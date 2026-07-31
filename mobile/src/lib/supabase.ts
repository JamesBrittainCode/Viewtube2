import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type ProfileLite = {
  id: string;
  username: string | null;
  handle: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  is_admin?: boolean | null;
};

export type VideoLite = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url?: string | null;
  views: number | null;
  created_at: string;
  is_short?: boolean | null;
  duration_seconds?: number | null;
  profiles?: ProfileLite | ProfileLite[] | null;
};

export function unwrapProfile(value: VideoLite['profiles']) {
  return Array.isArray(value) ? value[0] || null : value || null;
}
