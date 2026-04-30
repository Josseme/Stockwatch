import sqlite3
import smtplib
import os
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# SMTP Configuration with space-stripping to prevent common copy-paste issues
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
try:
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
except (ValueError, TypeError):
    SMTP_PORT = 587

SMTP_EMAIL = (os.getenv("SMTP_EMAIL") or "").strip()
SMTP_PASSWORD = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "")
ALERT_RECIPIENT = (os.getenv("ALERT_RECIPIENT_EMAIL") or "").strip()

LOG_FILE = "logs/email_errors.log"

def log_error(message):
    """Logs error messages to a local file for easier debugging."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    os.makedirs("logs", exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {message}\n")
    print(f"ERROR logged to {LOG_FILE}: {message}")

def send_email_alert(item_name, quantity, threshold):
    """Sends a low-stock email alert."""
    if not all([SMTP_EMAIL, SMTP_PASSWORD, ALERT_RECIPIENT]):
        msg = "Missing email credentials or recipient in .env file."
        log_error(msg)
        return False

    msg = MIMEMultipart()
    msg['From'] = SMTP_EMAIL
    msg['To'] = ALERT_RECIPIENT
    msg['Subject'] = f"Stockwatch Alert: Low Stock for {item_name}"

    body = f"The item '{item_name}' is below the threshold.\nCurrent Quantity: {quantity}\nThreshold: {threshold}"
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"[SUCCESS]: Alert sent for {item_name}")
        return True
    except Exception as e:
        error_msg = f"Failed to send email for {item_name}: {str(e)}"
        log_error(error_msg)
        return False

from database import get_connection

def check_low_stock(item_id=None):
    """Checks inventory for low stock items and triggers alerts."""
    conn = get_connection()
    cursor = conn.cursor()

    if item_id:
        cursor.execute("SELECT id, name, quantity, threshold FROM inventory WHERE id = ?", (item_id,))
    else:
        cursor.execute("SELECT id, name, quantity, threshold FROM inventory")

    items = cursor.fetchall()
    conn.close()

    for item in items:
        # id, name, quantity, threshold
        iid, name, quantity, threshold = item
        if quantity < threshold:
            send_email_alert(name, quantity, threshold)
