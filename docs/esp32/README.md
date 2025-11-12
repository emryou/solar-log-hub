# ESP32 Solar Sensor Client - Firmware

## Overview

This firmware enables ESP32 to read solar radiation sensor data via RS485/Modbus and send it to the Raspberry Pi backend via Ethernet.

## Features

- ✅ Modbus RTU communication (RS485)
- ✅ Ethernet connectivity (W5500)
- ✅ Auto-registration with server
- ✅ Web-based configuration interface
- ✅ Persistent settings (stored in flash)
- ✅ DHCP or Static IP
- ✅ Configurable data send interval
- ✅ Real-time sensor reading

## Hardware Connections

### Ethernet Module (W5500)

| ESP32 Pin | W5500 Pin |
|-----------|-----------|
| 3.3V      | VCC       |
| GND       | GND       |
| GPIO 18   | SCK       |
| GPIO 23   | MOSI      |
| GPIO 19   | MISO      |
| GPIO 5    | CS        |

### RS485 Module (MAX485)

| ESP32 Pin | MAX485 Pin |
|-----------|------------|
| 3.3V      | VCC        |
| GND       | GND        |
| GPIO 17   | TX (DI)    |
| GPIO 16   | RX (RO)    |
| GPIO 4    | DE & RE    |

### IMT Solar Sensor

Connect to RS485 module's A and B terminals according to sensor manual.

## Installation

### 1. Install Arduino IDE

Download from: https://arduino.cc/download

### 2. Add ESP32 Board Support

1. Open Arduino IDE
2. Go to: File → Preferences
3. Add to "Additional Board Manager URLs":
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Go to: Tools → Board → Boards Manager
5. Search for "ESP32" and install

### 3. Install Required Libraries

Go to: Tools → Manage Libraries

Install these libraries:
- **Ethernet** (by Various)
- **ModbusMaster** (by Doc Walker)  
- **ArduinoJson** (by Benoit Blanchon)
- **WebServer** (built-in for ESP32)
- **Preferences** (built-in for ESP32)

### 4. Configure the Firmware

Open `esp32_sensor_client.ino` and modify these settings:

```cpp
// Device Identification (UNIQUE FOR EACH ESP32!)
const char* DEFAULT_DEVICE_NAME = "ESP32-SOLAR-001";

// Server Configuration (Your Raspberry Pi)
const char* DEFAULT_SERVER_HOST = "192.168.1.100";  // Change to your Pi IP
const int DEFAULT_SERVER_PORT = 5000;

// MAC Address (UNIQUE FOR EACH ESP32!)
byte DEFAULT_MAC[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 };
```

**IMPORTANT:** Each ESP32 must have:
- Unique device name
- Unique MAC address (change last byte: 0x01, 0x02, 0x03, etc.)

### 5. Upload to ESP32

1. Connect ESP32 via USB
2. Select: Tools → Board → "ESP32 Dev Module"
3. Select: Tools → Port → (your COM port)
4. Click Upload button (→)

### 6. Monitor Serial Output

1. Open Serial Monitor (Ctrl+Shift+M)
2. Set baud rate to 115200
3. Watch for connection messages and IP address

## Configuration

### Via Web Interface (Recommended)

1. Find ESP32's IP address from Serial Monitor
2. Open browser: `http://<esp32-ip>`
3. Configure:
   - Device name
   - Server IP and port
   - Network settings (DHCP/Static)
   - Data send interval

### Via Code (Initial Setup)

Modify these constants in the firmware:

```cpp
// Network
bool DEFAULT_USE_DHCP = true;  // true = DHCP, false = Static IP
IPAddress DEFAULT_STATIC_IP(192, 168, 1, 50);
IPAddress DEFAULT_GATEWAY(192, 168, 1, 1);
IPAddress DEFAULT_SUBNET(255, 255, 255, 0);

// Data Collection
unsigned long DEFAULT_SEND_INTERVAL = 300000;  // milliseconds (5 min)

// Modbus
#define MODBUS_SLAVE_ADDRESS 1  // Your sensor's Modbus address
```

## Modbus Register Configuration

The firmware reads 3 holding registers by default:

