// API Client for Solar Monitoring System
// IMPORTANT: Backend Raspberry Pi'de çalışmalı!
// Raspberry Pi IP'sini buraya yazın (örnek: http://192.168.1.100:5000/api)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Authentication
  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    contact_email?: string;
    contact_phone?: string;
  }) {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  // Devices
  async getDevices() {
    return this.request<any[]>('/devices');
  }

  async createDevice(data: { name: string; ip_address?: string; description?: string }) {
    return this.request<any>('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteDevice(id: number) {
    return this.request<{ success: boolean }>(`/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // Sensor Data
  async getSensorData(params: {
    device_name?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]
    );
    return this.request<any[]>(`/sensor-data?${query}`);
  }

  async getLatestSensorData(deviceName: string) {
    return this.request<any>(`/sensor-data/latest/${deviceName}`);
  }

  // Statistics
  async getStatistics(params: {
    device_name?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]
    );
    return this.request<any>(`/statistics?${query}`);
  }

  // Modbus Configuration
  async getModbusMaps() {
    return this.request<any[]>('/modbus-maps');
  }

  async createModbusMap(data: any) {
    return this.request<any>('/modbus-maps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateModbusMap(id: number, data: any) {
    return this.request<any>(`/modbus-maps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteModbusMap(id: number) {
    return this.request<{ success: boolean }>(`/modbus-maps/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings
  async getSettings() {
    return this.request<any[]>('/settings');
  }

  async updateSetting(key: string, value: string) {
    return this.request<any>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // Admin - Organizations
  async getOrganizations() {
    return this.request<any[]>('/admin/organizations');
  }

  async createOrganization(data: any) {
    return this.request<any>('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin - Users
  async getUsers() {
    return this.request<any[]>('/admin/users');
  }

  // Export
  async exportCsv(params: {
    device_name?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]
    );
    const response = await fetch(`${this.baseUrl}/export/csv?${query}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensor-data-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export const apiClient = new ApiClient();
