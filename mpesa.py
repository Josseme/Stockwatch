import requests
import base64
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

class MpesaGateway:
    def __init__(self):
        self.consumer_key = os.getenv("MPESA_CONSUMER_KEY")
        self.consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
        self.shortcode = os.getenv("MPESA_SHORTCODE")
        self.passkey = os.getenv("MPESA_PASSKEY")
        self.callback_url = os.getenv("MPESA_CALLBACK_URL")
        self.base_url = "https://sandbox.safaricom.co.ke" # Switch to 'api' for production

    def get_access_token(self):
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        try:
            res = requests.get(url, auth=(self.consumer_key, self.consumer_secret))
            return res.json().get("access_token")
        except Exception as e:
            print(f"M-Pesa Auth Error: {e}")
            return None

    def stk_push(self, phone, amount, account_ref="Stockwatch"):
        token = self.get_access_token()
        if not token:
            return False, "Authentication failed"

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(f"{self.shortcode}{self.passkey}{timestamp}".encode()).decode()

        # Clean phone number (needs to be 254...)
        phone = str(phone).replace("+", "")
        if phone.startswith("0"):
            phone = "254" + phone[1:]
        elif phone.startswith("7") or phone.startswith("1"):
            phone = "254" + phone

        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": phone,
            "PartyB": self.shortcode,
            "PhoneNumber": phone,
            "CallBackURL": self.callback_url,
            "AccountReference": account_ref,
            "TransactionDesc": "Payment for Stockwatch items"
        }

        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        try:
            res = requests.post(url, json=payload, headers=headers)
            return True, res.json()
        except Exception as e:
            return False, str(e)
