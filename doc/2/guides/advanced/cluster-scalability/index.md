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

Also, all nodes must have different IP addresses. Failing that, nodes will refuse to start with a meaningful error message.  

If you want to quickly create a Kuzzle cluster on a single machine, you can use our Docker images to spawn Kuzzle instances easily, each with a different IP address.
:::


## Cluster configuration

Kuzzle's RC file features a `cluster` section, allowing to fine-tune its behavior.

See the `cluster` section of our [.kuzzlerc.sample.jsonc file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc) for a complete documentation.

---

## Legacy Cluster Plugin

<DeprecatedBadge version="2.11.0"/>

Before Kuzzle version 2.11.0, clustering capabilities were ensured by our official cluster plugin: `kuzzle-plugin-cluster`.

This plugin is now deprecated and shouldn't be used.

Kuzzle 2.11 and above still embed this plugin.  
On these versions, the plugin is an empty shell, only there to ensure backward-compatibility with previous versions:

* Using the cluster plugin will now display a deprecation notice in Kuzzle's logs;
* If present, the cluster plugin configuration will be interpreted and applied to the native cluster configuration;
* API routes exposed by the legacy plugin will stay available, their response being reconstructed from the native cluster data. Users might want to migrate to the new [cluster:status](/core/2/api/controllers/cluster/status) native API route for a more detailed view of their cluster health.
