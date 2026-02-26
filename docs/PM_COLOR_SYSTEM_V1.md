# AstroApp — PM Color System V1

> **Kaynak önceliği (authoritative):** Görsel örnekler ile Bella palette önerileri çelişirse **Bella palette** esas alınır.
> 
> Ton hedefi: **şefkatli koç + modern** (güven veren, sakin, net).

## 1) V1 Final Palette (Light / Dark)

### 1.1 Semantik Tokenlar

| Token | Light | Dark | Not |
|---|---:|---:|---|
| `primary` | `#6C5CE7` | `#9B8CFF` | Ana marka/aksiyon tonu (mor) |
| `bg` | `#F7F8FC` | `#0F1220` | Uygulama ana arka planı |
| `surface` | `#FFFFFF` | `#171A2B` | Kart/panel yüzeyi |
| `text-primary` | `#1E2233` | `#F4F6FF` | Birincil metin |
| `text-secondary` | `#5F6785` | `#B6BEDD` | Yardımcı metin |
| `success` | `#22C55E` | `#4ADE80` | Başarılı durum |
| `warning` | `#F59E0B` | `#FBBF24` | Uyarı durumu |
| `error` | `#EF4444` | `#F87171` | Hata/kritik durum |
| `accent` | `#14B8A6` | `#2DD4BF` | Destekleyici vurgu |

### 1.2 Opsiyonel Tonlar (State/Layer için öneri)

| Token | Light | Dark | Kullanım |
|---|---:|---:|---|
| `primary-pressed` | `#5B4BD6` | `#8D7CFF` | Buton basılı |
| `primary-soft` | `#EEEAFE` | `#2A2446` | Badge/chip, düşük vurgu |
| `border` | `#E6E9F5` | `#2A2F47` | Ayraç/kenarlık |
| `overlay` | `rgba(15,18,32,0.48)` | `rgba(0,0,0,0.56)` | Modal arka katman |

---

## 2) Token İsimlendirme Kuralı

**Format:** `color.<theme>.<token>`

- `color.light.primary`
- `color.dark.bg`
- `color.light.text-primary`

Kısa kullanım (UI kodunda):
- `--color-primary`
- `--color-bg`
- `--color-surface`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-success`
- `--color-warning`
- `--color-error`
- `--color-accent`

> Not: Bileşen seviyesinde doğrudan hex yerine semantik token kullanılır.

---

## 3) Kontrast / Erişilebilirlik Notları (WCAG)

| Kural | Hedef |
|---|---|
| Normal metin | **min 4.5:1** |
| Büyük metin (≥ 18pt veya 14pt bold) | **min 3:1** |
| UI sınırları/ikonlar | **min 3:1** |

### Operasyonel kurallar
- `text-primary` yalnızca `bg/surface` üzerinde kullanılmalı.
- `text-secondary` uzun gövdede kullanılmaz; kısa yardımcı metin için.
- `primary` üstünde metin gerekiyorsa Light’da beyaz (`#FFFFFF`), Dark’da koyu metin (`#1E2233`) ile kontrast doğrulanır.
- **Renk tek başına anlam taşımaz:** state bilgisini ikon/etiket/metin ile destekle.
- Uyarı ve hata durumlarında ek olarak kısa açıklama metni zorunlu.

---

## 4) CTA, State ve Card Kullanım Kuralları

## 4.1 CTA (Buton)

| Tip | Arka Plan | Metin | Kullanım |
|---|---|---|---|
| Primary CTA | `primary` | `#FFFFFF` (Light), `#1E2233` (Dark varyantta kontrol) | Ekrandaki 1 ana aksiyon |
| Secondary CTA | `surface` + `border` | `text-primary` | İkincil aksiyon |
| Ghost CTA | Şeffaf | `primary` | Düşük öncelikli link-aksiyon |

Kurallar:
- Bir ekranda **tek primary CTA** önerilir.
- Hover/pressed için `primary-pressed` kullan.
- Disabled: opaklık düşürmek yerine özel token öner (`text-secondary` + `border`).

## 4.2 State (Success/Warning/Error/Info)

| State | Vurgu Rengi | Arka Plan Önerisi |
|---|---|---|
| Success | `success` | `success`in düşük opak versiyonu (`~10-14%`) |
| Warning | `warning` | `warning` düşük opak (`~10-14%`) |
| Error | `error` | `error` düşük opak (`~10-14%`) |
| Info | `accent` | `accent` düşük opak (`~10-14%`) |

Kurallar:
- State bileşeninde ikon + başlık + kısa açıklama birlikte kullan.
- Error tonu, yalnızca gerçek aksiyon gerektiren durumda.

## 4.3 Card

| Özellik | Light | Dark |
|---|---|---|
| Zemin | `surface` | `surface` |
| Kenarlık | `border` | `border` |
| Başlık | `text-primary` | `text-primary` |
| Açıklama | `text-secondary` | `text-secondary` |

Kurallar:
- Card içindeki ana aksiyon varsa yalnızca 1 adet primary CTA.
- İç boşlukta sakin hiyerarşi: başlık > açıklama > yardımcı meta.
- Çoklu card listesinde accent kullanımını %10’dan düşük tut (görsel gürültüyü önle).

---

## 5) Örnek Kullanım

```css
:root[data-theme='light'] {
  --color-primary: #6C5CE7;
  --color-bg: #F7F8FC;
  --color-surface: #FFFFFF;
  --color-text-primary: #1E2233;
  --color-text-secondary: #5F6785;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-accent: #14B8A6;
}

:root[data-theme='dark'] {
  --color-primary: #9B8CFF;
  --color-bg: #0F1220;
  --color-surface: #171A2B;
  --color-text-primary: #F4F6FF;
  --color-text-secondary: #B6BEDD;
  --color-success: #4ADE80;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-accent: #2DD4BF;
}

.button--primary {
  background: var(--color-primary);
  color: #fff;
}

.card {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border, #E6E9F5);
}
```

---

## V1 Karar Özeti
- Bu dokümandaki tokenlar **AstroApp PM Color System V1** için finaldir.
- Görsel referanslar ile uyuşmazlıkta **Bella palette authoritative** kabul edilir.
- V2’de yalnızca ölçüm/erişilebilirlik test sonuçlarına göre revizyon yapılır.
