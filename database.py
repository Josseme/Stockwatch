import sqlite3
import os

DB_PATH = 'inventory.db'

def get_connection():
    return sqlite3.connect(DB_PATH)

def initialize_database():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            quantity INTEGER NOT NULL,
            threshold INTEGER NOT NULL,
            price REAL NOT NULL,
            barcode TEXT UNIQUE
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            event_type TEXT NOT NULL, -- 'clock_in', 'clock_out'
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            qty_change INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY(item_id) REFERENCES inventory(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Run migration safely
    cursor.execute("PRAGMA table_info(transactions)")
    tx_columns = [col[1] for col in cursor.fetchall()]
    if "item_name" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN item_name TEXT")
        # Backfill item names for existing transactions
        cursor.execute('''
            UPDATE transactions SET item_name = (
                SELECT name FROM inventory WHERE inventory.id = transactions.item_id
            )
            WHERE item_name IS NULL
        ''')
        # If any item was already deleted, set a placeholder
        cursor.execute("UPDATE transactions SET item_name = 'Unknown Item' WHERE item_name IS NULL")
        
    if "unit_price" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN unit_price REAL")
        # Backfill unit_price from inventory
        cursor.execute('''
            UPDATE transactions SET unit_price = (
                SELECT price FROM inventory WHERE inventory.id = transactions.item_id
            )
            WHERE unit_price IS NULL
        ''')
        cursor.execute("UPDATE transactions SET unit_price = 0.0 WHERE unit_price IS NULL")
    cursor.execute("PRAGMA table_info(inventory)")
    columns = [col[1] for col in cursor.fetchall()]
    if "barcode" not in columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN barcode TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode)")
        
    # Default Admin Auto-Create
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_hash = "$2b$12$DXcfFJwkmhISYpGA1RVgE.HTOKmxMMFC7MeMvcS1ODccNEYUpwjum" # 'admin123'
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ("admin", default_hash, "admin"))

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_barcodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            barcode TEXT NOT NULL UNIQUE,
            FOREIGN KEY(item_id) REFERENCES inventory(id)
        )
    ''')
    
    # Migration: Move existing barcodes from inventory table to item_barcodes
    cursor.execute("SELECT id, barcode FROM inventory WHERE barcode IS NOT NULL")
    existing_barcodes = cursor.fetchall()
    for item_id, barcode in existing_barcodes:
        # Insert into new table if not already exists
        cursor.execute("INSERT OR IGNORE INTO item_barcodes (item_id, barcode) VALUES (?, ?)", (item_id, barcode))

    conn.commit()
    conn.close()

def add_item(name, quantity, threshold, price, user_id=None, barcode=None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO inventory (name, quantity, threshold, price, barcode)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, quantity, threshold, price, barcode))
        new_id = cursor.lastrowid
        
        # Also insert into the new multi-barcode table
        if barcode:
            cursor.execute('INSERT OR IGNORE INTO item_barcodes (item_id, barcode) VALUES (?, ?)', (new_id, barcode))
            
        # Log initial creation transaction if user_id is provided
        if user_id:
            cursor.execute('''
                INSERT INTO transactions (item_id, item_name, qty_change, user_id)
                VALUES (?, ?, ?, ?)
            ''', (new_id, name, quantity, user_id))
            
        conn.commit()
        return True, "Item added and initial stock logged."
    except sqlite3.IntegrityError as e:
        return False, "Item with this name already exists."
    finally:
        conn.close()

def update_quantity(item_id, new_quantity):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE inventory SET quantity = ? WHERE id = ?
    ''', (new_quantity, item_id))
    conn.commit()
    conn.close()

def get_all_items():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, quantity, threshold, price, barcode FROM inventory')
    items = cursor.fetchall()
    conn.close()
    return items

