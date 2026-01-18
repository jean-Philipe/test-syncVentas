# ================================
# Stage 1: Build React Frontend
# ================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copiar archivos de dependencias del cliente
COPY client/package*.json ./
RUN npm ci

# Copiar código fuente del cliente
COPY client/ ./

# Build de Next.js
RUN npm run build

# ================================
# Stage 2: Production Server
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar dependencias de producción para servidor
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el servidor backend
COPY server.js ./
COPY controllers/ ./controllers/
COPY routes/ ./routes/
COPY services/ ./services/
COPY utils/ ./utils/
COPY prisma/ ./prisma/

# Generar cliente Prisma
RUN npx prisma generate

# Copiar build de Next.js (standalone output)
COPY --from=frontend-builder /app/client/.next/standalone ./client/.next/standalone
COPY --from=frontend-builder /app/client/.next/static ./client/.next/static
COPY --from=frontend-builder /app/client/public ./client/public

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=America/Santiago

EXPOSE 3000

# Arrancar servidor Express que sirve API + archivos estáticos
CMD ["node", "server.js"]
