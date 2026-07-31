import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return { ok: false, message: 'Push notifications require a physical device.' };

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return { ok: false, message: 'Notifications are not enabled.' };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

  await supabase.from('mobile_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      device_name: Device.deviceName || Device.modelName || null,
      app_version: Constants.expoConfig?.version || null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' },
  );

  await supabase.from('notification_preferences').upsert({ user_id: userId }, { onConflict: 'user_id' });

  return { ok: true, token };
}
