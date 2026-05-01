from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import jwt
import bcrypt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, BackgroundTasks, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from mpesa import MpesaGateway
from database import (
    initialize_database,
    add_item,
    update_quantity,
    get_all_items,
    get_item_by_id,
    get_item_by_barcode,
    delete_item,
    get_user_by_username,
    get_all_users,
    log_attendance,
    get_attendance_logs,
    log_transaction,
    get_all_transactions,
    get_live_users,
    process_checkout,
    create_user,
    log_security_event
)
from tracker import check_low_stock, send_email_alert

# Initialize FastAPI app
app = FastAPI(title="Stockwatch API")
app.add_middleware(GZipMiddleware, minimum_size=1000) # Compress responses > 1KB
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup CORS for Local Network Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "online", "message": "Stockwatch API is running"}

# Real-time synchronization manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                continue

manager = ConnectionManager()

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait for any data (or keepalive) from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# Security Config
SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-stockwatch-enterprise-jwt-key")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    try:
        # Diagnostic logging for debug mode
        if not hashed_password or not isinstance(hashed_password, str):
             print(f"AUTH ERROR: Incompatible hash format received: {type(hashed_password)}")
             return False
             
        # bcrypt.checkpw expects bytes
        result = bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        if not result:
            print("DEBUG: Password verification failed (mismatch)")
        return result
    except Exception as e:
        print(f"AUTH CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_password_hash(password: str):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = get_user_by_username(username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user[0], "username": user[1], "role": user[3]}

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

# Models
class Item(BaseModel):
    id: int
    name: str
    quantity: int
    threshold: int
    price: float
    barcode: Optional[str] = None

class ItemCreate(BaseModel):
    name: str
    quantity: int
    threshold: int
    price: float = Field(..., le=9999999)
    cost_price: float = Field(0.0, le=9999999)
    barcode: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    expiry_date: Optional[str] = None
    unit_measure: Optional[str] = "pcs"
    supplier_contact: Optional[str] = None
    sale_price: Optional[float] = Field(None, le=9999999)
    sale_start: Optional[str] = None
    sale_end: Optional[str] = None
    sale_days: Optional[str] = None

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    threshold: Optional[int] = None
    price: Optional[float] = Field(None, le=9999999)
    cost_price: Optional[float] = Field(None, le=9999999)
    barcode: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    expiry_date: Optional[str] = None
    unit_measure: Optional[str] = None
    supplier_contact: Optional[str] = None
    sale_price: Optional[float] = Field(None, le=9999999)
    sale_start: Optional[str] = None
    sale_end: Optional[str] = None
    sale_days: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "cashier"

class CheckoutItem(BaseModel):
    item_id: int
    qty_change: int

class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]
    customer_phone: Optional[str] = None
    payment_method: str = "Cash" # 'Cash', 'M-Pesa', 'Credit'

class BarcodeData(BaseModel):
    barcode: str
    
class SecurityLogCreate(BaseModel):
    action_type: str
    item_name: Optional[str] = None

class PaystackInitializeRequest(BaseModel):
    email: str
    amount: float

class CustomerCreate(BaseModel):
    phone: str
    name: str

class DebtPaymentRequest(BaseModel):
    amount: float
    method: str

class ShopSettingsUpdate(BaseModel):
    owner_phone: str
    vat_rate: float
    shop_name: Optional[str] = None
    tax_id: Optional[str] = None
    shop_location: Optional[str] = None
    shop_email: Optional[str] = None
    shop_footer: Optional[str] = None
    currency: Optional[str] = None
    low_stock_threshold: Optional[int] = 20
    enable_email_alerts: Optional[bool] = False
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    smtp_sender: Optional[str] = None
    auto_backup: Optional[bool] = True
    timezone: Optional[str] = "Africa/Nairobi"

# Startup event to ensure DB is initialized
@app.on_event("startup")
def startup_event():
    initialize_database()

# Endpoints
@app.post("/api/auth/register")
@limiter.limit("5/minute")
def register(request: Request, user: UserCreate, current_user: dict = Depends(require_admin)):
    from database import create_user
    # Using unified get_password_hash
    success, msg = create_user(user.username.strip(), get_password_hash(user.password), user.role)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": "User registered successfully"}


