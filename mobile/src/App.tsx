import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { colors } from './lib/theme';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ShortsScreen } from './screens/ShortsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { VideoScreen } from './screens/VideoScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Video: { id: string; title?: string };
};

export type TabParamList = {
  Home: undefined;
  Shorts: undefined;
  Inbox: undefined;
  Alerts: undefined;
  Settings: undefined;
};

const Tabs = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator({ session }: { session: Session }) {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 86, paddingTop: 10 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800', paddingBottom: 10 },
      }}
    >
      <Tabs.Screen name="Home" options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="⌂" /> }}>
        {(props) => <HomeScreen {...props} session={session} />}
      </Tabs.Screen>
      <Tabs.Screen name="Shorts" options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="▯" /> }}>
        {(props) => <ShortsScreen {...props} />}
      </Tabs.Screen>
      <Tabs.Screen name="Inbox" options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="✉" /> }}>
        {(props) => <MessagesScreen {...props} session={session} />}
      </Tabs.Screen>
      <Tabs.Screen name="Alerts" options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="◉" /> }}>
        {(props) => <NotificationsScreen {...props} session={session} />}
      </Tabs.Screen>
      <Tabs.Screen name="Settings" options={{ tabBarIcon: ({ color }) => <TabIcon color={color} label="⚙" /> }}>
        {(props) => <SettingsScreen {...props} session={session} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

function TabIcon({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: 20, fontWeight: '900', height: 24 }}>{label}</Text>
    </View>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.red,
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
        <Stack.Screen name="Tabs" options={{ headerShown: false }}>
          {() => <TabNavigator session={session} />}
        </Stack.Screen>
        <Stack.Screen name="Video" component={VideoScreen} options={({ route }) => ({ title: route.params.title || 'Watch' })} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
