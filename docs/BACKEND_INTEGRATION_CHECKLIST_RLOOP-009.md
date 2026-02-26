# BACKEND_INTEGRATION_CHECKLIST_RLOOP-009

## Scope
Mock akışlardan gerçek backend entegrasyonuna geçiş için başlangıç iskeleti.
RLOOP-012 ile backend standardı **Supabase-first** olarak güncellendi.

## 1) API Config & Environment Strategy
- [x] `src/config/apiConfig.ts` eklendi.
- [x] `releaseChannel -> environment` çözümlemesi tanımlandı (`internal/beta -> staging`, `production -> production`).
- [x] Base URL merkezi konfigürasyona taşındı.
- [x] Timeout (`timeoutMs`) merkezi konfigürasyona taşındı.
- [x] Default header seti tanımlandı (`Accept`, `Content-Type`, app version/build header'ları).
- [x] Runtime base URL override hook'u bırakıldı (`setApiRuntimeBaseUrl`).
- [x] Supabase env placeholder stratejisi eklendi (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `.env.example`).
- [ ] CI/CD env injection ile staging/production Supabase project değerlerinin güvenli dağıtımı.

## 2) Auth Lifecycle Skeleton (Supabase Adaptör Geçişi)
- [x] Login/Register/ForgotPassword request type’ları netleştirildi (`authTypes.ts`).
- [x] Token storage abstraction eklendi (`tokenStorage.ts`, secure storage placeholder).
- [x] Supabase auth wrapper katmanı eklendi (`src/services/supabase/auth.ts`):
  - [x] `signIn`
  - [x] `signUp`
  - [x] `forgotPassword`
  - [x] `logout`
- [x] Mevcut `authApi` katmanı Supabase adaptörüne bağlandı (fallback: mevcut REST endpoint'leri).
- [x] Login/Register başarılı olursa token persistence akışı korunuyor (`onQueryStarted`).
- [ ] In-memory token store yerine Keychain/Keystore tabanlı güvenli storage bağlanması.
- [ ] Supabase refresh token lifecycle + background restore testleri.

## 3) Reports & Profile Contract Notes (Supabase Perspektifi)
- [x] Reports contract'ı Supabase tablo/RPC yaklaşımına göre dokümante edildi (`docs/SUPABASE_BACKEND_PLAN.md`).
- [x] Profile contract'ı `profiles` tablosu + `auth.users` ilişkisi üzerinden tanımlandı.
- [x] MVP için RLS yaklaşımı dokümante edildi (anon vs authenticated erişim sınırları).
- [ ] Final SQL migration dosyalarının hazırlanması ve Supabase üzerinde uygulanması.

## 4) RTK Query Backend-Ready Endpoints
- [x] `axiosBaseQuery` merkezi API config + auth header kullanımına geçirildi.
- [x] `healthApi` hardcoded URL’den çıkarılıp merkezi base query’e geçirildi.
- [x] `reportsApi` store’a reducer + middleware olarak bağlandı.
- [x] Auth endpoints Supabase-first davranışa taşındı (safe transition ile).
- [ ] UI data source'unun `reportsSlice` mock state'ten `reportsApi` query cache'e kademeli taşınması.

## 5) PM Palette Rule (Critical)
- [x] Renk kararlarında PM palette authoritative yaklaşımı not edildi.
- [x] Palette hardcode kararlarından kaçınılması; config/token bazlı ilerleme prensibi korundu.

## Validation
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`

## Next Actions
1. Supabase SQL migrations (`profiles`, `reports_catalog`, `user_reports`, `report_orders`) + seed.
2. Reports querylerini Supabase client üzerinden gerçek sorgulara taşıma.
3. Auth secure storage gerçek implementasyonu.
4. Backend error mapping + retry policy standardizasyonu.
