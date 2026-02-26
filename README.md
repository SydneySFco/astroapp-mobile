# AstroApp (RLOOP-001)

React Native CLI (Expo'suz) ile TypeScript tabanlı mobil uygulama başlangıç projesi.

## Stack Kararları

- **Platform:** React Native CLI (`react-native init`)
- **Paket yöneticisi:** Yarn
- **Dil:** TypeScript / TSX
- **Stil yaklaşımı:** Bileşen içinde `StyleSheet`
- **State + data layer:** Redux Toolkit + RTK Query
- **HTTP client:** axios

## Proje Yapısı

```text
src/
  app/
  components/
  features/
    health/
  screens/
  services/
    api/
  store/
  theme/
```

## Kurulum

```bash
yarn install
```

## Çalıştırma

### Android

```bash
yarn android
# veya
npx react-native run-android
```

### iOS

```bash
cd ios && bundle install && bundle exec pod install && cd ..
yarn ios
# veya
npx react-native run-ios
```

## Mevcut İskelet

- `axiosBaseQuery` ile RTK Query + axios entegrasyonu
- `healthApi` içinde örnek `getHealth` endpoint'i (`/health`)
- `HealthScreen` üzerinde örnek çağrı ve durum gösterimi

> Not: Health endpoint'i örnek URL (`https://example.com/health`) ile iskelet amaçlıdır.

## Commit Disiplini

Bu loop kapsamında commit mesajlarında **RLOOP-001** kimliği kullanılmıştır.
