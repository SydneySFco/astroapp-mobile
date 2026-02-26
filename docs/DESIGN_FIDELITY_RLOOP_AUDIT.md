# AstroApp — Design Fidelity RLoop Audit

## Scope
Design parity lock was applied to the 3 highest-impact screens in current flow:
1. `welcome_screen` → `AuthFlowScreen` (welcome state)
2. `login_screen` → `LoginScreen`
3. `home_daily_dashboard` → `HomeScreen`

References used:
- `/home/node/.openclaw/workspace/tmp/astro_figma/stitch_splash_welcome_screen/**`
- `docs/SCREEN_GAPS_AND_DEV_NOTES.md`

---

## 1) Welcome Screen Parity Checklist (`AuthFlowScreen`)

### Before → After
- **Spacing scale**
  - Before: generic `padding: 20`, centered auth block.
  - After: Figma-like sectional spacing (`24/16/56` rhythm, full-height split layout).
- **Typography**
  - Before: simple app title + TR subtitle.
  - After: hero heading (`42/46`, bold), subtitle (`16/24`), branded label sizing aligned to Stitch sample.
- **Color tokens**
  - Before: theme background token only.
  - After: deep cosmic base `#060B2A`, violet glow layers, high-contrast text shades from reference.
- **Border radius**
  - Before: default component radii.
  - After: CTA `14`, brand capsule `18`.
- **Elevation/shadow**
  - Before: flat.
  - After: CTA violet glow + elevation for stitch-like luminous button.
- **Button/input heights**
  - Before: generic button style from shared component.
  - After: explicit `56` CTA height to match welcome export.
- **Iconography**
  - Before: none.
  - After: star glyph brand mark and directional arrow in CTA.

### Remaining gaps
- Hero background image/nebula from Stitch not embedded (currently glow-only approximation).
- Exact font family (Space Grotesk) is not bundled yet.

---

## 2) Login Screen Parity Checklist (`LoginScreen`)

### Before → After
- **Spacing scale**
  - Before: card-based dense stacking with small `8px` gaps.
  - After: vertical rhythm aligned to exported screen, larger field/title offsets.
- **Typography**
  - Before: title `24`, small labels.
  - After: large display title (`54/58`), subtitle (`19/28`), prominent labels and link hierarchy.
- **Color tokens**
  - Before: generic dark card/background tokens.
  - After: dedicated deep navy layers, violet accent links, muted hint text like reference.
- **Border radius**
  - Before: input radius `10`.
  - After: input radius `18`, social cards `16`, primary CTA `20`.
- **Elevation/shadow**
  - Before: minimal/no glow.
  - After: primary sign-in glow and stronger depth in main CTA.
- **Button/input heights**
  - Before: compact inputs and button.
  - After: inputs `~72`, sign-in button `~78` for reference-like hit area.
- **Iconography**
  - Before: text-only forms.
  - After: back arrow, logo glyph, social placeholders (Google/Apple symbolic).

### Remaining gaps
- Native icon set (mail/lock/apple/google marks) not yet replaced with exact vector assets.
- Exact social brand icons and stroke widths differ.

---

## 3) Home Daily Dashboard Parity Checklist (`HomeScreen`)

### Before → After
- **Spacing scale**
  - Before: basic menu of buttons in centered layout.
  - After: dashboard composition with header/date/hero/grid/tip sections and tuned gaps.
- **Typography**
  - Before: generic heading/body.
  - After: dashboard label uppercase, strong date lockup, card hierarchy matching Stitch proportions.
- **Color tokens**
  - Before: app default dark palette.
  - After: `#191022` base + `#231B2E` surface + `#8C2BEE` accent consistent with reference HTML.
- **Border radius**
  - Before: mostly `10`.
  - After: cards/buttons moved to `10/12/14` family matching source.
- **Elevation/shadow**
  - Before: mostly flat blocks.
  - After: hero and CTA shadows introduced to match perceived depth.
- **Button/input heights**
  - Before: generic action rows.
  - After: dashboard CTA/nav heights normalized (`44–48`) to visual system.
- **Iconography**
  - Before: no dashboard icon treatment.
  - After: section tags and symbolic glyph placeholders in controls.

### Remaining gaps
- Full bottom tab bar/iconography from Stitch export is not implemented in app navigation architecture.
- Hero image background (nebula) currently represented by color block.

---

## Parity Summary
- Welcome: **High parity (layout/color/typography), medium parity on imagery/icons**
- Login: **High parity on structure/scale/colors, medium parity on exact icon assets**
- Dashboard: **High parity on information architecture and visual token system, medium parity on imagery/bottom-nav**

## Notes
Changes were constrained to parity-only styling/layout updates in in-file `StyleSheet` rules and existing screen components.

---

## Iteration-2 (Design Fidelity Lock for Welcome + Birth Data Input + Home Dashboard)

### References used
- `/home/node/.openclaw/workspace/tmp/astro_figma/stitch_splash_welcome_screen/welcome_screen/code.html`
- `/home/node/.openclaw/workspace/tmp/astro_figma/stitch_splash_welcome_screen/birth_data_input/code.html`
- `/home/node/.openclaw/workspace/tmp/astro_figma/stitch_splash_welcome_screen/home_daily_dashboard/code.html`
- `docs/SCREEN_GAPS_AND_DEV_NOTES.md`

### A) Welcome (`src/screens/auth/AuthFlowScreen.tsx`)
- Refined top app bar IA parity: brand left + settings affordance right.
- Added hero visual container (rounded 24, border, layered violet glow) to close composition gap from reference central visual block.
- Adjusted typography hierarchy toward reference scale:
  - Hero title to `44/48`, tighter tracking
  - Supporting copy weight lowered and centered
- Updated CTA fidelity:
  - Height `56`, radius `12`, explicit arrow glyph, stronger violet glow shadow.
- Improved footer link hierarchy: muted base text + accent-weighted “Log in”.

### B) Birth Data Input parity pass (`src/screens/auth/RegisterScreen.tsx`, Step 4)
- Reworked Step-4 layout to mirror reference section IA:
  - Added dedicated title block (“cosmic blueprint”) + explanatory subtitle.
  - Introduced labeled field groups and grouped input rows.
- Matched visual form language:
  - Input rows now `54` height family, `12` radius, bordered surface rows.
  - Icon-leading rows for date/time/location semantics (placeholder glyphs in RN text form).
- Time-of-birth UX parity improvement:
  - Added compact “Unknown time” toggle chip in header row.
  - Preserved required validation behavior and unknown-time logic.
- Increased global register control sizing (taller inputs/buttons, card radius 16) for better parity with modern rounded reference style.

### C) Home Daily Dashboard (`src/screens/HomeScreen.tsx`)
- Upgraded header IA to closer reference structure:
  - Left menu, centered “Daily Dashboard / Today’s Energy”, right utility action.
- Converted content into scrollable stacked dashboard sections with explicit rhythm.
- Hero card parity improvements:
  - Split image-area + content-body composition.
  - Added atmospheric glow layer and badge/title lockup.
  - CTA includes arrow and improved shadow depth.
- Added icon-led metric card headers and tip card icon capsule to improve reference-like visual hierarchy.
- Added lightweight bottom-nav visual treatment to better match screen-level IA expectation from reference dashboard.

### Remaining known gaps after Iteration-2
- Reference web exports use external image assets and Material Symbols; native app still uses local placeholder glyphs for icons/imagery.
- Exact font family parity (Space Grotesk / Manrope) is still approximate unless bundled at app level.
- Bottom navigation in Home remains visual-level parity; full navigator architecture change is intentionally out of scope for this iteration.
