# BACKEND_INTEGRATION_CHECKLIST_RLOOP-009

## Scope
Mock akışlardan gerçek backend entegrasyonuna geçiş için başlangıç iskeleti.

## 1) API Config & Environment Strategy
- [x] `src/config/apiConfig.ts` eklendi.
- [x] `releaseChannel -> environment` çözümlemesi tanımlandı (`internal/beta -> staging`, `production -> production`).
- [x] Base URL merkezi konfigürasyona taşındı.
- [x] Timeout (`timeoutMs`) merkezi konfigürasyona taşındı.
- [x] Default header seti tanımlandı (`Accept`, `Content-Type`, app version/build header'ları).
- [x] Runtime base URL override hook'u bırakıldı (`setApiRuntimeBaseUrl`).
- [ ] CI/CD env injection ile production/staging URL’lerinin gerçek domainlerle doldurulması.

## 2) Auth Lifecycle Skeleton
- [x] Login/Register/ForgotPassword request type’ları netleştirildi (`authTypes.ts`).
- [x] Login/Register response typing backend-ready hale getirildi (`user + tokens`).
- [x] Token storage abstraction eklendi (`tokenStorage.ts`, secure storage placeholder).
- [x] Login/Register başarılı olursa token persistence akışı tanımlandı (`onQueryStarted`).
- [x] Logout mutation eklendi.
- [x] Logout invalidation flow merkezi fonksiyonla tanımlandı (`runLogoutFlow`).
- [ ] In-memory token store yerine Keychain/Keystore tabanlı güvenli storage bağlanması.

## 3) Reports Backend Contract Stubs
- [x] `reportsApi.ts` eklendi.
- [x] Catalog contract type’ları eklendi (`ReportCatalogItem`, `ReportCatalogResponse`).
- [x] Detail contract type’ları eklendi (`ReportDetail`).
- [x] Purchased reports contract type’ları eklendi (`PurchasedReport`, `PurchasedReportsResponse`).

## 4) RTK Query Backend-Ready Endpoints
- [x] `axiosBaseQuery` merkezi API config + auth header kullanımına geçirildi.
- [x] `healthApi` hardcoded URL’den çıkarılıp merkezi base query’e geçirildi.
- [x] `reportsApi` store’a reducer + middleware olarak bağlandı.
- [x] Mock fallback notları endpoint seviyesinde dokümante edildi.
- [ ] UI data source'unun `reportsSlice` mock state'ten `reportsApi` query cache'e kademeli taşınması.

## 5) PM Palette Rule (Critical)
- [x] Renk kararlarında PM palette authoritative yaklaşımı not edildi.
- [x] Palette hardcode kararlarından kaçınılması; config/token bazlı ilerleme prensibi korundu.

## Validation
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`

## Follow-up for RLOOP-010
1. PM color token uygulaması + UI alignment (authoritative palette ile).
2. Auth secure storage gerçek implementasyonu.
3. Reports ekranlarının API-first veri modeline taşınması (mock fallback kaldırma planı ile).
4. Backend error mapping + retry policy standardizasyonu.
