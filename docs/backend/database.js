const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'solar.db');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log(`✅ Connected to SQLite database: ${DB_PATH}`);
          this.createTables()
            .then(() => this.insertDefaultSettings())
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Organizations (companies/customers)
      `CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        organization_id INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CHECK (role IN ('admin', 'user', 'viewer'))
      )`,
      
      // Devices table (with organization_id)
      `CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        organization_id INTEGER NOT NULL,
        ip_address TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      )`,
      
      // Sensors table (her cihaz altında birden fazla sensör)
      `CREATE TABLE IF NOT EXISTS sensors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        sensor_name TEXT NOT NULL,
        sensor_type TEXT NOT NULL,
        unit TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        UNIQUE(device_id, sensor_name)
      )`,
      
      // Modbus maps table (her sensör için ayrı Modbus yapılandırması)
      `CREATE TABLE IF NOT EXISTS modbus_maps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id INTEGER NOT NULL,
        modbus_address INTEGER NOT NULL,
        register_type TEXT NOT NULL,
        data_type TEXT NOT NULL,
        scale_factor REAL DEFAULT 1.0,
        offset REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE,
        CHECK (register_type IN ('holding', 'input', 'coil', 'discrete')),
        CHECK (data_type IN ('int16', 'uint16', 'int32', 'uint32', 'float32'))
      )`,
      
      // Sensor data table (gerçek sensör verisi)
      `CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id INTEGER NOT NULL,
        value REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
      )`,
      
      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_sensor_data_sensor 
       ON sensor_data(sensor_id)`,
      
      `CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp 
       ON sensor_data(timestamp DESC)`,
      
      `CREATE INDEX IF NOT EXISTS idx_devices_active 
       ON devices(is_active)`,
       
      `CREATE INDEX IF NOT EXISTS idx_sensors_device 
       ON sensors(device_id)`,
       
      `CREATE INDEX IF NOT EXISTS idx_sensors_active 
       ON sensors(is_active)`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
    
    console.log('✅ Database tables created/verified');
  }

  async insertDefaultSettings() {
    const defaults = [
      ['data_interval', '300', 'Data collection interval in seconds (default: 5 minutes)'],
      ['retention_days', '365', 'Data retention period in days'],
      ['alarm_radiation_max', '1500', 'Maximum radiation alarm threshold (W/m²)'],
      ['alarm_temp_max', '70', 'Maximum temperature alarm threshold (°C)'],
      ['timezone', 'Europe/Istanbul', 'System timezone']
    ];

    for (const [key, value, description] of defaults) {
      await this.run(
        `INSERT OR IGNORE INTO settings (key, value, description) 
         VALUES (?, ?, ?)`,
        [key, value, description]
      );
    }
    
    // Create default admin user and organization
    await this.createDefaultAdmin();
  }

  async createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    
    // Check if admin exists
    const existingAdmin = await this.get(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
    );
    
    if (!existingAdmin) {
      // Create default organization
      await this.run(
        `INSERT OR IGNORE INTO organizations (name, contact_email) 
         VALUES (?, ?)`,
        ['System Admin', 'admin@solar-monitor.local']
      );
      
      const org = await this.get(
        `SELECT id FROM organizations WHERE name = 'System Admin'`
      );
      
      // Create admin user (password: admin123)
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      await this.run(
        `INSERT OR IGNORE INTO users (email, password_hash, full_name, role, organization_id) 
         VALUES (?, ?, ?, ?, ?)`,
        ['admin@solar-monitor.local', passwordHash, 'System Administrator', 'admin', org.id]
      );
      
      console.log('✅ Default admin created:');
      console.log('   Email: admin@solar-monitor.local');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    }
  }

  // Generic database operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // ============================================
  // USERS
  // ============================================

  async createUser(email, passwordHash, fullName, role, organizationId) {
    const result = await this.run(
      `INSERT INTO users (email, password_hash, full_name, role, organization_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [email, passwordHash, fullName, role, organizationId]
    );
    
    return this.getUserById(result.id);
  }

  async getUserById(id) {
    return this.get(
      `SELECT u.*, o.name as organization_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id 
       WHERE u.id = ?`,
      [id]
    );
  }

  async getUserByEmail(email) {
    return this.get(
      `SELECT u.*, o.name as organization_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id 
       WHERE u.email = ?`,
      [email]
    );
  }

  async updateUserLastLogin(userId) {
    return this.run(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId]
    );
  }

  async getAllUsers() {
    return this.all(
      `SELECT u.*, o.name as organization_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id 
       ORDER BY u.created_at DESC`
    );
  }

  // ============================================
  // ORGANIZATIONS
  // ============================================

  async createOrganization(name, contactEmail, contactPhone, address) {
    const result = await this.run(
      `INSERT INTO organizations (name, contact_email, contact_phone, address) 
       VALUES (?, ?, ?, ?)`,
      [name, contactEmail, contactPhone, address]
    );
    
    return this.getOrganizationById(result.id);
  }

  async getOrganizationById(id) {
    return this.get(
      `SELECT * FROM organizations WHERE id = ?`,
      [id]
    );
  }

  async getAllOrganizations() {
    return this.all(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
              (SELECT COUNT(*) FROM devices WHERE organization_id = o.id) as device_count
       FROM organizations o 
       ORDER BY o.name ASC`
    );
  }

  // ============================================
  // DEVICES
  // ============================================

  async getAllDevices(organizationId = null) {
    if (organizationId) {
      return this.all(
        `SELECT d.*, o.name as organization_name 
         FROM devices d 
         LEFT JOIN organizations o ON d.organization_id = o.id 
         WHERE d.organization_id = ? 
         ORDER BY d.name ASC`,
        [organizationId]
      );
    }
    
    return this.all(
      `SELECT d.*, o.name as organization_name 
       FROM devices d 
       LEFT JOIN organizations o ON d.organization_id = o.id 
       ORDER BY d.name ASC`
    );
  }

  async getDeviceByName(name) {
    return this.get(
      `SELECT d.*, o.name as organization_name 
       FROM devices d 
       LEFT JOIN organizations o ON d.organization_id = o.id 
       WHERE d.name = ?`,
      [name]
    );
  }

  async upsertDevice(name, organizationId, ip_address = null, description = null) {
    const existing = await this.getDeviceByName(name);
    
    if (existing) {
      await this.run(
        `UPDATE devices 
         SET ip_address = COALESCE(?, ip_address),
             description = COALESCE(?, description),
             last_seen = CURRENT_TIMESTAMP
         WHERE name = ?`,
        [ip_address, description, name]
      );
    } else {
      if (!organizationId) {
        throw new Error('organization_id is required for new devices');
      }
      
      await this.run(
        `INSERT INTO devices (name, organization_id, ip_address, description) 
         VALUES (?, ?, ?, ?)`,
        [name, organizationId, ip_address, description]
      );
    }
    
    return this.getDeviceByName(name);
  }

  async deleteDevice(id) {
    return this.run(
      `DELETE FROM devices WHERE id = ?`,
      [id]
    );
  }

  // ============================================
  // SENSORS
  // ============================================

  async createSensor(deviceId, sensorName, sensorType, unit = null) {
    const result = await this.run(
      `INSERT INTO sensors (device_id, sensor_name, sensor_type, unit) 
       VALUES (?, ?, ?, ?)`,
      [deviceId, sensorName, sensorType, unit]
    );
    
    return this.getSensorById(result.id);
  }

  async getSensorById(id) {
    return this.get(
      `SELECT s.*, d.name as device_name, d.organization_id
       FROM sensors s
       LEFT JOIN devices d ON s.device_id = d.id
       WHERE s.id = ?`,
      [id]
    );
  }

  async getSensorsByDevice(deviceId) {
    return this.all(
      `SELECT s.*, 
              (SELECT COUNT(*) FROM modbus_maps WHERE sensor_id = s.id) as modbus_config_count
       FROM sensors s
       WHERE s.device_id = ?
       ORDER BY s.sensor_name ASC`,
      [deviceId]
    );
  }

  async getAllSensorsWithDetails() {
    return this.all(
      `SELECT s.*, d.name as device_name, d.organization_id,
              (SELECT COUNT(*) FROM modbus_maps WHERE sensor_id = s.id) as modbus_config_count,
              (SELECT COUNT(*) FROM sensor_data WHERE sensor_id = s.id) as data_count
       FROM sensors s
       LEFT JOIN devices d ON s.device_id = d.id
       ORDER BY d.name, s.sensor_name ASC`
    );
  }

  async updateSensor(id, sensorName, sensorType, unit, isActive) {
    await this.run(
      `UPDATE sensors 
       SET sensor_name = ?, sensor_type = ?, unit = ?, is_active = ?
       WHERE id = ?`,
      [sensorName, sensorType, unit, isActive, id]
    );
    
    return this.getSensorById(id);
  }

  async deleteSensor(id) {
    return this.run(
      `DELETE FROM sensors WHERE id = ?`,
      [id]
    );
  }

  // ============================================
  // SENSOR DATA
  // ============================================

  async insertSensorData(sensorId, value) {
    const result = await this.run(
      `INSERT INTO sensor_data (sensor_id, value) 
       VALUES (?, ?)`,
      [sensorId, value]
    );
    
    // Update device last_seen
    const sensor = await this.getSensorById(sensorId);
    if (sensor) {
      await this.run(
        `UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [sensor.device_id]
      );
    }
    
    return this.get(
      `SELECT * FROM sensor_data WHERE id = ?`,
      [result.id]
    );
  }

  async bulkInsertSensorData(dataArray) {
    const stmt = this.db.prepare(
      `INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)`
    );
    
    for (const data of dataArray) {
      stmt.run(data.sensor_id, data.value, data.timestamp || new Date().toISOString());
    }
    
    stmt.finalize();
    
    // Update device last_seen for all affected devices
    const deviceIds = new Set();
    for (const data of dataArray) {
      const sensor = await this.getSensorById(data.sensor_id);
      if (sensor) deviceIds.add(sensor.device_id);
    }
    
    for (const deviceId of deviceIds) {
      await this.run(
        `UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [deviceId]
      );
    }
  }

  async getSensorData({ deviceId, sensorId, start_date, end_date, limit = 1000, organizationId = null }) {
    let sql = `SELECT sd.*, s.sensor_name, s.sensor_type, s.unit, 
                      d.name as device_name, d.organization_id
               FROM sensor_data sd
               LEFT JOIN sensors s ON sd.sensor_id = s.id
               LEFT JOIN devices d ON s.device_id = d.id
               WHERE 1=1`;
    const params = [];

    if (organizationId) {
      sql += ` AND d.organization_id = ?`;
      params.push(organizationId);
    }

    if (deviceId) {
      sql += ` AND s.device_id = ?`;
      params.push(deviceId);
    }

    if (sensorId) {
      sql += ` AND sd.sensor_id = ?`;
      params.push(sensorId);
    }

    if (start_date) {
      sql += ` AND sd.timestamp >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND sd.timestamp <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY sd.timestamp DESC LIMIT ?`;
    params.push(limit);

    return this.all(sql, params);
  }

  async getLatestSensorData(deviceId) {
    return this.all(
      `SELECT sd.*, s.sensor_name, s.sensor_type, s.unit
       FROM sensor_data sd
       INNER JOIN sensors s ON sd.sensor_id = s.id
       WHERE s.device_id = ? AND s.is_active = 1
       AND sd.id IN (
         SELECT MAX(id) FROM sensor_data 
         WHERE sensor_id IN (SELECT id FROM sensors WHERE device_id = ?)
         GROUP BY sensor_id
       )
       ORDER BY s.sensor_name ASC`,
      [deviceId, deviceId]
    );
  }

  async getLatestSensorDataBySensorId(sensorId) {
    return this.get(
      `SELECT sd.*, s.sensor_name, s.sensor_type, s.unit
       FROM sensor_data sd
       INNER JOIN sensors s ON sd.sensor_id = s.id
       WHERE sd.sensor_id = ?
       ORDER BY sd.timestamp DESC 
       LIMIT 1`,
      [sensorId]
    );
  }

  async getStatistics(deviceId = null, sensorId = null, start_date = null, end_date = null, organizationId = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_records,
        AVG(sd.value) as avg_value,
        MAX(sd.value) as max_value,
        MIN(sd.value) as min_value,
        s.sensor_name,
        s.sensor_type,
        s.unit,
        d.name as device_name
      FROM sensor_data sd
      LEFT JOIN sensors s ON sd.sensor_id = s.id
      LEFT JOIN devices d ON s.device_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (organizationId) {
      sql += ` AND d.organization_id = ?`;
      params.push(organizationId);
    }

    if (deviceId) {
      sql += ` AND s.device_id = ?`;
      params.push(deviceId);
    }

    if (sensorId) {
      sql += ` AND sd.sensor_id = ?`;
      params.push(sensorId);
    }

    if (start_date) {
      sql += ` AND sd.timestamp >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND sd.timestamp <= ?`;
      params.push(end_date);
    }

    sql += ` GROUP BY sd.sensor_id`;

    return this.all(sql, params);
  }

  // ============================================
  // MODBUS MAPS
  // ============================================

  async getAllModbusMaps() {
    return this.all(
      `SELECT mm.*, s.sensor_name, s.sensor_type, d.name as device_name
       FROM modbus_maps mm
       LEFT JOIN sensors s ON mm.sensor_id = s.id
       LEFT JOIN devices d ON s.device_id = d.id
       ORDER BY d.name, s.sensor_name ASC`
    );
  }

  async getModbusMapById(id) {
    return this.get(
      `SELECT mm.*, s.sensor_name, s.sensor_type, d.name as device_name
       FROM modbus_maps mm
       LEFT JOIN sensors s ON mm.sensor_id = s.id
       LEFT JOIN devices d ON s.device_id = d.id
       WHERE mm.id = ?`,
      [id]
    );
  }

  async getModbusMapBySensor(sensorId) {
    return this.get(
      `SELECT mm.*, s.sensor_name, s.sensor_type
       FROM modbus_maps mm
       LEFT JOIN sensors s ON mm.sensor_id = s.id
       WHERE mm.sensor_id = ?`,
      [sensorId]
    );
  }

  async getModbusMapsByDevice(deviceId) {
    return this.all(
      `SELECT mm.*, s.sensor_name, s.sensor_type
       FROM modbus_maps mm
       INNER JOIN sensors s ON mm.sensor_id = s.id
       WHERE s.device_id = ?
       ORDER BY mm.modbus_address ASC`,
      [deviceId]
    );
  }

  async insertModbusMap(sensorId, modbusAddress, registerType, dataType, scaleFactor = 1.0, offset = 0.0) {
    const result = await this.run(
      `INSERT INTO modbus_maps (sensor_id, modbus_address, register_type, data_type, scale_factor, offset) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sensorId, modbusAddress, registerType, dataType, scaleFactor, offset]
    );
    
    return this.getModbusMapById(result.id);
  }

  async updateModbusMap(id, modbusAddress, registerType, dataType, scaleFactor, offset) {
    await this.run(
      `UPDATE modbus_maps 
       SET modbus_address = ?, 
           register_type = ?, 
           data_type = ?,
           scale_factor = ?,
           offset = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [modbusAddress, registerType, dataType, scaleFactor, offset, id]
    );
    
    return this.getModbusMapById(id);
  }

  async deleteModbusMap(id) {
    return this.run(
      `DELETE FROM modbus_maps WHERE id = ?`,
      [id]
    );
  }

  // ============================================
  // SETTINGS
  // ============================================

  async getAllSettings() {
    return this.all(
      `SELECT * FROM settings ORDER BY key ASC`
    );
  }

  async getSetting(key) {
    return this.get(
      `SELECT * FROM settings WHERE key = ?`,
      [key]
    );
  }

  async updateSetting(key, value) {
    await this.run(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, value]
    );
    
    return this.getSetting(key);
  }

  // ============================================
  // CLEANUP
  // ============================================

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = { Database };
