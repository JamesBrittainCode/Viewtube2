import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationsScreen({ session }: { session: Session }) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,message,is_read,created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    if (!error) setRows((data || []) as NotificationRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [session.user.id]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`mobile-notifications-${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, session.user.id]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.page, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.red} />}
    >
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '950', marginBottom: 18 }}>Notifications</Text>
      {loading ? <ActivityIndicator color={colors.red} /> : null}
      {!loading && !rows.length ? <EmptyState title="No notifications yet" body="Subscribers, comments, messages, and admin updates show here." /> : null}
      {rows.map((item) => (
        <View key={item.id} style={{ marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: item.is_read ? colors.border : colors.red, backgroundColor: colors.panel, padding: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '850', fontSize: 16 }}>{item.message}</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
