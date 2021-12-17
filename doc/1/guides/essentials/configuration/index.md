---
code: false
type: page
title: Configure Kuzzle
order: 200
---

# Configuring Kuzzle

The Kuzzle **configuration** is stored in a [kuzzlerc file](https://github.com/kuzzleio/kuzzle/blob/1-stable/.kuzzlerc.sample) found in the root folder of your Kuzzle installation.

Kuzzle uses [rc](https://github.com/dominictarr/rc) to **override** its default configuration by either:

- loading parameters from a `.kuzzlerc` file ([sample file](https://github.com/kuzzleio/kuzzle/blob/1-stable/.kuzzlerc.sample)) ;
- loading parameters from environment variables with a `kuzzle_` prefix.

### Example 1: configuring Kuzzle using a custom `.kuzzlerc` file

You can write your custom config parameters in a `.kuzzlerc` and store it in `$HOME/.kuzzlerc` or [one of these locations](https://github.com/dominictarr/rc/blob/master/README.md#standards):

```json
{
  "services": {
    "db": {
      "client": {
        "host": "http://localhost:9200",
        "apiVersion": "5.4"
      }
    }
  }
}
```

### Example 2: configuring Kuzzle using Environment Variables

The name of the environment variable must match the path of the configuration parameter in the `.kuzzlerc` file. To set the name of the environment variable:

- Use the prefix `kuzzle_`,
- then append the parameter path (as defined in the `.kuzzlerc` file) by using a **double underscore** `__` to separate each level of its hierarchy.

For example, the `.kuzzlerc` parameter `services.db.host` in example 1, is represented by the environment variable `kuzzle_services__db__host`:

```bash
export kuzzle_services__db__host="<DB_HOST>"
```

Environment variables are particularly handy when running Kuzzle in a **Docker** container. Using **Docker Compose**, they can easily be configured in the `environment` section of the `docker-compose.yml` file. For example, here's how we pass environment variables to Kuzzle in our default docker-compose file:

```yaml
version: '3'

services:
  kuzzle:
    image: kuzzleio/kuzzle
    cap_add:
      - SYS_PTRACE
    depends_on:
      - redis
      - elasticsearch
    environment:
      - kuzzle_services__db__client__host=http://elasticsearch:9200
      - kuzzle_services__internalCache__node__host=redis
      - kuzzle_services__memoryStorage__node__host=redis
      - NODE_ENV=production

  redis:
    image: redis:5

  elasticsearch:
    image: kuzzleio/elasticsearch:5
    ulimits:
      nofile: 65536
    environment:
      - cluster.name=kuzzle
      - "ES_JAVA_OPTS=-Xms1024m -Xmx1024m"
```

:::info
For an exhaustive list of configuration parameters, please refer to the [kuzzlerc sample file](https://github.com/kuzzleio/kuzzle/blob/1-stable/.kuzzlerc.sample).
:::
