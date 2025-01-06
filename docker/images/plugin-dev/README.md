# kuzzleio/plugin-dev

This image is meant to be used by plugin developers.  

It contain a complete build toolchain to install and update NPM modules.

[nodemon](https://nodemon.io/) is used to automatically restart Kuzzle on code changes.

[kourou](https://github.com/kuzzleio/kourou/) is also available inside the image.

## Usage

The easiest way is to use this image in a `docker-compose.yml` file:

```yml
services:
  kuzzle:
    image: kuzzleio/plugin-dev:2
    container_name: kuzzle_node
    volumes:
      - ".:/var/app/plugins/enabled/your-plugin-name"
    cap_add:
      - SYS_PTRACE
    ulimits:
      nofile: 65536
    sysctls:
      - net.core.somaxconn=8192
    depends_on:
      - redis
      - elasticsearch
    ports:
      - "9229:9229"
      - "7512:7512"
    environment:
      - kuzzle_services__storageEngine__client__node=http://elasticsearch:9200
      - kuzzle_services__internalCache__node__host=redis
      - kuzzle_services__memoryStorage__node__host=redis
      - NODE_ENV=development
      - DEBUG=kuzzle:plugins
      # Customize here
      - KUZZLE_PLUGIN_NAME=your-plugin-name
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://kuzzle:7512/_healthcheck']
      timeout: 1s
      interval: 2s
      retries: 10

  redis:
    image: redis:6
    container_name: kuzzle_redis
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 1s
      timeout: 3s
      retries: 30

  elasticsearch:
    image: kuzzleio/elasticsearch:7
    container_name: kuzzle_elasticsearch
    ports:
      - '9200:9200'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9200']
      interval: 2s
      timeout: 2s
      retries: 10
    ulimits:
      nofile: 65536
```

You can provide the `KUZZLE_PLUGIN_NAME` variable so the container will only install your plugin dependencies, otherwise it will install every plugin dependencies again.