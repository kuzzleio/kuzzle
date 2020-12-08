---
code: false
type: page
title: Cluster and Scalability
description: Understand how a Kuzzle cluster works
order: 700
---

# Cluster and Scalability

<!-- need rewrite -->

Kuzzle can scale horizontally, provided our [official Cluster Plugin](https://github.com/kuzzleio/kuzzle-plugin-cluster) is installed.  

This guide covers Kuzzle Cluster features and how clustering capabilities can be added to Kuzzle.

---

## Kuzzle Cluster features

Kuzzle uses a cluster in [masterless mode](https://en.wikipedia.org/wiki/Shared-nothing_architecture) to ensure maximum resilience.  
Each node in the cluster handles part of the load of requests received by the application.  

### High Availability

A Kuzzle cluster shares the processing of requests and the dispatching of real-time notifications.  
From 2 nodes onwards, even if a problem causes a service interruption on a server, the availability of the application will not be affected.  

### Scaling without service interruption

Masterless mode allows you to add and remove nodes without service interruption.  
If the load becomes heavier, just start additional servers, they will be automatically integrated into the cluster for request processing.  
On the contrary, if the load decreases, just stop servers, the rest of the nodes will handle the remaining load.  
This allows to control the hosting costs during scalability due to temporary events.  

### Complete cluster environment

Kuzzle uses Elasticsearch as a database and Redis for communication between nodes as well as as a cache for performance.  
Both software have native cluster modes allowing them to scale to handle an increasing load of users and requests.  

The scaling of the [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/guide/current/distributed-cluster.html) and [Redis](https://redis.io/topics/cluster-tutorial) clusters are independent of Kuzzle. Each can scale differently depending on the needs.  

An application that greatly requires the write/read database can afford a larger Elasticsearch cluster, while an application that makes intensive use of real time will increase the size of its Kuzzle and Redis clusters.

## Quick start

This chapter shows how to quickly create a Kuzzle cluster stack for development purposes. If you already have an existing Kuzzle server running, you may want to read the manual install chapter instead.

::: info
This development stack is for demonstration and test purposes only and should not be used as-is on production.  

Notably, this stack only starts Kuzzle in cluster mode: Elasticsearch and Redis are not clustered.
:::

Install and run: 

```bash
git clone https://github.com/kuzzleio/kuzzle-plugin-cluster.git
cd kuzzle-plugin-cluster
docker-compose -p cluster up --scale kuzzle=3
```

You should now have a Kuzzle cluster stack running with 3 Kuzzle nodes.

::: info
<SinceBadge version="1.10.0" />

Kuzzle Docker images are shipped with the cluster plugin.
The cluster is disabled by default but you can use the [`$KUZZLE_PLUGINS`](/core/2/guides/develop-on-kuzzle/external-plugins) environment variable to enable it.
:::

### ENOSPC error

On some Linux environments, you may get `ENOSPC` errors from the filesystem watcher, because of limits set too low.

If that happens, simply raise the limits on the number of files that can be watched:

`sudo sysctl -w fs.inotify.max_user_watches=524288`

That configuration change will last until the next reboot. 

To make it permanent, add the following line to your `/etc/sysctl.conf` file:

```
fs.inotify.max_user_watches=524288
```

---

## Manual install on an existing Kuzzle installation

To add cluster capabilities to an existing Kuzzle installation, the cluster plugin must be installed by following the Plugin Install Guide.

::: info
If you are running Kuzzle in a Docker container, you will need to access the running container's shell and then the Kuzzle installation folder inside the container.
:::

To install the cluster plugin, follow these steps:

```bash
cd <kuzzle directory>/plugins/available

git clone https://github.com/kuzzleio/kuzzle-plugin-cluster.git

cd kuzzle-plugin-cluster
npm install # add --unsafe-perm if installing from inside a docker container

# Enable the installed plugin. Delete this link to disable it
cd ../../enabled
ln -s ../available/kuzzle-plugin-cluster
```

### Cluster plugin configuration

* The cluster plugin requires a privileged context from Kuzzle. This context is granted by Kuzzle via the global configuration.
* The cluster plugin registers a few [pipes](/core/2/guides/write-plugins/plugins-features#pipes-and-hooks). 

Add the following to your kuzzlerc configuration file (see our [Kuzzle configuration guide](/core/2/guides/advanced/configuration)):

```js
"plugins": {
  "common": {
    "pipeWarnTime": 5000
  },
  "cluster": {
    "privileged": true
  }
}
```

Once the plugin installed and configured, you can start as many Kuzzle instances as you need, and they will automatically synchronize and work together.

---

## Extended API

The cluster plugin adds an [API controller](/core/2/guides/write-plugins/plugins-features#api) named `cluster`, with the following actions defined:

### health

The `cluster:health` API action returns the cluster health status.

#### HTTP

```
GET http://<host>:<port>/_plugin/cluster/health
```

#### Other Protocols

```js
{
  "controller": "cluster/cluster",
  "action": "health"
}
```

#### Result

```js
{
  "status": 200,
  "error": null,
  "controller": "cluster/cluster",
  "action": "health",
  "result": "ok"
}
````

### reset

The `cluster:reset` API action resets the cluster state and forces a resync.

#### HTTP

```
POST http://<host>:<port>/_plugin/cluster/reset
```

#### Other Protocols

```js
{
  "controller": "cluster/cluster",
  "action": "reset"
}
```

#### Result

```js
{
  "status": 200,
  "error": null,
  "controller": "cluster/cluster",
  "action": "reset",
  "result": "ok"
}
````

### status

The `cluster:status` API action returns the current cluster status.

#### HTTP

```
GET http://<host>:<port>/_plugin/cluster/status
```

#### Other Protocols

```js
{
  "controller": "cluster/cluster",
  "action": "status"
}
```

#### Result

```js
{
  "status": 200,
  "error": null,
  "controller": "cluster/cluster",
  "action": "status",
  "result": {
    "count": 3,
    "current": {
      "pub": "tcp://<kuzzle node IP>:7511",
      "router": "tcp://<kuzzle node IP>:7510",
      "ready": true
    },
    "pool": [
      {
        "pub": "tcp://<kuzzle node IP>:7511",
        "router": "tcp://<kuzzle node IP>:7510",
        "ready": true
      },
      {
        "pub": "tcp://<kuzzle node IP>:7511",
        "router": "tcp://<kuzzle node IP>:7510",
        "ready": true
      }
    ]
  }
}
```

---

## How a Kuzzle cluster works

### Auto-discovery and Synchronization

Kuzzle nodes are synchronized by maintaining their state in a [Redis](https://redis.io) server instance, and they constantly exchange information using the [0mq](http://zeromq.org) messaging library.

What this means is that, to scale horizontally, all a Kuzzle node needs is a reachable Redis instance, and to be able to connect to other nodes.  
When these conditions are met, a Kuzzle node with the cluster plugin installed only needs to be started to automatically synchronize its state and to work together with the other nodes.

Check our [Kuzzle configuration guide](/core/2/guides/advanced/configuration) to know how to make Kuzzle connect to specific Redis instances.

### Load Balancing

A load balancer in front of a Kuzzle cluster is hugely advised, to dispatch user connections to different Kuzzle nodes.  
Once assigned to a Kuzzle node, a client stays attached to it until their connection drop; when needed, a Kuzzle node automatically dispatches valuable information to other nodes.

Any load balancer will do. For instance, our development stack uses nginx for the sake of example.

