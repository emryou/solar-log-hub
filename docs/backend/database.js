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
      // Devices table
      `CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  // DEVICES
  // ============================================

  async getAllDevices() {
    return this.all(
      `SELECT * FROM devices ORDER BY name ASC`
    );
  }

  async getDeviceByName(name) {
    return this.get(
      `SELECT * FROM devices WHERE name = ?`,
      [name]
    );
  }

  async upsertDevice(name, ip_address = null, description = null) {
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
      await this.run(
        `INSERT INTO devices (name, ip_address, description) 
         VALUES (?, ?, ?)`,
        [name, ip_address, description]
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

  async getSensorData({ device_name, start_date, end_date, limit = 1000 }) {
    let sql = `SELECT * FROM sensor_data WHERE 1=1`;
    const params = [];

    if (device_name) {
      sql += ` AND device_name = ?`;
      params.push(device_name);
    }

    if (start_date) {
      sql += ` AND timestamp >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND timestamp <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
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

  async getStatistics(device_name, start_date, end_date) {
    let sql = `
      SELECT 
        COUNT(*) as total_records,
        AVG(radiation) as avg_radiation,
        MAX(radiation) as max_radiation,
        MIN(radiation) as min_radiation,
        AVG(temperature1) as avg_temp1,
        MAX(temperature1) as max_temp1,
        MIN(temperature1) as min_temp1,
        AVG(temperature2) as avg_temp2,
        MAX(temperature2) as max_temp2,
        MIN(temperature2) as min_temp2
      FROM sensor_data 
      WHERE 1=1
    `;
    const params = [];

    if (device_name) {
      sql += ` AND device_name = ?`;
      params.push(device_name);
    }

    if (start_date) {
      sql += ` AND timestamp >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND timestamp <= ?`;
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
