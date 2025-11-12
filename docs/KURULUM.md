# Solar Radyasyon İzleme Sistemi - Kurulum Kılavuzu

## Sistem Gereksinimleri

- Raspberry Pi 4 (2GB+ RAM önerilen)
- Raspberry Pi OS (Bullseye veya daha yeni)
- İnternet bağlantısı (ilk kurulum için)
- ESP32 + Ethernet Kit + RS485 Kit
- IMT Solar Radyasyon Sensörü

## Hızlı Kurulum (Önerilen)

### 1. Raspberry Pi'ye Dosyaları Kopyalayın

```bash
# Proje klasörünü Raspberry Pi'ye kopyalayın
scp -r solar-monitoring pi@<raspberry-pi-ip>:~/
```

### 2. Kurulum Script'ini Çalıştırın

```bash
cd ~/solar-monitoring
chmod +x docs/scripts/install.sh
sudo ./docs/scripts/install.sh
```

Bu script otomatik olarak:
- Docker ve Docker Compose kurar
- Gerekli klasörleri oluşturur
- Backend ve Frontend container'larını başlatır
- Veritabanını initialize eder

### 3. Sisteme Erişin

- **Web Dashboard**: http://<raspberry-pi-ip>:3000
- **API**: http://<raspberry-pi-ip>:5000/api

## Manuel Kurulum

### 1. Docker Kurulumu

```bash
# Docker'ı kurun
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose kurun
sudo apt-get update
sudo apt-get install -y docker-compose

# Sistemi yeniden başlatın
sudo reboot
```

### 2. Proje Yapısını Oluşturun

```bash
mkdir -p ~/solar-monitoring
cd ~/solar-monitoring

# Backend dosyalarını kopyalayın
mkdir -p backend
cp docs/backend/* backend/

# Docker dosyalarını kopyalayın
cp docs/docker/* .

# Frontend build'i oluşturun (geliştirme bilgisayarınızda)
npm install
npm run build
# Sonra dist/ klasörünü Raspberry Pi'ye kopyalayın
```

### 3. Container'ları Başlatın

```bash
docker-compose up -d
```

### 4. Logları Kontrol Edin

```bash
docker-compose logs -f
```

## ESP32 Firmware Kurulumu

### 1. Arduino IDE Hazırlığı

1. Arduino IDE'yi indirin ve kurun: https://arduino.cc/download
2. ESP32 board desteğini ekleyin:
   - File → Preferences → Additional Board Manager URLs
   - Ekleyin: `https://dl.espressif.com/dl/package_esp32_index.json`
3. Tools → Board → Boards Manager → "ESP32" arayın ve kurun

### 2. Kütüphaneleri Kurun

Arduino IDE'de: Tools → Manage Libraries

Aşağıdaki kütüphaneleri kurun:
- **Ethernet** (by Various)
- **ModbusMaster** (by Doc Walker)
- **ArduinoJson** (by Benoit Blanchon)
- **WebServer** (ESP32 için dahili)

### 3. Firmware'i Yükleyin

1. `docs/esp32/esp32_sensor_client.ino` dosyasını açın
2. **KENDİ AYARLARINIZI YAPIN**:
   ```cpp
   // Cihaz Tanımlama
   const char* DEVICE_NAME = "ESP32-SOLAR-001";  // Her ESP32 için benzersiz isim
   
   // Sunucu Ayarları
   const char* SERVER_HOST = "192.168.1.100";     // Raspberry Pi IP adresi
   const int SERVER_PORT = 5000;
   
   // Ağ Ayarları (varsayılan DHCP)
   bool useDHCP = true;
   IPAddress staticIP(192, 168, 1, 50);
   IPAddress gateway(192, 168, 1, 1);
   IPAddress subnet(255, 255, 255, 0);
   ```

3. ESP32'yi USB ile bağlayın
4. Tools → Board → "ESP32 Dev Module" seçin
5. Tools → Port → Doğru portu seçin
6. Upload butonuna basın

### 4. ESP32 Web Arayüzü Kullanımı

ESP32 çalıştıktan sonra:
1. Seri Monitor'den IP adresini öğrenin
2. Tarayıcıda `http://<esp32-ip>` adresine gidin
3. Ağ ayarlarını düzenleyin:
   - DHCP / Statik IP seçimi
   - Sunucu IP adresi
   - Cihaz adı

## Sistem Kullanımı

### İlk Kurulum Adımları

1. **Web Dashboard'a Giriş**: http://<raspberry-pi-ip>:3000

2. **ESP32 Ekleme**:
   - "Cihazlar" sayfasına gidin
   - "Yeni Cihaz Ekle" butonuna tıklayın
   - ESP32'nizin benzersiz ismini girin (örn: ESP32-SOLAR-001)
   - Kaydet

3. **Modbus Haritası Tanımlama**:
   - "Modbus Yapılandırma" sayfasına gidin
   - Sensörünüz için yeni harita oluşturun:
     - **Sensör Adı**: IMT Solar Radyasyon
     - **Modbus Adresi**: 1 (sensörünüzün adresi)
     - **Kayıtlar**:
       - Register 0: Işınım (W/m²)
       - Register 1: Sıcaklık 1 (°C)
       - Register 2: Sıcaklık 2 (°C)

4. **Veri Kayıt Aralığı Ayarlama**:
   - "Ayarlar" sayfasına gidin
   - Varsayılan: 5 dakika
   - İstediğiniz aralığı seçin (1-60 dakika)

### Günlük Kullanım

- **Ana Dashboard**: Tüm cihazların anlık verileri
- **Grafik Görünümü**: Geçmiş verileri görselleştirin
- **Alarmlar**: Anormal değerler için uyarılar
- **Veri Dışa Aktarma**: CSV formatında indirin

## Çoklu ESP32 Yönetimi

Sistem yüzlerce ESP32 destekler:

1. Her ESP32'ye benzersiz isim verin: `ESP32-SOLAR-001`, `ESP32-SOLAR-002`, vb.
2. Firmware'de her birinin cihaz adını ayarlayın
3. İlk veri gönderiminde sistem otomatik olarak cihazı kaydeder
4. Dashboard'da tüm cihazlar listelenir

## Sorun Giderme

### Backend Başlamıyor

```bash
# Logları kontrol edin
docker-compose logs backend

# Container'ı yeniden başlatın
docker-compose restart backend
```

### ESP32 Bağlanamıyor

1. Seri Monitor'ü açın (115200 baud)
2. Hata mesajlarını kontrol edin
3. IP adresini ping'leyin
4. Sunucu IP adresinin doğru olduğundan emin olun

### Veri Gelmiyor

1. ESP32 loglarını kontrol edin
2. Backend API'yi test edin: http://<pi-ip>:5000/api/health
3. Modbus bağlantısını kontrol edin (RS485 kabloları)

## API Dokümantasyonu

Backend API endpoint'leri için: `docs/backend/api.md`

## Güvenlik Notları

- Raspberry Pi'yi güvenlik duvarı arkasında tutun
- Varsayılan şifreleri değiştirin
- HTTPS kullanmak için reverse proxy (nginx) kurun
- Düzenli yedekleme yapın: `/home/pi/solar-monitoring/backend/data/`

## Destek

Sorularınız için:
- GitHub Issues
- Email: support@example.com

## Lisans

MIT License - Ticari kullanım için uygundur
