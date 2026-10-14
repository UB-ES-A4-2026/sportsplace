FROM node:24-bookworm-slim

ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
WORKDIR /app
RUN if [ "$LOCAL_GID" != "1000" ]; then groupmod --non-unique --gid "$LOCAL_GID" node; fi \
    && if [ "$LOCAL_UID" != "1000" ]; then usermod --uid "$LOCAL_UID" node; fi \
    && mkdir -p /app/node_modules \
    && chown -R node:node /app /home/node
USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
