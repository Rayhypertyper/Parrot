FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node server.ts ./server.ts
USER node
CMD ["node", "server.ts"]
