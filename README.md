# React Native ESP32 Motor/LED Controller 🚀

**Wireless IoT controller bridging mobile apps with embedded hardware via Bluetooth Low Energy (BLE)**


## ✨ Features

### 📱 Mobile Control Interface
- React Native app with clean UI for device control
- BLE communication stack for wireless commands
- Cross-platform support (Android/iOS)

### 💻 ESP32 Firmware
- Custom BLE service with motor/LED control characteristics
- Efficient power management
- Real-time response to mobile commands

### ⚡ Hardware Integration
- Vibration motor control via GPIO
- LED status indicator
- Compact circuit design

### 🔌 Protocol Implementation
- GATT service architecture (`4fafc201-1fb5-459e-8fcc-c5c9c331914b`)
- Writeable characteristic for commands (`beb5483e-36e1-4688-b7f5-ea07361b26a8`)
- Error handling and reconnect logic

## 🛠️ Tech Stack
| Component       | Technology |
|-----------------|------------|
| Mobile App      | React Native, react-native-ble-plx |
| Microcontroller | ESP32 (Arduino Core) |
| BLE Protocol    | Bluetooth Low Energy 4.2+ |
| Hardware        | Vibration motor, LED, resistors |

## 🚀 Getting Started

### Prerequisites
- ESP32 Dev Board
- React Native development environment
- Android/iOS device with BLE support

### Installation
1. **Flash ESP32**:
```bash
# Clone firmware repo
git clone https://github.com/farhanpavel/BLEMotor
# Open in Arduino IDE and upload
