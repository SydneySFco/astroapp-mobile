# RLOOP-021 — Supabase Enforcement Rollout Runbook

Bu runbook, RLOOP-020 ile hazırlanan enforcement migration’ını güvenli biçimde **staging → production** ortamlarına uygulamak için operasyon adımlarını içerir.

## 1) Prerequisites

- Supabase project erişimi (staging + production)
- `service_role` secret erişimi (sadece deploy/ops sorumlularında)
- Migration dosyaları:
  - `docs/supabase/migrations/20260226130500_rloop020_user_reports_enforcement.sql`
  - `docs/supabase/migrations/20260226134000_rloop021_requeue_stuck_user_report_draft.sql`
- Uygulama tarafında minimum uyumluluk:
  - client select içinde `updated_at`, `version` alanları okunuyor olmalı

## 2) Staging Apply (Önerilen sıralama)

1. **Backup snapshot al**
   - Supabase dashboard’dan staging DB snapshot / PITR teyidi.
2. **Maintenance penceresi ilan et**
   - kısa süreli write riskine karşı ekip bilgilendirmesi.
3. **Migration apply**
   - SQL Editor veya migration pipeline ile sırayla uygula:
     1) `20260226130500_rloop020_user_reports_enforcement.sql`
     2) `20260226134000_rloop021_requeue_stuck_user_report_draft.sql`
4. **Smoke verify**
   - `user_reports` tablosunda trigger’lar oluştu mu:
     - `trg_user_reports_status_guard`
     - `trg_user_reports_versioning`
   - RPC oluştu mu:
     - `public.requeue_stuck_user_report(...)`
5. **Functional verify**
   - Geçerli transition test: `queued -> processing -> ready`
   - Geçersiz transition test: `ready -> processing` (hata beklenir)
   - RPC test (service role ile): stuck bir kayıt için çağrı + audit satırı oluşumu

## 3) Production Apply

Staging doğrulaması geçmeden production apply yapılmamalı.

1. **Pre-check**
   - Son 24 saat hata oranı / queue gecikmesi baseline’ı alın.
2. **Backup/PITR doğrulama**
   - Geri dönüş penceresi teyit edilir.
3. **Deploy window**
   - düşük trafik penceresi seçilir.
4. **Migration apply (aynı sıra)**
5. **Post-deploy verify (15-30 dk izleme)**
   - DB error spikes (`23514`, `42501`)
   - processing backlog artışı
   - Edge reconcile job hata oranı

## 4) Verification Checklist

- [ ] Migration dosyaları sıralı ve hatasız uygulandı
- [ ] Trigger fonksiyonları mevcut
- [ ] `user_reports.version` monotonic artıyor
- [ ] `user_reports.updated_at` update’te UTC refresh oluyor
- [ ] RPC sadece service role ile çalışıyor
- [ ] Audit log tablosuna başarılı/başarısız denemeler yazılıyor
- [ ] Client tarafı mismatch telemetry event’leri akıyor

## 5) Rollback Notes

> Not: Trigger/constraint migration’larında rollback “down migration” + gerektiğinde restore stratejisi gerektirir.

### Hızlı azaltım (mitigation)
- Reconcile cron’u `alert_only` moda al
- Edge function invocation’ı geçici durdur

### SQL rollback yaklaşımı
- `trg_user_reports_status_guard` / `trg_user_reports_versioning` drop
- İlgili helper function’ları drop
- RLOOP-021 draft RPC ve audit objelerini drop

### Tam geri dönüş
- Kritik veri bozulması varsa staging’de doğrulanmış restore runbook ile PITR/snapshot restore.

## 6) Known Risk

RLOOP-020 guard nedeniyle `processing -> queued` doğrudan transition bloklanır. RLOOP-021 RPC şu an bu durumları audit’leyip kontrollü şekilde raporlar; tam override davranışı için ayrı policy kararı gerekir (öneri: RLOOP-022).