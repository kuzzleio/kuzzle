# How to contribute to Kuzzle

Here are a few rules and guidelines to follow if you want to contribute to Kuzzle and, more importantly, if you want to see your pull requests accepted by Kuzzle team.

## Coding style

We use most of the [NPM Coding Style](https://www.w3resource.com/npm/npm-coding-style.php) rules, except for these ones:

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
* Follow [The Boy Scout Rule](https://deviq.com/principles/boy-scout-rule)

## Tools

For development only, we built a specific Docker Compose file: `docker-compose.yml`. You can use it to profile, debug, test a variable on the fly, add breakpoints and so on, thanks to [chrome-devtools](https://developer.chrome.com/devtools).  
Check the logs at the start of Kuzzle using the development docker image to get the appropriate debug URL.

How to run the development stack (needs Docker 1.10+ and Docker Compose 1.8+):

```bash
# clone this repository
git clone git@github.com:kuzzleio/kuzzle.git
cd kuzzle

# Start a kuzzle cluster with development tools enabled
# This will start a kuzzle with Elasticsearch 7
docker compose -f docker-compose.yml up

# Start a kuzzle cluster with development tools enabled
# This will start a kuzzle with Elasticsearch 8
# See [docker-compose.override.yml](docker-compose.override.yml) for more details
docker compose up
```

⚠️ **Important**: The two docker-compose command launch launch different configurations.

## ENOSPC error

On some Linux environments, you may get `ENOSPC` errors from the filesystem watcher, because of limits set too low.

If that happens, simply raise the limits on the number of files that can be watched:

`sudo sysctl -w fs.inotify.max_user_watches=524288`

That configuration change will last until the next reboot. 

To make it permanent, add the following line to your `/etc/sysctl.conf` file:

```
fs.inotify.max_user_watches=524288
```

You can now access the Kuzzle HTTP/WebSocket API through the following URL: `http://localhost:7512`.
This is the entrypoint for the loadbalancer: API requests are then forwarded to kuzzle individual kuzzle nodes (round-robin).

For development purposes, nodes can be accessed individually:

| Node no. | HTTP/WebSocket port | MQTT port | Chrome Inspect Port |
|:--------:|:-------------------:|:---------:|:-------------------:|
| 1 | 17510 | 1883 | 9229 |
| 2 | 17511 | 11883 | 9230 |
| 3 | 17512 | 11884 | 9231 |

Everytime a modification is detected in the source files, the nodes are automatically restarted.

### Kuzzle over SSL

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


## About Mac M1

First of all make sure that you have at least `4GB` of ram allocated to your vm **docker desktop** and that it is running.

Run the following command to install all the dependencies in your container:
```bash
docker compose run kuzzle_node_1 npm ci
```

Finally, run the command `docker compose up` to start your Kuzzle stack.


## Launching tests suits

### Unit tests

```bash
npm run test:unit
```

### Functional tests

```bash
KUZZLE_FUNCTIONAL_TESTS="test:functional:websocket" ES_VERSION=8 ./.ci/scripts/run-test-cluster.sh
```
