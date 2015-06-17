# What is a hook ?

Hooks are listen on a special event on object kuzzle and perform action when he event is triggered according to a configuration in /config/hooks.js

Example:

* When the event "data:create" is emitted by kuzzle, the function add in hook write will be executed (for write a message in broker).


# Contributing

You can create your own hook and share it to the community with a PR ;). If you want to create a hook you have to create a function init().

Your hook will be automatically called if you add your hook with event in /config/hooks.js.