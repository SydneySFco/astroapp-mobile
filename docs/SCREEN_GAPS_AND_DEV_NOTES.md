# AstroApp – Screen Gaps & Dev Notes

## 1) Mevcut ekran seti (tespit)
- welcome_screen
- login_screen
- register_screen_1..5
- birth_data_input
- choose_your_intent
- home_daily_dashboard
- daily_guidance_detail
- weekly_reflection
- reports_marketplace
- premium_subscription
- compatibility_lite

---

## 2) Gap listesi (P0/P1/P2)

| Öncelik | Eksik ekran/fonksiyon | Neden önemli | Önerilen çözüm (kısa) |
|---|---|---|---|
| **P0** | Şifre sıfırlama (Forgot Password) | Login tıkanırsa kullanıcı çıkamaz | login’den “Şifremi unuttum” + mail reset akışı |
| **P0** | Auth hata/başarı durumları | Form validasyonu ve API hata yönetimi yoksa drop artar | Her auth ekranda inline hata + global toast |
| **P0** | Onboarding tamamlanma/özet ekranı | Register 1-5 sonrası kullanıcı nerede olduğunu anlamalı | “Kurulum tamamlandı” + ilk aksiyon CTA |
| **P0** | Paywall satın alma sonuç ekranları | sub-first modelde ödeme sonucu kritik | success/fail/cancel + retry + restore purchases |
| **P0** | Rapor satın alma checkout akışı | report upsell kilit karar; marketplace tek başına yetmez | report detail → checkout → başarı/başarısız |
| **P0** | Settings + hesap yönetimi temel | Çıkış yapma, hesap silme, abonelik linki gerekir | minimal ayarlar: profil, logout, delete request |
| **P0** | Yasal ekranlar (KVKK/Gizlilik/Terms) | Store/onboarding compliance riski | onboarding ve ayarlara link + zorunlu onay kaydı |
| **P1** | Notification izin/onboarding | günlük rehberlik için geri dönüşü artırır | soft prompt → sistem izni → fallback ayarı |
| **P1** | Boş durumlar (empty states) | Beginner-first için yönlendirme şart | dashboard/report/reflection empty state + CTA |
| **P1** | Offline/timeout ekranları | Mobilde ağ sorunu kaçınılmaz | retry pattern + cached son içerik |
| **P1** | Subscription yönetim ekranı | iOS/Android store yönetimi şeffaf olmalı | plan, yenileme tarihi, iptal yönergesi |
| **P1** | Report library (satın alınanlarım) | satın alma sonrası erişim noktası şart | “Raporlarım” listesi + filtre/sıralama |
| **P1** | Search/filter (marketplace) | upsell için keşif kolaylığı | kategori, fiyat, tema filtresi |
| **P1** | Compatibility Lite detay/limit açıklaması | v1’de social kapalı, sınırlar net olmalı | tek kişi kullanım + “yakında” mesajı |
| **P2** | Tema modu (light/dark opsiyon) | UX iyileştirme, bloklayıcı değil | sistem temasını takip et |
| **P2** | Çoklu dil altyapısı | ölçek için önemli ama MVP dışı | i18n key bazlı copy yapısı |
| **P2** | İleri seviye profil kişiselleştirme | beginner-first için şart değil | avatar, tercih etiketleri |
| **P2** | In-app support/chat | nice-to-have destek kanalı | FAQ + mail fallback |

---

## 3) Development sırasında düzeltilecek net notlar

### Ürün/akış notları
- Register 1-5 adımlarına **step indicator** ekle (örn. 2/5) ve geri/ileri tutarlı olsun.
- `birth_data_input` için zorunlu alanlar net: tarih, saat (bilinmiyor seçeneği), şehir/ülke.
- Beginner-first için jargon azalt: astro terimleri için kısa tooltip/alt açıklama.
- `home_daily_dashboard` içinde tek bir ana CTA: “Bugünün rehberliğini aç”.
- `weekly_reflection` giriş bariyeri düşük olsun: 3 kısa soru + 1 CTA.

### Monetization notları (sub-first + report upsell)
- `premium_subscription` ekranında plan karşılaştırması sade: Aylık/Yıllık + fayda 3 madde.
- Paywall’da “Restore Purchases” görünür ve erişilebilir olmalı.
- `reports_marketplace` kartlarında fiyat, süre, çıktı örneği net görünsün.
- Rapor checkout sonrası “hemen oku” ve “kütüphaneye git” çift CTA ver.
- Ücretsiz kullanıcı için report preview + kilitli bölüm stratejisi uygula.

### UX/UI tutarlılık notları
- Tone standardı: **şefkatli koç + modern**; suçlayıcı/katı dil kullanma.
- Her ekranda 1 primary, 1 secondary CTA kuralı uygula.
- Loading/skeleton state komponentleri ortaklaştır (dashboard/detail/marketplace).
- Error metinleri aksiyonlu yazılsın: “Tekrar dene”, “Bağlantını kontrol et”.
- Formlarda klavye/odak davranışını mobilde test et (özellikle tarih-saat input).

### Teknik/ölçüm notları
- Event tracking minimum set: signup_start, signup_complete, paywall_view, subscribe_success, report_view, report_buy.
- Crash/exception için ekran-bazlı logging aç (auth, checkout, report detail öncelikli).
- Feature flag ile P1/P2 ekranları kapat/aç kurgusu hazır olsun.
- Deep link planı: paywall, report detail, purchased report.
- App store review için test account + demo data hazırla.

---

## 4) Steve implementation checklist (10 madde)

1. P0 ekranlarını branch’lerde ayrı ayrı teslim et; her biri demo edilebilir olsun.
2. Auth akışına forgot password + hata state’leri eklenmeden merge yapma.
3. Paywall success/fail/cancel/restore senaryolarını gerçek cihazda doğrula.
4. Report satın alma uçtan uca akışı (liste→detay→ödeme→okuma) tek test planında kapat.
5. Settings’e logout + account delete request + legal linkleri koy.
6. Tüm P0 ekranlarına analytics event’lerini bağla ve dashboard’da doğrula.
7. Empty/loading/error state olmayan ekran bırakma (minimum bir fallback şart).
8. Copy pass yap: tüm metinler “şefkatli koç + modern” tona çekilsin.
9. QA checklist’te low-network, offline, timeout testlerini zorunlu yap.
10. Release öncesi P0/P1 ayrımını yeniden teyit et; P1’i feature flag ile güvenli kapat.
