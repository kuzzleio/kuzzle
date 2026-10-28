---
code: true
type: page
title: "0x08: cluster | API | Core "
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x08: cluster



### Subdomain: 0x0800: fatal

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| cluster.fatal.desync<br/><pre>0x08000001</pre>  | [InternalError](/core/2/api/errors/types#internalerror) <pre>(500)</pre> | Caught a desync error: %s. | Caught a synchronization inconsistency. Triggers a suicide from the node detecting it. |

---


### Subdomain: 0x0801: join

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| cluster.join.duplicate_ip<br/><pre>0x08010001</pre>  | [InternalError](/core/2/api/errors/types#internalerror) <pre>(500)</pre> | Another node shares the same IP address as this one (%s): %s. | Another node of the cluster has the same IP address as the one joining it. The joining node does not start. |
| cluster.join.full_state_unavailable<br/><pre>0x08010002</pre>  | [InternalError](/core/2/api/errors/types#internalerror) <pre>(500)</pre> | Could not connect to the discovered cluster nodes (network split detected). | None of the cluster nodes discovered could give the joining node the cluster state, twice in a row (network split). The joining node does not start. |
| cluster.join.timeout<br/><pre>0x08010003</pre>  | [InternalError](/core/2/api/errors/types#internalerror) <pre>(500)</pre> | Failed to join the cluster: timed out (joinTimeout: %sms). | The node did not join the cluster within the configured cluster.joinTimeout. It does not start. |

---
