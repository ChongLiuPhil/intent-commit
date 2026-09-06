FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY packages ./packages
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/intent-commit.sqlite
ENV COOKIE_SECURE=true

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "server.js"]
