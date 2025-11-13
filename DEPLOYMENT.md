# Solar Monitoring System - Deployment Kılavuzu

## 🚀 Hızlı Kurulum (Önerilen)

### Gereksinimler

**Raspberry Pi:**
- Raspberry Pi 4 (2GB+ RAM önerilir)
- Raspberry Pi OS (Bullseye veya daha yeni)
- Docker ve Docker Compose kurulu
- SSH erişimi aktif
- En az 8GB boş disk alanı

**Geliştirme Bilgisayarı:**
- Node.js 18+ (sadece deployment için)
- SSH bağlantısı

### Adım 1: Raspberry Pi'yi Hazırlama

Raspberry Pi'ye SSH ile bağlanın:

```bash
ssh pi@[RASPBERRY_PI_IP]
```

Docker'ı kurun:

```bash
# Docker kurulum
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Kullanıcıyı docker grubuna ekle
sudo usermod -aG docker $USER

# Sistemi yeniden başlat
sudo reboot
```

Yeniden başladıktan sonra tekrar bağlanın ve Docker'ı kontrol edin:

```bash
docker --version
docker compose version
```

### Adım 2: Otomatik Deployment

Geliştirme bilgisayarınızda proje klasöründe:

```bash
# Deploy script'ini çalıştırılabilir yap
chmod +x deploy.sh

# Deploy'u başlat
./deploy.sh
```

Script sizden:
- Raspberry Pi IP adresi
- Raspberry Pi kullanıcı adı (varsayılan: pi)

sorarak otomatik olarak:
1. Dosyaları Raspberry Pi'ye kopyalar
2. Frontend'i build eder
3. Docker container'ları başlatır

### Adım 3: Uygulamaya Erişim

Tarayıcınızda açın:

```
http://[RASPBERRY_PI_IP]:3000
```

**Varsayılan Admin Giriş:**
- Email: `admin@solar-monitor.local`
- Şifre: `admin123`

## 🛠️ Manuel Kurulum

Otomatik deployment çalışmazsa:

### 1. Dosyaları Kopyalama

```bash
# Proje klasöründe
scp -r * pi@[RASPBERRY_PI_IP]:~/solar-monitoring/
```

### 2. Raspberry Pi'de Build ve Başlatma

```bash
ssh pi@[RASPBERRY_PI_IP]
cd ~/solar-monitoring

# Container'ları başlat
docker compose up -d --build

# Log'ları izle
docker compose logs -f
```

## 📊 Sistem Yönetimi

### Container'ları Yönetme

```bash
# Durumu kontrol et
docker compose ps

# Log'ları görüntüle
docker compose logs -f

# Sadece backend log'ları
docker compose logs -f backend

# Sadece frontend log'ları
docker compose logs -f frontend

# Container'ları durdur
docker compose down

# Container'ları yeniden başlat
docker compose restart

# Tüm container'ları sil ve yeniden oluştur
docker compose down
docker compose up -d --build
```

### Sistem Kaynaklarını İzleme

```bash
# Container kaynak kullanımı
docker stats

# Disk kullanımı
docker system df

# Log dosyalarını temizle
docker system prune -a
```

### Database Yedekleme

```bash
# Database dosyasını yedekle
docker compose exec backend cp /app/data/solar.db /app/data/solar.db.backup

# Backup'ı bilgisayarınıza kopyala
docker cp solar-backend:/app/data/solar.db.backup ./solar-backup-$(date +%Y%m%d).db
```

## 🔧 Güncelleme

Kod değişikliklerinden sonra:

```bash
# Otomatik deployment (önerilen)
./deploy.sh

# veya Manuel
ssh pi@[RASPBERRY_PI_IP]
cd ~/solar-monitoring
docker compose down
docker compose up -d --build
```

## 🌐 Ağ Yapılandırması

### API URL Yapılandırması

Frontend varsayılan olarak backend'i `http://backend:5000/api` adresinde arar (Docker network içinde).

Farklı bir yapılandırmaya ihtiyacınız varsa `.env` dosyası oluşturun:

