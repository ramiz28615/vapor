# ⚡ Vapor — Ücretsiz Deploy Platformu

Geliştiriciler için tam bir dağıtım (deployment) platformu: GitHub deponu bağla, tek tıkla
yayına al, canlı log akışını izle. **Tüm özellikler ücretsiz, kart bilgisi istenmez.**

Frontend + backend, sıfırdan yazılmış, bağımlılıksız.

---

## 🚀 Çalıştırma

```bash
node server.js
# → http://localhost:4000
```

Node 18+ yeterlidir. `npm install` gerekmez — hiçbir dış bağımlılık yok.

---

## ✨ Özellikler

### Landing (pazarlama sayfası)
- Hero, canlı terminal animasyonu (gerçek deploy log akışı taklidi)
- Özellik ızgarası, "nasıl çalışır" adımları
- Fiyatlandırma: **Free / Pro / Team — üçü de 0 ₺**
- S.S.S. (accordion), CTA, sayaç animasyonları
- Aurora arka plan, grid deseni, cam efektli kartlar

### Kimlik doğrulama
- E-posta + şifre ile kayıt / giriş
- PBKDF2-SHA256 (120.000 tur) ile şifre hash'leme, kullanıcı başına rastgele salt
- Token tabanlı oturum yönetimi, çıkışta token geçersiz kılma
- Korumalı API uç noktaları (401/403 doğru dönüyor)

### Dashboard (11 görünüm)
| Görünüm | İçerik |
|---|---|
| **Genel bakış** | KPI kartları (proje, deploy, başarı oranı, bant genişliği), 14 günlük trafik grafiği, proje kartları |
| **Projeler** | Proje ızgarası, framework ikonları, durum rozetleri, hızlı deploy |
| **Proje detayı** | 6 sekme: Genel, Deploy'lar, Ortam değişkenleri, Alan adları, Metrikler, Ayarlar |
| **Deploy geçmişi** | Tüm dağıtımların tablosu, commit, süre, tetikleyici, durum |
| **Deploy detayı** | 8 aşamalı ilerleme çubuğu + **canlı log terminali** (900 ms'de bir yenilenir) |
| **Alan adları** | Tüm projelerin alan adları, DNS kayıtları, doğrulama akışı |
| **Kullanım** | Plan limitleri, doluluk çubukları, plan değiştirme (hepsi ücretsiz) |
| **Ekip** | Üye daveti, rol yönetimi, koltuk limiti kontrolü |
| **API anahtarları** | Anahtar üretme (yalnızca bir kez gösterilir), silme, curl örneği |
| **Aktiviteler** | Hesap olaylarının zaman akışı |
| **Ayarlar** | Profil, plan, tema, oturum |

### Deploy motoru
- 8 gerçekçi aşama: kuyruk → klonlama → framework algılama → bağımlılık kurulumu → derleme → artefakt yükleme → servis başlatma → yayında
- Aşama aşama log üretimi (13 satır, renk kodlu: komut / çıktı / başarılı)
- İlerleme yüzdesi, süre ölçümü, canlı takip
- **Rollback**: herhangi bir sürümden yeni deploy tetikleme
- Günlük deploy limiti kontrolü (plan bazlı)

### Ortam değişkenleri
- Anahtar/değer çiftleri, production / preview ortam ayrımı
- **Gizli değerler maskelenir** (`••••••••`) — API yanıtlarında ve arayüzde asla açık görünmez

### Alan adı yönetimi
- Alan adı ekleme, otomatik DNS kaydı üretimi (A, CNAME, TXT)
- Doğrulama akışı, SSL durumu takibi
- Tekillik kontrolü (aynı alan adı iki kez eklenemez)

### Metrikler
- Günlük istek sayısı, bant genişliği, hata oranı, p50/p95 gecikme
- Plan bazlı pencere (Free 7 / Pro 30 / Team 90 gün)
- SVG alan grafiği, çizim animasyonlu

### Arayüz deneyimi
- **Komut paleti** (⌘K / Ctrl+K) — 13 komut, canlı arama
- Karanlık / aydınlık tema (tercih hatırlanır)
- Toast bildirimleri, modal sistem, skeleton yükleme
- Tam duyarlı tasarım (mobilde açılır kenar çubuğu)
- `prefers-reduced-motion` desteği

---

## 🏗️ Mimari

```
vapor/
├── server.js          # API + statik sunucu (tek dosya, 0 bağımlılık)
├── public/
│   ├── index.html     # Landing + uygulama kabuğu
│   └── app.js         # İstemci uygulaması (SPA)
├── data/
│   └── vapor.json     # JSON tabanlı kalıcı veri deposu
└── package.json
```

- **Backend**: Node.js `http` modülü, elle yazılmış router (`:param` desteğiyle), JSON dosya deposu
- **Kimlik**: `crypto.pbkdf2Sync` + rastgele salt, token oturumları
- **Frontend**: Saf JS SPA, durum yönetimi, SVG grafikler, CSS değişkenli tema sistemi
- **Bağımlılık: sıfır** — ne runtime ne dev

---

## 📡 API Referansı

Tüm korumalı uç noktalar `Authorization: Bearer <token>` başlığı ister.

### Genel
```
GET    /api/health                     # servis durumu
GET    /api/plans                      # plan listesi (hepsi ücretsiz)
```

### Kimlik
```
POST   /api/auth/register              # { email, password, name }
POST   /api/auth/login                 # { email, password }
POST   /api/auth/logout
GET    /api/auth/me                    # kullanıcı + plan + limitler
PATCH  /api/auth/me                    # { name, plan }
```

### Projeler
```
GET    /api/projects                   # liste + deploy sayısı
POST   /api/projects                   # { name, repo, framework, branch, ... }
GET    /api/projects/:id               # detay + deploy'lar + env'ler + domain'ler
PATCH  /api/projects/:id               # ayar güncelleme
DELETE /api/projects/:id               # sil (ilişkili kayıtlar dahil)
POST   /api/projects/:id/deploy        # deploy başlat
GET    /api/projects/:id/metrics       # metrik serisi
```

### Deploy
```
GET    /api/deploys                    # son 60 dağıtım
GET    /api/deploys/:id                # tek dağıtım + loglar
POST   /api/deploys/:id/rollback       # bu sürüme geri dön
```

### Ortam değişkenleri
```
POST   /api/projects/:id/env           # { key, value, secret, env }
DELETE /api/env/:id
```

### Alan adları
```
POST   /api/projects/:id/domains       # { domain }
POST   /api/domains/:id/verify         # doğrula
DELETE /api/domains/:id
```

### Ekip / anahtarlar / diğer
```
GET    /api/members                    # üyeler + koltuk limiti
POST   /api/members                    # { email, role }
DELETE /api/members/:id
GET    /api/apikeys
POST   /api/apikeys                    # { name, scope }
DELETE /api/apikeys/:id
GET    /api/events                     # aktivite akışı
GET    /api/usage                      # kullanım özeti
POST   /api/demo/seed                  # örnek veri ekle
```

### Örnek

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"sen@ornek.com","password":"gizli123","name":"Sen"}'

