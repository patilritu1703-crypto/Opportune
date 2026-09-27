# OpporTune — single-stage image, zero external npm dependencies.
FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/server.js"]
