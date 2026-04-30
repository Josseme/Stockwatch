import sqlite3
conn = sqlite3.connect('inventory.db')
cursor = conn.cursor()
# Fix order 15 (was stored as local, should be UTC)
cursor.execute("UPDATE orders SET timestamp = '2026-04-30 13:02:31' WHERE id = 15")
# Check if any others were affected (only between 13:01:39 and 13:02:43 UTC)
# From my previous raw check, only ID 15 had '16:'
conn.commit()
conn.close()
print("Fixed order 15 timestamp to UTC.")
