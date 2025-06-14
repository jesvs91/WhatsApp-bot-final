# Usa una imagen base oficial de Node.js que incluye herramientas de construcción
FROM node:18-slim

# Instala las dependencias del sistema operativo que Puppeteer necesita
# Esto es crucial para que Chrome funcione en el servidor
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \

    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends

# Define el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de definición de paquetes primero para aprovechar el caché de Docker
COPY package*.json ./

# Instala las dependencias de Node.js
RUN npm install

# Copia el resto del código de la aplicación al directorio de trabajo
COPY . .

# Expone el puerto que la aplicación usará (Koyeb lo gestionará)
EXPOSE 8080

# Comando para iniciar la aplicación cuando el contenedor se inicie
CMD [ "npm", "start" ]
