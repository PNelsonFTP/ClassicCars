FROM node:24-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build && npm run sbom && npm run sbom:artifacts && npm run sbom:validate
CMD ["npm", "run", "api"]
