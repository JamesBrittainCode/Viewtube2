import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { Brand } from '../components/Brand';
import { EmptyState } from '../components/EmptyState';
import { VideoCard } from '../components/VideoCard';
import { colors, spacing } from '../lib/theme';
import { supabase, type VideoLite } from '../lib/supabase';
import type { RootStackParamList, TabParamList } from '../App';

type Props = BottomTabScreenProps<TabParamList, 'Home'> & {
  session: Session;
  navigation: BottomTabScreenProps<TabParamList, 'Home'>['navigation'] & NativeStackNavigationProp<RootStackParamList>;
};

export function HomeScreen({ navigation }: Props) {
  const [videos, setVideos] = useState<VideoLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('id,title,thumbnail_url,views,created_at,duration_seconds,is_short,profiles:profiles!videos_user_id_fkey(id,username,handle,avatar_url,verified,is_admin)')
      .eq('visibility', 'public')
      .eq('is_removed', false)
      .eq('is_short', false)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setVideos((data || []) as VideoLite[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.page, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.red} />}
    >
      <View style={{ marginBottom: 22 }}>
        <Brand />
        <Text style={{ color: colors.muted, marginTop: 10 }}>Fresh videos from ViewTube creators</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.red} /> : null}
      {!loading && !videos.length ? <EmptyState title="No videos yet" body="Public uploads will show here." /> : null}
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} onPress={() => navigation.navigate('Video', { id: video.id, title: video.title })} />
      ))}
    </ScrollView>
  );
}