- **Register 0**: Radiation (W/m²) - multiplier: 1.0
- **Register 1**: Temperature 1 (°C) - multiplier: 0.1
- **Register 2**: Temperature 2 (°C) - multiplier: 0.1

To modify for your sensor, edit the `readSensorData()` function:

```cpp
bool readSensorData() {
  // Change register address and count here
  result = modbus.readHoldingRegisters(0, 3);  // Start: 0, Count: 3
  
  // Adjust data extraction
  data[0] = modbus.getResponseBuffer(0);
  radiation = data[0] * 1.0;  // Change multiplier if needed
  
  // Add more registers if needed
  // data[3] = modbus.getResponseBuffer(3);
  // humidity = data[3] * 0.1;
}
```

## Adding Multiple ESP32 Devices

For each additional ESP32:

1. **Change Device Name:**
   ```cpp
   const char* DEFAULT_DEVICE_NAME = "ESP32-SOLAR-002";  // Increment number
   ```

2. **Change MAC Address:**
   ```cpp
   byte DEFAULT_MAC[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x02 };  // Change last byte
   ```

3. **Upload firmware**

4. **Device auto-registers** with server on first data send

## Troubleshooting

### ESP32 Won't Connect to Ethernet

1. Check wiring (especially SPI connections)
2. Try DHCP first, then Static IP
3. Check Serial Monitor for error messages
4. Verify Ethernet cable is connected

### Can't Read Sensor Data

1. Check RS485 wiring (A, B terminals)
2. Verify Modbus slave address matches sensor
3. Check baud rate (default: 9600)
4. Test with Modbus polling tool first

### Data Not Reaching Server

1. Check server IP address is correct
2. Verify server is running: `docker-compose ps`
3. Test API manually: `curl http://<pi-ip>:5000/api/health`
4. Check firewall settings on Raspberry Pi

### Web Interface Not Loading

1. Find IP from Serial Monitor
2. Try `http://<ip>` not `https://`
3. Check if on same network as ESP32

### Configuration Not Saving

1. Settings are stored in ESP32 flash
2. If issues persist, erase flash:
   - Tools → Erase Flash → "All Flash Contents"
   - Re-upload firmware

## LED Status Indicators (Optional)

Add LED indicators by connecting LEDs to GPIOs:

```cpp
#define LED_ETHERNET 2   // Ethernet connected
#define LED_SENDING 15   // Sending data
#define LED_ERROR 13     // Error state

// In setup():
pinMode(LED_ETHERNET, OUTPUT);
pinMode(LED_SENDING, OUTPUT);
pinMode(LED_ERROR, OUTPUT);

// Then use throughout code:
digitalWrite(LED_ETHERNET, ethernetConnected ? HIGH : LOW);
```

## Power Considerations

- ESP32 + Ethernet + RS485 ≈ 500mA at 5V
- Use 5V 1A power supply minimum
- For outdoor installations, use weatherproof enclosure
- Consider surge protection for RS485 lines

## Updating Firmware

To update firmware OTA (Over-The-Air):

1. Modify code
2. Upload via USB (OTA not implemented yet)
3. Or add ArduinoOTA library for wireless updates

## Serial Monitor Output Example

```
================================
Solar Monitoring ESP32 Client
================================

✓ RS485/Modbus initialized
Configuration loaded:
  Device Name: ESP32-SOLAR-001
  Server: 192.168.1.100:5000
  DHCP: Yes
  Send Interval: 300s
Initializing Ethernet...
  Using DHCP...
✓ Ethernet connected - IP: 192.168.1.151
✓ Web server started on port 80
  Access at: http://192.168.1.151

✓ System ready!
================================

--- Reading Sensor Data ---
Radiation: 850.5 W/m²
Temperature 1: 45.2 °C
Temperature 2: 43.8 °C

--- Sending Data to Server ---
✓ Connected to server
Request sent:
{"device_name":"ESP32-SOLAR-001","radiation":850.5,"temperature1":45.2,"temperature2":43.8}
✓ Data sent successfully
```

## API Endpoints (ESP32 Web Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Configuration web interface |
| `/api/config` | GET | Get current configuration |
| `/api/config` | POST | Update configuration |
| `/api/status` | GET | Get current status and sensor data |
| `/api/restart` | POST | Restart ESP32 |

## License

MIT License - Free for commercial use
