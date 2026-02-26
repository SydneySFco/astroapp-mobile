# COLOR ALIGNMENT — RLOOP-010

Bu iterasyonda PM_COLOR_SYSTEM_V1 dokümanı authoritative kabul edilerek temel ekranlarda renk kullanımını semantik token yapısına hizaladım.

## Yapılanlar

- Merkezi token katmanı eklendi:
  - `src/theme/tokens.ts`
  - Light/Dark palette map + state/layer yardımcıları (`border`, `overlay`, `primarySoft`, `primaryPressed`)
- Uygulama renk erişimi güncellendi:
  - `src/theme/colors.ts`
  - Mevcut ekranların kullandığı API korunurken PM semantik tokenları bağlandı.

## Ekran Hizalamaları (Scope)

Hardcoded hex değerler token kullanımına geçirildi:

- Auth
  - `src/screens/auth/AuthFlowScreen.tsx`
  - `src/screens/auth/LoginScreen.tsx`
  - `src/screens/auth/RegisterScreen.tsx`
  - `src/screens/auth/ForgotPasswordScreen.tsx`
- Home
  - `src/screens/HomeScreen.tsx`
- Paywall
  - `src/screens/PaywallScreen.tsx`
- Reports
  - `src/screens/ReportsMarketplaceScreen.tsx`
  - `src/screens/ReportDetailScreen.tsx`
  - `src/screens/ReportCheckoutScreen.tsx`
- Settings/Legal
  - `src/screens/SettingsScreen.tsx`
  - `src/screens/LegalScreen.tsx`

Ayrıca state/card kurallarını ortaklaştırmak için:
- `src/components/ScreenState.tsx`

## CTA / State / Card Uyum Notları

- Primary CTA: `colors.primary` + `colors.ctaPrimaryText`
- Secondary CTA: `surface/card` + `border` + `colors.ctaSecondaryText`
- Ghost/link aksiyon: `colors.primary`
- State metinleri:
  - success: `colors.success`
  - warning: `colors.warning`
  - error: `colors.error`/`colors.danger`
- Kartlar: `surface/card` + `border`

## Hızlı Kontrast/Okunabilirlik Kontrol Notu

Metin/arka plan seviyesinde hızlı kontrol:
- Ana metinler `textPrimary` yalnızca `bg/surface` üstünde tutuldu.
- Yardımcı metinler `textSecondary` kısa açıklama/ikincil satırlarda kullanıldı.
- Primary CTA üzerinde metin rengi tema bazlı tanımlandı (`ctaPrimaryText`) ve dark temada koyu metin kullanıldı (PM notuna uygun).
- Error/Warning/Success yalnızca renk ile bırakılmadı; ilgili ekranlarda açıklama metni/başlık ile desteklendi.

Not: Bu çalışma kapsamı gereği kapsamlı WCAG ölçümü değil, hızlı semantik hizalama + temel okunabilirlik kontrolüdür.
