import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useRouter } from "expo-router";

import { apiPost, apiDelete } from "./api";

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications don't work on simulators
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "89f29baf-b117-4d7a-b341-76c8991d6baf",
  });

  return tokenData.data;
}

/**
 * Hook to register for push notifications and handle incoming notifications.
 * Call this once in the root layout when the user is authenticated.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  // Register push token when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications().then((token) => {
      if (token) {
        tokenRef.current = token;
        apiPost("/api/push-token", {
          token,
          platform: Platform.OS as "ios" | "android",
        });
      }
    });
  }, [isAuthenticated]);

  // Handle notification taps (when user taps on a notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.type === "dm" && data?.userId) {
          router.push(`/dm/${data.userId}`);
        } else if (data?.type === "follow" && data?.userId) {
          router.push(`/user/${data.userId}`);
        } else if (data?.type === "invite" && data?.activityId) {
          router.push(`/activity/${data.activityId}`);
        }
      }
    );

    return () => subscription.remove();
  }, [router]);

  // Return cleanup function for sign-out
  return {
    unregisterPushToken: async () => {
      if (tokenRef.current) {
        await apiDelete("/api/push-token", { token: tokenRef.current });
        tokenRef.current = null;
      }
    },
  };
}
