FROM oven/bun:1 AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run build:packages

FROM oven/bun:1 AS runtime

WORKDIR /app

COPY --from=builder /app/apps/backend/dist /app/apps/backend/dist
COPY --from=builder /app/apps/frontend/dist /app/apps/frontend/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_DIST=/app/apps/frontend/dist

EXPOSE 3000

CMD ["bun", "/app/apps/backend/dist/index.js"]
