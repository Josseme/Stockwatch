import sqlite3
import os
from datetime import datetime, timedelta

# Check for Turso / LibSQL environment variables
TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

if TURSO_URL:
    import libsql as libsql
    print(f"DATABASE: Using Cloud Turso DB ({TURSO_URL[:15]}...)")
else:
    libsql = None
    print("DATABASE: Using Local SQLite (inventory.db)")

DB_PATH = 'inventory.db'

def get_connection():
    if TURSO_URL and libsql:
        # Connect to Turso Cloud
        return libsql.connect(TURSO_URL, auth_token=TURSO_TOKEN)
    
    # Fallback to Local SQLite
    conn = sqlite3.connect(DB_PATH)
    # Enable WAL mode for better concurrency and performance at scale
    conn.execute('PRAGMA journal_mode=WAL')
    # Performance optimizations for large datasets
    conn.execute('PRAGMA synchronous=NORMAL')
    conn.execute('PRAGMA cache_size=-64000') # 64MB cache
    conn.execute('PRAGMA foreign_keys=ON')
    return conn

def backfill_transaction_costs(cursor):
    """Backfills unit_cost in transactions table from current inventory cost_price if missing."""
    print("AUDIT: Starting transaction cost backfill...")
    cursor.execute('''
        UPDATE transactions 
        SET unit_cost = (SELECT cost_price FROM inventory WHERE inventory.id = transactions.item_id)
        WHERE (unit_cost IS NULL OR unit_cost = 0.0)
        AND EXISTS (SELECT 1 FROM inventory WHERE inventory.id = transactions.item_id AND inventory.cost_price > 0)
    ''')
    print(f"AUDIT: Backfill complete. Rows affected: {cursor.rowcount}")

