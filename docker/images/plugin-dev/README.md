# kuzzleio/plugin-dev

This image is meant to be used by plugin developers.  

It contain a complete build toolchain to install and update NPM modules.

[nodemon](https://nodemon.io/) is used to automatically restart Kuzzle on code changes.

[kourou](https://github.com/kuzzleio/kourou/) is also available inside the image.

## Usage

The easiest way is to use this image in a `docker-compose.yml` file:

```yml
version: '3'

services:
  kuzzle:
    image: kuzzleio/plugin-dev:2
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

  redis:
    image: redis:6

  elasticsearch:
    image: kuzzleio/elasticsearch:7
    ulimits:
      nofile: 65536
```

You can provide the `KUZZLE_PLUGIN_NAME` variable so the container will only install your plugin dependencies, otherwise it will install every plugin dependencies again.