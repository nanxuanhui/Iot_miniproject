#include <WiFi.h>         // WiFi library for ESP32
#include <HTTPClient.h>   // HTTP client library for making requests
#include <Adafruit_Sensor.h> // Adafruit sensor library
#include <DHT.h>          // DHT sensor library
#include <ArduinoJson.h>  // JSON handling library
#include <Crypto.h>       // Cryptographic library
#include <AES.h>          // AES encryption library
#include <base64.h>       // Base64 encoding library

// Define DHT11 sensor connection pin
#define DHTPIN 4
#define DHTTYPE DHT11

// Initialize the DHT sensor
DHT dht(DHTPIN, DHTTYPE);

// WiFi credentials (SSID and password)
const char* ssid = "BSC-Resident";
const char* password = "brookside6551";

// Flask server endpoint where the data will be sent
const char* serverUrl = "http://172.31.99.212:8888/post-data";

// NTP Server details for time synchronization
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -21600;  // GMT offset for your timezone (-6 hours)
const int daylightOffset_sec = 3600; // Daylight saving time offset (+1 hour)

// AES-256 encryption key (Must be exactly 32 bytes long)
const byte aesKey[32] = {
    0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 
    0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 
    0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 
    0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32
};

/**
 * @brief Sets up the ESP32 system, connects to WiFi, and synchronizes time.
 * This function runs once when the ESP32 starts. It initializes the DHT sensor,
 * connects to WiFi, and syncs the device time with an NTP server.
 */
void setup() {
    Serial.begin(115200);  // Initialize serial communication
    Serial.println("Initializing DHT11 sensor...");
    dht.begin();  // Start the DHT sensor
    delay(3000);  // Allow the sensor to stabilize

    // Connect to WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {  // Keep trying until WiFi connects
        Serial.print(".");
        delay(1000);
    }

    Serial.println("\nWiFi Connected!");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());  // Print the assigned IP address

    // Sync time with NTP server
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    Serial.println("⏳ Synchronizing time...");
    delay(2000);  // Wait for time sync to complete
}

/**
 * @brief Encrypts a given input string using AES-256 and encodes it in Base64.
 * This function applies AES-256 encryption in ECB mode to the input data, 
 * ensuring it is padded to a multiple of 16 bytes. The encrypted output is 
 * then converted to Base64 format for transmission.
 * 
 * @param input The plaintext string to encrypt.
 * @param output The output buffer to store the Base64-encoded ciphertext.
 * @param outputSize The size of the output buffer.
 */
void encryptAES(const char* input, char* output, size_t outputSize) {
    AES256 aes;
    aes.setKey(aesKey, sizeof(aesKey));  // Set AES encryption key

    byte plainText[128] = {0};  // Buffer for plain text (expanded to 128 bytes)
    byte cipherText[128];  // Buffer for encrypted text

    int len = strlen(input);
    if (len % 16 != 0) {  // Ensure input length is a multiple of 16 bytes
        len += (16 - (len % 16));  // Apply padding
    }

    if (len > sizeof(plainText)) {  // Check if input is too large
        Serial.println("Error: Input too large!");
        return;
    }

    strncpy((char*)plainText, input, len);  // Copy input data to buffer

    // Encrypt the input in 16-byte blocks
    for (int i = 0; i < len; i += 16) {
        aes.encryptBlock(cipherText + i, plainText + i);
    }

    // Convert encrypted data to Base64 format
    String encoded = base64::encode(cipherText, len);

    // Ensure the output buffer is large enough
    if (encoded.length() >= outputSize) {
        Serial.println("Error: Output buffer too small!");
        return;
    }

    strcpy(output, encoded.c_str());  // Copy Base64 output to destination buffer
}

/**
 * @brief Continuously reads sensor data, encrypts it, and sends it to the server.
 * This function is called repeatedly in a loop. It reads temperature and humidity
 * data from the DHT sensor, gets the current timestamp, encrypts the data, and 
 * sends it via an HTTP POST request to a Flask server.
 */
void loop() {
    Serial.println("\nReading DHT sensor data...");

    // Read temperature and humidity from the DHT sensor
    float temperature = dht.readHumidity();
    float humidity = dht.readTemperature();

    // Check if the sensor reading is valid
    if (isnan(temperature) || isnan(humidity)) {
        Serial.println("Error: Failed to read sensor data!");
        return;
    }

    // Get current time from the system
    time_t now;
    time(&now);

    // Ensure time is properly synchronized
    if (now < 100000) {
        Serial.println("⚠️ Error: Time not synchronized, retrying...");
        configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
        delay(2000);
        time(&now);
        if (now < 100000) {  // If still not synchronized, skip sending data
            Serial.println("Critical Error: Time still not synchronized, skipping upload.");
            return;
        }
    }

    Serial.println("Time synchronized, preparing JSON...");

    // Create a JSON object with sensor data
    DynamicJsonDocument doc(128);
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;
    doc["timestamp"] = now;

    // Serialize JSON into a string buffer
    char jsonData[128];
    serializeJson(doc, jsonData, sizeof(jsonData));

    // Print unencrypted JSON data before encryption
    Serial.print("Unencrypted JSON Data: ");
    Serial.println(jsonData);

    // Encrypt JSON data
    char encryptedData[128];  // Ensure buffer is large enough
    encryptAES(jsonData, encryptedData, sizeof(encryptedData));

    Serial.print("Sending Encrypted JSON Data: ");
    Serial.println(encryptedData);  // Print the encrypted data

    // Check if WiFi is connected before sending data
    if (WiFi.status() == WL_CONNECTED) {  
        HTTPClient http;  // Initialize HTTP client
        http.begin(serverUrl);  // Set the server URL
        http.addHeader("Content-Type", "text/plain");  // Specify content type

        int httpResponseCode = http.POST(encryptedData);  // Send POST request

        // Print the server response
        if (httpResponseCode > 0) {
            Serial.print("Server Response Code: ");
            Serial.println(httpResponseCode);
            String response = http.getString();  // Read server response
            Serial.print("Server Response Body: ");
            Serial.println(response);  
        } else {
            Serial.print("HTTP Error: ");
            Serial.println(httpResponseCode);
        }

        http.end();  // Close HTTP connection
    } else {
        Serial.println("WiFi Disconnected! Cannot send data.");
    }

    delay(10000);  // Wait for 10 seconds before sending the next data
}
