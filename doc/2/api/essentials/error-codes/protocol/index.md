---
code: true
type: page
title: "0x06: protocol"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x06: protocol



### Subdomain: 0x0601: runtime

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| protocol.runtime.invalid_connection<br/><pre>0x06010001</pre>  | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Invalid connection: %s (missing id or protocol) | Connection objects must have both their id and protocol set |
| protocol.runtime.unknown_connection<br/><pre>0x06010002</pre>  | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Unable to remove connection - unknown connection identifier: %s | The provided connection identifier is unknown |
| protocol.runtime.already_exists<br/><pre>0x06010003</pre>  | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A protocol of the same name already exists: %s | A protocol of the same name already exists |

---
