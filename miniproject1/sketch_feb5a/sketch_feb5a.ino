#include <DHT11.h>  // Include the DHT11 sensor library

// Define return codes
#define DHTLIB_OK 0
#define DHTLIB_ERROR_CHECKSUM -1
#define DHTLIB_ERROR_TIMEOUT -2

// ----- Pin Definitions -----
#define DHT11PIN 4   // DHT11 sensor data pin (GPIO4)
#define LED_PIN 2    // LED control pin (GPIO2)

// Create a DHT11 object with the specified data pin.
DHT11 dht11(DHT11PIN);

// ----- Timing Variables -----
// Variables to manage timing for sensor readings and LED blinking.
unsigned long previousSensorMillis = 0;   // Stores the time of the last sensor reading.
const unsigned long sensorInterval = 2000;  // Interval for sensor readings (2000 ms).

unsigned long previousBlinkMillis = 0;      // Stores the last time the LED toggled.
const unsigned long blinkInterval = 250;      // LED blink interval (250 ms for a faster blink).

// ----- Global Variables -----
// Variables to store sensor data and LED state.
bool ledState = LOW;         // Current LED state (used for blinking).
float temperature = 0.0;     // Latest temperature reading in °C.
float humidity = 0.0;        // Latest humidity reading in %.
int ledMode = 0;             // LED mode: 0 = OFF, 1 = ON continuously, 2 = BLINKING.

// ----- Monitoring and Custom Thresholds -----
// Variables to control monitoring and set custom thresholds.
bool monitoring = false;     // Monitoring is off by default.
int tempHighThreshold = 30;  // Temperature high threshold in °C.
int tempLowThreshold  = 15;  // Temperature low threshold in °C.
int humHighThreshold  = 70;  // Humidity high threshold in %.
int humLowThreshold   = 30;  // Humidity low threshold in %.

/**
 * Function: printMenu
 * -------------------
 * Prints the user command menu to the Serial Monitor.
 */
void printMenu() {
  Serial.println();
  Serial.println("========== MENU ==========");
  Serial.println("Type one of the following commands:");
  Serial.println("  start          -> Start monitoring");
  Serial.println("  stop           -> Stop monitoring");
  Serial.println("  settemp <low> <high>  -> Set temperature thresholds (e.g., settemp 20 35)");
  Serial.println("  sethum <low> <high>   -> Set humidity thresholds (e.g., sethum 40 80)");
  Serial.println("  show           -> Show current threshold settings");
  Serial.println("  menu           -> Display this menu again");
  Serial.println("==========================");
  Serial.println();
}

/**
 * Function: handleCommand
 * -----------------------
 * Processes user commands entered via the Serial Monitor.
 *
 * Parameters:
 *   input - A string containing the command entered by the user.
 *
 * Behavior:
 *   - "start": Begins sensor monitoring.
 *   - "stop": Stops monitoring and displays the menu.
 *   - "settemp <low> <high>": Sets new temperature thresholds.
 *   - "sethum <low> <high>": Sets new humidity thresholds.
 *   - "show": Displays the current threshold settings.
 *   - "menu": Prints the menu.
 *   - Unknown commands prompt an error message.
 */
void handleCommand(String input) {
  input.trim();  // Remove any leading or trailing whitespace.
  if (input.equalsIgnoreCase("start")) {
    monitoring = true;
    Serial.println("Monitoring started.");
  } 
  else if (input.equalsIgnoreCase("stop")) {
    monitoring = false;
    Serial.println("Monitoring stopped.");
    // Automatically show the menu when monitoring stops.
    printMenu();
  } 
  else if (input.startsWith("settemp")) {
    // Expected format: "settemp <low> <high>"
    int firstSpace = input.indexOf(' ');
    if (firstSpace > 0) {
      String params = input.substring(firstSpace + 1);
      params.trim();
      int spaceIndex = params.indexOf(' ');
      if (spaceIndex > 0) {
         String lowStr = params.substring(0, spaceIndex);
         String highStr = params.substring(spaceIndex + 1);
         int lowVal = lowStr.toInt();
         int highVal = highStr.toInt();
         if (lowVal < highVal) {
             tempLowThreshold = lowVal;
             tempHighThreshold = highVal;
             Serial.print("Temperature thresholds set: low = ");
             Serial.print(tempLowThreshold);
             Serial.print(" °C, high = ");
             Serial.print(tempHighThreshold);
             Serial.println(" °C");
         } else {
             Serial.println("Error: low threshold must be less than high threshold.");
         }
      } else {
         Serial.println("Error: Please provide two values. (e.g., settemp 20 35)");
      }
    } else {
      Serial.println("Error: Invalid command format.");
    }
  } 
  else if (input.startsWith("sethum")) {
    // Expected format: "sethum <low> <high>"
    int firstSpace = input.indexOf(' ');
    if (firstSpace > 0) {
      String params = input.substring(firstSpace + 1);
      params.trim();
      int spaceIndex = params.indexOf(' ');
      if (spaceIndex > 0) {
         String lowStr = params.substring(0, spaceIndex);
         String highStr = params.substring(spaceIndex + 1);
         int lowVal = lowStr.toInt();
         int highVal = highStr.toInt();
         if (lowVal < highVal) {
             humLowThreshold = lowVal;
             humHighThreshold = highVal;
             Serial.print("Humidity thresholds set: low = ");
             Serial.print(humLowThreshold);
             Serial.print(" %, high = ");
             Serial.print(humHighThreshold);
             Serial.println(" %");
         } else {
             Serial.println("Error: low threshold must be less than high threshold.");
         }
      } else {
         Serial.println("Error: Please provide two values. (e.g., sethum 40 80)");
      }
    } else {
      Serial.println("Error: Invalid command format.");
    }
  } 
  else if (input.equalsIgnoreCase("show")) {
    // Display the current threshold settings.
    Serial.println("Current Threshold Settings:");
    Serial.print("  Temperature: low = ");
    Serial.print(tempLowThreshold);
    Serial.print(" °C, high = ");
    Serial.print(tempHighThreshold);
    Serial.println(" °C");
    Serial.print("  Humidity: low = ");
    Serial.print(humLowThreshold);
    Serial.print(" %, high = ");
    Serial.print(humHighThreshold);
    Serial.println(" %");
  } 
  else if (input.equalsIgnoreCase("menu")) {
    // Print the menu.
    printMenu();
  } 
  else {
    // Handle unknown commands.
    Serial.println("Unknown command. Type 'menu' to see available commands.");
  }
}

