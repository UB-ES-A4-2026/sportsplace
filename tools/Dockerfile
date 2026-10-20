FROM node:24-bookworm-slim

ARG LOCAL_UID=1000
ARG LOCAL_GID=1000

# Debian's CA bundle also supports the CLI's HTTPS package and platform calls.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && if [ "$LOCAL_GID" != "1000" ]; then groupmod --non-unique --gid "$LOCAL_GID" node; fi \
    && if [ "$LOCAL_UID" != "1000" ]; then usermod --uid "$LOCAL_UID" node; fi \
    && mkdir -p /opt/tools /workspace \
    && chown -R node:node /opt/tools /workspace /home/node

USER node
WORKDIR /opt/tools

COPY --chown=node:node package*.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node test ./test

# Dependencies live outside the repository bind mount.
WORKDIR /workspace
ENTRYPOINT ["node", "/opt/tools/scripts/migrate.js"]
