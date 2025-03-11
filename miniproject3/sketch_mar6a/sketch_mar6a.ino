#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <DHT.h>

// Define BLE service and characteristic UUIDs
#define ENVIRONMENTAL_SENSING_SERVICE_UUID "181A"  // Environmental Sensing Service UUID
#define TEMPERATURE_CHARACTERISTIC_UUID    "2A6E"  // Temperature characteristic UUID
#define HUMIDITY_CHARACTERISTIC_UUID       "2A6F"  // Humidity characteristic UUID
#define BATTERY_SERVICE_UUID               "180F"  // Battery service UUID
#define BATTERY_CHARACTERISTIC_UUID        "2A19"  // Battery level characteristic UUID
#define HUMIDITY_THRESHOLD_CHARACTERISTIC_UUID "2A1F"  // Humidity threshold characteristic UUID

// Define the BLE device name
#define DEVICE_NAME "Team 13"

// DHT sensor pin and type
#define DHTPIN 4  // GPIO pin where DHT11 sensor is connected
#define DHTTYPE DHT11  // Define the sensor type
DHT dht(DHTPIN, DHTTYPE);

// Initialize BLE server and characteristics
BLEServer *pServer = nullptr;
BLECharacteristic *pTemperatureCharacteristic = nullptr;
BLECharacteristic *pHumidityCharacteristic = nullptr;
BLECharacteristic *pBatteryCharacteristic = nullptr;
BLECharacteristic *pHumidityThresholdCharacteristic = nullptr;  // Humidity threshold characteristic

bool deviceConnected = false;
uint8_t batteryLevel = 100;  // Initial battery level (100%)
int humidityThreshold = -1;  // Default humidity threshold (-1 means disabled)

// Callback class to handle BLE connection events
class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        Serial.println("Device connected");
    }

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        Serial.println("Device disconnected, restarting advertising...");
        pServer->getAdvertising()->start();  // Restart advertising when disconnected
    }
};

// BLE callback class to handle humidity threshold updates
class HumidityThresholdCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        Serial.println("Received request to update humidity threshold...");
        
        // Convert received data into a string format
        std::string value = std::string((char*)pCharacteristic->getData(), pCharacteristic->getLength());
        
        // Print the received value for debugging
        Serial.print("Raw received value: ");
        Serial.println(value.c_str());
        
        if (!value.empty()) {
            try {
                humidityThreshold = std::stoi(value);  // Convert received string to integer
                Serial.print("New Humidity Threshold Set: ");
                Serial.print(humidityThreshold);
                Serial.println("%");
                Serial.println("Humidity threshold updated successfully.");
            } catch (const std::exception& e) {
                Serial.println("Error parsing humidity threshold value!");
                return;
            }
        }
    }
};

// Read DHT11 sensor data and update BLE characteristics
void updateSensorData() {
    char tempStr[8];
    char humStr[8];
    
    float temperature = dht.readHumidity();  // Read temperature in Celsius
    float humidity = dht.readTemperature();       // Read humidity percentage

    // Check if sensor data is valid
    if (isnan(temperature) || isnan(humidity)) {
        Serial.println("Failed to read from DHT sensor!");
        return;
    }

    // Print sensor data to the Serial Monitor
    Serial.print("Measured Temperature: ");
    Serial.print(temperature);
    Serial.print("°C, Measured Humidity: ");
    Serial.print(humidity);
    Serial.println("%");

    if (deviceConnected) {
        snprintf(tempStr, sizeof(tempStr), "%.2f", temperature); // Convert temperature to string format
        snprintf(humStr, sizeof(humStr), "%.2f", humidity);

        // Send temperature data via BLE
        pTemperatureCharacteristic->setValue(tempStr);
        pTemperatureCharacteristic->notify();
        Serial.print("Sent Temperature: ");
        Serial.print(temperature);
        Serial.println("°C");

        // Send humidity data only if it exceeds the threshold
        if (humidityThreshold == -1 || humidity > humidityThreshold) {
            pHumidityCharacteristic->setValue(humStr);
            pHumidityCharacteristic->notify();
            Serial.print("Sent Humidity: ");
            Serial.print(humidity);
            Serial.println("%");
        }
    }
}

// Simulate battery drain and update BLE characteristic
void updateBatteryLevel() {
    if (deviceConnected) {
        char batteryStr[4];
        snprintf(batteryStr, sizeof(batteryStr), "%d", batteryLevel);  // Convert battery level to string
        pBatteryCharacteristic->setValue(batteryStr);
        pBatteryCharacteristic->notify();
        Serial.print("Sent Battery Level: ");
        Serial.print(batteryLevel);
        Serial.println("%");
    }
    if (batteryLevel > 0) {
        batteryLevel--;  // Decrease battery level by 1% per minute
    }
}

// Initialize BLE device and characteristics
void setupBLE() {
    Serial.println("Initializing BLE...");
    BLEDevice::init(DEVICE_NAME);
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    // Add Environmental Sensing Service
    BLEService *pEnvService = pServer->createService(ENVIRONMENTAL_SENSING_SERVICE_UUID);
    
    pTemperatureCharacteristic = pEnvService->createCharacteristic(
        TEMPERATURE_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    
    pHumidityCharacteristic = pEnvService->createCharacteristic(
        HUMIDITY_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    
    pHumidityThresholdCharacteristic = pEnvService->createCharacteristic(
        HUMIDITY_THRESHOLD_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
    pHumidityThresholdCharacteristic->setCallbacks(new HumidityThresholdCallbacks());
    
    pEnvService->start();

    // Add Battery Service
    BLEService *pBatteryService = pServer->createService(BATTERY_SERVICE_UUID);
    pBatteryCharacteristic = pBatteryService->createCharacteristic(
        BATTERY_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pBatteryService->start();

    // Start BLE advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(ENVIRONMENTAL_SENSING_SERVICE_UUID);
    pAdvertising->addServiceUUID(BATTERY_SERVICE_UUID);
    pAdvertising->start();
    Serial.println("BLE Advertising started.");
}

void setup() {
    Serial.begin(115200);
    Serial.println("Starting ESP32 BLE Sensor...");
    dht.begin();  // Initialize DHT11 sensor
    setupBLE();
}

void loop() {
    updateSensorData();  // Read and transmit sensor data
    updateBatteryLevel();  // Simulate battery drain
    delay(60000);  // Wait 60 seconds before the next update
} 