def initialize_database():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Core Independent Tables
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
            role TEXT NOT NULL,
            permissions TEXT,
            is_active BOOLEAN DEFAULT 1
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL UNIQUE,
            name TEXT,
            points INTEGER DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shop_config (
            id INTEGER PRIMARY KEY,
            license_expiry TEXT,
            owner_phone TEXT,
            shop_name TEXT DEFAULT 'Stockwatch Enterprise',
            shop_location TEXT DEFAULT 'Nairobi, Kenya',
            shop_email TEXT DEFAULT 'contact@stockwatch.com',
            shop_footer TEXT DEFAULT 'Thank you for shopping with us!',
            currency TEXT DEFAULT 'Ksh',
            tax_id TEXT DEFAULT 'PIN-000000000',
            vat_rate REAL DEFAULT 16.0,
            low_stock_threshold INTEGER DEFAULT 20,
            enable_email_alerts BOOLEAN DEFAULT 0,
            smtp_host TEXT,
            smtp_port INTEGER DEFAULT 587,
            smtp_user TEXT,
            smtp_pass TEXT,
            smtp_sender TEXT,
            auto_backup BOOLEAN DEFAULT 1,
            timezone TEXT DEFAULT 'Africa/Nairobi',
            is_active BOOLEAN DEFAULT 1
        )
    ''')

    # 2. Dependent Tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            event_type TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            amount REAL,
            description TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customer_debts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_paid BOOLEAN DEFAULT 0,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS debt_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
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

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_barcodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            barcode TEXT NOT NULL UNIQUE,
            FOREIGN KEY(item_id) REFERENCES inventory(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            action_type TEXT NOT NULL,
            item_name TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL NOT NULL,
            vat_amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            customer_id INTEGER,
            user_id INTEGER NOT NULL,
            points_earned INTEGER DEFAULT 0,
            status TEXT DEFAULT 'completed', -- 'completed', 'refunded', 'void'
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sku TEXT UNIQUE,
            price REAL NOT NULL,
            quantity INTEGER DEFAULT 0,
            FOREIGN KEY(parent_id) REFERENCES inventory(id)
        )
    ''')

    # Add migration columns for inventory
    cursor.execute("PRAGMA table_info(inventory)")
    inv_columns = [col[1] for col in cursor.fetchall()]
    if "category_id" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN category_id INTEGER")
    if "sku" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN sku TEXT")
    if "expiry_date" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN expiry_date TEXT")
    if "unit_measure" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN unit_measure TEXT DEFAULT 'pcs'")
    if "supplier_id" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN supplier_id INTEGER")

    # Add migration columns for transactions
    cursor.execute("PRAGMA table_info(transactions)")
    tx_columns = [col[1] for col in cursor.fetchall()]
    if "order_id" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN order_id INTEGER")
        
    # 3. Existing Migrations & Seed Data
    cursor.execute("PRAGMA table_info(transactions)")
    tx_columns = [col[1] for col in cursor.fetchall()]
    if "item_name" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN item_name TEXT")
        cursor.execute("UPDATE transactions SET item_name = (SELECT name FROM inventory WHERE inventory.id = transactions.item_id) WHERE item_name IS NULL")
        cursor.execute("UPDATE transactions SET item_name = 'Unknown Item' WHERE item_name IS NULL")
        
    if "unit_price" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN unit_price REAL")
        cursor.execute("UPDATE transactions SET unit_price = (SELECT price FROM inventory WHERE inventory.id = transactions.item_id) WHERE unit_price IS NULL")
        cursor.execute("UPDATE transactions SET unit_price = 0.0 WHERE unit_price IS NULL")
        
    if "unit_cost" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN unit_cost REAL DEFAULT 0.0")
        
    if "customer_id" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN customer_id INTEGER")
        
    if "payment_method" not in tx_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT 'Cash'")

    cursor.execute("PRAGMA table_info(users)")
    user_columns = [col[1] for col in cursor.fetchall()]
    if "permissions" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN permissions TEXT")
    if "is_active" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")

    cursor.execute("PRAGMA table_info(shop_config)")
    config_columns = [col[1] for col in cursor.fetchall()]
    if "vat_rate" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN vat_rate REAL DEFAULT 16.0")
    if "shop_name" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN shop_name TEXT DEFAULT 'Stockwatch Enterprise'")
    if "tax_id" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN tax_id TEXT DEFAULT 'PIN-000000000'")
    if "shop_location" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN shop_location TEXT DEFAULT 'Nairobi, Kenya'")
    if "shop_email" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN shop_email TEXT DEFAULT 'contact@stockwatch.com'")
    if "shop_footer" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN shop_footer TEXT DEFAULT 'Thank you for shopping with us!'")
    if "currency" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN currency TEXT DEFAULT 'Ksh'")
    if "low_stock_threshold" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN low_stock_threshold INTEGER DEFAULT 20")
    if "enable_email_alerts" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN enable_email_alerts BOOLEAN DEFAULT 0")
    if "smtp_host" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN smtp_host TEXT")
    if "smtp_port" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN smtp_port INTEGER DEFAULT 587")
    if "smtp_user" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN smtp_user TEXT")
    if "smtp_pass" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN smtp_pass TEXT")
    if "smtp_sender" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN smtp_sender TEXT")
    if "auto_backup" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN auto_backup BOOLEAN DEFAULT 1")
    if "timezone" not in config_columns:
        cursor.execute("ALTER TABLE shop_config ADD COLUMN timezone TEXT DEFAULT 'Africa/Nairobi'")

    cursor.execute("PRAGMA table_info(inventory)")
    inv_columns = [col[1] for col in cursor.fetchall()]
    if "last_sale_date" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN last_sale_date TEXT")
    if "barcode" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN barcode TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode)")
        
    if "cost_price" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN cost_price REAL DEFAULT 0.0")
        
    if "supplier_contact" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN supplier_contact TEXT")
        
    if "sale_price" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN sale_price REAL")
        
    if "sale_start" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN sale_start TEXT")
        
    if "sale_end" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN sale_end TEXT")
        
    if "sale_days" not in inv_columns:
        cursor.execute("ALTER TABLE inventory ADD COLUMN sale_days TEXT")

    cursor.execute('SELECT COUNT(*) FROM shop_config')
    if cursor.fetchone()[0] == 0:
        expiry = (datetime.now() + timedelta(days=30)).isoformat()
        cursor.execute('INSERT INTO shop_config (license_expiry, owner_phone, shop_name, tax_id, vat_rate) VALUES (?, ?, ?, ?, ?)', 
                       (expiry, "254700000000", "Stockwatch Enterprise", "PIN-000000000", 16.0))
    
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_hash = "$2b$12$DXcfFJwkmhISYpGA1RVgE.HTOKmxMMFC7MeMvcS1ODccNEYUpwjum" # 'admin123'
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ("admin", default_hash, "admin"))

    # Sync barcodes
    cursor.execute("SELECT id, barcode FROM inventory WHERE barcode IS NOT NULL")
    for item_id, barcode in cursor.fetchall():
        cursor.execute("INSERT OR IGNORE INTO item_barcodes (item_id, barcode) VALUES (?, ?)", (item_id, barcode))

    # Backfill missing transaction costs for profit reports
    backfill_transaction_costs(cursor)

    # --- ENTERPRISE SCALE INDEXING ---
    print("AUDIT: Optimizing database indexes for scale...")
    # Inventory Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inv_name ON inventory(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inv_sku ON inventory(sku)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inv_cat ON inventory(category_id)")
    
    # Customer Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_phone ON customers(phone_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name)")
    
    # Transaction Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_item_id ON transactions(item_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_user_id ON transactions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_cust_id ON transactions(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_order_id ON transactions(order_id)")
    
    # Order Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_order_timestamp ON orders(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_order_cust_id ON orders(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_order_user_id ON orders(user_id)")
    
    # Analyze the database to optimize query planning
    cursor.execute("ANALYZE")
    print("AUDIT: Enterprise optimization complete.")

    conn.commit()
    conn.close()

