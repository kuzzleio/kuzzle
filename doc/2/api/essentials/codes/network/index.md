---
code: true
type: page
title: "0x03: network"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x03: network



### Subdomain: 0x0301: http

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.http.request_too_large<br/><pre>0x03010001</pre> | [SizeLimitError](/core/2/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The size of the request exceeds the server configured limit |
| network.http.unexpected_error<br/><pre>0x03010002</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Caught an unexpected HTTP parsing error |
| network.http.too_many_encodings<br/><pre>0x03010003</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The number of encodings exceeds the server configured limit |
| network.http.unsupported_compression<br/><pre>0x03010004</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request has been compressed using an unsupported compression algorithm |
| network.http.compression_disabled<br/><pre>0x03010005</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The server has been configured to refuse compressed requests |
| network.http.unsupported_verb<br/><pre>0x03010006</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An HTTP request has been submitted using an unsupported verb |
| network.http.url_not_found<br/><pre>0x03010007</pre> | [NotFoundError](/core/2/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | API URL not found |
| network.http.unsupported_content<br/><pre>0x03010008</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The content described in the content-type header is not supported |
| network.http.unsupported_charset<br/><pre>0x03010009</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unsupported content charset |
| network.http.duplicate_url<br/><pre>0x0301000a</pre> | [InternalError](/core/2/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Triggered when an attempt is made to register a duplicate URL in the HTTP router |
| network.http.volatile_parse_failed<br/><pre>0x0301000b</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The x-kuzzle-volatile header received is not in JSON format |
| network.http.body_parse_failed<br/><pre>0x0301000c</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request body is not in JSON format |
| network.http.file_too_large<br/><pre>0x0301000d</pre> | [SizeLimitError](/core/2/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The submitted file exceeds the server configured limit |

---


### Subdomain: 0x0302: mqtt

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.mqtt.unexpected_error<br/><pre>0x03020001</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Caught an unexpected MQTT error |

---


### Subdomain: 0x0303: websocket

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.websocket.unexpected_error<br/><pre>0x03030001</pre> | [BadRequestError](/core/2/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Caught an unexpected WebSocket error |

---


### Subdomain: 0x0304: entrypoint

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.entrypoint.unexpected_event<br/><pre>0x03040001</pre> | [InternalError](/core/2/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Received an erroneous network event |
| network.entrypoint.invalid_port<br/><pre>0x03040002</pre> | [InternalError](/core/2/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid network port |
| network.entrypoint.shutting_down<br/><pre>0x03040003</pre> | [ServiceUnavailableError](/core/2/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | Request rejected because this instance is shutting down |

---
