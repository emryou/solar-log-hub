/*
 * Solar Radiation Monitoring System - ESP32 Client
 * 
 * Hardware Required:
 * - ESP32 Development Board
 * - Ethernet Module (W5500 or similar)
 * - RS485 Module (MAX485 or similar)
 * - IMT Solar Radiation Sensor (Modbus RTU)
 * 
 * Libraries Required:
 * - Ethernet (by Various)
 * - ModbusMaster (by Doc Walker)
 * - ArduinoJson (by Benoit Blanchon)
 * - WebServer (built-in for ESP32)
 * - Preferences (built-in for ESP32)
 */

#include <Ethernet.h>
#include <ModbusMaster.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ============================================
// CONFIGURATION (Modify these values)
// ============================================

// Device Identification
const char* DEFAULT_DEVICE_NAME = "ESP32-SOLAR-001";  // Change for each device

// Server Configuration
const char* DEFAULT_SERVER_HOST = "192.168.1.100";    // Raspberry Pi IP
const int DEFAULT_SERVER_PORT = 5000;

// Network Configuration
bool DEFAULT_USE_DHCP = true;
byte DEFAULT_MAC[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 };  // Change for each device
IPAddress DEFAULT_STATIC_IP(192, 168, 1, 50);
IPAddress DEFAULT_GATEWAY(192, 168, 1, 1);
IPAddress DEFAULT_SUBNET(255, 255, 255, 0);
IPAddress DEFAULT_DNS(8, 8, 8, 8);

// Modbus RS485 Configuration
#define RS485_RX 16
#define RS485_TX 17
#define RS485_DE 4    // Driver Enable
#define RS485_RE 4    // Receiver Enable (same pin)
#define MODBUS_BAUD 9600
#define MODBUS_SLAVE_ADDRESS 1

// Data Collection
unsigned long DEFAULT_SEND_INTERVAL = 300000;  // 5 minutes in milliseconds

// ============================================
// GLOBAL VARIABLES
// ============================================

Preferences preferences;
ModbusMaster modbus;
WebServer webServer(80);
EthernetClient ethClient;

// Runtime configuration (loaded from Preferences)
String deviceName;
String serverHost;
int serverPort;
bool useDHCP;
IPAddress staticIP;
IPAddress gateway;
IPAddress subnet;
unsigned long sendInterval;

unsigned long lastSendTime = 0;
bool ethernetConnected = false;

// Sensor data
float radiation = 0.0;
float temperature1 = 0.0;
float temperature2 = 0.0;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n================================");
  Serial.println("Solar Monitoring ESP32 Client");
  Serial.println("================================\n");

  // Initialize RS485
  pinMode(RS485_DE, OUTPUT);
  pinMode(RS485_RE, OUTPUT);
  digitalWrite(RS485_DE, LOW);
  digitalWrite(RS485_RE, LOW);
  
  // Initialize Modbus
  Serial1.begin(MODBUS_BAUD, SERIAL_8N1, RS485_RX, RS485_TX);
  modbus.begin(MODBUS_SLAVE_ADDRESS, Serial1);
  modbus.preTransmission(preTransmission);
  modbus.postTransmission(postTransmission);
  
  Serial.println("✓ RS485/Modbus initialized");

  // Load configuration from Preferences
  loadConfiguration();

  // Initialize Ethernet
  initEthernet();

  // Start Web Server
  setupWebServer();
  webServer.begin();
  
  Serial.println("\n✓ System ready!");
  Serial.println("================================\n");
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  // Handle web server requests
  webServer.handleClient();

  // Check Ethernet connection
  if (!ethernetConnected) {
    Serial.println("⚠ Ethernet not connected, retrying...");
    initEthernet();
    delay(5000);
    return;
  }

  // Send data at configured interval
  unsigned long currentTime = millis();
  if (currentTime - lastSendTime >= sendInterval || lastSendTime == 0) {
    lastSendTime = currentTime;
    
    // Read sensor data
    if (readSensorData()) {
      // Send to server
      sendDataToServer();
    } else {
      Serial.println("❌ Failed to read sensor data");
    }
  }

  delay(100);  // Small delay to prevent watchdog issues
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

