# RELEASE READINESS — RLOOP-008 (Internal)

## 1) Amaç
Bu doküman, AstroApp P0 demo sürümünün **internal dağıtım** (TestFlight / Google Play Internal Testing) hazırlık durumunu ve release öncesi kontrol adımlarını tanımlar.

## 2) Build / Run Prerequisites
- Node.js: `>=22`
- Package manager: `npm` (repo lock dosyasına göre)
- iOS için:
  - Xcode (uyumlu güncel sürüm)
  - CocoaPods (`bundle install && bundle exec pod install`)
- Android için:
  - Android Studio + SDK + emulator/device
  - Java 17 önerilir
- Repo kurulumu:
  - `npm install`
  - iOS pod kurulumu (iOS build alınacaksa)

## 3) Environment Requirements
- `.env` dosyası mevcut olmalı (internal token/secrets localde tutulur).
- P0 kapsamı gereği bazı API uçları mock/fallback davranışla çalışır.
- Debug/QA build’de versiyon etiketi görünmelidir (footer: version/build).
- Ağ erişimi olmayan senaryolarda kritik ekranlar crash etmemeli.

## 4) Smoke Test Checklist (P0 Flows)
Aşağıdaki akışlar release adayı build’de en az 1 kez uçtan uca doğrulanmalı:

### Kimlik & Onboarding
- [ ] Register ekranı açılıyor
- [ ] Login ekranı açılıyor
- [ ] Forgot password ekranı açılıyor
- [ ] Onboarding tamamlandığında home ekranına geçiliyor

### Ana ürün akışları
- [ ] Home -> Paywall geçişi çalışıyor
- [ ] Home -> Reports Marketplace açılıyor
- [ ] Report detail açılıyor
- [ ] Checkout sonrası satın alınan rapor My Reports’ta görünüyor
- [ ] My Reports -> Report Read açılıyor

### Ayarlar & Yasal
- [ ] Settings ekranı açılıyor
- [ ] Legal ekranı açılıyor
- [ ] Logout sonrası auth flow’a dönülüyor

### Stabilite
- [ ] Uygulama cold start crash yok
- [ ] Arka plana al / geri dön senaryosunda kritik kırılma yok
- [ ] Footer’da version/build label görünüyor (debug/internal)

## 5) Rollback Plan
Internal release’te kritik sorun durumunda:
1. Dağıtımı durdur (TestFlight build expire/disable, Play Internal release pause).
2. Son stabil internal build’e geri dön (önceki build numarası).
3. RLOOP hotfix branch’i aç (`hotfix/rloop-008-<issue>`).
4. Fix sonrası yeniden smoke test + kısa regression.
5. Yeni internal build’i sınırlı test grubuna tekrar aç.

## 6) Go / No-Go Kriterleri
**Go:**
- Smoke test checklist’in tamamı geçti
- Lint + TypeScript validation başarılı
- Blocker/P0 bug yok
- Version/build etiketi doğru
- Bilinen limitasyonlar dokümante

**No-Go:**
- Auth veya satın alma akışında kırılma
- Crash veya veri kaybı riski
- Store review için yanıltıcı metadata
- Validation adımlarının başarısız olması

## 7) Release Owner Checklist
- [ ] Dokümanlar güncellendi (Readiness / Metadata / Known Limitations)
- [ ] Internal build alındı (iOS/Android)
- [ ] Smoke test sonuçları kaydedildi
- [ ] Go/No-Go kararı release owner tarafından onaylandı
