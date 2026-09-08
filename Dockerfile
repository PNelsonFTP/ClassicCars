FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "run", "api"]
