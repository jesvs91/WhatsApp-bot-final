# Usar una imagen base oficial de Node.js
FROM node:18-slim

# Instalar las dependencias necesarias para Puppeteer/Chromium
RUN apt-get update \
  && apt-get install -y \
  chromium \
  fonts-ipafont-gothic \
  fonts-wqy-zenhei \
  fonts-thai-tlwg \
  fonts-kacst \
  fonts-freefont-ttf \
  libxss1 \
  --no-install-recommends

# Crear el directorio de la aplicación
WORKDIR /app

# Copiar los archivos de dependencias
COPY package.json .
COPY package-lock.json* .

# Instalar las dependencias de Node.js
RUN npm install --production

# Copiar el resto del código de la aplicación
COPY . .

# Comando para iniciar la aplicación
CMD ["npm", "start"]
