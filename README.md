# 📦 Stockwatch

**Stockwatch** is a modern, real-time inventory management system designed for efficiency and operational transparency. It features a sleek, touch-friendly interface, real-time synchronization, and robust administrative tools.

---

## ✨ Features

- 🚀 **Real-Time Sync**: Instant dashboard updates via WebSockets when inventory changes.
- 📧 **Smart Alerts**: Automated email notifications when items drop below custom thresholds.
- 🤳 **Barcode Scanning**: Seamlessly check out items or look up inventory using integrated scanning support.
- 🔐 **Secure Access**: Role-based access control (Admin & Cashier) powered by JWT and bcrypt.
- 🕒 **Staff Portal**: Automated attendance tracking (Clock-in/Clock-out) upon login/logout.
- 📈 **Audit Trail**: Full transaction history logs to monitor stock movements and staff activity.
- 💻 **Admin Dashboard**: Live presence monitoring showing who is currently on shift.

---

## 🛠️ Technology Stack

### Backend
- **FastAPI**: High-performance Python framework for building APIs.
- **SQLite**: Lightweight, serverless SQL database engine.
- **JWT & bcrypt**: Secure authentication and password hashing.
- **WebSockets**: For real-time data broadcasting.

### Frontend
- **React (Vite)**: Modern UI framework for a fast, responsive user experience.
- **Lucide React**: For beautiful, consistent iconography.
- **Vanilla CSS**: Custom premium styling with a focus on rich aesthetics.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js & npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Josseme/Stockwatch.git
   cd Stockwatch
   ```

2. **Backend Setup:**
   ```bash
   # Create virtual environment
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   ```

### Configuration
Create a `.env` file in the root directory:
```env
# Email Configuration
EMAIL_SENDER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_RECIPIENT=recipient@example.com

# Security
JWT_SECRET=your-random-secret-key
```

### Running the Application

1. **Start the Backend:**
   ```bash
   python main.py
   ```

2. **Start the Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 📁 Project Structure

- `api.py`: FastAPI routes and core logic.
- `database.py`: SQLite database operations and schema management.
- `tracker.py`: Background tasks for low-stock alerts and email dispatch.
- `frontend/`: React source code and assets.
- `logs/`: Local diagnostic and error logs.

---

## 📜 License
Personal Project - All Rights Reserved.
