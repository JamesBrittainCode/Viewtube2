import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { colors } from '../lib/theme';
import { supabase, type VideoLite } from '../lib/supabase';

const height = Dimensions.get('window').height;

export function ShortsScreen() {
  const [shorts, setShorts] = useState<VideoLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('id,title,thumbnail_url,video_url,views,created_at,is_short,profiles:profiles!videos_user_id_fkey(id,username,handle,avatar_url,verified,is_admin)')
      .eq('visibility', 'public')
      .eq('is_removed', false)
      .eq('is_short', true)
      .order('created_at', { ascending: false })
      .limit(25);
    if (!error) setShorts((data || []) as VideoLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.red} /></View>;
  if (!shorts.length) return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, justifyContent: 'center' }}><EmptyState title="No Shorts yet" /></View>;

  return (
    <FlatList
      data={shorts}
      keyExtractor={(item) => item.id}
      pagingEnabled
      style={{ flex: 1, backgroundColor: colors.bg }}
      renderItem={({ item }) => (
        <View style={{ height: height - 86, justifyContent: 'center', padding: 18 }}>
          <View style={{ aspectRatio: 9 / 16, alignSelf: 'center', width: '78%', borderRadius: 28, backgroundColor: colors.panelSoft, overflow: 'hidden', justifyContent: 'flex-end', padding: 18 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }} numberOfLines={3}>{item.title}</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>Tap video support coming next</Text>
          </View>
        </View>
      )}
    />
  );
}
