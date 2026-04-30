const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`;
const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8000/api/ws`;

export { API_BASE, WS_BASE };
