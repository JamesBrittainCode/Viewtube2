import { Text, View } from 'react-native';
import { colors } from '../lib/theme';

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ padding: 24, borderRadius: 22, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {body ? <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>{body}</Text> : null}
    </View>
  );
}
