import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth-context";
import { SyncProvider } from "../src/lib/sync-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <Stack screenOptions={{ headerTitleAlign: "center" }}>
            <Stack.Screen name="index" options={{ title: "My Day" }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="job/[id]" options={{ title: "Job" }} />
          </Stack>
          <StatusBar style="auto" />
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
