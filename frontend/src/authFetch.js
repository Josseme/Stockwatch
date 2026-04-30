export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  try {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return response;
  } catch (err) {
    console.error('Network Error:', err);
    return {
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Network connection failed' }),
      text: async () => 'Network connection failed'
    };
  }
};
