# RLOOP-007 QA Matrix — Stability Gate

## Kapsam
- Auth (login/register/forgot password)
- Paywall (subscribe/restore)
- Reports (marketplace/detail/checkout)
- Settings (delete request feedback)

## Network Scenario Matrix

### 1) Low network (yüksek gecikme)
- **Adımlar**
  - Ağ hızını 2G/Slow 3G profiline düşür
  - Login / Register / Forgot Password submit et
  - Paywall subscribe ve Reports checkout success akışını başlat
  - Settings > delete request tetikle
- **Beklenen**
  - Loading skeleton görünür
  - Timeout olduğunda error state + retry görünür
  - Retry ile işlem ikinci denemede devam eder (mock demo)
  - İlgili `*_error` ve `*_retry` eventleri loglanır

### 2) Offline
- **Adımlar**
  - Cihazı airplane mode'a al
  - Auth submit / paywall subscribe / reports checkout / delete request dene
- **Beklenen**
  - Error state gösterilir
  - Retry butonu ile tekrar deneme mümkün
  - Uygulama crash olmaz, kullanıcı ekranda kalır

### 3) Timeout
- **Adımlar**
  - Normal ağda akışları başlat
  - İlk denemede mock timeout veren ekranları kontrol et
- **Beklenen**
  - Paywall: ilk subscribe denemesi timeout + retry
  - Reports checkout: ilk success denemesi timeout + retry
  - Settings delete request: ilk deneme timeout + retry
  - Retry sonrası başarılı akış gözlenir (demo net)

## Manual Smoke Checklist
- [ ] Auth login: loading/error/retry state görünür
- [ ] Auth register: loading/error/retry state görünür
- [ ] Forgot password: loading/error/retry state görünür
- [ ] Paywall: loading skeleton + timeout error + retry çalışır
- [ ] Reports marketplace: empty state fallback var
- [ ] Reports checkout: loading/error/retry + success/fail/cancel çalışır
- [ ] Settings delete request: loading/error/retry + success/fail feedback görünür
- [ ] Analytics console log: `auth_error/auth_retry`, `paywall_error/paywall_retry`, `reports_error/reports_retry`, `settings_error/settings_retry`
- [ ] Uygulama akış geçişlerinde crash yok
