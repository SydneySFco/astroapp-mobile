# AstroApp PRD v1 (Beginner-First)

## Product Vision
AstroApp, kullanıcıların doğum bilgilerine göre günlük kişiselleştirilmiş rehberlik sunan, şefkatli koç tonunda bir React Native mobil uygulamadır. Amaç sadece yorum üretmek değil; kullanıcıyı günlük küçük ve uygulanabilir aksiyonlara taşımaktır.

## Positioning
- Ton: Şefkatli koç + modern
- Segment: 18–34 (özellikle 25–34 şehirli çalışan kadın ağırlıklı)
- Model: Subscription-first + report upsell
- Scope: v1’de social/community kapalı

## Core Jobs To Be Done
1. “Bugün neye odaklanmalıyım?”
2. “Duygumu regüle etmek için kısa bir yönlendirme istiyorum.”
3. “Kendim/ilişkim hakkında kısa ama kişisel içgörü istiyorum.”

## v1 Features (MVP)
1. Auth: Register/Login/Forgot Password
2. Onboarding: Birth data + intent + first personal summary
3. Home Daily Dashboard
4. Daily Guidance Detail + micro action
5. Weekly Reflection
6. Compatibility Lite (tek kişi, temel öneri)
7. Paywall (sub-first)
8. Reports Marketplace + Report Purchase flow
9. Settings (profile/logout/legal links)
10. Legal: Privacy/Terms/KVKK links + consent capture

## Non-MVP (v2+)
- Community/Tribes
- Live astrologer
- Advanced astrology engine (pro-level)
- Multi-language/i18n full rollout

## Success Metrics
- Activation: signup_complete / signup_start
- Retention: D1, D7
- Monetization: paywall_view -> subscribe_success CVR
- Upsell: report_view -> report_buy CVR
- Engagement: daily_open_rate, ritual_completion_rate

## Guardrails
- Korku/anksiyete dili yok
- Deterministic/kesinlik iddiası yok
- Wellness/reflection framing + disclaimer zorunlu

## Release Gate (v1)
- Tüm P0 akışlar demo edilebilir ve crash-free
- P0 analytics event’leri bağlı
- Build başarılı (android + ios)
- Legal linkleri görünür
- Paywall ve report checkout success/fail/cancel senaryoları doğrulanmış