def add_item(name, quantity, threshold, price, cost_price=0.0, user_id=None, barcode=None, supplier_contact=None, sale_price=None, sale_start=None, sale_end=None, sale_days=None, category_id=None, sku=None, expiry_date=None, unit_measure='pcs', supplier_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO inventory (name, quantity, threshold, price, cost_price, barcode, supplier_contact, sale_price, sale_start, sale_end, sale_days, category_id, sku, expiry_date, unit_measure, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name, quantity, threshold, price, cost_price, barcode, supplier_contact, sale_price, sale_start, sale_end, sale_days, category_id, sku, expiry_date, unit_measure, supplier_id))
        new_id = cursor.lastrowid
        
        # Also insert into the new multi-barcode table
        if barcode:
            cursor.execute('INSERT OR IGNORE INTO item_barcodes (item_id, barcode) VALUES (?, ?)', (new_id, barcode))
            
        # Log initial creation transaction if user_id is provided
        if user_id:
            cursor.execute('''
                INSERT INTO transactions (item_id, item_name, qty_change, user_id, unit_price, unit_cost)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (new_id, name, quantity, user_id, price, cost_price))
            
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
    cursor.execute('SELECT id, name, quantity, threshold, price, barcode, cost_price, supplier_contact, sale_price, sale_start, sale_end, sale_days, category_id, sku, expiry_date, unit_measure, supplier_id FROM inventory')
    items = cursor.fetchall()
    conn.close()
    return items

def get_item_by_id(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, quantity, threshold, price, barcode, cost_price, supplier_contact, sale_price, sale_start, sale_end, sale_days, category_id, sku, expiry_date, unit_measure, supplier_id FROM inventory WHERE id = ?', (item_id,))
    item = cursor.fetchone()
    conn.close()
    return item

def get_item_by_barcode(barcode):
    conn = get_connection()
    cursor = conn.cursor()
    # Check item_barcodes table first
    cursor.execute('''
        SELECT i.id, i.name, i.quantity, i.threshold, i.price, b.barcode, i.cost_price, i.supplier_contact, i.sale_price, i.sale_start, i.sale_end, i.sale_days, i.category_id, i.sku, i.expiry_date, i.unit_measure, i.supplier_id
        FROM inventory i
        JOIN item_barcodes b ON i.id = b.item_id
        WHERE b.barcode = ?
    ''', (barcode,))
    item = cursor.fetchone()
    
    if not item:
        # Fallback to legacy barcode column
        cursor.execute('SELECT id, name, quantity, threshold, price, barcode, cost_price, supplier_contact, sale_price, sale_start, sale_end, sale_days, category_id, sku, expiry_date, unit_measure, supplier_id FROM inventory WHERE barcode = ?', (barcode,))
        item = cursor.fetchone()
        
    conn.close()
    return item

def get_or_create_customer(phone_number):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM customers WHERE phone_number = ?", (phone_number,))
    row = cursor.fetchone()
    if row:
        customer_id = row[0]
    else:
        cursor.execute("INSERT INTO customers (phone_number) VALUES (?)", (phone_number,))
        customer_id = cursor.lastrowid
        conn.commit()
    conn.close()
    return customer_id

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
    cursor.execute('SELECT id, username, password_hash, role, is_active, pin FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, role, is_active, permissions FROM users')
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "username": r[1], "role": r[2], "is_active": r[3], "permissions": r[4]} for r in rows]

def update_user_profile(user_id, is_active=None, role=None, permissions=None):
    conn = get_connection()
    cursor = conn.cursor()
    if is_active is not None:
        cursor.execute('UPDATE users SET is_active = ? WHERE id = ?', (1 if is_active else 0, user_id))
    if role is not None:
        cursor.execute('UPDATE users SET role = ? WHERE id = ?', (role, user_id))
    if permissions is not None:
        cursor.execute('UPDATE users SET permissions = ? WHERE id = ?', (permissions, user_id))
    conn.commit()
    conn.close()

def toggle_user_status(user_id, status):
    update_user_profile(user_id, is_active=status)

def delete_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

# --- Categories & Suppliers ---
def add_category(name, description=None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO categories (name, description) VALUES (?, ?)', (name, description))
        conn.commit()
        return True, "Category added"
    except sqlite3.IntegrityError:
        return False, "Category already exists"
    finally:
        conn.close()

def get_all_categories():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, description FROM categories')
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "description": r[2]} for r in rows]

def add_supplier(name, contact_person=None, phone=None, email=None, address=None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)', 
                       (name, contact_person, phone, email, address))
        conn.commit()
        return True, "Supplier added"
    except sqlite3.IntegrityError:
        return False, "Supplier already exists"
    finally:
        conn.close()

def get_all_suppliers():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, contact_person, phone, email, address FROM suppliers')
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "contact_person": r[2], "phone": r[3], "email": r[4], "address": r[5]} for r in rows]



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
        SELECT a.id, replace(datetime(a.timestamp, 'localtime'), ' ', 'T'), u.username, a.event_type
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
        SELECT u.username, u.role, datetime(a.timestamp, 'localtime')
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

def log_transaction_internal(cursor, item_id, item_name, qty_change, user_id, customer_id=None, payment_method='Cash', order_id=None):
    """Internal helper to log transaction using an existing cursor/connection."""
    # Fetch current price and cost
    cursor.execute("SELECT price, cost_price FROM inventory WHERE id = ?", (item_id,))
    price_row = cursor.fetchone()
    price = price_row[0] if price_row else 0.0
    cost = price_row[1] if price_row else 0.0
    
    cursor.execute('''
        INSERT INTO transactions (item_id, item_name, qty_change, user_id, unit_price, unit_cost, customer_id, payment_method, order_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (item_id, item_name, qty_change, user_id, price, cost, customer_id, payment_method, order_id))

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
        SELECT t.id, replace(datetime(t.timestamp, 'localtime'), ' ', 'T'), t.item_name, t.qty_change, u.username, 
               CASE WHEN t.qty_change > 0 THEN t.unit_cost ELSE t.unit_price END as applicable_price
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        ORDER BY t.timestamp DESC
    ''')
    txs = cursor.fetchall()
    conn.close()
    return txs


def log_security_event(user_id, action_type, item_name=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO security_logs (user_id, action_type, item_name)
        VALUES (?, ?, ?)
    ''', (user_id, action_type, item_name))
    conn.commit()
    conn.close()

