FROM node:22-slim AS base
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# A "prepare" script (next-ws patch) a node_modules/next-et módosítja, ezért a telepítés után fut
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app ./
EXPOSE 3000
# A séma létrehozása/frissítése indításkor, utána a szerver (next-ws miatt "next start")
CMD ["sh", "-c", "npx prisma db push && npm run start"]
