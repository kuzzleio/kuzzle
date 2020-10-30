---
code: false
type: page
title: API
description: Discover Kuzzle API usage and formats  
order: 100
---

# API

Kuzzle exposes most of its features through a **multi-protocol API**.  

This API uses the **JSON format** to communicate with a **standardized request and response format**.

## Multi Protocol

The Kuzzle API is accessible by default through 3 protocols:
 - [HTTP](/core/2/api/api-protocols/1-http)
 - [WebSocket]((/core/2/api/api-protocols/2-websocket))
 - [MQTT](/core/2/api/api-protocols/3-mqtt)

Each protocol has advantages and disadvantages. The choice of a protocol must therefore be adapted to a situation and a use.

::: info
Kuzzle is able to integrate to its API any protocol operating on [IP](https://en.wikipedia.org/wiki/Internet_Protocol).  
More info on [Writing Protocol Plugin](/core/2/guides/write-plugins/4-network-protocol).  
:::
