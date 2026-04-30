import os
import requests
import uuid

class PaystackGateway:
    def __init__(self):
        self.secret_key = os.environ.get("PAYSTACK_SECRET_KEY", "sk_test_placeholder")
        self.base_url = "https://api.paystack.co"
        self.headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }

    def initialize_transaction(self, email, amount, callback_url=None):
        """
        Initialize a transaction with Paystack.
        Amount is in subunits (e.g., Kobo for NGN, Cents for GHS/USD/KES).
        """
        url = f"{self.base_url}/transaction/initialize"
        payload = {
            "email": email,
            "amount": int(amount * 100), # Paystack expects amount in cents/kobo
            "reference": str(uuid.uuid4()),
            "callback_url": callback_url
        }
        
        try:
            response = requests.post(url, json=payload, headers=self.headers)
            return response.status_code == 200, response.json()
        except Exception as e:
            return False, {"message": str(e)}

    def verify_transaction(self, reference):
        """
        Verify a transaction with Paystack.
        """
        url = f"{self.base_url}/transaction/verify/{reference}"
        
        try:
            response = requests.get(url, headers=self.headers)
            return response.status_code == 200, response.json()
        except Exception as e:
            return False, {"message": str(e)}