void loadConfiguration() {
  preferences.begin("solar-config", false);
  
  deviceName = preferences.getString("deviceName", DEFAULT_DEVICE_NAME);
  serverHost = preferences.getString("serverHost", DEFAULT_SERVER_HOST);
  serverPort = preferences.getInt("serverPort", DEFAULT_SERVER_PORT);
  useDHCP = preferences.getBool("useDHCP", DEFAULT_USE_DHCP);
  sendInterval = preferences.getULong("sendInterval", DEFAULT_SEND_INTERVAL);
  
  // Load IP addresses (stored as strings)
  String ipStr = preferences.getString("staticIP", "");
  if (ipStr.length() > 0) {
    staticIP.fromString(ipStr);
  } else {
    staticIP = DEFAULT_STATIC_IP;
  }
  
  String gwStr = preferences.getString("gateway", "");
  if (gwStr.length() > 0) {
    gateway.fromString(gwStr);
  } else {
    gateway = DEFAULT_GATEWAY;
  }
  
  String snStr = preferences.getString("subnet", "");
  if (snStr.length() > 0) {
    subnet.fromString(snStr);
  } else {
    subnet = DEFAULT_SUBNET;
  }
  
  preferences.end();
  
  Serial.println("Configuration loaded:");
  Serial.println("  Device Name: " + deviceName);
  Serial.println("  Server: " + serverHost + ":" + String(serverPort));
  Serial.println("  DHCP: " + String(useDHCP ? "Yes" : "No"));
  Serial.println("  Send Interval: " + String(sendInterval / 1000) + "s");
}

void saveConfiguration() {
  preferences.begin("solar-config", false);
  
  preferences.putString("deviceName", deviceName);
  preferences.putString("serverHost", serverHost);
  preferences.putInt("serverPort", serverPort);
  preferences.putBool("useDHCP", useDHCP);
  preferences.putULong("sendInterval", sendInterval);
  preferences.putString("staticIP", staticIP.toString());
  preferences.putString("gateway", gateway.toString());
  preferences.putString("subnet", subnet.toString());
  
  preferences.end();
  
  Serial.println("✓ Configuration saved");
}

// ============================================
// ETHERNET
// ============================================

void initEthernet() {
  Serial.println("Initializing Ethernet...");
  
  if (useDHCP) {
    Serial.println("  Using DHCP...");
    if (Ethernet.begin(DEFAULT_MAC) == 0) {
      Serial.println("❌ DHCP failed");
      ethernetConnected = false;
      return;
    }
  } else {
    Serial.println("  Using Static IP...");
    Ethernet.begin(DEFAULT_MAC, staticIP, gateway, subnet);
  }
  
  delay(1500);  // Give Ethernet time to initialize
  
  Serial.print("✓ Ethernet connected - IP: ");
  Serial.println(Ethernet.localIP());
  
  ethernetConnected = true;
}

// ============================================
// MODBUS COMMUNICATION
// ============================================

void preTransmission() {
  digitalWrite(RS485_DE, HIGH);
  digitalWrite(RS485_RE, HIGH);
}

void postTransmission() {
  digitalWrite(RS485_DE, LOW);
  digitalWrite(RS485_RE, LOW);
}

bool readSensorData() {
  Serial.println("\n--- Reading Sensor Data ---");
  
  uint8_t result;
  uint16_t data[3];
  
  // Read 3 holding registers starting at address 0
  result = modbus.readHoldingRegisters(0, 3);
  
  if (result == modbus.ku8MBSuccess) {
    // Radiation (Register 0)
    data[0] = modbus.getResponseBuffer(0);
    radiation = data[0] * 1.0;  // W/m²
    
    // Temperature 1 (Register 1)
    data[1] = modbus.getResponseBuffer(1);
    temperature1 = data[1] * 0.1;  // °C (with 0.1 multiplier)
    
    // Temperature 2 (Register 2)
    data[2] = modbus.getResponseBuffer(2);
    temperature2 = data[2] * 0.1;  // °C (with 0.1 multiplier)
    
    Serial.println("Radiation: " + String(radiation, 1) + " W/m²");
    Serial.println("Temperature 1: " + String(temperature1, 1) + " °C");
    Serial.println("Temperature 2: " + String(temperature2, 1) + " °C");
    
    return true;
  } else {
    Serial.print("❌ Modbus read failed, error code: 0x");
    Serial.println(result, HEX);
    return false;
  }
}

// ============================================
// HTTP CLIENT
// ============================================

