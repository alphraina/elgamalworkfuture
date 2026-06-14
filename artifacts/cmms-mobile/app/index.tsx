import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
  Animated,
  Pressable,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Constants from "expo-constants";

const CMMS_URL =
  process.env.EXPO_PUBLIC_CMMS_URL ||
  `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const isExpoGo = Constants.appOwnership === "expo";

async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) return null;
  try {
    const Device = await import("expo-device");
    if (!Device.default.isDevice) return null;

    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("cmms-notifications", {
        name: "CMMS Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1db954",
      });
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_REPL_ID ?? "cmms-mobile",
    });
    return token.data;
  } catch {
    return null;
  }
}

export default function CMMSScreen() {
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const pushTokenRef = useRef<string | null>(null);

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      pushTokenRef.current = token;
    });

    if (!isExpoGo) {
      let sub: { remove: () => void } | null = null;
      import("expo-notifications").then((Notifications) => {
        sub = Notifications.addNotificationResponseReceivedListener(() => {
          webViewRef.current?.reload();
        });
      });
      return () => sub?.remove();
    }
  }, []);

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleLoadEnd = () => {
    Animated.timing(loadingOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setLoading(false));

    if (pushTokenRef.current) {
      const token = pushTokenRef.current;
      const platform = Platform.OS;
      const js = `
        (function() {
          fetch('/api/push-tokens', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: ${JSON.stringify(token)}, platform: ${JSON.stringify(platform)} })
          }).catch(function(){});
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    }
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleReload = () => {
    setError(false);
    setLoading(true);
    loadingOpacity.setValue(1);
    webViewRef.current?.reload();
  };

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const onBack = () => {
        if (canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [canGoBack])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {canGoBack && (
            <Pressable
              onPress={() => webViewRef.current?.goBack()}
              style={({ pressed }) => [
                styles.backBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={22} color="#fff" />
            </Pressable>
          )}
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>Midea</Text>
          </View>
          <Text style={styles.headerTitle}>CMMS</Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={handleReload}
            style={({ pressed }) => [
              styles.reloadBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
          >
            <Feather
              name="refresh-cw"
              size={17}
              color="rgba(255,255,255,0.7)"
            />
          </Pressable>
        </View>
      </View>

      {/* WebView */}
      {!error && (
        <WebView
          ref={webViewRef}
          source={{ uri: CMMS_URL }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationChange}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleError}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          startInLoadingState={false}
          mixedContentMode="compatibility"
          mediaCapturePermissionGrantType="grant"
          onPermissionRequest={(request) => request.grant(request.resources)}
          allowFileAccess
          allowsProtectedMedia
        />
      )}

      {/* Loading overlay */}
      {loading && !error && (
        <Animated.View
          style={[styles.loadingOverlay, { opacity: loadingOpacity }]}
        >
          <View style={styles.loadingContent}>
            <View style={styles.loadingLogo}>
              <Text style={styles.loadingLogoText}>Midea</Text>
            </View>
            <Text style={styles.loadingTitle}>CMMS</Text>
            <Text style={styles.loadingSubtitle}>
              Factory Management System
            </Text>
            <ActivityIndicator
              size="large"
              color="#1db954"
              style={styles.spinner}
            />
          </View>
        </Animated.View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="wifi-off" size={52} color="rgba(255,255,255,0.2)" />
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorSubtitle}>
            Unable to reach the CMMS server.{"\n"}Please check your network
            connection.
          </Text>
          <Pressable
            onPress={handleReload}
            style={({ pressed }) => [
              styles.retryBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      <View style={{ height: insets.bottom, backgroundColor: "#0a0a0f" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d14",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
  },
  headerLeft: {
    width: 44,
    alignItems: "flex-start",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerRight: {
    width: 44,
    alignItems: "flex-end",
  },
  logoBadge: {
    backgroundColor: "#1db954",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  reloadBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadingContent: {
    alignItems: "center",
    gap: 8,
  },
  loadingLogo: {
    backgroundColor: "#1db954",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
  },
  loadingLogoText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  loadingTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
  },
  loadingSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: 0.3,
    marginBottom: 32,
  },
  spinner: {
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
  },
  errorSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1db954",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
