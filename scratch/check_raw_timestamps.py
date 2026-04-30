import sqlite3
conn = sqlite3.connect('inventory.db')
cursor = conn.cursor()
cursor.execute("SELECT id, timestamp FROM orders ORDER BY id DESC LIMIT 20")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}, Raw Timestamp: {r[1]}")
conn.close()