def get_security_logs(limit=50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.id, replace(datetime(s.timestamp, 'localtime'), ' ', 'T'), u.username, s.action_type, s.item_name
        FROM security_logs s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.timestamp DESC
        LIMIT ?
    ''', (limit,))
    logs = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": row[0],
            "timestamp": row[1],
            "username": row[2],
            "action_type": row[3],
            "item_name": row[4]
        }
        for row in logs
    ]

def get_top_products(limit=10):
    conn = get_connection()
    cursor = conn.cursor()
    # Rank by Sales Volume (Quantity) as requested
    cursor.execute('''
        SELECT 
            item_name, 
            SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE -qty_change END) as total_qty,
            SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) * unit_price ELSE qty_change * -unit_price END) as total_revenue,
            SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) * (unit_price - unit_cost) ELSE qty_change * -(unit_price - unit_cost) END) as total_profit
        FROM transactions
        WHERE qty_change < 0 OR order_id IS NOT NULL
        GROUP BY item_name
        ORDER BY total_qty DESC
        LIMIT ?
    ''', (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "name": r[0],
            "qty": r[1],
            "revenue": r[2],
            "profit": r[3]
        }
        for r in rows
    ]

def log_expense(category, amount, description):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO expenses (category, amount, description)
        VALUES (?, ?, ?)
    ''', (category, amount, description))
    conn.commit()
    conn.close()

