---
code: true
type: page
title: "0x08: cluster"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x08: cluster



### Subdomain: 0x0800: fatal

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| cluster.fatal.desync<br/><pre>0x08000001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Caught a desync error: %s. | Caught a synchronization inconsistency. Triggers a suicide from the node detecting it. |

---
