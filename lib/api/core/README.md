# About the core/ directory

This directory contains Kuzzle core components: critical modules, server launchers, core libraries, and so on.


## servers.js
Starts the different servers used by clients to communicate with Kuzzle: HTTP, MQTT and WebSocket.

## hotelClerk.js
Manages the room subscription process, made either by clients or by Kuzzle itself.

## notifier.js
Critical module used by Kuzzle and its workers to send notifications to subscribed rooms.
