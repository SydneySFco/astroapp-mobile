import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {StatusBadge} from '../components/StatusBadge';
import {useGetHealthQuery} from '../features/health/healthApi';
import {colors} from '../theme/colors';

export function HealthScreen() {
  const {data, error, isLoading} = useGetHealthQuery();

  const isHealthy = data?.status?.toLowerCase() === 'ok';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AstroApp Health Check</Text>

      {isLoading && <ActivityIndicator color={colors.textPrimary} />}

      {!isLoading && (
        <View style={styles.card}>
          <Text style={styles.subtitle}>Servis Durumu</Text>
          <StatusBadge ok={isHealthy && !error} />
          <Text style={styles.meta}>
            {error
              ? 'İstek başarısız (iskelet endpoint, backend bekleniyor)'
              : `Yanıt: ${JSON.stringify(data)}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  meta: {
    color: colors.textPrimary,
  },
});
