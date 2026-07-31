import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { colors, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications } from '../lib/push';

type Prefs = {
  push_enabled: boolean;
  new_subscriber_push: boolean;
  new_comment_push: boolean;
  messages_push: boolean;
  message_requests_push: boolean;
  admin_messages_push: boolean;
};

const defaultPrefs: Prefs = {
  push_enabled: true,
  new_subscriber_push: true,
  new_comment_push: true,
  messages_push: true,
  message_requests_push: true,
  admin_messages_push: true,
};

export function SettingsScreen({ session }: { session: Session }) {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notification_preferences')
      .select('push_enabled,new_subscriber_push,new_comment_push,messages_push,message_requests_push,admin_messages_push')
      .eq('user_id', session.user.id)
      .maybeSingle();
    setPrefs({ ...defaultPrefs, ...(data || {}) });
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: Prefs) {
    setPrefs(next);
    setSaving(true);
    await supabase.from('notification_preferences').upsert({ user_id: session.user.id, ...next }, { onConflict: 'user_id' });
    setSaving(false);
  }

  async function enablePush() {
    setSaving(true);
    const result = await registerForPushNotifications(session.user.id);
    setSaving(false);
    Alert.alert('ViewTube notifications', result.ok ? 'Push notifications are enabled.' : result.message || 'Could not enable push notifications.');
    if (result.ok) await save({ ...prefs, push_enabled: true });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.page, paddingBottom: 120 }}>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '950', marginBottom: 10 }}>Settings</Text>
      <Text style={{ color: colors.muted, marginBottom: 20 }}>Manage mobile notifications and your account.</Text>
      {loading ? <ActivityIndicator color={colors.red} /> : null}
      {!loading ? (
        <View style={{ gap: 12 }}>
          <Pressable onPress={enablePush} disabled={saving} style={{ borderRadius: 20, backgroundColor: colors.red, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '950' }}>{saving ? 'Saving…' : 'Enable iOS push notifications'}</Text>
          </Pressable>
          <Toggle label="Push notifications" value={prefs.push_enabled} onChange={(value) => save({ ...prefs, push_enabled: value })} />
          <Toggle label="New subscribers" value={prefs.new_subscriber_push} onChange={(value) => save({ ...prefs, new_subscriber_push: value })} />
          <Toggle label="New comments" value={prefs.new_comment_push} onChange={(value) => save({ ...prefs, new_comment_push: value })} />
          <Toggle label="Messages" value={prefs.messages_push} onChange={(value) => save({ ...prefs, messages_push: value })} />
          <Toggle label="Message requests" value={prefs.message_requests_push} onChange={(value) => save({ ...prefs, message_requests_push: value })} />
          <Toggle label="Admin messages" value={prefs.admin_messages_push} onChange={(value) => save({ ...prefs, admin_messages_push: value })} />
          <Pressable onPress={signOut} style={{ marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.text, fontWeight: '850', fontSize: 16 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.redDark }} thumbColor={value ? colors.red : colors.muted} />
    </View>
  );
}
