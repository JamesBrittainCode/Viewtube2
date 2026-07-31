import { Image, Pressable, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { unwrapProfile, type VideoLite } from '../lib/supabase';

function formatViews(value?: number | null) {
  const views = Number(value || 0);
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

export function VideoCard({ video, onPress }: { video: VideoLite; onPress?: () => void }) {
  const profile = unwrapProfile(video.profiles);
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 22 }}>
      <View style={{ overflow: 'hidden', borderRadius: 20, backgroundColor: colors.panelSoft }}>
        <Image
          source={{ uri: video.thumbnail_url || 'https://viewtube.tv/thumbnail-placeholder.svg' }}
          style={{ aspectRatio: 16 / 9, width: '100%', backgroundColor: colors.panelSoft }}
        />
        {video.duration_seconds ? (
          <View style={{ position: 'absolute', bottom: 10, right: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>{Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Image
          source={{ uri: profile?.avatar_url || 'https://viewtube.tv/avatar-placeholder.svg' }}
          style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: colors.panelSoft }}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: colors.text, fontSize: 16, fontWeight: '850', lineHeight: 21 }}>{video.title}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 4 }}>
            {profile?.username || 'ViewTube creator'} · {formatViews(video.views)} views
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