def get_expenses(limit=50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, category, amount, description, replace(datetime(timestamp, "localtime"), " ", "T") FROM expenses ORDER BY timestamp DESC LIMIT ?', (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "category": r[1], "amount": r[2], "description": r[3], "timestamp": r[4]} for r in rows]

def get_daily_report():
    conn = get_connection()
    cursor = conn.cursor()
    # Comprehensive daily reporting: Sales, Restocks, Gross Profit, and Expenses
    cursor.execute('''
        SELECT 
            DATE(t.timestamp, 'localtime') as day,
            SUM(CASE 
                WHEN t.qty_change < 0 THEN ABS(t.qty_change) * t.unit_price 
                WHEN t.qty_change > 0 AND t.order_id IS NOT NULL THEN -t.qty_change * t.unit_price 
                ELSE 0 
            END) as total_sales,
            SUM(CASE WHEN t.qty_change > 0 AND t.order_id IS NULL THEN t.qty_change * t.unit_cost ELSE 0 END) as total_restock,
            SUM(CASE 
                WHEN t.qty_change < 0 THEN ABS(t.qty_change) * (t.unit_price - t.unit_cost) 
                WHEN t.qty_change > 0 AND t.order_id IS NOT NULL THEN -t.qty_change * (t.unit_price - t.unit_cost) 
                ELSE 0 
            END) as gross_profit,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE DATE(timestamp, 'localtime') = DATE(t.timestamp, 'localtime')), 0) as total_expenses
        FROM transactions t
        GROUP BY day
        ORDER BY day DESC
    ''')
    report = cursor.fetchall()
    conn.close()
    return report

def get_license_status():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT license_expiry, owner_phone, shop_name, tax_id, vat_rate, 
               shop_location, shop_email, shop_footer, currency,
               low_stock_threshold, enable_email_alerts, smtp_host, smtp_port,
               smtp_user, smtp_pass, smtp_sender, auto_backup, timezone
        FROM shop_config LIMIT 1
    ''')
    row = cursor.fetchone()
    conn.close()
    if not row: return None
    
    from datetime import datetime
    expiry = datetime.fromisoformat(row[0])
    is_expired = datetime.now() > expiry
    days_left = (expiry - datetime.now()).days
    
    return {
        "expiry": row[0],
        "is_expired": is_expired,
        "days_left": days_left,
        "owner_phone": row[1],
        "shop_name": row[2],
        "tax_id": row[3],
        "vat_rate": row[4],
        "shop_location": row[5],
        "shop_email": row[6],
        "shop_footer": row[7],
        "currency": row[8],
        "low_stock_threshold": row[9],
        "enable_email_alerts": row[10],
        "smtp_host": row[11],
        "smtp_port": row[12],
        "smtp_user": row[13],
        "smtp_pass": row[14],
        "smtp_sender": row[15],
        "auto_backup": row[16],
        "timezone": row[17]
    }

def update_license_expiry(days=30):
    conn = get_connection()
    cursor = conn.cursor()
    status = get_license_status()
    from datetime import datetime, timedelta
    if status and not status['is_expired']:
        current_expiry = datetime.fromisoformat(status['expiry'])
        new_expiry = (current_expiry + timedelta(days=days)).isoformat()
    else:
        new_expiry = (datetime.now() + timedelta(days=days)).isoformat()
    
    cursor.execute('UPDATE shop_config SET license_expiry = ?', (new_expiry,))
    conn.commit()
    conn.close()
    return new_expiry

def get_customer_by_phone(phone):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, phone_number, name, points FROM customers WHERE phone_number = ?', (phone,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "phone": row[1], "name": row[2], "points": row[3]}
    return None

def search_customers(query):
    conn = get_connection()
    cursor = conn.cursor()
    q = f"%{query}%"
    cursor.execute('''
        SELECT id, phone_number, name, points 
        FROM customers 
        WHERE phone_number LIKE ? OR name LIKE ? 
        LIMIT 10
    ''', (q, q))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "phone": r[1], "name": r[2], "points": r[3]} for r in rows]

def get_expiry_risk(days=30):
    conn = get_connection()
    cursor = conn.cursor()
    # Query items where expiry_date is between today and today + days
    # SQLite DATE comparison works with ISO strings
    cursor.execute('''
        SELECT id, name, quantity, price, expiry_date, cost_price
        FROM inventory
        WHERE expiry_date IS NOT NULL 
        AND expiry_date != ''
        AND expiry_date <= DATE('now', '+' || ? || ' days')
        AND expiry_date >= DATE('now')
        ORDER BY expiry_date ASC
    ''', (days,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "name": r[1],
            "quantity": r[2],
            "price": r[3],
            "expiry_date": r[4],
            "cost_price": r[5]
        }
        for r in rows
    ]

def add_customer(phone, name):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO customers (phone_number, name) VALUES (?, ?)', (phone, name))
        conn.commit()
        return True, "Customer registered successfully"
    except sqlite3.IntegrityError:
        return False, "Phone number already registered"
    finally:
        conn.close()

def get_customer_debts(customer_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, amount, description, datetime(timestamp, "localtime"), is_paid FROM customer_debts WHERE customer_id = ? AND is_paid = 0', (customer_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "amount": r[1], "description": r[2], "timestamp": r[3]} for r in rows]

def record_debt_payment(customer_id, amount, payment_method):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION")
        # 1. Log payment
        cursor.execute('INSERT INTO debt_payments (customer_id, amount, payment_method) VALUES (?, ?, ?)', (customer_id, amount, payment_method))
        
        # 2. Update existing debts (FIFO or simple reduction)
        # For simplicity, we'll mark the oldest unpaid debts as paid if the payment covers them
        cursor.execute('SELECT id, amount FROM customer_debts WHERE customer_id = ? AND is_paid = 0 ORDER BY timestamp ASC', (customer_id,))
        debts = cursor.fetchall()
        
        remaining_payment = amount
        for debt_id, debt_amount in debts:
            if remaining_payment >= debt_amount:
                cursor.execute('UPDATE customer_debts SET is_paid = 1 WHERE id = ?', (debt_id,))
                remaining_payment -= debt_amount
            else:
                # Partially pay the debt (or just leave it if we don't support partial yet)
                # For high-end accounting, we should support partial, but let's stick to full for now
                break
                
        conn.commit()
        return True, "Payment recorded"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()

def update_shop_settings(phone, vat_rate, shop_name=None, tax_id=None, location=None, email=None, footer=None, currency=None, 
                         low_stock_threshold=None, enable_email_alerts=None, smtp_host=None, smtp_port=None, 
                         smtp_user=None, smtp_pass=None, smtp_sender=None, auto_backup=None, timezone=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE shop_config 
        SET owner_phone = ?, 
            vat_rate = ?, 
            shop_name = COALESCE(?, shop_name), 
            tax_id = COALESCE(?, tax_id),
            shop_location = COALESCE(?, shop_location),
            shop_email = COALESCE(?, shop_email),
            shop_footer = COALESCE(?, shop_footer),
            currency = COALESCE(?, currency),
            low_stock_threshold = COALESCE(?, low_stock_threshold),
            enable_email_alerts = COALESCE(?, enable_email_alerts),
            smtp_host = COALESCE(?, smtp_host),
            smtp_port = COALESCE(?, smtp_port),
            smtp_user = COALESCE(?, smtp_user),
            smtp_pass = COALESCE(?, smtp_pass),
            smtp_sender = COALESCE(?, smtp_sender),
            auto_backup = COALESCE(?, auto_backup),
            timezone = COALESCE(?, timezone)
    ''', (phone, vat_rate, shop_name, tax_id, location, email, footer, currency, 
          low_stock_threshold, enable_email_alerts, smtp_host, smtp_port, 
          smtp_user, smtp_pass, smtp_sender, auto_backup, timezone))
    conn.commit()
    conn.close()

