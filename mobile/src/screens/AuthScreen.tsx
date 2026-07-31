import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Brand } from '../components/Brand';
import { colors, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';

export function AuthScreen() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const result =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (result.error) Alert.alert('ViewTube', result.error.message);
    if (mode === 'sign-up' && !result.error) Alert.alert('Check your email', 'Confirm your email, then come back and sign in.');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.page }}>
      <StatusBar style="light" />
      <View style={{ gap: 28 }}>
        <Brand />
        <View>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '950' }}>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 16 }}>ViewTube on iPhone — synced with your web account.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            style={inputStyle}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={inputStyle}
          />
          <Pressable onPress={submit} disabled={loading} style={{ minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.red }}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{mode === 'sign-in' ? 'Sign in' : 'Sign up'}</Text>}
          </Pressable>
          <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} style={{ alignItems: 'center', padding: 12 }}>
            <Text style={{ color: colors.muted }}>{mode === 'sign-in' ? 'No account yet? Sign up' : 'Already have an account? Sign in'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  minHeight: 54,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.panel,
  color: colors.text,
  paddingHorizontal: 16,
  fontSize: 16,
};
