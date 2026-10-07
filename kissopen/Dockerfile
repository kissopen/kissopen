# Standalone kissopen-server: single container, no external dependencies
# Uses PGlite (embedded Postgres), local filesystem storage, no Redis

# Stage 1: install dependencies
FROM node:20 AS deps

RUN apt-get update && apt-get install -y python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY scripts ./scripts
COPY patches ./patches

RUN mkdir -p packages/kissopen-app packages/kissopen-server packages/kissopen-cli packages/kissopen-agent packages/kissopen-wire

COPY packages/kissopen-app/package.json packages/kissopen-app/
COPY packages/kissopen-server/package.json packages/kissopen-server/
COPY packages/kissopen-cli/package.json packages/kissopen-cli/
COPY packages/kissopen-agent/package.json packages/kissopen-agent/
COPY packages/kissopen-wire/package.json packages/kissopen-wire/

# Workspace postinstall requirements
COPY packages/kissopen-app/patches packages/kissopen-app/patches
COPY packages/kissopen-server/prisma packages/kissopen-server/prisma
COPY packages/kissopen-cli/scripts packages/kissopen-cli/scripts
COPY packages/kissopen-cli/tools packages/kissopen-cli/tools

RUN SKIP_KISSOPEN_WIRE_BUILD=1 pnpm install --frozen-lockfile

# Stage 2: copy source and type-check
FROM deps AS builder

COPY packages/kissopen-wire ./packages/kissopen-wire
COPY packages/kissopen-server ./packages/kissopen-server

RUN pnpm --filter @kissopen/kissopen-wire --fail-if-no-match build
RUN pnpm --filter kissopen-server --fail-if-no-match build

# Stage 3: runtime
FROM node:20-slim AS runner

WORKDIR /repo

RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PGLITE_DIR=/data/pglite

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/packages/kissopen-wire /repo/packages/kissopen-wire
COPY --from=builder /repo/packages/kissopen-server /repo/packages/kissopen-server

VOLUME /data
EXPOSE 3005

WORKDIR /repo/packages/kissopen-server

CMD ["sh", "-c", "../../node_modules/.bin/tsx sources/standalone.ts migrate && exec ../../node_modules/.bin/tsx sources/standalone.ts serve"]
