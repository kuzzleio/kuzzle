ARG NODE_VERSION="20"
FROM node:${NODE_VERSION}-bookworm-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your in-development Kuzzle application with ease"

RUN mkdir /var/npm && chown node:node /var/npm

ENV NPM_CONFIG_CACHE=/var/npm

WORKDIR /var/app

RUN set -x \
     && apt-get update && apt-get install -y \
     curl \
     python3 \
     make \
     g++ \
     git \
     libzmq3-dev \
     libunwind-dev \
     && apt-get clean \
     && rm -rf /var/lib/apt/lists/*

RUN npm i -g kourou
