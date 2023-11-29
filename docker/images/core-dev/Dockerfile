ARG NODE_LTS_VERSION="18"
FROM node:${NODE_LTS_VERSION}-bullseye-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Enhance the Kuzzle core with ease"

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
      gdb \
      git \
      gnupg \
      libfontconfig \
      libzmq3-dev \
      python3 \
      procps \
      wget \
      libunwind-dev \
 && npm install -g kourou \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
