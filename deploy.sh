#!/bin/bash

# Solar Monitoring System - Deployment Script
# Bu script projeyi Raspberry Pi'ye deploy eder

set -e

echo "🚀 Solar Monitoring System - Deployment"
echo "========================================"

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Raspberry Pi bilgileri
read -p "Raspberry Pi IP adresi: " RPI_IP
read -p "Raspberry Pi kullanıcı adı (varsayılan: pi): " RPI_USER
RPI_USER=${RPI_USER:-pi}

RPI_PATH="/home/$RPI_USER/solar-monitoring"

echo ""
echo "📦 Gerekli dosyalar kontrol ediliyor..."

# Gerekli dosyaları kontrol et
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml bulunamadı!${NC}"
    exit 1
fi

if [ ! -d "docs/backend" ]; then
    echo -e "${RED}❌ Backend dosyaları bulunamadı!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dosyalar hazır${NC}"

echo ""
echo "📤 Raspberry Pi'ye dosyalar gönderiliyor..."

# Raspberry Pi'de dizin oluştur
ssh $RPI_USER@$RPI_IP "mkdir -p $RPI_PATH"

# Proje dosyalarını kopyala
echo "  - Docker dosyaları..."
scp docker-compose.yml Dockerfile nginx.conf $RPI_USER@$RPI_IP:$RPI_PATH/

echo "  - Backend dosyaları..."
scp -r docs/ $RPI_USER@$RPI_IP:$RPI_PATH/

echo "  - Frontend kaynak kodları..."
scp -r src/ public/ $RPI_USER@$RPI_IP:$RPI_PATH/
scp package*.json index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js $RPI_USER@$RPI_IP:$RPI_PATH/

echo "  - .env dosyası (varsa)..."
if [ -f ".env" ]; then
    scp .env $RPI_USER@$RPI_IP:$RPI_PATH/
fi

echo -e "${GREEN}✅ Dosyalar gönderildi${NC}"

echo ""
echo "🐳 Docker container'ları başlatılıyor..."

# Raspberry Pi'de Docker Compose ile başlat
echo "  - Mevcut container'lar durduruluyor..."
ssh $RPI_USER@$RPI_IP "cd $RPI_PATH && docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true"

echo "  - Yeni container'lar build ediliyor ve başlatılıyor..."
ssh $RPI_USER@$RPI_IP "cd $RPI_PATH && docker compose up -d --build || docker-compose up -d --build"

echo ""
echo "⏳ Container'ların hazır olması bekleniyor..."
sleep 10

# Container durumlarını kontrol et
echo "📊 Container durumları:"
ssh $RPI_USER@$RPI_IP "cd $RPI_PATH && (docker compose ps || docker-compose ps)"

echo ""
echo -e "${GREEN}✅ Deployment tamamlandı!${NC}"
echo ""
echo "📱 Uygulamaya erişim:"
echo -e "   ${YELLOW}http://$RPI_IP:3000${NC}"
echo ""
echo "🔍 Faydalı Komutlar:"
echo -e "   Log'ları görmek için:"
echo -e "   ${YELLOW}ssh $RPI_USER@$RPI_IP 'cd $RPI_PATH && docker compose logs -f'${NC}"
echo ""
echo -e "   Yeniden başlatmak için:"
echo -e "   ${YELLOW}ssh $RPI_USER@$RPI_IP 'cd $RPI_PATH && docker compose restart'${NC}"
echo ""
echo -e "   Durdurmak için:"
echo -e "   ${YELLOW}ssh $RPI_USER@$RPI_IP 'cd $RPI_PATH && docker compose down'${NC}"
echo ""
echo -e "   Sadece frontend'i yeniden build etmek için:"
echo -e "   ${YELLOW}ssh $RPI_USER@$RPI_IP 'cd $RPI_PATH && docker compose up -d --build frontend'${NC}"
echo ""