@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    from database import get_user_by_username
    username = form_data.username.strip()
    user = get_user_by_username(username)
    
    if not user:
        log_security_event(None, "FAILED_LOGIN_ATTEMPT", f"User: {username}")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if not verify_password(form_data.password, user[2]):
        log_security_event(user[0], "FAILED_LOGIN_ATTEMPT", "Incorrect password")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if not user[4]: # is_active
        log_security_event(user[0], "BLOCKED_LOGIN_ATTEMPT", f"User: {username}")
        raise HTTPException(status_code=403, detail="Your account has been blocked. Contact administrator.")
    
    token = jwt.encode({"sub": user[1], "role": user[3]}, SECRET_KEY, algorithm=ALGORITHM)
    # Log automated clock-in
    log_attendance(user[0], "clock_in")
    
    return {"access_token": token, "token_type": "bearer", "role": user[3]}

@app.get("/api/ping")
def ping_africa():
    """Diagnostic endpoint to check system latency and regional status."""
    import time
    start = time.time()
    # Simulate a check or just return status
    latency = (time.time() - start) * 1000
    return {
        "status": "online",
        "region": "Africa/Nairobi",
        "latency_ms": round(latency, 2),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/attendance")
def attendance_logs(current_user: dict = Depends(require_admin)):
    logs = get_attendance_logs()
    return [{"id": l[0], "timestamp": l[1], "username": l[2], "event_type": l[3]} for l in logs]

@app.get("/api/auth/live-status")
def live_status(current_user: dict = Depends(get_current_user)):
    # Note: We restrict visibility on the FRONTEND, but the API can be accessible to all AUTHENTICATED users for internal sync
    live = get_live_users()
    return [{"username": u[0], "role": u[1], "since": u[2]} for u in live]

@app.post("/api/auth/logout")
def logout(current_user: dict = Depends(get_current_user)):
    # We already have the user ID from the dependency
    if "id" in current_user:
        log_attendance(current_user["id"], "clock_out")
        return {"message": "Clocked out successfully"}
    
    # Fallback to username lookup if ID somehow missing
    user = get_user_by_username(current_user.get("username"))
    if user:
        log_attendance(user[0], "clock_out")
    return {"message": "Clocked out successfully"}

@app.get("/api/transactions")
def get_transactions(current_user: dict = Depends(require_admin)):
    from database import get_all_transactions
    txs = get_all_transactions()
    return [{"id": t[0], "timestamp": t[1], "item_name": t[2], "qty_change": t[3], "username": t[4], "unit_price": t[5]} for t in txs]

@app.get("/api/orders")
def read_orders(limit: int = 50, offset: int = 0, current_user: dict = Depends(require_admin)):
    from database import get_orders
    return get_orders(limit, offset)

@app.get("/api/orders/{order_id}")
def read_order(order_id: int, current_user: dict = Depends(require_admin)):
    from database import get_order_details
    order = get_order_details(order_id)
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/orders/{order_id}/refund")
def refund_order(order_id: int, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    from database import get_order_details, get_connection
    order = get_order_details(order_id)
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") == "Refunded": raise HTTPException(status_code=400, detail="Order already refunded")
    
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION")
        # 1. Update order status
        cursor.execute("UPDATE orders SET status = 'Refunded' WHERE id = ?", (order_id,))
        
        # 2. Restore inventory quantities
        for item in order["items"]:
            cursor.execute("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", (item["qty"], item["item_id"]))
            # Log the restoration as a transaction
            from database import log_transaction_internal
            log_transaction_internal(cursor, item["item_id"], item["name"], item["qty"], current_user['id'], order_id=order_id)
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
        
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    return {"message": "Order refunded and stock restored"}

@app.post("/api/inventory/checkout")
def checkout(request: CheckoutRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    from database import get_or_create_customer
    
    # Prepare items list with names for transaction logging
    items_list = []
    ids_to_check = []
    for ci in request.items:
        item = get_item_by_id(ci.item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {ci.item_id} not found")
        items_list.append({"item_id": ci.item_id, "item_name": item[1], "qty_change": ci.qty_change})
        ids_to_check.append(ci.item_id)

    customer_id = None
    if request.customer_phone:
        customer_id = get_or_create_customer(request.customer_phone.strip())

    success, result = process_checkout(items_list, current_user['id'], customer_id, request.payment_method)
    if not success:
        raise HTTPException(status_code=400, detail=result)
    
    # Enrich receipt with shop details
    from database import get_license_status
    shop = get_license_status()
    if shop:
        result.update({
            "shop_name": shop.get("shop_name"),
            "shop_location": shop.get("shop_location"),
            "shop_email": shop.get("shop_email"),
            "shop_footer": shop.get("shop_footer"),
            "tax_id": shop.get("tax_id"),
            "currency": shop.get("currency", "Ksh")
        })

    # Broadcast refresh to all dashboards
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Run low stock checks in background
    for iid in ids_to_check:
        background_tasks.add_task(check_low_stock, iid)
        
    return result

@app.post("/api/admin/test-email")
def test_email(background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    """Triggers a test email alert to verify SMTP settings."""
    background_tasks.add_task(send_email_alert, "Test Item", 5, 10)
    return {"message": "Test email triggered. Check logs/email_errors.log for status."}

from datetime import datetime

def format_item_response(item, get_item_barcodes):
    base_price = item[4]
    sale_price = item[8]
    sale_start = item[9]
    sale_end = item[10]
    sale_days = item[11]
    
    is_on_sale = False
    active_price = base_price
    
    if sale_price is not None and sale_start and sale_end and sale_days:
        now = datetime.now()
        current_day = now.strftime("%A")[:3] # 'Mon', 'Tue'
        if current_day in sale_days:
            current_time = now.strftime("%H:%M")
            if sale_start <= current_time <= sale_end:
                active_price = sale_price
                is_on_sale = True

    return {
        "id": item[0],
        "name": item[1],
        "quantity": item[2],
        "threshold": item[3],
        "price": active_price,
        "original_price": base_price,
        "is_on_sale": is_on_sale,
        "barcodes": get_item_barcodes(item[0]),
        "cost_price": item[6],
        "supplier_contact": item[7],
        "sale_price": sale_price,
        "sale_start": sale_start,
        "sale_end": sale_end,
        "sale_days": sale_days,
        "category_id": item[12],
        "sku": item[13],
        "expiry_date": item[14],
        "unit_measure": item[15],
        "supplier_id": item[16]
    }

@app.get("/api/inventory")
def read_inventory(current_user: dict = Depends(get_current_user)):
    from database import get_all_items, get_item_barcodes
    items = get_all_items()
    resp = [format_item_response(item, get_item_barcodes) for item in items]
    if current_user.get("role") != "admin":
        for item in resp:
            item["cost_price"] = None
    return resp

@app.post("/api/inventory")
def create_item(item: ItemCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    success, msg = add_item(
        item.name, item.quantity, item.threshold, item.price, item.cost_price, 
        current_user['id'], item.barcode, item.supplier_contact, item.sale_price, 
        item.sale_start, item.sale_end, item.sale_days, 
        item.category_id, item.sku, item.expiry_date, item.unit_measure, item.supplier_id
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    # Broadcast refresh
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    return {"message": msg}

@app.post("/api/inventory/bulk")
def bulk_create_items(items: List[ItemCreate], background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    from database import add_item
    success_count = 0
    errors = []
    for item in items:
        success, msg = add_item(
            item.name, item.quantity, item.threshold, item.price, item.cost_price, 
            current_user['id'], item.barcode, item.supplier_contact, item.sale_price, 
            item.sale_start, item.sale_end, item.sale_days, 
            item.category_id, item.sku, item.expiry_date, item.unit_measure, item.supplier_id
        )
        if success:
            success_count += 1
        else:
            errors.append(f"{item.name}: {msg}")
    
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    return {"message": f"Successfully imported {success_count} items", "errors": errors}

@app.get("/api/inventory/barcodes")
def list_all_barcodes(current_user: dict = Depends(get_current_user)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT i.name, b.barcode FROM inventory i JOIN barcodes b ON i.id = b.item_id')
    rows = cursor.fetchall()
    conn.close()
    return [{"name": r[0], "barcode": r[1]} for r in rows]

@app.put("/api/inventory/{item_id}")
def update_item(item_id: int, item: ItemUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    from database import get_connection, log_transaction_internal
    existing_item = get_item_by_id(item_id)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Permission Check: Only admins can change core details
    is_admin = current_user["role"] == "admin"
    if not is_admin:
        if any([item.name, item.threshold, item.price, item.cost_price, item.barcode, item.supplier_contact, item.sale_price, item.sale_start, item.sale_end, item.sale_days]):
            raise HTTPException(status_code=403, detail="Staff can only update quantity.")
            
    conn = get_connection()
    cursor = conn.cursor()
    
    updates = []
    params = []
    if item.name is not None:
        updates.append("name = ?")
        params.append(item.name)
    if item.quantity is not None:
        updates.append("quantity = ?")
        params.append(item.quantity)
    if item.threshold is not None:
        updates.append("threshold = ?")
        params.append(item.threshold)
    if item.price is not None:
        updates.append("price = ?")
        params.append(item.price)
    if item.cost_price is not None:
        updates.append("cost_price = ?")
        params.append(item.cost_price)
    if item.barcode is not None:
        updates.append("barcode = ?")
        params.append(item.barcode.strip() if item.barcode else None)
    if item.supplier_contact is not None:
        updates.append("supplier_contact = ?")
        params.append(item.supplier_contact)
    if item.sale_price is not None:
        updates.append("sale_price = ?")
        params.append(item.sale_price)
    if item.sale_start is not None:
        updates.append("sale_start = ?")
        params.append(item.sale_start)
    if item.sale_end is not None:
        updates.append("sale_end = ?")
        params.append(item.sale_end)
    if item.sale_days is not None:
        updates.append("sale_days = ?")
        params.append(item.sale_days)
    if item.sku is not None:
        updates.append("sku = ?")
        params.append(item.sku)
    if item.category_id is not None:
        updates.append("category_id = ?")
        params.append(item.category_id)
    if item.supplier_id is not None:
        updates.append("supplier_id = ?")
        params.append(item.supplier_id)
    if item.expiry_date is not None:
        updates.append("expiry_date = ?")
        params.append(item.expiry_date)
    if item.unit_measure is not None:
        updates.append("unit_measure = ?")
        params.append(item.unit_measure)
        
    if not updates:
        return {"message": "No changes provided"}

    params.append(item_id)
    query = f"UPDATE inventory SET {', '.join(updates)} WHERE id = ?"
    
    try:
        cursor.execute("BEGIN TRANSACTION")
        
        # Get customer phone if available
        if item.quantity is not None:
            delta = item.quantity - existing_item[2]
            if delta != 0:
                log_transaction_internal(cursor, item_id, item.name or existing_item[1], delta, current_user['id'])
        
        cursor.execute(query, params)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"CRITICAL UPDATE ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        conn.close()
    
    # Broadcast refresh
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Check for low stock alert if quantity changed
    if item.quantity is not None:
        background_tasks.add_task(check_low_stock, item_id)
        
    return {"message": "Item updated successfully"}

@app.delete("/api/inventory/{item_id}")
def delete_item_route(item_id: int, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    existing_item = get_item_by_id(item_id)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Log deletion before actual removal
    log_transaction(item_id, existing_item[1], -existing_item[2], current_user['id'])
    delete_item(item_id)
    
    # Broadcast refresh
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    return {"message": "Item deleted successfully and logged in audit trail"}

@app.get("/api/inventory/alerts")
def run_alerts(current_user: dict = Depends(get_current_user)):
    check_low_stock()
    return {"message": "Alerts triggered successfully."}

@app.get("/api/reports/daily")
def daily_report(current_user: dict = Depends(require_admin)):
    from database import get_daily_report
    report = get_daily_report()
    # Updated to handle: date, sales, restock, profit, expenses
    return [{"date": r[0], "sales": r[1], "restock": r[2], "profit": r[3], "expenses": r[4]} for r in report]

@app.get("/api/reports/performance")
def performance_report(current_user: dict = Depends(get_current_user)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    # Get sales transactions count per user for today
    query = '''
        SELECT u.username, COUNT(t.id) as tx_count
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.qty_change < 0 AND DATE(t.timestamp) = DATE('now', 'localtime')
    '''
    params = []
    
    if current_user["role"] != "admin":
        query += " AND u.id = ?"
        params.append(current_user["id"])
        
    query += " GROUP BY u.id ORDER BY tx_count DESC"
    
    cursor.execute(query, params)
    perf = cursor.fetchall()
    conn.close()
    return [{"username": p[0], "transactions": p[1]} for p in perf]

@app.get("/api/inventory/insights")
def inventory_insights(current_user: dict = Depends(get_current_user)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    # Calculate avg daily sales over the last 7 days
    cursor.execute('''
        SELECT i.id, i.name, i.quantity,
               COALESCE(SUM(ABS(t.qty_change)) / 7.0, 0) as daily_burn_rate
        FROM inventory i
        LEFT JOIN transactions t ON i.id = t.item_id 
             AND t.qty_change < 0 
             AND t.timestamp >= datetime('now', '-7 days')
        GROUP BY i.id
    ''')
    data = cursor.fetchall()
    conn.close()
    
    insights = []
    for r in data:
        burn_rate = r[3]
        days_left = (r[2] / burn_rate) if burn_rate > 0 else 999
        insights.append({
            "id": r[0],
            "name": r[1],
            "quantity": r[2],
            "burn_rate": round(burn_rate, 2),
            "days_left": round(days_left, 1)
        })
    return insights

@app.post("/api/inventory/{item_id}/barcodes")
def link_barcode(item_id: int, data: BarcodeData, current_user: dict = Depends(get_current_user)):
    from database import add_barcode_to_item
    success, msg = add_barcode_to_item(item_id, data.barcode.strip())
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@app.post("/api/barcode/webhook")
async def barcode_webhook(data: dict, background_tasks: BackgroundTasks):
    """
    Receive barcode from external app and broadcast to frontend via WebSocket.
    Flexible enough to handle various scanner app formats (Barcode to PC, etc.)
    """
    # Try to find the barcode in common field names
    barcode = data.get("barcode") or data.get("text") or data.get("code") or data.get("data")
    
    # Handle cases where the app sends a list of scans
    if not barcode and "barcodes" in data and isinstance(data["barcodes"], list):
        if len(data["barcodes"]) > 0:
            first_item = data["barcodes"][0]
            barcode = first_item.get("barcode") or first_item.get("text")

    if not barcode:
        print(f"WEBHOOK RECEIVED BUT NO BARCODE FOUND: {data}")
        return {"status": "error", "message": "No barcode found in payload"}

    barcode = str(barcode).strip()
    print(f"WEBHOOK SUCCESS: Received barcode {barcode}")
    
    await manager.broadcast({"type": "BARCODE_SCANNED", "barcode": barcode})
    return {"status": "success", "barcode": barcode}

@app.get("/api/scan/{barcode}")
def scan_item(barcode: str, current_user: dict = Depends(get_current_user)):
    from database import get_item_by_barcode, get_item_barcodes
    item = get_item_by_barcode(barcode.strip())
    if not item:
        raise HTTPException(status_code=404, detail="Item with this barcode not found")
        
    return format_item_response(item, get_item_barcodes)

@app.post("/api/mpesa/stk-push")
async def mpesa_stk_push(data: dict, current_user: dict = Depends(get_current_user)):
    phone = data.get("phone")
    amount = data.get("amount")
    if not phone or not amount:
        raise HTTPException(status_code=400, detail="Phone and Amount required")
    
    gateway = MpesaGateway()
    success, response = gateway.stk_push(phone, amount)
    if success:
        return response
    raise HTTPException(status_code=500, detail=response)

@app.post("/api/paystack/initialize")
async def paystack_init(data: PaystackInitializeRequest, current_user: dict = Depends(get_current_user)):
    from paystack import PaystackGateway
    gateway = PaystackGateway()
    success, response = gateway.initialize_transaction(data.email, data.amount)
    if success:
        return response
    raise HTTPException(status_code=400, detail=response)

@app.get("/api/paystack/verify/{reference}")
async def paystack_verify(reference: str, current_user: dict = Depends(get_current_user)):
    from paystack import PaystackGateway
    gateway = PaystackGateway()
    success, response = gateway.verify_transaction(reference)
    if success:
        return response
    raise HTTPException(status_code=400, detail=response)

@app.get("/api/license/status")
def get_license(current_user: dict = Depends(get_current_user)):
    from database import get_license_status
    return get_license_status()

@app.post("/api/license/renew")
async def renew_license(current_user: dict = Depends(require_admin)):
    from database import get_license_status
    status = get_license_status()
    if not status: raise HTTPException(status_code=404, detail="Config not found")
    
    # Subscription fee is Ksh 4500
    gateway = MpesaGateway()
    success, response = gateway.stk_push(status['owner_phone'], 4500, account_ref="LICENSE")
    if success:
        return response
    raise HTTPException(status_code=500, detail=response)

@app.post("/api/mpesa/callback")
async def mpesa_callback(data: dict):
    # This is called by Safaricom
    print(f"MPESA CALLBACK RECEIVED: {data}")
    result_code = data.get("Body", {}).get("stkCallback", {}).get("ResultCode")
    merchant_request_id = data.get("Body", {}).get("stkCallback", {}).get("MerchantRequestID")
    
    # Check if this was a license payment
    # Daraja doesn't send AccountRef back in callback easily, 
    # but we can check the metadata or just broadcast and let frontend handle
    
    if result_code == 0:
        # Payment Successful
        # If we know it's a license, update DB
        # For now, let's look for a specific flag or amount
        amount = 0
        items = data.get("Body", {}).get("stkCallback", {}).get("CallbackMetadata", {}).get("Item", [])
        for item in items:
            if item.get("Name") == "Amount":
                amount = item.get("Value")
        
        if amount == 4500:
            from database import update_license_expiry
            update_license_expiry(30)
            await manager.broadcast({
                "type": "LICENSE_RENEWED",
                "message": "Subscription Renewed Successfully!"
            })
        else:
            await manager.broadcast({
                "type": "PAYMENT_SUCCESS",
                "merchant_request_id": merchant_request_id,
                "message": "M-Pesa Payment Received!"
            })
    else:
        # Payment Failed or Cancelled
        await manager.broadcast({
            "type": "PAYMENT_FAILED",
            "merchant_request_id": merchant_request_id,
            "message": "M-Pesa Payment Failed or Cancelled"
        })
    
    return {"ResultCode": 0, "ResultDesc": "Success"}

@app.get("/api/expenses")
def read_expenses(current_user: dict = Depends(require_admin)):
    from database import get_expenses
    return get_expenses()

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: str

@app.post("/api/expenses")
def create_expense(expense: ExpenseCreate, current_user: dict = Depends(require_admin)):
    from database import log_expense
    log_expense(expense.category, expense.amount, expense.description)
    return {"message": "Expense logged successfully"}

@app.get("/api/reports/security")
def get_security_audit_logs(current_user: dict = Depends(require_admin)):
    from database import get_security_logs
    return get_security_logs(limit=100)

@app.get("/api/reports/top-products")
def get_top_performing_products(current_user: dict = Depends(require_admin)):
    from database import get_top_products
    return get_top_products(limit=10)

@app.post("/api/security/log")
def log_security_event_api(log: SecurityLogCreate, current_user: dict = Depends(get_current_user)):
    from database import log_security_event
    log_security_event(current_user["id"], log.action_type, log.item_name)
    return {"status": "logged"}

@app.get("/api/security/logs")
def read_security_logs(limit: int = 50, current_user: dict = Depends(require_admin)):
    from database import get_security_logs
    return get_security_logs(limit)

@app.get("/api/customers/search")
def search_customers_api(q: str, current_user: dict = Depends(get_current_user)):
    from database import search_customers
    return search_customers(q)

@app.post("/api/customers")
def create_customer_api(data: CustomerCreate, current_user: dict = Depends(get_current_user)):
    from database import add_customer
    success, msg = add_customer(data.phone, data.name)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@app.get("/api/customers/{customer_id}/debts")
def read_customer_debts(customer_id: int, current_user: dict = Depends(get_current_user)):
    from database import get_customer_debts
    return get_customer_debts(customer_id)

@app.post("/api/customers/{customer_id}/payments")
def create_debt_payment(customer_id: int, data: DebtPaymentRequest, current_user: dict = Depends(get_current_user)):
    from database import record_debt_payment
    success, msg = record_debt_payment(customer_id, data.amount, data.method)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@app.get("/api/admin/settings")
def read_settings(current_user: dict = Depends(require_admin)):
    from database import get_license_status
    status = get_license_status()
    if not status: raise HTTPException(status_code=404, detail="Config not found")
    
    return {
        "owner_phone": status["owner_phone"],
        "shop_name": status.get("shop_name", "Stockwatch Enterprise"),
        "tax_id": status.get("tax_id", "PIN-000000000"),
        "vat_rate": status["vat_rate"],
        "license_expiry": status["expiry"],
        "shop_location": status.get("shop_location", "Nairobi, Kenya"),
        "shop_email": status.get("shop_email", "contact@stockwatch.com"),
        "shop_footer": status.get("shop_footer", "Thank you for shopping with us!"),
        "currency": status.get("currency", "Ksh"),
        "low_stock_threshold": status.get("low_stock_threshold", 20),
        "enable_email_alerts": status.get("enable_email_alerts", False),
        "smtp_host": status.get("smtp_host"),
        "smtp_port": status.get("smtp_port", 587),
        "smtp_user": status.get("smtp_user"),
        "smtp_pass": status.get("smtp_pass"),
        "smtp_sender": status.get("smtp_sender"),
        "auto_backup": status.get("auto_backup", True),
        "timezone": status.get("timezone", "Africa/Nairobi")
    }

@app.put("/api/admin/settings")
def update_settings(data: ShopSettingsUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    from database import update_shop_settings
    update_shop_settings(
        data.owner_phone, 
        data.vat_rate, 
        data.shop_name, 
        data.tax_id, 
        data.shop_location, 
        data.shop_email, 
        data.shop_footer, 
        data.currency,
        data.low_stock_threshold,
        data.enable_email_alerts,
        data.smtp_host,
        data.smtp_port,
        data.smtp_user,
        data.smtp_pass,
        data.smtp_sender,
        data.auto_backup,
        data.timezone
    )
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_SETTINGS"})
    return {"message": "Settings updated successfully"}

@app.get("/api/admin/users")
def list_users(current_user: dict = Depends(require_admin)):
    from database import get_all_users
    return get_all_users()

@app.post("/api/admin/users/{user_id}/toggle")
def toggle_user(user_id: int, data: dict, current_user: dict = Depends(require_admin)):
    from database import toggle_user_status
    status = data.get("is_active")
    toggle_user_status(user_id, status)
    return {"message": "User status updated"}

@app.put("/api/admin/users/{user_id}")
def update_user_data(user_id: int, data: dict, current_user: dict = Depends(require_admin)):
    from database import update_user_profile
    role = data.get("role")
    permissions = data.get("permissions")
    # Permissions should be a JSON string if stored as TEXT
    import json
    perms_str = json.dumps(permissions) if permissions is not None else None
    update_user_profile(user_id, role=role, permissions=perms_str)
    return {"message": "User profile updated"}

@app.delete("/api/admin/users/{user_id}")
def remove_user(user_id: int, current_user: dict = Depends(require_admin)):
    from database import delete_user
    # Don't allow deleting self
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    delete_user(user_id)
    return {"message": "User deleted successfully"}

@app.get("/api/reports/tax")
def get_tax_collected_report(current_user: dict = Depends(require_admin)):
    from database import get_tax_report
    return get_tax_report()

@app.get("/api/reports/dead-stock")
def get_dead_stock(current_user: dict = Depends(require_admin)):
    from database import get_dead_stock_analysis
    return get_dead_stock_analysis()

@app.get("/api/reports/staff-performance")
def get_staff_performance_report(current_user: dict = Depends(require_admin)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.username, u.role, 
               COUNT(o.id) as total_orders, 
               SUM(o.total_amount) as total_revenue,
               AVG(o.total_amount) as avg_order_value
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id
        ORDER BY total_revenue DESC
    ''')
    perf = cursor.fetchall()
    conn.close()
    return [{
        "username": p[0], "role": p[1], "orders": p[2], 
        "revenue": p[3] or 0, "aov": round(p[4] or 0, 2)
    } for p in perf]

@app.get("/api/reports/expiry-risk")
def report_expiry_risk(days: int = 30, current_user: dict = Depends(require_admin)):
    from database import get_expiry_risk
    return get_expiry_risk(days)

@app.post("/api/inventory/clearance")
def apply_clearance_discount(item_ids: list[int], discount_percent: float, current_user: dict = Depends(require_admin)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f"UPDATE inventory SET price = price * (1 - ?) WHERE id IN ({','.join(map(str, item_ids))})", (discount_percent / 100,))
        conn.commit()
        return {"message": f"Applied {discount_percent}% discount to {len(item_ids)} items"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@app.get("/api/dashboard/analytics")
def get_dashboard_analytics(current_user: dict = Depends(require_admin)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Sales Trends (Last 7 Days)
    cursor.execute('''
        SELECT DATE(timestamp) as day, SUM(total_amount) as revenue
        FROM orders
        WHERE timestamp >= date('now', '-7 days')
        GROUP BY day ORDER BY day ASC
    ''')
    trends = [{"day": r[0], "revenue": r[1]} for r in cursor.fetchall()]
    
    # 2. Category Distribution
    cursor.execute('''
        SELECT c.name, SUM(ABS(t.qty_change) * t.unit_price) as total_sales
        FROM transactions t
        JOIN inventory i ON t.item_id = i.id
        JOIN categories c ON i.category_id = c.id
        WHERE t.qty_change < 0
        GROUP BY c.id
    ''')
    categories = [{"name": r[0], "value": r[1]} for r in cursor.fetchall()]
    
    # 3. Staff Performance (Top 5)
    cursor.execute('''
        SELECT u.username, COUNT(o.id) as orders_count, SUM(o.total_amount) as total_sales
        FROM orders o
        JOIN users u ON o.user_id = u.id
        GROUP BY u.id
        ORDER BY total_sales DESC
        LIMIT 5
    ''')
    staff = [{"username": r[0], "orders": r[1], "sales": r[2]} for r in cursor.fetchall()]
    
    # 4. Summary Metrics
    cursor.execute('''
        SELECT 
            SUM(total_amount), 
            COUNT(id), 
            AVG(total_amount),
            (SELECT SUM(ABS(qty_change) * (unit_price - unit_cost)) FROM transactions WHERE qty_change < 0 AND timestamp >= date('now', 'start of day', 'localtime'))
        FROM orders 
        WHERE timestamp >= date('now', 'start of day', 'localtime')
    ''')
    today_row = cursor.fetchone()
    
    conn.close()
    
    return {
        "trends": trends,
        "categories": categories,
        "staff": staff,
        "today": {
            "revenue": today_row[0] or 0,
            "orders": today_row[1] or 0,
            "aov": round(today_row[2] or 0, 2),
            "profit": today_row[3] or 0
        }
    }

@app.get("/api/categories")
def read_categories(current_user: dict = Depends(get_current_user)):
    from database import get_all_categories
    return get_all_categories()

@app.post("/api/categories")
def create_category(data: dict, current_user: dict = Depends(require_admin)):
    from database import add_category
    success, msg = add_category(data.get("name"), data.get("description"))
    if not success: raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@app.get("/api/suppliers")
def read_suppliers(current_user: dict = Depends(require_admin)):
    from database import get_all_suppliers
    return get_all_suppliers()

@app.post("/api/suppliers")
def create_supplier(data: dict, current_user: dict = Depends(require_admin)):
    from database import add_supplier
    success, msg = add_supplier(data.get("name"), data.get("contact"), data.get("phone"), data.get("email"), data.get("address"))
    if not success: raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}
