---
code: true
type: page
title: kuzzle:state
---

# kuzzle:state

<SinceBadge version="change-me" />

These events allow to hook on Kuzzle startup sequence. 

# kuzzle:state:start

This event is triggered when Kuzzle begin it's startup sequence.

# kuzzle:state:live

This event is triggered when Kuzzle has loaded every internal components but it's not accepting incoming requests.

# kuzzle:state:ready

This event is triggered when Kuzzle is ready to accept incoming requests.
