# How to contribute to Kuzzle

Here are a few rules and guidelines to follow if you want to contribute to Kuzzle and, more importantly, if you want to see your pull requests accepted by Kuzzle team.

## Coding style

We use most of the [NPM Coding Style](https://docs.npmjs.com/misc/coding-style) rules, except for these ones:

* Semicolons at the end of lines
* 'Comma first' rule is not followed

## Guidelines

* Prefer async/await or promises instead of callbacks as often as you can
  * Except for methods invoked before the funnel module: ALWAYS use callbacks there to prevent event loop saturation (i.e. mostly methods handling network connections) 
* Always add/update the corresponding unit and/or functional tests. We won't accept non-tested pull requests.
* [Documentation and comments are more important than code](http://queue.acm.org/detail.cfm?id=1053354): comment your code, use jsdoc for every new function, add or update markdown documentation if need be. We won't accept undocumented pull requests.
* Similar to the previous rule: documentation is important, but also is code readability. Write [self-describing code](https://en.wikipedia.org/wiki/Self-documenting).

## General rules and principles we'd like you to follow

* If you plan to add new features to Kuzzle, make sure that this is for a general improvement to benefit a majority of Kuzzle users. If not, consider making a plugin instead (check our [plugin documentation](https://docs.kuzzle.io/plugins/1))
* Follow the [KISS Principle](https://en.wikipedia.org/wiki/KISS_principle)
* Follow [The Boy Scout Rule](https://deviq.com/boy-scout-rule)

## Tools

For development only, we built a specific docker-compose file: `docker-compose.yml`. You can use it to profile, debug, test a variable on the fly, add breakpoints and so on, thanks to [chrome-devtools](https://developer.chrome.com/devtools).  
Check the logs at the start of Kuzzle using the development docker image to get the appropriate debug URL.

How to run the development stack (needs Docker 1.10+ and Docker Compose 1.8+):

```bash
# clone this repository
git clone git@github.com:kuzzleio/kuzzle.git
cd kuzzle

# start a kuzzle cluster with development tools enabled
docker-compose up
```

You can now access to the Kuzzle HTTP/WebSocket API through the following URL: `http://localhost:7512`.
This is the entrypoint for the loadbalancer: API requests are then forwarded to kuzzle individual kuzzle nodes (round-robin).

For development purposes, nodes can be accessed individually:

| Node no. | HTTP/WebSocket port | MQTT port | Chrome Inspect Port |
|:--------:|:-------------------:|:---------:|:-------------------:|
| 1 | 17510 | 1883 | 9229 |
| 2 | 17511 | 11883 | 9230 |
| 3 | 17512 | 11884 | 9231 |

Everytime a modification is detected in the source files, the nodes are automatically restarted.

### Kuzzle over SSL

[See our complete guide](https://docs.kuzzle.io/core/2/guides/essentials/ssl-support/)

The development stack include a endpoint to access Kuzzle API through SSL on port `7443`.  

The certificates are privately signed, using provided [CA certificate](docker/nginx/kuzzleCA.crt).  
Domains accepted:
- localhost
- *.kuzzle.loc

You'll need to import the CA certificate to your browser and possibly your system local authorities to make it verified.
Once done, your browser should not complain when reaching https://localhost:7443.  
The CA certificate is here: [docker/nginx/kuzzleCA.crt](docker/nginx/kuzzleCA.crt)

Using node.js, for instance when using the sdk, you'll need to pass the CA cert using the `NODE_EXTRA_CA_CERTS` environment variable:

```
NODE_EXTRA_CA_CERTS=/path/to/certificate/kuzzleCA.crt wscat -c wss://localhost:7443
```

## Create a plugin

See our [plugins documentation](https://docs.kuzzle.io/core/2/plugins/)

## Running Tests
   
### Using docker, with Kuzzle running in Docker

```bash
$ docker-compose up -d

# wait for Kuzzle stack to be up, and start the entire test suite (long)
$ npm run test

# To launch tests individually:

# linter: check that the code is properly written
$ npm run test:lint

# unit tests: test parts of the code individually
$ npm run test:unit

# functional tests: test Kuzzle's API behavior
$ npm run test:functional
```

