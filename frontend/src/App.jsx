import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './Login';
import Register from './Register';
import Inventory from './Inventory';
import Attendance from './Attendance';
import Receipt from './Receipt';

import Dashboard from './pages/Dashboard';
import InventoryManager from './pages/InventoryManager';
import StaffManagement from './pages/StaffManagement';
import CustomerHub from './pages/CustomerHub';
import ExpiryRisk from './pages/ExpiryRisk';
import Audits from './pages/Audits';

// Simple Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const userRole = localStorage.getItem('role');
  const isAdmin = userRole === 'admin';

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes inside Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Admn Dashboard or POS default */}
        <Route path="/" element={isAdmin ? <Dashboard /> : <Inventory />} />
        
        {/* Core Ops */}
        <Route path="/pos" element={<Inventory />} />
        
        {/* Management (Admin only) */}
        <Route path="/admin/inventory" element={<ProtectedRoute>{isAdmin ? <InventoryManager /> : <Navigate to="/" />}</ProtectedRoute>} />
        <Route path="/admin/staff" element={<ProtectedRoute>{isAdmin ? <StaffManagement /> : <Navigate to="/" />}</ProtectedRoute>} />
        <Route path="/admin/customers" element={<ProtectedRoute>{isAdmin ? <CustomerHub /> : <Navigate to="/" />}</ProtectedRoute>} />
        <Route path="/admin/expiry" element={<ProtectedRoute>{isAdmin ? <ExpiryRisk /> : <Navigate to="/" />}</ProtectedRoute>} />
        <Route path="/admin/intelligence" element={<ProtectedRoute>{isAdmin ? <Audits /> : <Navigate to="/" />}</ProtectedRoute>} />
        
        {/* Legacy/Other */}
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/receipt" element={<Receipt />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

