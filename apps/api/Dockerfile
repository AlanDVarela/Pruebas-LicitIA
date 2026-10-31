FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Solo manifiestos: el código se monta como volumen (hot reload) desde docker-compose.
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --workspace=@licitaia/api --workspace=@licitaia/shared --include-workspace-root=false

WORKDIR /app/apps/api
EXPOSE 3000
# db push en dev (sin migraciones todavía) → triggers de bitácora → semilla → servidor
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && npx prisma db execute --schema prisma/schema.prisma --file prisma/triggers.sql && npx tsx prisma/seed.ts && npx tsx watch src/server.ts"]
