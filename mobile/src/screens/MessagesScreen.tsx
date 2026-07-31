import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';

type ThreadRow = {
  thread_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  message_threads?: {
    id: string;
    title: string | null;
    is_admin_thread: boolean;
    updated_at: string;
  } | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  is_admin_message: boolean;
  created_at: string;
};

export function MessagesScreen({ session }: { session: Session }) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const selected = useMemo(() => threads.find((item) => item.thread_id === selectedThreadId) || null, [threads, selectedThreadId]);

  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_thread_participants')
      .select('thread_id,status,message_threads(id,title,is_admin_thread,updated_at)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!error) {
      const next = (data || []) as unknown as ThreadRow[];
      next.sort((a, b) => {
        const adminA = Boolean(a.message_threads?.is_admin_thread);
        const adminB = Boolean(b.message_threads?.is_admin_thread);
        if (adminA !== adminB) return adminA ? -1 : 1;
        return new Date(b.message_threads?.updated_at || 0).getTime() - new Date(a.message_threads?.updated_at || 0).getTime();
      });
      setThreads(next);
      if (!selectedThreadId && next[0]) setSelectedThreadId(next[0].thread_id);
    }
    setLoading(false);
  }, [selectedThreadId, session.user.id]);

  const loadMessages = useCallback(async (threadId: string) => {
    const { data, error } = await supabase
      .from('message_thread_messages')
      .select('id,thread_id,sender_id,body,is_admin_message,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (!error) setMessages((data || []) as MessageRow[]);
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
    const channel = supabase
      .channel(`mobile-messages-${selectedThreadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_thread_messages', filter: `thread_id=eq.${selectedThreadId}` }, () => void loadMessages(selectedThreadId))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMessages, selectedThreadId]);

  async function acceptRequest() {
    if (!selectedThreadId) return;
    await supabase
      .from('message_thread_participants')
      .update({ status: 'accepted', last_read_at: new Date().toISOString() })
      .eq('thread_id', selectedThreadId)
      .eq('user_id', session.user.id);
    await loadThreads();
  }

  async function send() {
    if (!selectedThreadId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    const auth = await supabase.auth.getSession();
    const baseUrl = process.env.EXPO_PUBLIC_VIEWTUBE_WEB_URL || 'https://viewtube.tv';
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/mobile/messages/${selectedThreadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.data.session?.access_token || ''}`,
      },
      body: JSON.stringify({ message: text }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Message failed.' }));
      Alert.alert('Message failed', payload.error || 'Message failed.');
    }
    await loadMessages(selectedThreadId);
  }

  async function startThread(toAdmin = false) {
    if (!newMessage.trim() || (!toAdmin && !target.trim())) return;
    const auth = await supabase.auth.getSession();
    const baseUrl = process.env.EXPO_PUBLIC_VIEWTUBE_WEB_URL || 'https://viewtube.tv';
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/mobile/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.data.session?.access_token || ''}`,
      },
      body: JSON.stringify({ target, message: newMessage, toAdmin }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      Alert.alert('Message failed', payload.error || 'Message failed.');
      return;
    }
    setTarget('');
    setNewMessage('');
    await loadThreads();
    setSelectedThreadId(payload.threadId || selectedThreadId);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.page, paddingBottom: 106 }}>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '950', marginBottom: 14 }}>Messages</Text>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14, marginBottom: 14, gap: 10 }}>
        <Text style={{ color: colors.text, fontWeight: '950', fontSize: 17 }}>Start a chat</Text>
        <TextInput value={target} onChangeText={setTarget} autoCapitalize="none" placeholder="@handle or email" placeholderTextColor={colors.muted} style={{ borderRadius: 14, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12, minHeight: 44 }} />
        <TextInput value={newMessage} onChangeText={setNewMessage} placeholder="Message" placeholderTextColor={colors.muted} style={{ borderRadius: 14, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12, minHeight: 44 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => startThread(false)} style={{ flex: 1, borderRadius: 14, backgroundColor: colors.red, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '900' }}>Send request</Text>
          </Pressable>
          <Pressable onPress={() => startThread(true)} style={{ flex: 1, borderRadius: 14, backgroundColor: colors.panelSoft, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>Admin</Text>
          </Pressable>
        </View>
      </View>
      {loading ? <ActivityIndicator color={colors.red} /> : null}
      {!loading && !threads.length ? <EmptyState title="No messages yet" body="Admin messages and message requests will appear here." /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 54, marginBottom: 12 }}>
        {threads.map((thread) => (
          <Pressable key={thread.thread_id} onPress={() => setSelectedThreadId(thread.thread_id)} style={{ marginRight: 10, borderRadius: 999, backgroundColor: selectedThreadId === thread.thread_id ? colors.text : colors.panel, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: selectedThreadId === thread.thread_id ? colors.bg : colors.text, fontWeight: '850' }}>
              {thread.message_threads?.is_admin_thread ? 'Admin' : thread.status === 'pending' ? 'Request' : 'Chat'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {selected ? (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 10 }}>
            {messages.map((message) => {
              const mine = message.sender_id === session.user.id;
              return (
                <View key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginBottom: 10, borderRadius: 18, backgroundColor: mine ? colors.red : message.is_admin_message ? '#12335A' : colors.panel, padding: 14 }}>
                  <Text style={{ color: colors.text, lineHeight: 20 }}>{message.body}</Text>
                </View>
              );
            })}
          </ScrollView>
          {selected.status === 'pending' ? (
            <Pressable onPress={acceptRequest} style={{ borderRadius: 18, backgroundColor: colors.red, padding: 15, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '900' }}>Accept message request</Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Message" placeholderTextColor={colors.muted} style={{ flex: 1, borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14 }} />
              <Pressable onPress={send} style={{ borderRadius: 18, backgroundColor: colors.red, paddingHorizontal: 18, justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '900' }}>Send</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}
