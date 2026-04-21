from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()
from pydantic import BaseModel
from typing import List, Optional
import os
import jwt
import bcrypt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, BackgroundTasks
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
    create_user
)
from tracker import check_low_stock, send_email_alert

# Initialize FastAPI app
app = FastAPI(title="Stockwatch API")

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
    price: float
    barcode: Optional[str] = None

class ItemUpdate(BaseModel):
    quantity: int

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "cashier"

class CheckoutItem(BaseModel):
    item_id: int
    qty_change: int

# Startup event to ensure DB is initialized
@app.on_event("startup")
def startup_event():
    initialize_database()

# Endpoints
@app.post("/api/auth/register")
def register(user: UserCreate):
    from database import create_user
    # Using unified get_password_hash
    success, msg = create_user(user.username.strip(), get_password_hash(user.password), user.role)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": "User registered successfully"}

@app.get("/api/auth/users")
def list_users():
    users = get_all_users()
    return [{"username": u[0], "role": u[1]} for u in users]

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    from database import get_user_by_username
    username = form_data.username.strip()
    user = get_user_by_username(username)
    
    if not user:
        print(f"LOGIN FAILED: User '{username}' not found in DB")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if not verify_password(form_data.password, user[2]):
        print(f"LOGIN FAILED: Password mismatch for user '{username}'. Provided password length: {len(form_data.password)}")
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
def get_transactions(current_user: dict = Depends(get_current_user)):
    from database import get_all_transactions
    txs = get_all_transactions()
    return [{"id": t[0], "timestamp": t[1], "item_name": t[2], "qty_change": t[3], "username": t[4]} for t in txs]

@app.post("/api/inventory/checkout")
def checkout(cart_items: List[CheckoutItem], background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    # Prepare items list with names for transaction logging
    items_list = []
    ids_to_check = []
    for ci in cart_items:
        item = get_item_by_id(ci.item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {ci.item_id} not found")
        items_list.append({"item_id": ci.item_id, "item_name": item[1], "qty_change": ci.qty_change})
        ids_to_check.append(ci.item_id)

    success, msg = process_checkout(items_list, current_user['id'])
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    # Broadcast refresh to all dashboards
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Run low stock checks in background
    for iid in ids_to_check:
        background_tasks.add_task(check_low_stock, iid)
        
    return {"message": "Checkout completed successfully"}

@app.post("/api/admin/test-email")
def test_email(background_tasks: BackgroundTasks):
    """Triggers a test email alert to verify SMTP settings."""
    background_tasks.add_task(send_email_alert, "Test Item", 5, 10)
    return {"message": "Test email triggered. Check logs/email_errors.log for status."}

@app.get("/api/inventory", response_model=List[dict])
def read_inventory(current_user: dict = Depends(get_current_user)):
    items = get_all_items()
    # Convert tuples to dicts for easier frontend handling
    result = [
        {
            "id": item[0],
            "name": item[1],
            "quantity": item[2],
            "threshold": item[3],
            "price": item[4],
            "barcode": item[5] if len(item) > 5 else None
        }
        for item in items
    ]
    return result

@app.post("/api/inventory")
def create_item(item: ItemCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    success, msg = add_item(item.name, item.quantity, item.threshold, item.price, current_user['id'], item.barcode)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    # Broadcast refresh
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Check if this new item immediately requires an alert (in background)
    background_tasks.add_task(check_low_stock)
        
    return {"message": msg}

@app.put("/api/inventory/{item_id}")
def update_item(item_id: int, item: ItemUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(require_admin)):
    existing_item = get_item_by_id(item_id)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    delta = item.quantity - existing_item[2]
    update_quantity(item_id, item.quantity)
    
    if delta != 0:
        log_transaction(item_id, existing_item[1], delta, current_user['id'])
    
    # Broadcast refresh
    background_tasks.add_task(manager.broadcast, {"type": "REFRESH_INVENTORY"})
    
    # Check for low stock alert after updating (in background)
    background_tasks.add_task(check_low_stock, item_id)
        
    return {"message": f"Item quantity updated to {item.quantity}"}

@app.delete("/api/inventory/{item_id}")
def delete_item_route(item_id: int, current_user: dict = Depends(require_admin)):
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

@app.get("/api/scan/{barcode}")
def scan_item(barcode: str, current_user: dict = Depends(get_current_user)):
    from database import get_item_by_barcode
    item = get_item_by_barcode(barcode)
    if not item:
        raise HTTPException(status_code=404, detail="Item with this barcode not found")
        
    return {
        "id": item[0],
        "name": item[1],
        "quantity": item[2],
        "threshold": item[3],
        "price": item[4],
        "barcode": item[5] if len(item) > 5 else None
    }
