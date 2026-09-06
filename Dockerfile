FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5199

COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node dist ./dist

USER node

EXPOSE 5199

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:5199/api/health >/dev/null || exit 1

CMD ["node", "server.mjs"]
