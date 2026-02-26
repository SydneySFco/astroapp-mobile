# RLOOP-043 Notes — Replay Quarantine Operations + Control Plane

Bu iterasyonun amacı, RLOOP-042 ile eklenen quarantine akışını operasyonel olarak görünür ve yönetilebilir hale getirecek control plane taslağını çıkarmaktır.

## Yapılanlar

1. **Quarantine persistence draft**
   - `quarantine_control_plane` için tablo, index ve audit tabanlı SQL taslağı hazırlandı.
   - Retention/purge stratejisi tanımlandı (default: 30 gün pending_review, 90 gün resolved kayıtlar).

2. **Control plane read model skeleton**
   - Quarantine list/detail DTO alanları netleştirildi.
   - Status lifecycle: `pending_review -> redriven | dropped`.
   - `QuarantineControlPlaneReadModel` kontratı eklendi.

3. **Admin operations endpoint skeleton**
   - `listQuarantinedHandler`
   - `getQuarantinedDetailHandler`
   - `redriveQuarantinedHandler`
   - `dropQuarantinedHandler`
   - Redrive/drop için `actorId`, `reason`, `approvalRef` zorunlu audit alanları enforce edildi.

4. **Observability draft**
   - Metric isimleri: quarantine volume / redrive success rate / drop rate.
   - Basit oran hesaplayıcı helper (`computeQuarantineRates`) eklendi.

## Notlar

- Bu iterasyondaki kod, **skeleton/contract** seviyesindedir; DB adapter ve HTTP router wiring bir sonraki iterasyona bırakılmıştır.
- SQL tarafındaki trigger ve state guard’lar da draft niteliğindedir; migration apply öncesi domain review önerilir.
