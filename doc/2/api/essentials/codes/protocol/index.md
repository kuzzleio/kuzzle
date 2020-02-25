---
code: true
type: page
title: "0x06: protocol"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x06: protocol



### Subdomain: 0x0601: runtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| protocol.runtime.invalid_connection<br/><pre>0x06010001</pre> | [PluginImplementationError](/core/2/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Connection objects must have both their id and protocol set |
| protocol.runtime.unknown_connection<br/><pre>0x06010002</pre> | [PluginImplementationError](/core/2/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The provided connection identifier is unknown |
| protocol.runtime.already_exists<br/><pre>0x06010003</pre> | [PluginImplementationError](/core/2/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A protocol of the same name already exists |

---
