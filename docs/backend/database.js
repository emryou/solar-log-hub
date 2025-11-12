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
      
      // Sensor data table
      `CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_name TEXT NOT NULL,
        radiation REAL,
        temperature1 REAL,
        temperature2 REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_name) REFERENCES devices(name) ON DELETE CASCADE
      )`,
      
      // Modbus maps table
      `CREATE TABLE IF NOT EXISTS modbus_maps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_name TEXT UNIQUE NOT NULL,
        modbus_address INTEGER NOT NULL,
        registers TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_sensor_data_device 
       ON sensor_data(device_name)`,
      
      `CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp 
       ON sensor_data(timestamp DESC)`,
      
      `CREATE INDEX IF NOT EXISTS idx_devices_active 
       ON devices(is_active)`
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
  // SENSOR DATA
  // ============================================

  async insertSensorData(device_name, radiation, temperature1, temperature2) {
    const result = await this.run(
      `INSERT INTO sensor_data (device_name, radiation, temperature1, temperature2) 
       VALUES (?, ?, ?, ?)`,
      [device_name, radiation, temperature1, temperature2]
    );
    
    // Update device last_seen
    await this.run(
      `UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE name = ?`,
      [device_name]
    );
    
    return this.get(
      `SELECT * FROM sensor_data WHERE id = ?`,
      [result.id]
    );
  }

  async getSensorData({ device_name, start_date, end_date, limit = 1000, organizationId = null }) {
    let sql = `SELECT sd.*, d.organization_id 
               FROM sensor_data sd 
               LEFT JOIN devices d ON sd.device_name = d.name 
               WHERE 1=1`;
    const params = [];

    if (organizationId) {
      sql += ` AND d.organization_id = ?`;
      params.push(organizationId);
    }

    if (device_name) {
      sql += ` AND sd.device_name = ?`;
      params.push(device_name);
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

  async getLatestSensorData(device_name) {
    return this.get(
      `SELECT * FROM sensor_data 
       WHERE device_name = ? 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [device_name]
    );
  }

  async getStatistics(device_name, start_date, end_date, organizationId = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_records,
        AVG(sd.radiation) as avg_radiation,
        MAX(sd.radiation) as max_radiation,
        MIN(sd.radiation) as min_radiation,
        AVG(sd.temperature1) as avg_temp1,
        MAX(sd.temperature1) as max_temp1,
        MIN(sd.temperature1) as min_temp1,
        AVG(sd.temperature2) as avg_temp2,
        MAX(sd.temperature2) as max_temp2,
        MIN(sd.temperature2) as min_temp2
      FROM sensor_data sd
      LEFT JOIN devices d ON sd.device_name = d.name
      WHERE 1=1
    `;
    const params = [];

    if (organizationId) {
      sql += ` AND d.organization_id = ?`;
      params.push(organizationId);
    }

    if (device_name) {
      sql += ` AND sd.device_name = ?`;
      params.push(device_name);
    }

    if (start_date) {
      sql += ` AND sd.timestamp >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND sd.timestamp <= ?`;
      params.push(end_date);
    }

    return this.get(sql, params);
  }

  // ============================================
  // MODBUS MAPS
  // ============================================

  async getAllModbusMaps() {
    return this.all(
      `SELECT * FROM modbus_maps ORDER BY sensor_name ASC`
    );
  }

  async getModbusMapById(id) {
    const map = await this.get(
      `SELECT * FROM modbus_maps WHERE id = ?`,
      [id]
    );
    
    if (map && map.registers) {
      map.registers = JSON.parse(map.registers);
    }
    
    return map;
  }

  async insertModbusMap(sensor_name, modbus_address, registers) {
    const result = await this.run(
      `INSERT INTO modbus_maps (sensor_name, modbus_address, registers) 
       VALUES (?, ?, ?)`,
      [sensor_name, modbus_address, JSON.stringify(registers)]
    );
    
    return this.getModbusMapById(result.id);
  }

  async updateModbusMap(id, sensor_name, modbus_address, registers) {
    await this.run(
      `UPDATE modbus_maps 
       SET sensor_name = ?, 
           modbus_address = ?, 
           registers = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sensor_name, modbus_address, JSON.stringify(registers), id]
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
