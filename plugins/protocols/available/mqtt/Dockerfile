FROM kuzzleio/kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Power your IOT apps with the Kuzzle MQTT backend"

COPY . /var/app/protocols/enabled/mqtt

RUN  apt-get update \
  && apt-get install -y \
      build-essential \
      python \
  \
  && cd /var/app/protocols/enabled/mqtt \
  && npm install \
  && cd /var/app \
  \
  && apt-get clean \
  && apt-get remove -y \
    build-essential \
    g++ \
    python \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

