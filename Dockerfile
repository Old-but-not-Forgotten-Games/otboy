FROM oven/bun:1 AS base

WORKDIR /app

# install deps (bun.lock present)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# app code
COPY index.ts index.html game.ts tsconfig.json ./

EXPOSE 3000

ENV PORT=3000

CMD ["bun", "index.ts"]
