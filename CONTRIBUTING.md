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

```bash
# clone this repository
git clone git@github.com:kuzzleio/kuzzle.git
cd kuzzle

# don't forget to retreive default plugins embeded in submodules
git submodule init
git submodule update

# start kuzzle with development tools enabled
docker-compose -f docker-compose/dev.yml up
```

You can now access to `http://localhost:7512` for the standard Kuzzle HTTP, WebSocket and Socket.io APIs

Everytime a modification is detected in the source files, the server is automatically restarted and a new debug URL is provided.

### Kuzzle over SSL

The development stack include a endpoint to access Kuzzle API through SSL on port `7443`.  

The certificates are privately signed, using provided [CA certificate](docker-compose/nginx/kuzzleCA.crt).  
Domains accepted:
- localhost
- *.kuzzle.loc

You'll need to import the CA certificate to your browser and possibly your system local authorities to make it verified.
Once done, your browser should not complain when reaching https://localhost:7443.  
The CA certificate is here: [docker-compose/nginx/kuzzleCA.crt](docker-compose/nginx/kuzzleCA.crt)

Using node.js, for instance when using the sdk, you'll need to pass the CA cert using the `NODE_EXTRA_CA_CERTS` environment variable:

```
NODE_EXTRA_CA_CERTS=/path/to/certificate/kuzzleCA.crt wscat -c wss://localhost:7443
```

## Create a plugin

See our [plugins documentation](http://docs.kuzzle.io/plugin-reference/)

## Running Tests
   
### With a running Kuzzle inside a docker container

Because functional tests need a running Kuzzle environment, if you're using docker to run Kuzzle, then they can only be started from inside a Kuzzle container.

    $ docker exec -ti <kuzzle docker image> npm test

### Using docker, without any Kuzzle instance running

A docker-compose script is available to run tests on a non-running Kuzzle. This script will pop a Kuzzle stack using Docker, automatically run tests, and exit once done.

    $ docker-compose -f docker-compose/test.yml up

### With a manually installed and running Kuzzle

From the Kuzzle source directory, launch the following command line:

    $ npm test
