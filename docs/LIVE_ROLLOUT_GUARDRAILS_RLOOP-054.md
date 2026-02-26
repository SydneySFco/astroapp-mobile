# Live Rollout Guardrails — RLOOP-054

Bu doküman canary publisher runtime’ın `live` moduna geçişinde uygulanacak minimum güvenlik çitlerini tanımlar.

## 1) Allowlist (Repo + Branch)

`CANARY_PUBLISHER_MODE=live` sadece allowlist koşulları sağlandığında etkinleştirilmelidir.

### Repository allowlist

- İzinli repo: `SydneySFco/astroapp-mobile`
- Fork veya farklı org/repo kombinasyonlarında live publish **yasak**.

### Branch allowlist

- İzinli branch’ler:
  - `master`
  - `release/*`
- Özellik branch’lerinde (`feature/*`, `bugfix/*`) live publish **yasak**.

Önerilen CI koşulu (conceptual):

- `github.repository == 'SydneySFco/astroapp-mobile'`
- `github.ref_name == 'master' || startsWith(github.ref_name, 'release/')`

## 2) Manual Approval Gate

Live publish adımı environment protection ile manuel onaya bağlanmalıdır.

- Önerilen environment: `canary-publisher-live`
- Required reviewers: on-call SRE / release manager
- Approval notu aşağıdakileri içermeli:
  - canary trend sonucu
  - drift severity özeti
  - son 24h rate-limit trendi

Not: RLOOP-054 kapsamında bu adım dokümante edilmiştir; ortam bazlı approval policy repo ayarlarından aktif edilmelidir.

### Approval integration draft (workflow pattern)

```yaml
jobs:
  nonprod-db-canary:
    # ...non-prod checks + canary summary artifact

  nonprod-db-canary-live-publish:
    needs: [nonprod-db-canary]
    if: ${{ needs.nonprod-db-canary.outputs.requested_publisher_mode == 'live' && github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    environment:
      name: canary-publisher-live
    steps:
      - name: Download canary artifact bundle
        uses: actions/download-artifact@v4
      - name: Live publish runtime
        run: yarn test __tests__/canaryPublisherRuntime.e2e.rloop054.test.ts --runInBand
```

RLOOP-056 ile pattern, tek bir `approval-gate` placeholder yerine **ayrı live publish job** olarak netleştirildi. Bu sayede live publish ancak:

1. non-prod canary job başarıyla tamamlandıysa,
2. `publisher_mode=live` explicit verildiyse,
3. environment reviewer onayı geldiyse

çalışır.

## 3) Mode Switch Güvenlik Kuralları

Mode switch sadece explicit input/env ile yapılmalı, implicit fallback ile `live` açılmamalıdır.

Kurallar:

1. Default mode daima `dry`.
2. `live` sadece `workflow_dispatch` input (`publisher_mode=live`) ile.
3. `live` için allowlist + approval gate birlikte sağlanmadan runtime çağrısı yapılmamalı.
4. Secret/credential yoksa runtime otomatik dry’ya düşmeli veya fail-fast etmelidir (policy’e göre).
5. `live` koşusunda telemetry zorunlu:
   - `github_api_attempt_count`
   - `github_api_rate_limit_hits`
   - `publisher_idempotent_dedupe_count`

## 4) Operational Rollout Checklist (Live öncesi)

- [ ] Repo/branch allowlist policy doğrulandı
- [ ] Environment approval gate aktif
- [ ] `publisher_mode` default `dry`
- [ ] Dry run çıktıları son 7 koşuda stabil
- [ ] Rate-limit trend alarm eşiği tanımlı
- [ ] Dedupe ratio beklenen bandta

## 5) Rollback / Safety

Şüpheli durumda tek adım rollback:

- `CANARY_PUBLISHER_MODE=dry`

Bu değişiklik side effect’leri kapatır; runtime yalnızca plan üretir.
