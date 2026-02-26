# TS Baseline Fix — RLOOP-013

## Root Cause
`npx tsc --noEmit` was failing for baseline/config reasons, not feature code:

1. `tsconfig.json` extended `@react-native/typescript-config`, but that preset was not available in the active install state (`TS6053: File '@react-native/typescript-config' not found`).
2. Because the preset did not load, RN-required compiler options were missing (`jsx`, `esModuleInterop`, `allowSyntheticDefaultImports`), causing widespread JSX/default import failures.
3. Without a React Native-safe `lib/types` baseline, global type collisions appeared between RN globals and DOM/Node declarations.

## What Was Changed (Minimum-Invasive)
### 1) Stabilized `tsconfig.json` with explicit RN-safe baseline
Replaced preset extension with explicit compiler options equivalent to RN app expectations:

- `jsx: "react-native"`
- `moduleResolution: "bundler"`
- `lib: ["esnext"]`
- `allowSyntheticDefaultImports: true`
- `esModuleInterop: true`
- `skipLibCheck: true`
- `types: ["react", "react-native"]`
- narrowed include/exclude for app runtime sources

This removes dependency on missing preset resolution and keeps TS behavior deterministic.

### 2) Dependency install state aligned for validation
Installed dev dependencies (`npm install --include=dev`) so lint/tsc toolchain binaries are present in workspace.

## Supabase Typing Safety
No Supabase source/type refactor was performed. Existing Supabase integration compiles under the stabilized TS baseline (`npx tsc --noEmit` passes), confirming no type regression introduced by this change.

## Validation
- `npm run lint` ✅ PASS
- `npx tsc --noEmit` ✅ PASS

## Permanent Notes
- If this repo later standardizes again on `@react-native/typescript-config`, reintroduce `extends` only after confirming package resolution in CI/local install mode.
- Keep RN projects on non-DOM libs (`lib: ["esnext"]`) unless web-targeted typing is intentionally added.
- Prefer explicit `types` in RN apps to avoid accidental ambient type pollution from transitive packages.