curl -X POST http://localhost:4000/api/projects/PROJE_ID/deploy \
  -H "Authorization: Bearer vap_..." \
  -H "Content-Type: application/json" \
  -d '{"branch":"main"}'
```

---

## 📊 Planlar

| | Free | Pro | Team |
|---|---|---|---|
| Fiyat | **₺0** | **₺0** | **₺0** |
| Proje | 5 | 50 | Sınırsız |
| Günlük deploy | 50 | 500 | 5.000 |
| Bant genişliği | 100 GB | 1 TB | 5 TB |
| Metrik geçmişi | 7 gün | 30 gün | 90 gün |
| Özel alan adı | ✅ | ✅ | ✅ |
| Koltuk | 1 | 10 | 50 |

Ödeme adımı yoktur; sistemde kart alanı bulunmaz.

---

## 🔒 Güvenlik notları

- Şifreler düz metin olarak **asla** saklanmaz (PBKDF2-SHA256, 120k tur, kullanıcı başına salt)
- Oturum token'ları çıkışta sunucu tarafında geçersiz kılınır
- Gizli ortam değişkenleri API yanıtlarında maskelenir
- Kaynak sahipliği her uç noktada doğrulanır (başka kullanıcının projesine erişilemez)
- İstek gövdesi 2 MB ile sınırlıdır
- Kullanıcı girdileri arayüzde HTML olarak kaçırılır (XSS koruması)

> Bu proje bir demo/öğrenme uygulamasıdır. Üretimde kullanmadan önce: HTTPS arkasına alın,
> gerçek bir veritabanına geçin, oran sınırlama (rate limiting) ekleyin ve deploy motorunu
> gerçek container'lara bağlayın.

---

## Lisans

MIT
