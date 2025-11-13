// ESP32 Solar Monitoring System with Modbus RTU over RS485
// Hardware: ESP32 + RS485 Module + Ethernet Module
// Server: Raspberry Pi running backend API

#include <ETH.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ModbusMaster.h>

// Configuration
#define DEVICE_NAME "ESP32-SOLAR-001"  // Unique device name
String serverUrl = "http://192.168.1.100:5000/api";  // Raspberry Pi IP

// RS485 Configuration
#define RS485_RX 16
#define RS485_TX 17
#define RS485_DE 4  // Driver Enable
ModbusMaster modbus;

// Ethernet Configuration
bool eth_connected = false;

// Data collection interval (will be fetched from server)
unsigned long dataInterval = 300000;  // Default 5 minutes
unsigned long lastDataSend = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize RS485
  Serial2.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);
  modbus.begin(1, Serial2);  // Modbus slave ID 1
  
  // Initialize Ethernet
  ETH.begin();
  ETH.config(IPAddress(192,168,1,150), IPAddress(192,168,1,1), IPAddress(255,255,255,0));
  
  Serial.println("ESP32 Solar Monitor Starting...");
  Serial.println("Device: " + String(DEVICE_NAME));
}

void loop() {
  if (ETH.linkUp() && !eth_connected) {
    eth_connected = true;
    Serial.println("Ethernet Connected!");
    Serial.print("IP: ");
    Serial.println(ETH.localIP());
  }
  
  if (eth_connected && millis() - lastDataSend >= dataInterval) {
    sendSensorData();
    lastDataSend = millis();
  }
  
  delay(1000);
}

void sendSensorData() {
  HTTPClient http;
  
  // Read Modbus sensors
  float radiation = readModbusSensor(40001, 1.0, 0.0);      // Register 40001
  float temperature1 = readModbusSensor(40002, 0.1, 0.0);   // Register 40002
  float temperature2 = readModbusSensor(40003, 0.1, 0.0);   // Register 40003
  
  // Prepare JSON data
  StaticJsonDocument<512> doc;
  doc["device_name"] = DEVICE_NAME;
  
  JsonArray dataArray = doc.createNestedArray("data");
  
  JsonObject sensor1 = dataArray.createNestedObject();
  sensor1["sensor_name"] = "RADIATION";
  sensor1["value"] = radiation;
  
  JsonObject sensor2 = dataArray.createNestedObject();
  sensor2["sensor_name"] = "TEMPERATURE1";
  sensor2["value"] = temperature1;
  
  JsonObject sensor3 = dataArray.createNestedObject();
  sensor3["sensor_name"] = "TEMPERATURE2";
  sensor3["value"] = temperature2;
  
  String jsonData;
  serializeJson(doc, jsonData);
  
  // Send to server
  http.begin(serverUrl + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonData);
  
  if (httpCode > 0) {
    Serial.printf("Data sent: %d\n", httpCode);
    Serial.println("Radiation: " + String(radiation) + " W/m²");
    Serial.println("Temp1: " + String(temperature1) + " °C");
    Serial.println("Temp2: " + String(temperature2) + " °C");
  } else {
    Serial.printf("Error: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

float readModbusSensor(uint16_t address, float scale, float offset) {
  digitalWrite(RS485_DE, HIGH);
  delay(10);
  
  uint8_t result = modbus.readHoldingRegisters(address - 40001, 1);
  
  digitalWrite(RS485_DE, LOW);
  
  if (result == modbus.ku8MBSuccess) {
    uint16_t rawValue = modbus.getResponseBuffer(0);
    return (rawValue * scale) + offset;
  }
  
  Serial.printf("Modbus read error at %d\n", address);
  return 0.0;
}
