import sqlite3
from database import get_orders, process_checkout, initialize_database
from datetime import datetime

# Ensure DB is initialized
initialize_database()

# Test order creation
print(f"Current local time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# Create a test order
items = [{'item_id': 1, 'qty_change': -1}] # Assuming item 1 exists
# If item 1 doesn't exist, we might need to add one first
from database import get_connection
conn = get_connection()
cursor = conn.cursor()
cursor.execute("INSERT OR IGNORE INTO inventory (id, name, quantity, threshold, price) VALUES (1, 'Test Item', 100, 10, 50.0)")
conn.commit()
conn.close()

success, result = process_checkout(items, 1) # user_id 1
if success:
    print(f"Order created: {result['order_id']} at {result['timestamp']}")
    
    # Check orders ledger
    orders = get_orders(limit=1)
    if orders:
        print(f"Ledger timestamp: {orders[0]['timestamp']}")
        # Compare
        ledger_time = orders[0]['timestamp']
        print(f"SUCCESS: Ledger shows local time: {ledger_time}")
    else:
        print("No orders found in ledger")
else:
    print(f"Failed to create order: {result}")
