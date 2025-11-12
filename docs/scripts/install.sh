#!/bin/bash

# Solar Radyasyon İzleme Sistemi - Otomatik Kurulum Script
# Raspberry Pi 4 için optimize edilmiştir

set -e  # Hata durumunda dur

echo "=================================="
echo "Solar Monitoring System Installer"
echo "=================================="
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Bu script'i root olarak çalıştırın: sudo ./install.sh"
  exit 1
fi

echo "✓ Root erişimi doğrulandı"

# Sistem güncelleme
echo ""
echo "📦 Sistem güncelleniyor..."
apt-get update -qq
apt-get upgrade -y -qq

# Docker kontrolü ve kurulumu
echo ""
echo "🐳 Docker kontrol ediliyor..."

if ! command -v docker &> /dev/null; then
    echo "Docker bulunamadı. Kuruluyor..."
    
    # Docker kurulumu
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Docker grubuna kullanıcı ekleme
    usermod -aG docker $SUDO_USER
    
    echo "✓ Docker kuruldu"
else
    echo "✓ Docker zaten kurulu"
fi

# Docker Compose kontrolü ve kurulumu
echo ""
echo "🔧 Docker Compose kontrol ediliyor..."

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose kuruluyor..."
    
    apt-get install -y docker-compose
    
    echo "✓ Docker Compose kuruldu"
else
    echo "✓ Docker Compose zaten kurulu"
fi

# Proje klasör yapısı
echo ""
echo "📁 Proje klasörleri oluşturuluyor..."

PROJECT_DIR="/home/$SUDO_USER/solar-monitoring"
mkdir -p "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/backend"
mkdir -p "$PROJECT_DIR/backend/data"
mkdir -p "$PROJECT_DIR/frontend"

echo "✓ Klasörler oluşturuldu: $PROJECT_DIR"

# Backend dosyalarını kopyala
echo ""
echo "📋 Backend dosyaları kopyalanıyor..."

if [ -f "./docs/backend/server.js" ]; then
    cp ./docs/backend/* "$PROJECT_DIR/backend/" 2>/dev/null || true
    echo "✓ Backend dosyaları kopyalandı"
else
    echo "⚠️  Backend dosyaları bulunamadı. Manuel kopyalama gerekli."
fi

# Docker dosyalarını kopyala
echo ""
echo "🐳 Docker yapılandırması kopyalanıyor..."

if [ -f "./docs/docker/docker-compose.yml" ]; then
    cp ./docs/docker/Dockerfile "$PROJECT_DIR/"
    cp ./docs/docker/docker-compose.yml "$PROJECT_DIR/"
    echo "✓ Docker dosyaları kopyalandı"
else
    echo "⚠️  Docker dosyaları bulunamadı. Manuel kopyalama gerekli."
fi

# Frontend build kopyala (eğer varsa)
if [ -d "./dist" ]; then
    echo ""
    echo "🎨 Frontend build kopyalanıyor..."
    cp -r ./dist/* "$PROJECT_DIR/frontend/"
    echo "✓ Frontend kopyalandı"
fi

# Dosya izinleri
echo ""
echo "🔐 Dosya izinleri ayarlanıyor..."
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

# Docker container'ları başlat
echo ""
echo "🚀 Docker container'ları başlatılıyor..."

cd "$PROJECT_DIR"

# Container'ları indir ve başlat
docker-compose pull
docker-compose up -d

echo "✓ Container'lar başlatıldı"

# Container'ların hazır olmasını bekle
echo ""
echo "⏳ Servisler başlatılıyor (30 saniye)..."
sleep 30

# Health check
echo ""
echo "🏥 Sistem sağlık kontrolü..."

if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✓ Backend API çalışıyor"
else
    echo "⚠️  Backend API henüz hazır değil. Logları kontrol edin:"
    echo "   docker-compose logs backend"
fi

# Sistem bilgileri
echo ""
echo "=================================="
echo "✅ KURULUM TAMAMLANDI!"
echo "=================================="
echo ""
echo "📊 Sistem Bilgileri:"
echo "-----------------------------------"
echo "Proje Dizini: $PROJECT_DIR"
echo ""
echo "🌐 Web Arayüzleri:"
HOSTNAME=$(hostname -I | awk '{print $1}')
echo "  Dashboard: http://$HOSTNAME:3000"
echo "  Backend API: http://$HOSTNAME:5000/api"
echo ""
echo "🔧 Docker Komutları:"
echo "  Logları görüntüle: cd $PROJECT_DIR && docker-compose logs -f"
echo "  Yeniden başlat: cd $PROJECT_DIR && docker-compose restart"
echo "  Durdur: cd $PROJECT_DIR && docker-compose down"
echo "  Başlat: cd $PROJECT_DIR && docker-compose up -d"
echo ""
echo "📖 Dokümantasyon:"
echo "  Kurulum: docs/KURULUM.md"
echo "  API: docs/backend/api.md"
echo "  ESP32: docs/esp32/README.md"
echo ""
echo "⚠️  ÖNEMLİ:"
echo "  - Docker grubuna ekleme için sistemi yeniden başlatın"
echo "  - ESP32 firmware'de sunucu IP'sini ayarlayın: $HOSTNAME"
echo ""
echo "=================================="
