import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing } from '../lib/theme';
import { supabase, type VideoLite, unwrapProfile } from '../lib/supabase';
import type { RootStackParamList } from '../App';

export function VideoScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Video'>) {
  const [video, setVideo] = useState<VideoLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('videos')
      .select('id,title,description,thumbnail_url,video_url,views,created_at,duration_seconds,profiles:profiles!videos_user_id_fkey(id,username,handle,avatar_url,verified,is_admin)')
      .eq('id', route.params.id)
      .maybeSingle()
      .then(({ data }) => {
        setVideo(data as VideoLite | null);
        setLoading(false);
      });
  }, [route.params.id]);

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.red} /></View>;
  if (!video) return <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.page }}><EmptyState title="Video not found" /></View>;

  const profile = unwrapProfile(video.profiles);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 120 }}>
      <Image source={{ uri: video.thumbnail_url || 'https://viewtube.tv/thumbnail-placeholder.svg' }} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.panelSoft }} />
      <View style={{ padding: spacing.page }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '950', lineHeight: 29 }}>{video.title}</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>{Number(video.views || 0).toLocaleString()} views</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <Image source={{ uri: profile?.avatar_url || 'https://viewtube.tv/avatar-placeholder.svg' }} style={{ height: 46, width: 46, borderRadius: 23 }} />
          <View>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{profile?.username || 'Creator'}</Text>
            <Text style={{ color: colors.muted }}>@{profile?.handle || 'viewtube'}</Text>
          </View>
        </View>
        <View style={{ marginTop: 18, borderRadius: 20, backgroundColor: colors.panel, padding: 16 }}>
          <Text style={{ color: colors.text, lineHeight: 21 }}>{String((video as { description?: string | null }).description || 'No description provided.')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
