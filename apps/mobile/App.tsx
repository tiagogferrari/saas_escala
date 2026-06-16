import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>SaaS Escala</Text>
      <Text style={styles.title}>Mobile preparado</Text>
      <Text style={styles.description}>
        Base Expo para Android e futuro iOS. A PWA sera validada primeiro.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  description: {
    color: "#6b7280",
    fontSize: 16,
    marginTop: 8,
    maxWidth: 320,
    textAlign: "center",
  },
  kicker: {
    color: "#2563eb",
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "700",
  },
});
