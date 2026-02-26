# THEME ACCESSIBILITY CHECK — RLOOP-011

Kısa kontrast checklist’i (text/bg kombinasyonları):

- [ ] `textPrimary` sadece `bg` ve `surface` üstünde kullanılıyor.
- [ ] `textSecondary` uzun paragraf yerine kısa yardımcı metinlerde kullanılıyor.
- [ ] Primary CTA metni tema bazlı doğrulandı:
  - light: `#FFFFFF` on `primary`
  - dark: `#1E2233` on `primary`
- [ ] `error`, `warning`, `success`, `accent` tonları tek başına anlam taşımıyor; metin/ikonla destekleniyor.
- [ ] Card/Panel sınırları için `border` tonu görsel ayrımı sağlayacak seviyede.
- [ ] Skeleton/loading katmanlarında foreground/background ayrımı korunuyor.
- [ ] Kritik ekranlar (auth, paywall, settings) light/dark/system modunda manuel görsel kontrol edildi.

Hedef kontrast eşikleri (referans):
- Normal metin: minimum 4.5:1
- Büyük metin (>=18pt veya 14pt bold): minimum 3:1
- UI sınır/ikon: minimum 3:1
