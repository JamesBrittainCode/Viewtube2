import { Text, View } from 'react-native';
import { colors } from '../lib/theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ borderRadius: 10, backgroundColor: colors.red, paddingHorizontal: 9, paddingVertical: 6 }}>
        <Text style={{ color: 'white', fontSize: compact ? 18 : 22, fontWeight: '900' }}>View</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: compact ? 18 : 22, fontWeight: '900' }}>Tube</Text>
    </View>
  );
}