void sendDataToServer() {
  Serial.println("\n--- Sending Data to Server ---");
  
  if (ethClient.connect(serverHost.c_str(), serverPort)) {
    Serial.println("✓ Connected to server");
    
    // Prepare JSON payload
    StaticJsonDocument<256> doc;
    doc["device_name"] = deviceName;
    doc["radiation"] = radiation;
    doc["temperature1"] = temperature1;
    doc["temperature2"] = temperature2;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    // Send HTTP POST request
    ethClient.println("POST /api/sensor-data HTTP/1.1");
    ethClient.println("Host: " + serverHost);
    ethClient.println("Content-Type: application/json");
    ethClient.print("Content-Length: ");
    ethClient.println(jsonPayload.length());
    ethClient.println("Connection: close");
    ethClient.println();
    ethClient.println(jsonPayload);
    
    Serial.println("Request sent:");
    Serial.println(jsonPayload);
    
    // Wait for response
    unsigned long timeout = millis();
    while (ethClient.connected() && !ethClient.available()) {
      if (millis() - timeout > 5000) {
        Serial.println("⚠ Response timeout");
        ethClient.stop();
        return;
      }
      delay(10);
    }
    
    // Read response
    while (ethClient.available()) {
      String line = ethClient.readStringUntil('\r');
      Serial.print(line);
    }
    Serial.println("\n✓ Data sent successfully");
    
    ethClient.stop();
  } else {
    Serial.println("❌ Connection to server failed");
  }
}

// ============================================
// WEB SERVER
// ============================================

void setupWebServer() {
  // Root page - Configuration UI
  webServer.on("/", HTTP_GET, handleRoot);
  
  // API endpoints
  webServer.on("/api/config", HTTP_GET, handleGetConfig);
  webServer.on("/api/config", HTTP_POST, handleSetConfig);
  webServer.on("/api/status", HTTP_GET, handleGetStatus);
  webServer.on("/api/restart", HTTP_POST, handleRestart);
  
  Serial.println("✓ Web server started on port 80");
  Serial.print("  Access at: http://");
  Serial.println(Ethernet.localIP());
}

