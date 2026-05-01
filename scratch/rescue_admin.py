import os
import bcrypt
import libsql_experimental as libsql # Using the Turso-compatible library

def reset_admin():
    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")
    
    if not url:
        print("Error: TURSO_DATABASE_URL not set")
        return

    print(f"Connecting to {url}...")
    conn = libsql.connect(url, auth_token=token)
    cursor = conn.cursor()
    
    new_pass = "admin123"
    hashed = bcrypt.hashpw(new_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Let's find the admin user. Usually it's 'admin' or the first user.
    cursor.execute("SELECT id, username FROM users WHERE role = 'admin'")
    admins = cursor.fetchall()
    
    if not admins:
        print("No admin users found!")
        return
    
    for admin_id, username in admins:
        print(f"Resetting password for {username} (ID: {admin_id})...")
        cursor.execute("UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?", (hashed, admin_id))
    
    conn.commit()
    print("Success! Admin passwords reset to 'admin123'")
    conn.close()

if __name__ == "__main__":
    reset_admin()
