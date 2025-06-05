"use client";

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import base64 from "react-native-base64";
import { BleManager } from "react-native-ble-plx";

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const { width, height } = Dimensions.get("window");

const BLEMotorController = () => {
  const [manager] = useState(new BleManager());
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [characteristic, setCharacteristic] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestPermissions();
    startGlowAnimation();
    return () => {
      manager.destroy();
    };
  }, []);

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const requestPermissions = async () => {
    if (Platform.OS === "android" && Platform.Version >= 23) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      console.log("Permissions:", granted);
    }
  };

  const scanForDevices = async () => {
    setDevices([]);
    setIsScanning(true);

    // Reset BLE manager state to ensure fresh scan
    try {
      await manager.stopDeviceScan();
      // Small delay to ensure cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.log("Stop scan error (expected):", error);
    }

    // Start scan animation
    Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      })
    ).start();

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("Scan error:", error);
        setIsScanning(false);
        scanAnim.stopAnimation();
        return;
      }

      if (device && device.name) {
        console.log("Discovered:", device.name);
        setDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      }
    });

    // Stop scan after 15 seconds (increased time)
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
    }, 15000);
  };

  const connectToDevice = async (device) => {
    if (device.name !== "ESP32_MOTOR_LED") {
      alert("Please connect to ESP32_MOTOR_LED device only");
      return;
    }

    setIsConnecting(true);
    try {
      // Ensure device is disconnected first
      try {
        await device.cancelConnection();
      } catch (e) {
        // Ignore if already disconnected
      }

      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      const services = await connected.services();

      for (const service of services) {
        if (service.uuid.includes(SERVICE_UUID)) {
          const chars = await service.characteristics();
          const targetChar = chars.find((c) =>
            c.uuid.includes(CHARACTERISTIC_UUID)
          );
          if (targetChar) {
            setCharacteristic(targetChar);
            setConnectedDevice(connected);
            setDevices([]); // Clear devices list
            console.log("Connected and characteristic found");
            setIsConnecting(false);
            return;
          }
        }
      }

      console.warn("Characteristic not found");
      setIsConnecting(false);
    } catch (err) {
      console.error("Connection error:", err);
      setIsConnecting(false);
    }
  };

  const sendDataWithPulse = async () => {
    if (characteristic && !isPulsing) {
      setIsPulsing(true);

      // Start pulse animation
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();

      try {
        await characteristic.writeWithResponse(base64.encode("1"));
        console.log("Pulse ON");
        setTimeout(async () => {
          await characteristic.writeWithResponse(base64.encode("0"));
          console.log("Pulse OFF");
          setIsPulsing(false);
        }, 100); // 0.1 seconds
      } catch (error) {
        console.error("Pulse error:", error);
        setIsPulsing(false);
      }
    }
  };

  const disconnect = async () => {
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
      } catch (error) {
        console.log("Disconnect error:", error);
      }
      setConnectedDevice(null);
      setCharacteristic(null);
    }
  };

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(76, 110, 245, 0.3)", "rgba(76, 110, 245, 0.8)"],
  });

  const scanRotation = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1f" />

      {/* Animated Background */}
      <Animated.View
        style={[styles.backgroundGlow, { backgroundColor: glowColor }]}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ BLE Motor Controller</Text>
        <Text style={styles.headerSubtitle}>Control your ESP32 device</Text>
      </View>

      {!connectedDevice ? (
        <ScrollView contentContainerStyle={styles.scanContainer}>
          {/* Scan Button */}
          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanButtonActive]}
            onPress={scanForDevices}
            disabled={isScanning}
          >
            <View style={styles.scanButtonContent}>
              {isScanning && (
                <Animated.View
                  style={[
                    styles.scanIcon,
                    { transform: [{ rotate: scanRotation }] },
                  ]}
                >
                  <Text style={styles.scanIconText}>🔍</Text>
                </Animated.View>
              )}
              <Text style={styles.scanButtonText}>
                {isScanning ? "Scanning..." : "🔎 Search for Devices"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Loading indicator */}
          {isScanning && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingWave}>
                <View style={[styles.loadingDot, styles.dot1]} />
                <View style={[styles.loadingDot, styles.dot2]} />
                <View style={[styles.loadingDot, styles.dot3]} />
              </View>
              <Text style={styles.loadingText}>🌐 Looking for devices...</Text>
            </View>
          )}

          {/* Device List */}
          {devices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.deviceListTitle}>📱 Available Devices:</Text>
              {devices.map((device, index) => (
                <TouchableOpacity
                  key={device.id}
                  style={[
                    styles.deviceCard,
                    device.name === "ESP32_MOTOR_LED" && styles.targetDevice,
                    { opacity: 0.9 + index * 0.1 },
                  ]}
                  onPress={() => connectToDevice(device)}
                  disabled={isConnecting}
                >
                  <View style={styles.deviceCardContent}>
                    <Text style={styles.deviceName}>
                      {device.name === "ESP32_MOTOR_LED" ? "🎯 " : "📡 "}
                      {device.name || "Unknown Device"}
                    </Text>
                    <Text style={styles.deviceId}>{device.id}</Text>
                    {device.name === "ESP32_MOTOR_LED" && (
                      <View style={styles.targetBadge}>
                        <Text style={styles.targetLabel}>⭐ TARGET DEVICE</Text>
                      </View>
                    )}
                    {isConnecting && device.name === "ESP32_MOTOR_LED" && (
                      <Text style={styles.connectingText}>
                        🔗 Connecting...
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        /* Connected View */
        <View style={styles.connectedContainer}>
          <View style={styles.connectionStatus}>
            <View style={styles.statusIndicator} />
            <Text style={styles.connectedText}>
              🔗 Connected to {connectedDevice.name}
            </Text>
          </View>

          {/* Main Control Button */}
          <View style={styles.controlContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  isPulsing && styles.controlButtonActive,
                ]}
                onPress={sendDataWithPulse}
                disabled={isPulsing}
              >
                <View style={styles.controlButtonInner}>
                  <Text style={styles.controlButtonText}>
                    {isPulsing ? "⚡ PULSING..." : "🚀 PRESS"}
                  </Text>
                  <Text style={styles.controlButtonSubtext}>
                    Motor & LED Control
                  </Text>
                </View>
                <View style={styles.controlButtonGlow} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Disconnect Button */}
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={disconnect}
          >
            <Text style={styles.disconnectButtonText}>🔌 Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1f",
  },
  backgroundGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    opacity: 0.1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#4c6ef5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  headerDecoration: {
    position: "absolute",
    bottom: -15,
    left: "50%",
    marginLeft: -15,
    width: 30,
    height: 30,
    backgroundColor: "#4c6ef5",
    borderRadius: 15,
    opacity: 0.7,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    textShadowColor: "#4c6ef5",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#a0a0a0",
    textAlign: "center",
    marginTop: 5,
  },
  scanContainer: {
    flexGrow: 1,
    padding: 20,
  },
  scanButton: {
    background: "linear-gradient(135deg, #4c6ef5 0%, #364fc7 100%)",
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 30,
    shadowColor: "#4c6ef5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(76, 110, 245, 0.3)",
  },
  scanButtonActive: {
    backgroundColor: "#364fc7",
    shadowOpacity: 0.6,
  },
  scanButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scanIcon: {
    marginRight: 10,
  },
  scanIconText: {
    fontSize: 20,
  },
  scanButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  loadingWave: {
    flexDirection: "row",
    marginBottom: 15,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4c6ef5",
    marginHorizontal: 3,
  },
  dot1: {
    animationDelay: "0s",
  },
  dot2: {
    animationDelay: "0.2s",
  },
  dot3: {
    animationDelay: "0.4s",
  },
  loadingText: {
    color: "#a0a0a0",
    fontSize: 14,
  },
  deviceList: {
    flex: 1,
  },
  deviceListTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 15,
    textShadowColor: "#4c6ef5",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  deviceCard: {
    backgroundColor: "#1a1a2e",
    padding: 18,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a3e",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  targetDevice: {
    borderColor: "#4c6ef5",
    backgroundColor: "#1e2a5e",
    shadowColor: "#4c6ef5",
    shadowOpacity: 0.4,
  },
  deviceCardContent: {
    position: "relative",
  },
  deviceName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },
  deviceId: {
    color: "#a0a0a0",
    fontSize: 12,
    fontFamily: "monospace",
  },
  targetBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#4c6ef5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  targetLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  connectingText: {
    color: "#4c6ef5",
    fontSize: 14,
    marginTop: 8,
    fontStyle: "italic",
  },
  connectedContainer: {
    flex: 1,
    padding: 20,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 50,
    backgroundColor: "rgba(81, 207, 102, 0.1)",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(81, 207, 102, 0.3)",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#51cf66",
    marginRight: 10,
    shadowColor: "#51cf66",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  connectedText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "500",
  },
  controlContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#4c6ef5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4c6ef5",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 3,
    borderColor: "rgba(76, 110, 245, 0.5)",
    position: "relative",
  },
  controlButtonActive: {
    backgroundColor: "#364fc7",
    transform: [{ scale: 0.95 }],
  },
  controlButtonGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(76, 110, 245, 0.2)",
    top: -10,
    left: -10,
    zIndex: -1,
  },
  controlButtonInner: {
    alignItems: "center",
  },
  controlButtonText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  controlButtonSubtext: {
    color: "#e3f2fd",
    fontSize: 14,
    textAlign: "center",
    opacity: 0.9,
  },
  disconnectButton: {
    backgroundColor: "#ff6b6b",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignSelf: "center",
    marginBottom: 30,
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  disconnectButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default BLEMotorController;
