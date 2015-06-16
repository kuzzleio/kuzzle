# What is a worker ?

A worker is something that could be independent of the rest of Kuzzle and can be launch several times between several hosts.
Typically a worker can be a broker that listen on a special channel and do something when a message is received.

In a next release, Kuzzle could be launched without worker, and workers could be launched in a second times (Because Node.js is mono-thread, it looks like a good solution to launch worker and dependencies in other service) 

# Contributing

You can create your own worker and share it to the community with a PR ;). If you want to create a worker you have to create a function init().

Your worker will be automatically launched when Kuzzle will be started.