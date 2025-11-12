# Node.js 18 Alpine (hafif ve hızlı)
FROM node:18-alpine

# Gerekli sistem paketleri
RUN apk add --no-cache \
    sqlite \
    curl \
    python3 \
    make \
    g++

# Çalışma dizini
WORKDIR /app

# Backend package.json oluştur
RUN echo '{ \
  "name": "solar-monitoring-backend", \
  "version": "1.0.0", \
  "description": "Solar radiation monitoring system backend", \
  "main": "server.js", \
  "scripts": { \
    "start": "node server.js", \
    "dev": "nodemon server.js" \
  }, \
  "dependencies": { \
    "express": "^4.18.2", \
    "cors": "^2.8.5", \
    "sqlite3": "^5.1.6", \
    "ws": "^8.14.2", \
    "dotenv": "^16.3.1" \
  }, \
  "engines": { \
    "node": ">=18.0.0" \
  } \
}' > package.json

# Bağımlılıkları yükle
RUN npm install --production

# Backend dosyalarını kopyala
COPY backend/ .

# Veri klasörü izinleri
RUN mkdir -p /app/data && chmod 777 /app/data

# Port expose
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Başlat
CMD ["node", "server.js"]
