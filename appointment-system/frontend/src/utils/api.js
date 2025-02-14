import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = (credentials) => api.post('/login', credentials);
export const register = (userData) => api.post('/register', userData);
export const getSlots = () => api.get('/slots');
export const getAppointments = () => api.get('/appointments');
export const bookAppointment = (slotId) => api.post('/appointments', { slot_id: slotId });
export const cancelAppointment = (id) => api.delete(`/appointments/${id}`);
