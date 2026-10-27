---
code: false
type: page
order: 700
title: Cluster and Scalability | Kuzzle Advanced | Guide | Core
meta:
  - name: description
    content: Understand how a Kuzzle cluster works
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, opensource,  Cluster and Scalability 
---
:::info
This documentation page applies to Kuzzle versions 2.11 and above.  

Previous versions of Kuzzle used a Cluster plugin. See the "Legacy Cluster Plugin" section at the end of this page.
:::

# Cluster and Scalability

Kuzzle natively supports cluster capabilities, and is thus able to easily scale horizontally.

This guide covers the Kuzzle Cluster features and how clustering capabilities can be added to Kuzzle.

---

## Kuzzle Cluster features

Kuzzle uses a cluster in [masterless mode](https://en.wikipedia.org/wiki/Shared-nothing_architecture) to ensure maximum resilience.  
Each node in the cluster handles part of the load of requests received by the application, given a load balancer is used.  

### High Availability

A Kuzzle cluster shares the processing of requests and the dispatching of real-time notifications.  
From 2 nodes onwards, even if a problem causes a service interruption on a server, the availability of the application will not be affected.  

### Resiliency

The Kuzzle Cluster architecture is built to be resilient against network or machine failures.  
It features a predictive algorithm ensuring that all nodes stay synchronized, at all times.

Nodes isolated because of a network failure are automatically evicted from the cluster, and killed.  
Nodes installed on faulty machines, or too slow to stay synchronized with the cluster, will also be evicted and killed.

This strategy guarantees that a Kuzzle Cluster stays sane at all times. Used with a load balancer able to spawn new Kuzzle instances on the fly, it also guarantees your application to be stable, even when facing disrupting events.

### Scaling without service interruption

The Kuzzle Cluster allows you to add and remove nodes on the fly, without service interruption.  

If the load intensifies, just start additional servers, they will be automatically integrated into the cluster for request processing.  
It requires only a few seconds for a new Kuzzle node to join an existing cluster and to synchronize with it.


On the contrary, if the load decreases, just stop Kuzzle instances: the rest of the nodes will handle the remaining load.  

This allows to control the hosting costs while scaling accordingly when facing temporary events.

This model also fits nicely with how cloud providers allow to add/remove instances on the fly, depending on usage metrics.  

:::info 
A load balancer in front of a Kuzzle cluster is highly advised, to dispatch user connections to different Kuzzle nodes.  
Once assigned to a Kuzzle node, a client stays attached to it until their connection drop; when needed, a Kuzzle node automatically dispatches valuable information to other nodes.

Any load balancer will do: nginx, traefik, your favorite cloud provider's load balancer, ...
:::

### Completely scalable environment

Kuzzle uses Elasticsearch as it storage layer, and Redis as a shared cache.    
Both of these products have native cluster capabilities, allowing them to scale to handle an increasing load of users and requests.  

Scaling [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/guide/current/distributed-cluster.html) and [Redis](https://redis.io/topics/cluster-tutorial) is done independently of Kuzzle. Each can scale differently depending on the needs.  

For instance, an application that greatly requires to write/read documents from the storage should have a larger Elasticsearch cluster, while an application that makes intensive use of real time with a large number of simultaneous connections should increase the size of its Kuzzle cluster.

## Quick start

Kuzzle's Cluster embeds an auto-discovery feature, allowing to automatically form a new cluster when more than 1 nodes are started, and allowing newly started nodes to join an existing cluster if one is present.  


New nodes will automatically synchronize themselves with existing ones, and be made available once they have successfully joined the cluster.

Getting a Kuzzle cluster is as simple as running new instances, no configuration needed:

Simply start a Kuzzle instance.  
Then start another one, using the same Redis endpoint: you now have a 2-node cluster.  
Start another one, and you have a 3-node cluster.  
Start another one, ...  


:::info
For this to work, each instance must share the same Redis endpoint.  

Also, all nodes must have different IP addresses. A starting node that finds another node registered with its own IP address first waits for that registration to expire (`cluster.heartbeat` × 3, 6 seconds by default), in case it is the leftover of its own previous run. If the other node is still there, the starting node refuses to start: `app.start()` rejects with a `cluster.join.duplicate_ip` error and the process exits with code `1` (see [Startup failures](#startup-failures)).  

If you want to quickly create a Kuzzle cluster on a single machine, you can use our Docker images to spawn Kuzzle instances easily, each with a different IP address.
:::


## Network prerequisites

Cluster nodes talk to each other directly, over two TCP ports:

| Port | Configuration key | Use |
|---|---|---|
| `7510` | `cluster.ports.command` | Commands between nodes (handshakes, full state requests, ...) |
| `7511` | `cluster.ports.sync` | Synchronization messages sent by each node to the other ones |

Every node must be able to open these ports on every other node. There is no need to expose them publicly: only the API port (`7512` by default) must be reachable by clients.

All nodes must also share the same Redis server (`services.internalCache`), which they use to discover each other.

## Cluster configuration

Kuzzle's RC file features a `cluster` section, allowing to fine-tune its behavior. The most commonly used keys are:

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Set to `false` to run a standalone node |
| `minimumNodes` | `1` | Minimum number of nodes for the cluster to accept requests. Set it to at least half the number of nodes plus one (e.g. `2` for a 3-node cluster) to protect against network splits: with fewer active nodes, the whole cluster refuses requests until enough nodes are back |
| `joinTimeout` | `60000` | Time (in milliseconds) a starting node has to join the cluster. Past it, the node fails its startup |
| `heartbeat` | `2000` | Interval (in milliseconds) at which nodes signal they are alive |
| `ip` / `interface` / `ipv6` | `"private"` / `null` / `false` | Which network address a node advertises to the other ones |
| `syncTimeout` | `5000` | Time (in milliseconds) a joining node has to receive the cluster state from another node. Raise it if the cluster holds a very large number of realtime subscriptions |
| `retransmitBuffer` | `{ "messages": 1000, "bytes": 16777216 }` | <SinceBadge version="2.57.0" /> How many of its last synchronization messages each node keeps, so that a node that missed some can ask for them again instead of leaving the cluster. `0` disables retransmission |

See the `cluster` section of our [.kuzzlerc.sample.jsonc file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc) for a complete documentation.

## Startup failures

A node that cannot join the cluster fails its startup: `app.start()` rejects with one of the [cluster.join errors](/core/2/api/errors/error-codes/cluster#subdomain-0x0801-join):

- `cluster.join.duplicate_ip`: another node uses the same IP address,
- `cluster.join.full_state_unavailable`: the node could not get the cluster state from the other nodes,
- `cluster.join.timeout`: the node did not join within `cluster.joinTimeout`.

Whatever the cause, and whatever the value of `NODE_ENV`, **a node whose startup fails shuts down and exits with code `1`**. This includes a failure of an [app.install](/core/2/framework/classes/backend/install) handler or of a startup import. The error is still returned by `app.start()` before the process exits, so you can log it.

A running node also exits with code `1` when it leaves the cluster because of a failure: it is evicted by the other nodes, it cannot reach them anymore (network split), or it is too slow to stay synchronized. A shutdown caused by a failure is bounded to 30 seconds. A requested shutdown (`SIGTERM`, `SIGINT`, [admin:shutdown](/core/2/api/controllers/admin/shutdown)) exits with code `0`.

::: info
Use a restart policy that restarts on failure (e.g. `restart: on-failure` or `restart: always` with Docker Compose, or the default policy of a Kubernetes Deployment): a failed node is then restarted and joins the cluster again.
:::

## Write cluster-safe code

Every node runs the same application code. Code that must run on one node only, or on one node at a time, needs to be coordinated.

### Startup code

Several nodes can start at the same time. To create indexes, collections or permissions, or to run code once per environment, use [app.import](/core/2/framework/classes/backend-import) and [app.install](/core/2/framework/classes/backend/install): Kuzzle runs them on one node while the other ones wait. See [Initialize data at startup](/core/2/guides/getting-started/write-application#initialize-data-at-startup).

### Cluster-wide locks

<SinceBadge version="2.57.0" />

The [withLock](/core/2/framework/functions/with-lock) function runs a function while holding a lock shared by every node of the cluster (it is stored in Redis). Other calls with the same key, on any node, wait for the lock to be released.

```js
import { MutexAcquireError, MutexLockLostError, withLock } from 'kuzzle';

try {
  await withLock('reports:rebuild', async () => {
    // only one node runs this at any given time
    await rebuildReports();
  }, { retryAttempts: 0 }); // do not wait if another node holds the lock
}
catch (error) {
  if (error instanceof MutexAcquireError) {
    // another node is already rebuilding the reports
  }
  else if (error instanceof MutexLockLostError) {
    // the lock was lost while the function was running
  }
  else {
    throw error;
  }
}
```

The lock is extended for as long as the function runs, and released when it ends or when the node stops. `withLock` can be used once the application has started.

::: warning
The `Mutex` class is deprecated: use `withLock` instead. See [Migrating to withLock](/core/2/framework/classes/mutex/constructor#migrating-to-withlock).
:::

### Cluster events

<SinceBadge version="2.9.0" />

To keep a state in sync between nodes (e.g. a cache held in memory), broadcast an event to the other nodes with [app.cluster.broadcast](/core/2/framework/classes/backend-cluster/broadcast), and listen to it with [app.cluster.on](/core/2/framework/classes/backend-cluster/on), [once](/core/2/framework/classes/backend-cluster/once), [off](/core/2/framework/classes/backend-cluster/off) and [removeAllListeners](/core/2/framework/classes/backend-cluster/removeAllListeners).

```js
// On every node
await app.cluster.on('config:changed', async payload => {
  await reloadConfig(payload.name);
});

// On the node where the change happens
await reloadConfig('pricing');
await app.cluster.broadcast('config:changed', { name: 'pricing' });
```

::: info
The event is received by the other nodes only, not by the node that broadcasts it.
:::

---

## Legacy Cluster Plugin

<DeprecatedBadge version="2.11.0"/>

Before Kuzzle version 2.11.0, clustering capabilities were ensured by our official cluster plugin: `kuzzle-plugin-cluster`.

This plugin is now deprecated and shouldn't be used.

From Kuzzle 2.11, the cluster is native and the plugin was replaced by an empty compatibility shell, which translated its configuration to the native `cluster` configuration and kept its API routes.

This compatibility shell is not shipped anymore, neither in the `kuzzle` npm package nor in the official Docker image: remove the cluster plugin from your plugins and its configuration, configure the native `cluster` section instead (see [Cluster configuration](#cluster-configuration)), and use the native [cluster:status](/core/2/api/controllers/cluster/status) API route to check the health of your cluster.
