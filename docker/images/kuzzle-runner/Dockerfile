ARG NODE_VERSION="22"
FROM node:${NODE_VERSION}-bookworm-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your in-development Kuzzle application with ease"

RUN mkdir /var/npm && chown node:node /var/npm

ENV NPM_CONFIG_CACHE=/var/npm

WORKDIR /var/app

RUN set -x \
     \
     && apt-get update \
     && apt-get install -y \
     bash-completion \
     build-essential \
     curl \
     g++ \
     git \
     python3 \
     && apt-get clean \
     && rm -rf /var/lib/apt/lists/*
