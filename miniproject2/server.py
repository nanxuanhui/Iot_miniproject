from flask import Flask, request, jsonify  # Import Flask for web framework
from base64 import b64decode  # Import base64 decoding function
from Crypto.Cipher import AES  # Import AES encryption module
import json  # Import JSON handling module

# Initialize Flask application
app = Flask(__name__)

# AES-256 encryption key (Must match the key used in the ESP32)
aes_key = bytes([
    0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
    0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36,
    0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34,
    0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32
])

"""
Decrypts an AES-256 encrypted Base64-encoded string.

:param cipher_text: The Base64-encoded encrypted text received from ESP32.
:return: The decrypted plaintext JSON string, or None if decryption fails.
"""
def decrypt_aes(cipher_text):
    try:
        # Decode the Base64 encoded ciphertext
        cipher_text = b64decode(cipher_text)

        # Initialize AES cipher in ECB mode with the predefined key
        cipher = AES.new(aes_key, AES.MODE_ECB)

        # Perform AES decryption
        decrypted = cipher.decrypt(cipher_text).decode()

        # Handle PKCS7 padding removal
        pad = ord(decrypted[-1])  # Get the last character (padding length)
        if 1 <= pad <= 16:
            decrypted = decrypted[:-pad]  # Remove the padding bytes

        # Strip leading/trailing whitespace and remove null characters
        decrypted = decrypted.strip()
        decrypted = decrypted.replace("\x00", "")

        # Check if decrypted JSON is empty
        if not decrypted:
            print("Error: Decrypted JSON is empty!")
            return None

        return decrypted

    except Exception as e:
        print("AES Decryption Error:", str(e))  # Log decryption error
        return None  # Return None to indicate failure


"""
Flask route to handle incoming POST requests with encrypted sensor data.

:return: JSON response indicating success or error.
"""
@app.route('/post-data', methods=['POST'])
def receive_data():
    try:
        # Read the raw encrypted data from the HTTP POST request
        encrypted_data = request.data.decode('utf-8')

        # Print received encrypted data for debugging
        print("Received Encrypted Data:", encrypted_data)

        # Decrypt the received data
        decrypted_json = decrypt_aes(encrypted_data)
        if decrypted_json is None:
            return jsonify({"error": "Decryption failed"}), 400  # Return error if decryption fails

        # Print decrypted JSON for debugging
        print("Decrypted JSON Data:", decrypted_json)

        # Parse decrypted JSON string into a Python dictionary
        data = json.loads(decrypted_json)

        # Define required JSON fields
        required_fields = ["team_number", "temperature", "humidity", "timestamp"]

        # Validate that all required fields exist in the received data
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400  # Return error if a field is missing

        # Print successfully received and parsed data
        print(f"Data Stored: Team Number: {data['team_number']}, Temperature: {data['temperature']}°C, Humidity: {data['humidity']}%, Timestamp: {data['timestamp']}")

        # Return success response
        return jsonify({"message": "Data received successfully"}), 200

    except Exception as e:
        # Log server error and return a 500 Internal Server Error response
        print("Server Error:", str(e))
        return jsonify({"error": f"Server error: {str(e)}"}), 500


"""
Main entry point: Starts the Flask server on port 8888, accessible to all network devices.
"""
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8888, debug=True)  # Start Flask server on port 8888