/**
 * Function: setup
 * ---------------
 * Initializes Serial communication, sets up pin modes,
 * and displays the menu at startup.
 */
void setup() {
  Serial.begin(115200);  // Start Serial communication at 115200 baud.
  Serial.println("Starting DHT11 sensor readings with LED indicator and menu...");
  pinMode(LED_PIN, OUTPUT);  // Set the LED control pin as an output.
  printMenu();  // Display the menu on startup.
}

/**
 * Function: loop
 * --------------
 * Main program loop:
 *   - Checks for and processes Serial input commands.
 *   - When monitoring is active, reads sensor data every 2 seconds.
 *   - Based on sensor readings and custom thresholds, sets the LED mode:
 *       * LED ON continuously if temperature > 30°C or humidity > 70%.
 *       * LED BLINKING if temperature < 15°C or humidity < 30%.
 *       * LED OFF otherwise.
 *   - Controls the LED based on the current mode.
 */
void loop() {
  unsigned long currentMillis = millis();
  
  // Check for incoming Serial commands.
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');  // Read the input until a newline.
    handleCommand(command);  // Process the received command.
  }
  
  // If monitoring is enabled, read sensor data periodically.
  if (monitoring) {
    if (currentMillis - previousSensorMillis >= sensorInterval) {
      previousSensorMillis = currentMillis;
      
      // Read sensor data from the DHT11.
      int tempRead = dht11.readHumidity();      // Read temperature value (if library mapping is reversed)
      int humidityRead = dht11.readTemperature(); // Read humidity value (if library mapping is reversed)
      
      // Check if sensor readings are valid.
      if (humidityRead >= 0 && tempRead >= 0) {
        // Update global sensor values.
        humidity = humidityRead;
        temperature = tempRead;
        
        // Display sensor readings on the Serial Monitor.
        Serial.print("Temperature: ");
        Serial.print(temperature);
        Serial.print(" °C, Humidity: ");
        Serial.print(humidity);
        Serial.println(" %");
        
        // Determine LED mode based on the custom thresholds:
        // LED ON continuously if either temperature or humidity exceeds its high threshold.
        // LED BLINKING if either temperature or humidity is below its low threshold.
        // Otherwise, turn the LED OFF.
        if (temperature > tempHighThreshold || humidity > humHighThreshold) {
          ledMode = 1;  // LED ON continuously.
        } else if (temperature < tempLowThreshold || humidity < humLowThreshold) {
          ledMode = 2;  // LED BLINKING.
        } else {
          ledMode = 0;  // LED OFF.
        }
      } else {
        // If a sensor error occurred, print the error code.
        Serial.print("Failed to read from DHT11 sensor, error code: ");
        Serial.println((humidityRead < 0) ? humidityRead : tempRead);
      }
    }
  } else {
    // If monitoring is off, ensure the LED is turned off.
    ledMode = 0;
  }
  
  // ----- LED Control -----
  // Act based on the current LED mode.
  switch (ledMode) {
    case 0:  // LED OFF
      digitalWrite(LED_PIN, LOW);
      break;
    case 1:  // LED ON continuously
      digitalWrite(LED_PIN, HIGH);
      break;
    case 2:  // LED BLINKING
      if (currentMillis - previousBlinkMillis >= blinkInterval) {
        previousBlinkMillis = currentMillis;
        ledState = !ledState;  // Toggle the LED state.
        digitalWrite(LED_PIN, ledState);
      }
      break;
  }
}


