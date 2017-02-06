# How to contribute to Kuzzle

Here are a few rules and guidelines to follow if you want to contribute to Kuzzle and, more importantly, if you want to see your pull requests accepted by Kuzzle team.

## Coding style

We use most of the [NPM Coding Style](https://docs.npmjs.com/misc/coding-style) rules, except for these ones:

* Semicolons at the end of lines
* 'Comma first' rule is not followed

## Guidelines

* Use promises instead of callbacks as often as you can.
* If you add new functions, files or features to Kuzzle, then implements the corresponding unit and/or functional tests. We won't accept non-tested pull requests.
* [Documentation and comments are more important than code](http://queue.acm.org/detail.cfm?id=1053354): comment your code, use jsdoc for every new function, add or update markdown documentation if need be. We won't accept non-documented pull requests.
* Similar to the previous rule: documentation is important, but also is code readability. Write [self-describing code](https://en.wikipedia.org/wiki/Self-documenting).

## General rules and principles we'd like you to follow

* If you plan to add new features to Kuzzle, make sure that this is for a general improvement to benefit a majority of Kuzzle users. If not, consider making a plugin instead (check our [plugin documentation](http://docs.kuzzle.io/plugin-reference/))
* Follow the [KISS Principle](https://en.wikipedia.org/wiki/KISS_principle)
* Follow [The Boy Scout Rule](http://programmer.97things.oreilly.com/wiki/index.php/The_Boy_Scout_Rule)

## Tools

For development only, we built a specific docker-compose file: `docker-compose/dev.yml`. You can use it to profile, debug, test a variable on the fly, add breakpoints and so on, thanks to [chrome-devtools](https://developer.chrome.com/devtools).  
Check the logs at the start of Kuzzle using the development docker image to get the appropriate debug URL.
  
How to run the development stack (needs Docker 1.10+ and Docker Compose 1.8+):

```
docker-compose -f docker-compose/dev.yml up
```

You can now access to `http://localhost:7511` for the standard Kuzzle HTTP, WebSocket and Socket.io APIs

Everytime a modification is detected in the source files, the server is automatically restarted and a new debug URL is provided.

# Create a plugin

See our [plugins documentation](http://docs.kuzzle.io/plugin-reference/)
