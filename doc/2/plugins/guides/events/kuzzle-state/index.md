---
code: true
type: page
title: kuzzle:state
---

# kuzzle:state

<SinceBadge version="change-me" />

These events allows to hooks on Kuzzle startup sequence. They follow [Kubernetes probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).

# kuzzle:state:start

This event is triggered when Kuzzle begin it's startup sequence.

# kuzzle:state:live

This event is triggered when Kuzzle has loaded every internal components but it's not accepting incoming requests.

# kuzzle:state:ready

This event is triggered when Kuzzle is ready to accept incoming requests.
