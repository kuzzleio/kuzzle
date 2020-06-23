---
code: true
type: page
title: kuzzle:state
---

# kuzzle:state

<SinceBadge version="2.3.0" />

These events allow to hook on Kuzzle startup sequence. 

# kuzzle:state:start

This event is triggered when Kuzzle begins its startup sequence.

# kuzzle:state:live

This event is triggered when Kuzzle has loaded every internal components but is not yet accepting user requests.

# kuzzle:state:ready

This event is triggered when Kuzzle is ready to accept incoming requests.