def get_item_by_id(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, quantity, threshold, price, barcode FROM inventory WHERE id = ?', (item_id,))
    item = cursor.fetchone()
    conn.close()
    return item

def get_item_by_barcode(barcode):
    conn = get_connection()
    cursor = conn.cursor()
    # Search in the new multi-barcode table first
    cursor.execute('''
        SELECT i.id, i.name, i.quantity, i.threshold, i.price, i.barcode 
        FROM inventory i
        JOIN item_barcodes ib ON i.id = ib.item_id
        WHERE ib.barcode = ?
    ''', (barcode,))
    item = cursor.fetchone()
    
    # Fallback to legacy column if not found (though migration should have handled it)
    if not item:
        cursor.execute('SELECT id, name, quantity, threshold, price, barcode FROM inventory WHERE barcode = ?', (barcode,))
        item = cursor.fetchone()
        
    conn.close()
    return item

def add_barcode_to_item(item_id, barcode):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO item_barcodes (item_id, barcode) VALUES (?, ?)', (item_id, barcode))
        conn.commit()
        return True, "Barcode linked successfully"
    except sqlite3.IntegrityError:
        return False, "This barcode is already assigned to a product"
    finally:
        conn.close()

def get_item_barcodes(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT barcode FROM item_barcodes WHERE item_id = ?', (item_id,))
    barcodes = [row[0] for row in cursor.fetchall()]
    conn.close()
    return barcodes

def delete_item(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM inventory WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()

def create_user(username, password_hash, role="cashier"):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', (username, password_hash, role))
        conn.commit()
        return True, "User created"
    except sqlite3.IntegrityError:
        return False, "Username exists"
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, password_hash, role FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT username, role FROM users')
    users = cursor.fetchall()
    conn.close()
    return users

def log_attendance(user_id, event_type="clock_in"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO attendance (user_id, event_type) VALUES (?, ?)', (user_id, event_type))
    conn.commit()
    conn.close()

def get_attendance_logs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.id, a.timestamp, u.username, a.event_type
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.timestamp DESC
    ''')
    logs = cursor.fetchall()
    conn.close()
    return logs

def get_live_users():
    conn = get_connection()
    cursor = conn.cursor()
    # Get the latest attendance event for each user and filter for 'clock_in'
    cursor.execute('''
        SELECT u.username, u.role, a.timestamp
        FROM users u
        JOIN attendance a ON u.id = a.user_id
        WHERE a.id IN (
            SELECT MAX(id)
            FROM attendance
            GROUP BY user_id
        )
        AND a.event_type = 'clock_in'
    ''')
    live = cursor.fetchall()
    conn.close()
    return live

def log_transaction_internal(cursor, item_id, item_name, qty_change, user_id):
    """Internal helper to log transaction using an existing cursor/connection."""
    # Fetch current price
    cursor.execute("SELECT price FROM inventory WHERE id = ?", (item_id,))
    price_row = cursor.fetchone()
    price = price_row[0] if price_row else 0.0
    
    cursor.execute('''
        INSERT INTO transactions (item_id, item_name, qty_change, user_id, unit_price) 
        VALUES (?, ?, ?, ?, ?)
    ''', (item_id, item_name, qty_change, user_id, price))

def log_transaction(item_id, item_name, qty_change, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        log_transaction_internal(cursor, item_id, item_name, qty_change, user_id)
        conn.commit()
    finally:
        conn.close()

def get_all_transactions():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.id, t.timestamp, t.item_name, t.qty_change, u.username, t.unit_price
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        ORDER BY t.timestamp DESC
    ''')
    txs = cursor.fetchall()
    conn.close()
    return txs

def get_daily_report():
    conn = get_connection()
    cursor = conn.cursor()
    # Calculate daily totals
    # Sales: qty_change < 0
    # Restock: qty_change > 0
    cursor.execute('''
        SELECT 
            DATE(timestamp) as day,
            SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) * unit_price ELSE 0 END) as total_sales,
            SUM(CASE WHEN qty_change > 0 THEN qty_change * unit_price ELSE 0 END) as total_restock
        FROM transactions
        GROUP BY day
        ORDER BY day DESC
    ''')
    report = cursor.fetchall()
    conn.close()
    return report

def process_checkout(items_to_update, user_id):
    """
    items_to_update: List of dicts like {'item_id': 1, 'item_name': 'Apple', 'qty_change': -2}
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION")
        for update in items_to_update:
            item_id = update['item_id']
            item_name = update['item_name']
            delta = update['qty_change']
            
            # Fetch current price for snapshot
            cursor.execute("SELECT price FROM inventory WHERE id = ?", (item_id,))
            price_row = cursor.fetchone()
            price = price_row[0] if price_row else 0.0
            
            # 1. Update Inventory
            cursor.execute("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", (delta, item_id))
            
            # 2. Log Transaction with Item Name Snapshot and Price
            cursor.execute('''
                INSERT INTO transactions (item_id, item_name, qty_change, user_id, unit_price) 
                VALUES (?, ?, ?, ?, ?)
            ''', (item_id, item_name, delta, user_id, price))
        
        conn.commit()
        return True, "Checkout processed successfully"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()
