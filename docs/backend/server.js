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
// SENSOR DATA
// ============================================

// Get sensor data (filtered by organization)
app.get('/api/sensor-data', authMiddleware, async (req, res) => {
  try {
    const { device_name, start_date, end_date, limit = 1000 } = req.query;
    
    // Filter by organization for non-admin users
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    
    const data = await db.getSensorData({
      device_name,
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
app.get('/api/sensor-data/latest/:device_name', async (req, res) => {
  try {
    const data = await db.getLatestSensorData(req.params.device_name);
    if (!data) {
      return res.status(404).json({ error: 'No data found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching latest data:', error);
    res.status(500).json({ error: 'Failed to fetch latest data' });
  }
});

// Add sensor data (from ESP32 - public endpoint with device lookup)
app.post('/api/sensor-data', async (req, res) => {
  try {
    const { device_name, radiation, temperature1, temperature2 } = req.body;
    
    if (!device_name) {
      return res.status(400).json({ error: 'Device name is required' });
    }

    // Device must exist (registered through web interface)
    const device = await db.getDeviceByName(device_name);
    if (!device) {
      return res.status(404).json({ error: 'Device not found. Please register device first.' });
    }
    
    // Insert sensor data
    const data = await db.insertSensorData(
      device_name,
      radiation,
      temperature1,
      temperature2
    );
    
    // Broadcast to WebSocket clients
    broadcast({ type: 'sensor_data', data });
    
    res.json(data);
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

// Get Modbus map by ID
app.get('/api/modbus-maps/:id', async (req, res) => {
  try {
    const map = await db.getModbusMapById(req.params.id);
    if (!map) {
      return res.status(404).json({ error: 'Modbus map not found' });
    }
    res.json(map);
  } catch (error) {
    console.error('Error fetching Modbus map:', error);
    res.status(500).json({ error: 'Failed to fetch Modbus map' });
  }
});

// Create Modbus map
app.post('/api/modbus-maps', async (req, res) => {
  try {
    const { sensor_name, modbus_address, registers } = req.body;
    
    if (!sensor_name || !modbus_address || !registers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const map = await db.insertModbusMap(sensor_name, modbus_address, registers);
    res.json(map);
  } catch (error) {
    console.error('Error creating Modbus map:', error);
    res.status(500).json({ error: 'Failed to create Modbus map' });
  }
});

// Update Modbus map
app.put('/api/modbus-maps/:id', async (req, res) => {
  try {
    const { sensor_name, modbus_address, registers } = req.body;
    const map = await db.updateModbusMap(
      req.params.id,
      sensor_name,
      modbus_address,
      registers
    );
    res.json(map);
  } catch (error) {
    console.error('Error updating Modbus map:', error);
    res.status(500).json({ error: 'Failed to update Modbus map' });
  }
});

// Delete Modbus map
app.delete('/api/modbus-maps/:id', async (req, res) => {
  try {
    await db.deleteModbusMap(req.params.id);
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
    const { device_name, start_date, end_date } = req.query;
    
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    
    const stats = await db.getStatistics(device_name, start_date, end_date, organizationId);
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
    const { device_name, start_date, end_date } = req.query;
    
    const organizationId = req.user.role === 'admin' ? null : req.user.organization_id;
    
    const data = await db.getSensorData({
      device_name,
      start_date,
      end_date,
      limit: 1000000,  // No limit for export
      organizationId
    });
    
    // Generate CSV
    const csv = [
      'Timestamp,Device Name,Radiation (W/m²),Temperature 1 (°C),Temperature 2 (°C)',
      ...data.map(row => 
        `${row.timestamp},${row.device_name},${row.radiation || ''},${row.temperature1 || ''},${row.temperature2 || ''}`
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
