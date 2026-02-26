# KNOWN LIMITATIONS — RLOOP-008

## 1) Mock Kalan Noktalar
- Bazı rapor içerikleri statik/mock veri ile gösterilmektedir.
- Checkout akışı gerçek ödeme sağlayıcısına bağlı değildir (demo davranış).
- Analytics event’leri üretimde doğrulanmış telemetry pipeline’a bağlı olmayabilir.

## 2) Backend Entegrasyon Eksikleri
- Auth endpoint’lerinin production-grade token lifecycle doğrulaması tamamlanmamış olabilir.
- Report catalog / detail / purchased state kalıcılığı backend ile tam senkron değildir.
- Retry / timeout / offline cache stratejileri sınırlı düzeydedir.
- Health ve bazı servis uçlarında fallback davranışları geçici olabilir.

## 3) Store Review Risk Notları
- “Gerçek satın alma” beklentisi oluşturabilecek metadata ifadeleri riskli; demo/internal ibaresi korunmalı.
- Mock içeriklerin nihai ürün gibi sunulması review sırasında red riski doğurabilir.
- Age rating/disclaimer metinleri legal ekip tarafından son kontrolden geçmelidir.
- Gizlilik politikası/terms linkleri public release öncesi nihai URL’lerle güncellenmelidir.

## 4) Operasyonel Not
Bu limitasyonlar internal test görünürlüğü için dokümante edilmiştir. Public release öncesi RLOOP-009 backend integration kickoff ile kapatılması planlanır.
