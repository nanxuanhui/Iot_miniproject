# 🌡️ ESP32 Monitoring System

A modern web application for monitoring temperature and humidity data from ESP32 devices in real-time.

## Features

- 🔐 **Secure Authentication**
  - User registration and login system
  - JWT-based authentication
  - Remember me functionality

- 📊 **Real-time Monitoring**
  - Live temperature and humidity data display
  - Interactive charts and graphs
  - Historical data analysis
  - Customizable time ranges

- 🎨 **Modern UI/UX**
  - Clean and intuitive interface
  - Responsive design for all devices
  - Beautiful animations and transitions
  - Dark/Light mode support

- 🔍 **Advanced Search**
  - Temperature search with multiple conditions
  - Date range filtering
  - Real-time data filtering
  - Export functionality

## Tech Stack

- **Frontend**
  - React.js
  - React Router
  - Chart.js
  - CSS3 with modern features
  - Context API for state management

- **Backend**
  - Node.js
  - Express.js
  - MongoDB
  - JWT Authentication
  - WebSocket for real-time updates

## Installation & Running

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- ESP32 device with temperature/humidity sensors

### Steps
1. Clone and install
```bash
git clone https://github.com/nanxuanhui/Iot_miniproject.git
cd Iot_miniproject/miniproject4/esp12-g13
npm install
```

2. Configure environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the application
```bash
npm start
```

4. ESP32 Setup
- Upload the ESP32 code to your device
- Configure WiFi credentials
- Connect temperature and humidity sensors
- The device will automatically start sending data to the server

## Usage

1. **Registration & Login**
   - Create a new account or login with existing credentials
   - Enable "Remember me" for persistent sessions

2. **Dashboard**
   - View real-time temperature and humidity data
   - Monitor device status
   - Access historical data charts

3. **Temperature Search**
   - Set custom date ranges
   - Apply multiple conditions
   - Export data for analysis

4. **Settings**
   - Configure notification preferences
   - Set up data retention policies
   - Manage device connections

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- ESP32 community for hardware support
- React.js community for frontend libraries
- All contributors who have helped improve this project