void handleRoot() {
  String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESP32 Solar Monitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 20px; text-align: center; }
    .section { margin-bottom: 25px; }
    .section h2 { color: #555; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; }
    .field { margin-bottom: 15px; }
    label { display: block; font-weight: bold; margin-bottom: 5px; color: #666; }
    input[type="text"], input[type="number"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; }
    input[type="checkbox"] { margin-right: 10px; }
    button { background: #4CAF50; color: white; border: none; padding: 12px 30px; border-radius: 5px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 10px; }
    button:hover { background: #45a049; }
    button.danger { background: #f44336; }
    button.danger:hover { background: #da190b; }
    .status { padding: 15px; background: #e8f5e9; border-left: 4px solid #4CAF50; margin-bottom: 20px; border-radius: 5px; }
    .status-item { margin-bottom: 8px; }
    .status-label { font-weight: bold; color: #2e7d32; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌞 ESP32 Solar Monitor</h1>
    
    <div class="status">
      <div class="status-item"><span class="status-label">Device:</span> <span id="deviceName">-</span></div>
      <div class="status-item"><span class="status-label">IP Address:</span> <span id="ipAddress">-</span></div>
      <div class="status-item"><span class="status-label">Radiation:</span> <span id="radiation">-</span> W/m²</div>
      <div class="status-item"><span class="status-label">Temperature 1:</span> <span id="temp1">-</span> °C</div>
      <div class="status-item"><span class="status-label">Temperature 2:</span> <span id="temp2">-</span> °C</div>
    </div>

    <form onsubmit="saveConfig(event)">
      <div class="section">
        <h2>Device Configuration</h2>
        <div class="field">
          <label>Device Name:</label>
          <input type="text" id="cfgDeviceName" required>
        </div>
      </div>

      <div class="section">
        <h2>Server Configuration</h2>
        <div class="field">
          <label>Server IP Address:</label>
          <input type="text" id="cfgServerHost" required>
        </div>
        <div class="field">
          <label>Server Port:</label>
          <input type="number" id="cfgServerPort" required>
        </div>
      </div>

      <div class="section">
        <h2>Network Configuration</h2>
        <div class="field">
          <label>
            <input type="checkbox" id="cfgUseDHCP"> Use DHCP
          </label>
        </div>
        <div id="staticIPFields">
          <div class="field">
            <label>Static IP Address:</label>
            <input type="text" id="cfgStaticIP">
          </div>
          <div class="field">
            <label>Gateway:</label>
            <input type="text" id="cfgGateway">
          </div>
          <div class="field">
            <label>Subnet Mask:</label>
            <input type="text" id="cfgSubnet">
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Data Collection</h2>
        <div class="field">
          <label>Send Interval (seconds):</label>
          <input type="number" id="cfgInterval" min="10" required>
        </div>
      </div>

      <button type="submit">Save Configuration</button>
      <button type="button" class="danger" onclick="restartESP()">Restart Device</button>
    </form>
  </div>

  <script>
    function loadConfig() {
      fetch('/api/config')
        .then(r => r.json())
        .then(data => {
          document.getElementById('cfgDeviceName').value = data.deviceName;
          document.getElementById('cfgServerHost').value = data.serverHost;
          document.getElementById('cfgServerPort').value = data.serverPort;
          document.getElementById('cfgUseDHCP').checked = data.useDHCP;
          document.getElementById('cfgStaticIP').value = data.staticIP;
          document.getElementById('cfgGateway').value = data.gateway;
          document.getElementById('cfgSubnet').value = data.subnet;
          document.getElementById('cfgInterval').value = data.sendInterval / 1000;
          toggleStaticIP();
        });
    }

    function loadStatus() {
      fetch('/api/status')
        .then(r => r.json())
        .then(data => {
          document.getElementById('deviceName').textContent = data.deviceName;
          document.getElementById('ipAddress').textContent = data.ipAddress;
          document.getElementById('radiation').textContent = data.radiation.toFixed(1);
          document.getElementById('temp1').textContent = data.temperature1.toFixed(1);
          document.getElementById('temp2').textContent = data.temperature2.toFixed(1);
        });
    }

    function saveConfig(e) {
      e.preventDefault();
      
      const config = {
        deviceName: document.getElementById('cfgDeviceName').value,
        serverHost: document.getElementById('cfgServerHost').value,
        serverPort: parseInt(document.getElementById('cfgServerPort').value),
        useDHCP: document.getElementById('cfgUseDHCP').checked,
        staticIP: document.getElementById('cfgStaticIP').value,
        gateway: document.getElementById('cfgGateway').value,
        subnet: document.getElementById('cfgSubnet').value,
        sendInterval: parseInt(document.getElementById('cfgInterval').value) * 1000
      };

      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      .then(r => r.json())
      .then(data => {
        alert('Configuration saved! Restart device to apply changes.');
      })
      .catch(err => {
        alert('Error saving configuration: ' + err);
      });
    }

    function restartESP() {
      if (confirm('Are you sure you want to restart the device?')) {
        fetch('/api/restart', { method: 'POST' })
          .then(() => {
            alert('Device is restarting...');
            setTimeout(() => location.reload(), 10000);
          });
      }
    }

    function toggleStaticIP() {
      const useDHCP = document.getElementById('cfgUseDHCP').checked;
      document.getElementById('staticIPFields').style.display = useDHCP ? 'none' : 'block';
    }

    document.getElementById('cfgUseDHCP').addEventListener('change', toggleStaticIP);

    loadConfig();
    loadStatus();
    setInterval(loadStatus, 10000);  // Update status every 10 seconds
  </script>
</body>
</html>
)rawliteral";
  
  webServer.send(200, "text/html", html);
}

void handleGetConfig() {
  StaticJsonDocument<512> doc;
  
  doc["deviceName"] = deviceName;
  doc["serverHost"] = serverHost;
  doc["serverPort"] = serverPort;
  doc["useDHCP"] = useDHCP;
  doc["staticIP"] = staticIP.toString();
  doc["gateway"] = gateway.toString();
  doc["subnet"] = subnet.toString();
  doc["sendInterval"] = sendInterval;
  
  String json;
  serializeJson(doc, json);
  
  webServer.send(200, "application/json", json);
}

void handleSetConfig() {
  if (webServer.hasArg("plain")) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, webServer.arg("plain"));
    
    if (error) {
      webServer.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
      return;
    }
    
    // Update configuration
    deviceName = doc["deviceName"].as<String>();
    serverHost = doc["serverHost"].as<String>();
    serverPort = doc["serverPort"];
    useDHCP = doc["useDHCP"];
    staticIP.fromString(doc["staticIP"].as<String>());
    gateway.fromString(doc["gateway"].as<String>());
    subnet.fromString(doc["subnet"].as<String>());
    sendInterval = doc["sendInterval"];
    
    // Save to Preferences
    saveConfiguration();
    
    webServer.send(200, "application/json", "{\"success\":true}");
  } else {
    webServer.send(400, "application/json", "{\"error\":\"No data received\"}");
  }
}

void handleGetStatus() {
  StaticJsonDocument<256> doc;
  
  doc["deviceName"] = deviceName;
  doc["ipAddress"] = Ethernet.localIP().toString();
  doc["radiation"] = radiation;
  doc["temperature1"] = temperature1;
  doc["temperature2"] = temperature2;
  doc["uptime"] = millis() / 1000;
  
  String json;
  serializeJson(doc, json);
  
  webServer.send(200, "application/json", json);
}

void handleRestart() {
  webServer.send(200, "application/json", "{\"success\":true}");
  delay(1000);
  ESP.restart();
}
