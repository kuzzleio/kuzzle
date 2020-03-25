---
code: false
type: page
title: Signal Handling
order: 1000
---

# Signal Handling

Kuzzle handles certain Unix signals which fall into the following three categories:

- Abnormal termination
- Normal termination
- Dump report generation

## Abnormal termination

Unix signal names:

- `SIGQUIT`
- `SIGABRT`
- `SIGPIPE`

These signals are the result of a critical error and will force Kuzzle to shutdown.
When one of the aforementioned Unix signals is detected, Kuzzle will first generate a dump report and then shutdown.

## Normal termination

Unix signal names:

- `SIGTERM`
- `SIGINT`

These signals are the result of a request to terminate gracefully.
When one of the aforementioned Unix signals is detected, Kuzzle will refuse new requests, exit the cluster, finish the current request queue and then shutdown.

## Dump report

Unix signal names:

- `SIGTRAP`

When one of the aforementioned Unix signals is detected, Kuzzle will generate a dump report and continue to serve requests normally.
