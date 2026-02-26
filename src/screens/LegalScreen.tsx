import React from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme/colors';

type Props = {
  onBack: () => void;
};

type LegalLink = {
  label: string;
  url: string;
};

const LEGAL_LINKS: LegalLink[] = [
  {label: 'Gizlilik Politikası', url: 'https://example.com/privacy'},
  {label: 'Kullanım Koşulları', url: 'https://example.com/terms'},
  {label: 'KVKK Aydınlatma Metni', url: 'https://example.com/kvkk'},
];

export function LegalScreen({onBack}: Props) {
  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yasal Bilgilendirme</Text>
      <Text style={styles.description}>
        AstroApp kişisel verilerini daha iyi deneyim sunmak için işler. Hangi veriyi neden
        kullandığımızı aşağıdaki metinlerde açıkça görebilirsin.
      </Text>

      <View style={styles.card}>
        {LEGAL_LINKS.map(link => (
          <Pressable key={link.label} onPress={() => openLink(link.url)} style={styles.linkRow}>
            <Text style={styles.linkText}>{link.label}</Text>
            <Text style={styles.linkUrl}>{link.url}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={onBack}>
        <Text style={styles.primaryButtonText}>Ayarlar'a Dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  linkRow: {
    gap: 4,
  },
  linkText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  linkUrl: {
    color: '#7FA4FF',
    textDecorationLine: 'underline',
  },
  primaryButton: {
    marginTop: 'auto',
    backgroundColor: '#4A63F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