```bash
# .env
VITE_API_URL=http://192.168.1.100:5000/api
```

### Port Yapılandırması

`docker-compose.yml` dosyasındaki portları değiştirebilirsiniz:

```yaml
services:
  frontend:
    ports:
      - "80:80"  # 3000 yerine 80 kullan
  
  backend:
    ports:
      - "5000:5000"  # Backend portu
```

## 🔒 Güvenlik

### Varsayılan Admin Şifresini Değiştirme

1. Uygulamaya admin olarak giriş yapın
2. Settings > Change Password bölümünden şifrenizi değiştirin

### SSL/HTTPS Ekleme

Nginx'e SSL sertifikası eklemek için:

```bash
# Let's Encrypt sertifikası (domain varsa)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 📱 ESP32 Sensör Bağlantısı

### 1. Arduino IDE'de Firmware Ayarları

`docs/esp32/esp32_sensor_client.ino` dosyasını açın:

```cpp
const char* serverHost = "192.168.1.100";  // Raspberry Pi IP
const int serverPort = 5000;
const char* deviceName = "ESP32-SOLAR-001";
```

### 2. Firmware Yükleme

1. Arduino IDE > Tools > Board > ESP32 Dev Module
2. Tools > Port > [ESP32'nin bağlı olduğu port]
3. Upload butonuna tıklayın

### 3. Cihazı Uygulamaya Ekleme

1. Web arayüzünde Devices sekmesine gidin
2. "Add Device" butonuna tıklayın
3. Device Name: `ESP32-SOLAR-001`
4. Device Type: `esp32`
5. Save edin

## 🐛 Sorun Giderme

### Backend başlamıyor

```bash
# Log'ları kontrol et
docker compose logs backend

# Container'ı yeniden başlat
docker compose restart backend
```

### Frontend boş sayfa gösteriyor

```bash
# Nginx log'larına bak
docker compose logs frontend

# Container'ı yeniden build et
docker compose up -d --build frontend
```

### ESP32 bağlanamıyor

1. Serial Monitor'u açın (115200 baud)
2. IP adresinin doğru olduğunu kontrol edin
3. Backend'in çalıştığını doğrulayın: `curl http://localhost:5000/api/health`
4. Firewall kurallarını kontrol edin

### Database hataları

```bash
# Database'i sıfırla (DİKKAT: Tüm veriler silinir!)
docker compose down
docker volume rm solar-monitoring_backend-data
docker compose up -d
```

## 📞 Destek

Sorun yaşarsanız:

1. Log dosyalarını kontrol edin: `docker compose logs`
2. Container durumunu kontrol edin: `docker compose ps`
3. System resource'ları kontrol edin: `docker stats`

## 🔄 Otomatik Başlatma

Sistem açılışında otomatik başlatma:

```bash
# Systemd service oluştur
sudo nano /etc/systemd/system/solar-monitoring.service
```

İçeriği:

```ini
[Unit]
Description=Solar Monitoring System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/pi/solar-monitoring
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=pi

[Install]
WantedBy=multi-user.target
```

Aktif et:

```bash
sudo systemctl enable solar-monitoring.service
sudo systemctl start solar-monitoring.service
```

## 📈 Performans İpuçları

1. **Raspberry Pi 4 önerilir** (minimum 2GB RAM)
2. **SD kart yerine SSD kullanın** (daha hızlı database)
3. **Log rotasyonu ayarlayın** (disk dolmasını önler)
4. **Düzenli backup alın** (veri kaybını önler)

## 🎯 Production Checklist

- [ ] Docker ve Docker Compose kurulu
- [ ] Raspberry Pi güncel (sudo apt update && sudo apt upgrade)
- [ ] Yerel ağda statik IP atanmış
- [ ] Varsayılan admin şifresi değiştirilmiş
- [ ] Database backup planı var
- [ ] Log rotation yapılandırılmış
- [ ] Otomatik başlatma aktif
- [ ] Firewall kuralları ayarlanmış
