<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/66303815-2617b000-e8fc-11e9-8c3f-613574be1746.png"/>
</p>
<p align="center">
  <a href="https://david-dm.org/kuzzleio/kuzzle-plugin-cluster">
    <img src="https://david-dm.org/kuzzleio/kuzzle-plugin-cluster.svg" />
  </a>
  <a href="https://travis-ci.com/kuzzleio/kuzzle-plugin-cluster">
    <img alt="undefined" src="https://travis-ci.com/kuzzleio/kuzzle-plugin-cluster.svg?branch=master">
  </a>
  <a href="https://codecov.io/gh/kuzzleio/kuzzle-plugin-cluster">
    <img src="https://codecov.io/gh/kuzzleio/kuzzle-plugin-cluster/branch/master/graph/badge.svg" />
  </a>
  <a href="https://github.com/kuzzleio/kuzzle-plugin-cluster/blob/master/LICENSE">
    <img alt="undefined" src="https://img.shields.io/github/license/kuzzleio/kuzzle-plugin-cluster.svg?style=flat">
  </a>
</p>


## About

### Kuzzle Cluster Plugin

This plugin adds a masterless cluster mode to Kuzzle.

<p align="center">
  :books: <b><a href="https://docs.kuzzle.io/core/1/guides/kuzzle-depth/scalability">Documentation</a></b>
</p>

### Kuzzle

Kuzzle is a ready-to-use, **on-premises and scalable backend** that enables you to manage your persistent data and be notified in real-time on whatever happens to it. 
It also provides you with a flexible and powerful user-management system.

* :watch: __[Kuzzle in 5 minutes](https://kuzzle.io/company/about-us/kuzzle-in-5-minutes/)__
* :octocat: __[Github](https://github.com/kuzzleio/kuzzle)__
* :earth_africa: __[Website](https://kuzzle.io)__
* :books: __[Documentation](https://docs.kuzzle.io)__
* :email: __[Gitter](https://gitter.im/kuzzleio/kuzzle)__

### Get trained by the creators of Kuzzle :zap:

Train yourself and your teams to use Kuzzle to maximize its potential and accelerate the development of your projects.  
Our teams will be able to meet your needs in terms of expertise and multi-technology support for IoT, mobile/web, backend/frontend, devops.  
:point_right: [Get a quote](https://hubs.ly/H0jkfJ_0)

### Compatibility matrice

| Kuzzle Version | Plugin Version |
| -------------- | -------------- |
| 1.8.x          | 3.x.x          | 
| 2.x.x          | 4.x.x          |


## Try it

To run a kuzzle stack, you can use the provided compose file:

```bash
docker-compose up --scale kuzzle=3
```

**NB: This compose stack is for tests and development only and should not be used as-is on production.** 

## Run a development stack

```bash
cd <dir>
git clone https://github.com/kuzzleio/kuzzle-plugin-cluster.git

cd kuzzle-plugin-cluster
cp docker-compose/my.env.sample docker-compose/my.env

./dev-npm-install.sh
./dev.sh
```

You should now have a full Kuzzle clustered stack running 3 Kuzzle front nodes (and 3 servers).
Each update on the cluster source should automatically restart kuzzle.

**Note:** on some Linux environments, you may get `ENOSPC` errors from the filesystem watcher. If so, you need to raise the limits on the number of files that can be watched:

`sudo sysctl -w fs.inotify.max_user_watches=524288`

### Goodies

* [http://localhost:7512/_plugin/cluster/status] => cluster status
* `curl -XPOST http://localhost:7512/_plugin/cluster/reset` => resets redis state and force a new sync (blanks cluster state)
* `bash docker-compose/scripts/devtools.sh` dumps to the standard output the urls to copy/paste in Google Chrome to live-debug the nodes

## Run the cluster in production

### Install

The cluster needs to be installed as a plugin. Please refer to [Kuzzle documentation](https://docs.kuzzle.io/guide/1/essentials/plugins/#installing-a-plugin) on how to proceed.

### Network ports

By default, Kuzzle nodes communicate with each other using two channels on ports `7510` and `7511`.  

**NB: These ports are used by the cluster only and do not need to be publicly exposed.**

You can configure the ports used in the `bindings` section of the plugin configuration (cf [below](#configuration)).

Each Kuzzle node also needs to be able to access Redis and Elasticsearch services.

### Healthcheck

The cluster exposes a healthcheck route on http://kuzzle:7512/_plugin/cluster/health

The route returns a 200 status code only if the `minimumNodes` set in the configuration is reached (cf [configuration](#configuration) below).

## Configuration

### Privileged context

This plugin needs privileged context to work. This context is granted by Kuzzle via the global configuration. Add the following to your configuration

```javascript
plugins: {
    cluster: {
        privileged: true
    }
}
```

For more information on how to configure Kuzzle, [please refer to the Guide](http://docs.kuzzle.io/guide/#configuring-kuzzle).

### Pipe plugin timeouts

This plugin registers some pipe plugins which induce some delay and will exceed default Kuzzle timeouts. 
Make sure you increase your pipe timeouts accordingly.

```json
  "plugins": {
    "common": {
      "pipeWarnTime": 5000,
      "pipeTimeout": 10000
    }
```

### Bindings

The bindings on which each node can be reached by the others can be configured in the `bindings` section of the cluster plugin configuration:

```json
"plugins": {
  "cluster": {
    "bindings": {
      "pub": "tcp://[_site_:ipv4]:7511",
      "router": "tcp://[_site_:ipv4]:7510"
    }
  }
}
```

The syntax is `tcp://[<interface>:<family>]:<port>`, where

- `interface` is either a network interface (i.e. `eth0`), an ip address (i.e. `0.0.0.0`) or `_site_`. If set to `_site_`, the first public ip will be used.
- `family` is either set to `ipv4` (default) or `ipv6`
- `port` is set to the port to listen to

### Redis cluster

Redis cluster comes with some limitations:

1. Single database only.
2. Cluster node arrays.

The latter implies the configuration cannot be set via environment variables.
To comply with the former, make sure to set only one database index (0).

### Full configuration sample

Here is a complete sample configuration using a 3 nodes redis cluster and a 2 elasticsearch nodes.

```json
"plugins": {
  "common": {
    "pipeWarnTime": 5000,
    "pipeTimeout": 10000
  },
  "cluster": {
    "privileged": true,
    "bindings": {
      "pub": "tcp://[_site_:ipv4]:7511",
      "router": "tcp://[_site_:ipv4]:7510"
    },
    "minimumNodes": 1,
    "retryJoin": 30,
    "timers": {
      "discoverTimeout": 3000,
      "joinAttemptIntervall": 2000,
      "heartbeat": 5000,
      "waitForMissingRooms": 4500
    }
  }
},

"services": {
  "internalCache": {
    "database": 0,
    "nodes": [
      {
        "host": "redis1",
        "port": 6379
      },
      {
        "host": "redis2",
        "port": 6379
      },
      {
        "host": "redis3",
        "port": 6379
      }
    ]
  },
  "memoryStorage": {
    "database": 0,
    "nodes": [
      {
        "host": "redis1",
        "port": 6379
      },
      {
        "host": "redis2",
        "port": 6379
      },
      {
        "host": "redis3",
        "port": 6379
      }
    ]
  },
  "db": {
    "client": {
      "host": false,
      "hosts": [
        {
          "protocol": "http",
          "host": "elasticsearch1",
          "port": 9200
        },
        {
          "protocol": "http",
          "host": "elasticsearch2",
          "port": 9200
        }
      ]
    }
  }
}

```

