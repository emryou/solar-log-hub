# Solar Monitoring System - API Documentation

Base URL: `http://<raspberry-pi-ip>:5000/api`

## Authentication

Currently no authentication required. For production, implement JWT or API keys.

---

## Health Check

### GET `/health`

Check if the API is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5
}
```

---

## Devices

### GET `/devices`

Get all registered ESP32 devices.

**Response:**
```json
[
  {
    "id": 1,
    "name": "ESP32-SOLAR-001",
    "ip_address": "192.168.1.50",
    "description": "Roof sensor unit",
    "is_active": 1,
    "last_seen": "2024-01-15T10:29:00.000Z",
    "created_at": "2024-01-10T08:00:00.000Z"
  }
]
```

### GET `/devices/:name`

Get specific device by name.

**Parameters:**
- `name` (string): Device name (e.g., "ESP32-SOLAR-001")

**Response:**
```json
{
  "id": 1,
  "name": "ESP32-SOLAR-001",
  "ip_address": "192.168.1.50",
  "description": "Roof sensor unit",
  "is_active": 1,
  "last_seen": "2024-01-15T10:29:00.000Z",
  "created_at": "2024-01-10T08:00:00.000Z"
}
```

### POST `/devices`

Register or update a device (used by ESP32 auto-registration).

**Request Body:**
```json
{
  "name": "ESP32-SOLAR-001",
  "ip_address": "192.168.1.50",
  "description": "Roof sensor unit"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "ESP32-SOLAR-001",
  "ip_address": "192.168.1.50",
  "description": "Roof sensor unit",
  "is_active": 1,
  "last_seen": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-10T08:00:00.000Z"
}
```

### DELETE `/devices/:id`

Delete a device.

**Parameters:**
- `id` (integer): Device ID

**Response:**
```json
{
  "success": true
}
```

---

## Sensor Data

### GET `/sensor-data`

Get sensor data with optional filters.

**Query Parameters:**
- `device_name` (string, optional): Filter by device name
- `start_date` (ISO 8601, optional): Start date (e.g., "2024-01-01T00:00:00Z")
- `end_date` (ISO 8601, optional): End date
- `limit` (integer, optional, default: 1000): Maximum records to return

**Example:**
```
GET /sensor-data?device_name=ESP32-SOLAR-001&start_date=2024-01-15T00:00:00Z&limit=100
```

**Response:**
```json
[
  {
    "id": 1234,
    "device_name": "ESP32-SOLAR-001",
    "radiation": 850.5,
    "temperature1": 45.2,
    "temperature2": 43.8,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
]
```

### GET `/sensor-data/latest/:device_name`

Get the latest sensor reading for a device.

**Parameters:**
- `device_name` (string): Device name

**Response:**
```json
{
  "id": 1234,
  "device_name": "ESP32-SOLAR-001",
  "radiation": 850.5,
  "temperature1": 45.2,
  "temperature2": 43.8,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### POST `/sensor-data`

Submit new sensor data (used by ESP32).

**Request Body:**
```json
{
  "device_name": "ESP32-SOLAR-001",
  "radiation": 850.5,
  "temperature1": 45.2,
  "temperature2": 43.8
}
```

**Response:**
```json
{
  "id": 1234,
  "device_name": "ESP32-SOLAR-001",
  "radiation": 850.5,
  "temperature1": 45.2,
  "temperature2": 43.8,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Notes:**
- If the device doesn't exist, it will be auto-registered
- Timestamp is automatically set to current time
- WebSocket broadcast is triggered for real-time updates

---

## Modbus Configuration

### GET `/modbus-maps`

Get all Modbus register maps.

**Response:**
```json
[
  {
    "id": 1,
    "sensor_name": "IMT Solar Radiation",
    "modbus_address": 1,
    "registers": [
      {
        "register": 0,
        "name": "Radiation",
        "unit": "W/m²",
        "multiplier": 1
      },
      {
        "register": 1,
        "name": "Temperature 1",
        "unit": "°C",
        "multiplier": 0.1
      },
      {
        "register": 2,
        "name": "Temperature 2",
        "unit": "°C",
        "multiplier": 0.1
      }
    ],
    "created_at": "2024-01-10T08:00:00.000Z",
    "updated_at": "2024-01-10T08:00:00.000Z"
  }
]
```

### GET `/modbus-maps/:id`

Get specific Modbus map by ID.

**Response:** Same as single item in GET `/modbus-maps`

### POST `/modbus-maps`

Create new Modbus register map.

**Request Body:**
```json
{
  "sensor_name": "IMT Solar Radiation",
  "modbus_address": 1,
  "registers": [
    {
      "register": 0,
      "name": "Radiation",
      "unit": "W/m²",
      "multiplier": 1
    }
  ]
}
```

### PUT `/modbus-maps/:id`

Update existing Modbus map.

**Request Body:** Same as POST

### DELETE `/modbus-maps/:id`

Delete Modbus map.

**Response:**
```json
{
  "success": true
}
```

---

## Settings

### GET `/settings`

Get all system settings.

**Response:**
```json
[
  {
    "key": "data_interval",
    "value": "300",
    "description": "Data collection interval in seconds",
    "updated_at": "2024-01-10T08:00:00.000Z"
  },
  {
    "key": "retention_days",
    "value": "365",
    "description": "Data retention period in days",
    "updated_at": "2024-01-10T08:00:00.000Z"
  }
]
```

### GET `/settings/:key`

Get specific setting.

**Parameters:**
- `key` (string): Setting key (e.g., "data_interval")

**Response:**
```json
{
  "key": "data_interval",
  "value": "300",
  "description": "Data collection interval in seconds",
  "updated_at": "2024-01-10T08:00:00.000Z"
}
```

### PUT `/settings/:key`

Update setting value.

**Request Body:**
```json
{
  "value": "600"
}
```

**Response:**
```json
{
  "key": "data_interval",
  "value": "600",
  "description": "Data collection interval in seconds",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Available Settings:**
- `data_interval`: Data collection interval in seconds (default: 300)
- `retention_days`: Data retention period in days (default: 365)
- `alarm_radiation_max`: Maximum radiation alarm threshold in W/m² (default: 1500)
- `alarm_temp_max`: Maximum temperature alarm threshold in °C (default: 70)
- `timezone`: System timezone (default: "Europe/Istanbul")

---

## Statistics

### GET `/statistics`

Get aggregated statistics for sensor data.

**Query Parameters:**
- `device_name` (string, optional): Filter by device
- `start_date` (ISO 8601, optional): Start date
- `end_date` (ISO 8601, optional): End date

**Response:**
```json
{
  "total_records": 28800,
  "avg_radiation": 642.3,
  "max_radiation": 1245.8,
  "min_radiation": 0.0,
  "avg_temp1": 38.5,
  "max_temp1": 65.2,
  "min_temp1": 12.3,
  "avg_temp2": 37.8,
  "max_temp2": 63.1,
  "min_temp2": 11.9
}
```

---

## Data Export

### GET `/export/csv`

Export sensor data as CSV file.

**Query Parameters:**
- `device_name` (string, optional): Filter by device
- `start_date` (ISO 8601, optional): Start date
- `end_date` (ISO 8601, optional): End date

**Response:**
CSV file download with headers:
```
Timestamp,Device Name,Radiation (W/m²),Temperature 1 (°C),Temperature 2 (°C)
2024-01-15T10:30:00.000Z,ESP32-SOLAR-001,850.5,45.2,43.8
...
```

---

## WebSocket

### WS `/ws`

Real-time data updates via WebSocket.

**Connection:**
```javascript
const ws = new WebSocket('ws://<raspberry-pi-ip>:5000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Message Types:**

1. **New Sensor Data:**
```json
{
  "type": "sensor_data",
  "data": {
    "id": 1234,
    "device_name": "ESP32-SOLAR-001",
    "radiation": 850.5,
    "temperature1": 45.2,
    "temperature2": 43.8,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

2. **Device Update:**
```json
{
  "type": "device_update",
  "data": {
    "id": 1,
    "name": "ESP32-SOLAR-001",
    "is_active": 1,
    "last_seen": "2024-01-15T10:30:00.000Z"
  }
}
```

3. **Setting Update:**
```json
{
  "type": "setting_update",
  "data": {
    "key": "data_interval",
    "value": "600"
  }
}
```

---

## Error Responses

All endpoints may return error responses in this format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found
- `500`: Internal Server Error
