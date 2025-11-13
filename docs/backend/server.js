const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { Database } = require('./database');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authMiddleware, 
  adminMiddleware,
  validateEmail,
  validatePassword 
} = require('./auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database instance
const db = new Database();

// WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast data to all WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ============================================
// API ROUTES
// ============================================

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// AUTHENTICATION
// ============================================

// Register new organization + user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      full_name, 
      organization_name,
      contact_email,
      contact_phone 
    } = req.body;
    
    // Validation
    if (!email || !password || !full_name || !organization_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    
    // Check if email exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create organization
    const organization = await db.createOrganization(
      organization_name,
      contact_email || email,
      contact_phone,
      null
    );
    
    // Create user
    const passwordHash = await hashPassword(password);
    const user = await db.createUser(
      email,
      passwordHash,
      full_name,
      'user',  // Default role
      organization.id
    );
    
    // Generate token
    const token = generateToken(user);
    
    // Remove password hash from response
    delete user.password_hash;
    
    res.json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Get user
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    
    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.updateUserLastLogin(user.id);
    
    // Generate token
    const token = generateToken(user);
    
    // Remove password hash from response
    delete user.password_hash;
    
    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    delete user.password_hash;
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ============================================
// ADMIN - ORGANIZATIONS
// ============================================

// Get all organizations (admin only)
app.get('/api/admin/organizations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const organizations = await db.getAllOrganizations();
    res.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Create organization (admin only)
app.post('/api/admin/organizations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, contact_email, contact_phone, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    
    const organization = await db.createOrganization(name, contact_email, contact_phone, address);
    res.json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// ============================================
// ADMIN - USERS
// ============================================

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    // Remove password hashes
    users.forEach(user => delete user.password_hash);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================
// DEVICES
// ============================================

// Get all devices (filtered by organization for users)
app.get('/api/devices', authMiddleware, async (req, res) => {
  try {
    // Admin sees all devices, users see only their organization's devices
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    const devices = await db.getAllDevices(organizationId);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get device by name
app.get('/api/devices/:name', async (req, res) => {
  try {
    const device = await db.getDeviceByName(req.params.name);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// Add or update device (authenticated - organization assigned)
app.post('/api/devices', authMiddleware, async (req, res) => {
  try {
    const { name, ip_address, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Device name is required' });
    }

    // Users can only add devices to their organization
    const organizationId = req.user.organization_id;
    
    const device = await db.upsertDevice(name, organizationId, ip_address, description);
    
    // Broadcast to WebSocket clients
    broadcast({ type: 'device_update', data: device });
    
    res.json(device);
  } catch (error) {
    console.error('Error upserting device:', error);
    res.status(500).json({ error: 'Failed to save device' });
  }
});

// Public endpoint for ESP32 auto-registration (with device token)
app.post('/api/devices/register', async (req, res) => {
  try {
    const { name, ip_address, description, device_token } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Device name is required' });
    }
    
    // TODO: Implement device token validation
    // For now, device updates existing records only
    const existing = await db.getDeviceByName(name);
    if (!existing) {
      return res.status(404).json({ error: 'Device not found. Please register device through web interface first.' });
    }
    
    const device = await db.upsertDevice(name, existing.organization_id, ip_address, description);
    
    broadcast({ type: 'device_update', data: device });
    
    res.json(device);
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Delete device
app.delete('/api/devices/:id', async (req, res) => {
  try {
    await db.deleteDevice(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// ============================================
// SENSORS
// ============================================

// Get all sensors with details
app.get('/api/sensors', authMiddleware, async (req, res) => {
  try {
    const sensors = await db.getAllSensorsWithDetails();
    
    // Filter by organization for non-admin users
    const filteredSensors = req.user.role === 'admin' 
      ? sensors 
      : sensors.filter(s => s.organization_id === req.user.organization_id);
    
    res.json(filteredSensors);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

// Get sensors by device
app.get('/api/devices/:deviceId/sensors', async (req, res) => {
  try {
    const sensors = await db.getSensorsByDevice(req.params.deviceId);
    res.json(sensors);
  } catch (error) {
    console.error('Error fetching device sensors:', error);
    res.status(500).json({ error: 'Failed to fetch device sensors' });
  }
});

// Create sensor
app.post('/api/devices/:deviceId/sensors', authMiddleware, async (req, res) => {
  try {
    const { sensor_name, sensor_type, unit } = req.body;
    const deviceId = req.params.deviceId;
    
    if (!sensor_name || !sensor_type) {
      return res.status(400).json({ error: 'Sensor name and type are required' });
    }
    
    const sensor = await db.createSensor(deviceId, sensor_name, sensor_type, unit);
    res.json(sensor);
  } catch (error) {
    console.error('Error creating sensor:', error);
    res.status(500).json({ error: 'Failed to create sensor' });
  }
});

// Update sensor
app.put('/api/sensors/:id', authMiddleware, async (req, res) => {
  try {
    const { sensor_name, sensor_type, unit, is_active } = req.body;
    const sensor = await db.updateSensor(
      req.params.id,
      sensor_name,
      sensor_type,
      unit,
      is_active
    );
    res.json(sensor);
  } catch (error) {
    console.error('Error updating sensor:', error);
    res.status(500).json({ error: 'Failed to update sensor' });
  }
});

// Delete sensor
app.delete('/api/sensors/:id', authMiddleware, async (req, res) => {
  try {
    await db.deleteSensor(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sensor:', error);
    res.status(500).json({ error: 'Failed to delete sensor' });
  }
});

// ============================================
// SENSOR DATA
// ============================================

// Get sensor data (filtered by organization)
app.get('/api/sensor-data', authMiddleware, async (req, res) => {
  try {
    const { deviceId, sensorId, start_date, end_date, limit = 1000 } = req.query;
    
    // Filter by organization for non-admin users
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    
    const data = await db.getSensorData({
      deviceId: deviceId ? parseInt(deviceId) : null,
      sensorId: sensorId ? parseInt(sensorId) : null,
      start_date,
      end_date,
      limit: parseInt(limit),
      organizationId
    });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// Get latest sensor data for a device
app.get('/api/devices/:deviceId/latest', async (req, res) => {
  try {
    const data = await db.getLatestSensorData(parseInt(req.params.deviceId));
    res.json(data);
  } catch (error) {
    console.error('Error fetching latest data:', error);
    res.status(500).json({ error: 'Failed to fetch latest data' });
  }
});

// Get latest data for specific sensor
app.get('/api/sensors/:sensorId/latest', async (req, res) => {
  try {
    const data = await db.getLatestSensorDataBySensorId(parseInt(req.params.sensorId));
    if (!data) {
      return res.status(404).json({ error: 'No data found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    res.status(500).json({ error: 'Failed to fetch latest sensor data' });
  }
});

// Add sensor data (from ESP32 - public endpoint)
app.post('/api/sensor-data', async (req, res) => {
  try {
    const { device_name, data } = req.body;
    
    if (!device_name || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Device name and data array are required' });
    }

    // Device must exist
    const device = await db.getDeviceByName(device_name);
    if (!device) {
      return res.status(404).json({ error: 'Device not found. Please register device first.' });
    }
    
    // Get all sensors for this device
    const sensors = await db.getSensorsByDevice(device.id);
    
    // Insert data for each sensor
    const results = [];
    for (const item of data) {
      const sensor = sensors.find(s => s.sensor_name === item.sensor_name);
      if (sensor && sensor.is_active) {
        const sensorData = await db.insertSensorData(sensor.id, item.value);
        results.push(sensorData);
      }
    }
    
    // Broadcast to WebSocket clients
    broadcast({ 
      type: 'sensor_data', 
      device_name,
      device_id: device.id,
      data: results 
    });
    
    res.json({ success: true, inserted: results.length });
  } catch (error) {
    console.error('Error inserting sensor data:', error);
    res.status(500).json({ error: 'Failed to insert sensor data' });
  }
});

// ============================================
// MODBUS CONFIGURATION
// ============================================

// Get all Modbus maps
app.get('/api/modbus-maps', async (req, res) => {
  try {
    const maps = await db.getAllModbusMaps();
    res.json(maps);
  } catch (error) {
    console.error('Error fetching Modbus maps:', error);
    res.status(500).json({ error: 'Failed to fetch Modbus maps' });
  }
});

// Get Modbus maps by device
app.get('/api/devices/:deviceId/modbus-maps', async (req, res) => {
  try {
    const maps = await db.getModbusMapsByDevice(parseInt(req.params.deviceId));
    res.json(maps);
  } catch (error) {
    console.error('Error fetching device Modbus maps:', error);
    res.status(500).json({ error: 'Failed to fetch device Modbus maps' });
  }
});

// Get Modbus map by sensor
app.get('/api/sensors/:sensorId/modbus-map', async (req, res) => {
  try {
    const map = await db.getModbusMapBySensor(parseInt(req.params.sensorId));
    if (!map) {
      return res.status(404).json({ error: 'Modbus map not found' });
    }
    res.json(map);
  } catch (error) {
    console.error('Error fetching Modbus map:', error);
    res.status(500).json({ error: 'Failed to fetch Modbus map' });
  }
});

// Create Modbus map for sensor
app.post('/api/sensors/:sensorId/modbus-map', authMiddleware, async (req, res) => {
  try {
    const { modbus_address, register_type, data_type, scale_factor, offset } = req.body;
    const sensorId = parseInt(req.params.sensorId);
    
    if (!modbus_address || !register_type || !data_type) {
      return res.status(400).json({ error: 'Modbus address, register type, and data type are required' });
    }
    
    const map = await db.insertModbusMap(
      sensorId,
      modbus_address,
      register_type,
      data_type,
      scale_factor || 1.0,
      offset || 0.0
    );
    res.json(map);
  } catch (error) {
    console.error('Error creating Modbus map:', error);
    res.status(500).json({ error: 'Failed to create Modbus map' });
  }
});

// Update Modbus map
app.put('/api/modbus-maps/:id', authMiddleware, async (req, res) => {
  try {
    const { modbus_address, register_type, data_type, scale_factor, offset } = req.body;
    const map = await db.updateModbusMap(
      parseInt(req.params.id),
      modbus_address,
      register_type,
      data_type,
      scale_factor,
      offset
    );
    res.json(map);
  } catch (error) {
    console.error('Error updating Modbus map:', error);
    res.status(500).json({ error: 'Failed to update Modbus map' });
  }
});

// Delete Modbus map
app.delete('/api/modbus-maps/:id', authMiddleware, async (req, res) => {
  try {
    await db.deleteModbusMap(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Modbus map:', error);
    res.status(500).json({ error: 'Failed to delete Modbus map' });
  }
});

// ============================================
// SETTINGS
// ============================================

// Get all settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get setting by key
app.get('/api/settings/:key', async (req, res) => {
  try {
    const setting = await db.getSetting(req.params.key);
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(setting);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update setting
app.put('/api/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const setting = await db.updateSetting(req.params.key, value);
    
    // Broadcast to WebSocket clients
    broadcast({ type: 'setting_update', data: setting });
    
    res.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ============================================
// STATISTICS
// ============================================

// Get statistics (filtered by organization)
app.get('/api/statistics', authMiddleware, async (req, res) => {
  try {
    const { deviceId, sensorId, start_date, end_date } = req.query;
    
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    
    const stats = await db.getStatistics(
      deviceId ? parseInt(deviceId) : null,
      sensorId ? parseInt(sensorId) : null,
      start_date,
      end_date,
      organizationId
    );
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================
// DATA EXPORT
// ============================================

// Export data as CSV (filtered by organization)
app.get('/api/export/csv', authMiddleware, async (req, res) => {
  try {
    const { deviceId, sensorId, start_date, end_date } = req.query;
    
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    
    const data = await db.getSensorData({
      deviceId: deviceId ? parseInt(deviceId) : null,
      sensorId: sensorId ? parseInt(sensorId) : null,
      start_date,
      end_date,
      limit: 1000000,  // No limit for export
      organizationId
    });
    
    // Generate CSV
    const csv = [
      'Timestamp,Device Name,Sensor Name,Sensor Type,Value,Unit',
      ...data.map(row => 
        `${row.timestamp},${row.device_name},${row.sensor_name},${row.sensor_type},${row.value},${row.unit || ''}`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sensor-data-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

db.initialize()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Solar Monitoring Backend running on port ${PORT}`);
      console.log(`📊 API: http://0.0.0.0:${PORT}/api`);
      console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}/ws`);
    });
  })
  .catch(error => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    db.close();
    process.exit(0);
  });
});
