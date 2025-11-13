const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface Device {
  id: number;
  name: string;
  organization_id: number;
  ip_address?: string;
  description?: string;
  last_seen?: string;
}

export interface Sensor {
  id: number;
  device_id: number;
  sensor_name: string;
  sensor_type: string;
  unit?: string;
  is_active: number;
  modbus_config_count?: number;
}

export interface ModbusMap {
  id: number;
  sensor_id: number;
  modbus_address: number;
  register_type: string;
  data_type: string;
  scale_factor: number;
  offset: number;
  sensor_name?: string;
}

export interface Setting {
  key: string;
  value: string;
  description?: string;
}

class ApiClient {
  private baseUrl = API_BASE_URL;
  private token: string | null = localStorage.getItem('auth_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }

  async login(email: string, password: string) {
    return this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  }

  async register(data: any) {
    return this.request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  async getDevices() {
    return this.request<Device[]>('/devices');
  }

  async createDevice(data: any) {
    return this.request<Device>('/devices', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteDevice(id: number) {
    return this.request<any>(`/devices/${id}`, { method: 'DELETE' });
  }

  async getSensorsByDevice(deviceId: number) {
    return this.request<Sensor[]>(`/devices/${deviceId}/sensors`);
  }

  async createSensor(deviceId: number, data: any) {
    return this.request<Sensor>(`/devices/${deviceId}/sensors`, { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteSensor(id: number) {
    return this.request<any>(`/sensors/${id}`, { method: 'DELETE' });
  }

  async getLatestSensorData(deviceId: number) {
    return this.request<any[]>(`/devices/${deviceId}/latest`);
  }

  async getModbusMaps() {
    return this.request<ModbusMap[]>('/modbus-maps');
  }

  async createModbusMap(sensorId: number, data: any) {
    return this.request<ModbusMap>(`/sensors/${sensorId}/modbus-map`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateModbusMap(id: number, data: any) {
    return this.request<ModbusMap>(`/modbus-maps/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteModbusMap(id: number) {
    return this.request<any>(`/modbus-maps/${id}`, { method: 'DELETE' });
  }

  async getSettings() {
    return this.request<Setting[]>('/settings');
  }

  async updateSetting(key: string, value: string) {
    return this.request<Setting>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
  }

  async getOrganizations() {
    return this.request<any[]>('/organizations');
  }

  async getUsers() {
    return this.request<any[]>('/users');
  }
}

export const apiClient = new ApiClient();
