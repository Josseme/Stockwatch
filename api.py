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
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup CORS for Local Network Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Expand to allow local network scanning from mobile
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
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
    price: float = Field(..., le=9999999, description="Price cannot exceed 9.9M to prevent accidental barcode scans")
    cost_price: float = Field(0.0, le=9999999)
    barcode: Optional[str] = None
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

class BarcodeData(BaseModel):
    barcode: str
    
class SecurityLogCreate(BaseModel):
    action_type: str
    item_name: Optional[str] = None

class CustomerCreate(BaseModel):
    phone: str
    name: str

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

@app.get("/api/auth/users")
def list_users(current_user: dict = Depends(require_admin)):
    users = get_all_users()
    return [{"username": u[0], "role": u[1]} for u in users]

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
    
    token = jwt.encode({"sub": user[1], "role": user[3]}, SECRET_KEY, algorithm=ALGORITHM)
    # Log automated clock-in
    log_attendance(user[0], "clock_in")
    
    return {"access_token": token, "token_type": "bearer", "role": user[3]}

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

    success, msg = process_checkout(items_list, current_user['id'], customer_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    # Broadcast refresh to all dashboards
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Run low stock checks in background
    for iid in ids_to_check:
        background_tasks.add_task(check_low_stock, iid)
        
    return {"message": "Checkout completed successfully"}

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
        "sale_days": sale_days
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
    success, msg = add_item(item.name, item.quantity, item.threshold, item.price, item.cost_price, current_user['id'], item.barcode, item.supplier_contact, item.sale_price, item.sale_start, item.sale_end, item.sale_days)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    # Broadcast refresh
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Check if this new item immediately requires an alert (in background)
    background_tasks.add_task(check_low_stock)
        
    return {"message": msg}

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
        
    if not updates:
        return {"message": "No changes provided"}

    params.append(item_id)
    query = f"UPDATE inventory SET {', '.join(updates)} WHERE id = ?"
    
    try:
        cursor.execute("BEGIN TRANSACTION")
        cursor.execute(query, params)
        
        # Log quantity changes if applicable
        if item.quantity is not None:
            delta = item.quantity - existing_item[2]
            if delta != 0:
                log_transaction_internal(cursor, item_id, item.name or existing_item[1], delta, current_user['id'])
        
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
    return [{"date": r[0], "sales": r[1], "restock": r[2], "profit": r[3]} for r in report]

@app.get("/api/reports/performance")
def performance_report(current_user: dict = Depends(get_current_user)):
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()
    # Get sales transactions count per user for today
    cursor.execute('''
        SELECT u.username, COUNT(t.id) as tx_count
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.qty_change < 0 AND DATE(t.timestamp) = DATE('now', 'localtime')
        GROUP BY u.id
        ORDER BY tx_count DESC
    ''')
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

@app.post("/api/mpesa/callback")
async def mpesa_callback(data: dict):
    # This is called by Safaricom
    print(f"MPESA CALLBACK RECEIVED: {data}")
    result_code = data.get("Body", {}).get("stkCallback", {}).get("ResultCode")
    merchant_request_id = data.get("Body", {}).get("stkCallback", {}).get("MerchantRequestID")
    
    if result_code == 0:
        # Payment Successful
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

@app.get("/api/reports/daily")
def get_daily_financial_report(current_user: dict = Depends(require_admin)):
    from database import get_daily_report
    report = get_daily_report()
    return [{"day": r[0], "total_sales": r[1], "total_restock": r[2], "gross_profit": r[3]} for r in report]

@app.get("/api/reports/security")
def get_security_audit_logs(current_user: dict = Depends(require_admin)):
    from database import get_security_logs
    return get_security_logs(limit=100)

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
