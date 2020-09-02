FROM kuzzleio/kuzzle:2-dev

RUN  set -x \
  \
  && npm set user 0 \
  && npm set unsafe-perm true \
  && npm install -g pm2 \
  \
  && apt-get update \
  && apt-get install -y \
    build-essential \
    git \
    python-dev \
    libzmq3-dev