def get_tax_report():
    conn = get_connection()
    cursor = conn.cursor()
    # Fetch VAT rate
    cursor.execute('SELECT vat_rate FROM shop_config LIMIT 1')
    vat_rate = cursor.fetchone()[0] / 100.0
    
    # Calculate tax from sales
    cursor.execute('''
        SELECT 
            DATE(timestamp, 'localtime') as day,
            SUM(CASE 
                WHEN qty_change < 0 THEN ABS(qty_change) * unit_price 
                WHEN qty_change > 0 AND order_id IS NOT NULL THEN -qty_change * unit_price 
                ELSE 0 
            END) as total_revenue,
            SUM(CASE 
                WHEN qty_change < 0 THEN ABS(qty_change) * unit_price * (? / (1 + ?))
                WHEN qty_change > 0 AND order_id IS NOT NULL THEN -qty_change * unit_price * (? / (1 + ?))
                ELSE 0 
            END) as vat_collected
        FROM transactions
        GROUP BY day
        ORDER BY day DESC
    ''', (vat_rate, vat_rate, vat_rate, vat_rate))
    rows = cursor.fetchall()
    conn.close()
    return [{"day": r[0], "revenue": r[1], "vat": r[2]} for r in rows]

def get_dead_stock_analysis():
    conn = get_connection()
    cursor = conn.cursor()
    # Find items with no sales in last 30 days
    # suggested_clearance_price = max(cost_price * 1.05, price * 0.7)
    cursor.execute('''
        SELECT 
            i.id, i.name, i.quantity, i.price, i.cost_price,
            MAX(datetime(t.timestamp, 'localtime')) as last_sale
        FROM inventory i
        LEFT JOIN transactions t ON i.id = t.item_id AND t.qty_change < 0
        GROUP BY i.id
        HAVING last_sale IS NULL OR last_sale < datetime('now', '-30 days')
        ORDER BY last_sale ASC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        price = r[3]
        cost = r[4]
        # Suggested: Recover cost + 5% or 30% discount, whichever is higher price
        suggested = max(cost * 1.05, price * 0.7)
        results.append({
            "id": r[0],
            "name": r[1],
            "quantity": r[2],
            "current_price": price,
            "cost_price": cost,
            "last_sale": r[5] or "Never",
            "suggested_clearance": round(suggested, 2)
        })
    return results

def process_checkout(items_to_update, user_id, customer_id=None, payment_method='Cash'):
    """
    items_to_update: List of dicts like {'item_id': 1, 'item_name': 'Apple', 'qty_change': -2}
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION")
        
        # 1. Calculate order totals
        total_amount = 0
        total_points = 0
        order_items = []
        
        for update in items_to_update:
            item_id = update['item_id']
            delta = update['qty_change']
            
            cursor.execute("SELECT name, price, cost_price, quantity FROM inventory WHERE id = ?", (item_id,))
            row = cursor.fetchone()
            if not row: continue
            
            name, price, cost, stock = row
            if delta < 0 and stock < abs(delta):
                raise Exception(f"Insufficient stock for {name}")
                
            item_total = abs(delta) * price
            total_amount += item_total
            order_items.append({
                "id": item_id, "name": name, "qty": delta, "price": price, "cost": cost
            })

        # 2. Calculate VAT
        cursor.execute("SELECT vat_rate FROM shop_config LIMIT 1")
        vat_rate_row = cursor.fetchone()
        vat_rate = (vat_rate_row[0] if vat_rate_row else 16.0) / 100.0
        vat_amount = total_amount * (vat_rate / (1 + vat_rate))
        
        # 3. Create Order record
        points_earned = int(total_amount // 100) if customer_id else 0
        cursor.execute('''
            INSERT INTO orders (total_amount, vat_amount, payment_method, customer_id, user_id, points_earned)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (total_amount, vat_amount, payment_method, customer_id, user_id, points_earned))
        order_id = cursor.lastrowid
        
        # 4. Process individual items & transactions
        for item in order_items:
            # Update Inventory
            cursor.execute("UPDATE inventory SET quantity = quantity + ?, last_sale_date = CURRENT_TIMESTAMP WHERE id = ?", (item['qty'], item['id']))
            
            # Log Transaction linked to Order
            cursor.execute('''
                INSERT INTO transactions (item_id, item_name, qty_change, user_id, unit_price, unit_cost, customer_id, payment_method, order_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (item['id'], item['name'], item['qty'], user_id, item['price'], item['cost'], customer_id, payment_method, order_id))

        # 5. Handle Debt if payment method is Credit
        if payment_method == 'Credit' and customer_id:
             cursor.execute('''
                INSERT INTO customer_debts (customer_id, amount, description)
                VALUES (?, ?, ?)
            ''', (customer_id, total_amount, f"Order #{order_id}"))

        # 6. Award Loyalty Points
        if customer_id and points_earned > 0:
            cursor.execute("UPDATE customers SET points = points + ? WHERE id = ?", (points_earned, customer_id))
            
        conn.commit()
        
        # Fetch customer info for receipt
        customer_phone = None
        if customer_id:
            cursor.execute("SELECT phone_number FROM customers WHERE id = ?", (customer_id,))
            c_row = cursor.fetchone()
            if c_row: customer_phone = c_row[0]

        return True, {
            "order_id": order_id, 
            "total": total_amount, 
            "vat": vat_amount, 
            "points": points_earned,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "customer_phone": customer_phone,
            "payment_method": payment_method
        }
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()

def get_orders(limit=50, offset=0):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT o.id, replace(datetime(o.timestamp, 'localtime'), ' ', 'T'), o.total_amount, o.payment_method, o.status, u.username, c.name as customer_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN customers c ON o.customer_id = c.id
        ORDER BY o.timestamp DESC
        LIMIT ? OFFSET ?
    ''', (limit, offset))
    rows = cursor.fetchall()
    conn.close()
    return [{
        "id": r[0], "timestamp": r[1], "total": r[2], "method": r[3], 
        "status": r[4], "staff": r[5], "customer": r[6]
    } for r in rows]

def get_order_details(order_id):
    conn = get_connection()
    cursor = conn.cursor()
    # Get Order info
    cursor.execute('''
        SELECT o.id, replace(datetime(o.timestamp, 'localtime'), ' ', 'T'), o.total_amount, o.vat_amount, o.payment_method, o.points_earned, o.status, u.username, c.name, c.phone_number
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
    ''', (order_id,))
    order_row = cursor.fetchone()
    if not order_row:
        conn.close()
        return None
        
    # Get Order Items
    cursor.execute('''
        SELECT item_name, qty_change, unit_price
        FROM transactions
        WHERE order_id = ?
    ''', (order_id,))
    items = [{"name": r[0], "qty": abs(r[1]), "price": r[2]} for r in cursor.fetchall()]
    
    conn.close()
    return {
        "id": order_row[0], "timestamp": order_row[1], "total": order_row[2], 
        "vat": order_row[3], "method": order_row[4], "points": order_row[5],
        "status": order_row[6], "staff": order_row[7], "customer_name": order_row[8],
        "customer_phone": order_row[9], "items": items
    }
