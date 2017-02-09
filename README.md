[![Build Status](https://travis-ci.org/kuzzleio/kuzzle.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle) 
[![codecov.io](http://codecov.io/github/kuzzleio/kuzzle/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle?branch=master) 
[![Join the chat at https://gitter.im/kuzzleio/kuzzle](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/kuzzleio/kuzzle?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

![logo](http://kuzzle.io/themes/kuzzleio/images/kuzzle-logo-blue-500.png)

**A backend software, self-hostable and ready to use to power modern apps**

# Installation

## Using Docker

If you are running Docker and just want to get your own Kuzzle running, you can use the provided docker-compose file.

Prerequisites:

* [Docker](https://docs.docker.com/engine/installation/) (version >1.10.0)
* [Docker Compose](https://docs.docker.com/compose/install/) (version >1.8.0)

From Kuzzle's build repo:

    $ sudo sysctl -w vm.max_map_count=262144
    $ wget http://kuzzle.io/docker-compose.yml
    $ docker-compose up


## Manual install

Check our complete installation guide [here](http://docs.kuzzle.io/guide/#manually-on-linux)


# Using Kuzzle

To use Kuzzle, all you have to do is to download one of our SDKs and use it in your application. Simple as that!  
Check our complete [SDK Reference](http://docs.kuzzle.io/sdk-reference/) for further informations.

You can also interface with Kuzzle directly, using its [exposed API](http://docs.kuzzle.io/api-reference/)  

# Running Tests
   
### With a running Kuzzle inside a docker container

Because functional tests need a running Kuzzle environment, if you're using docker to run Kuzzle, then they can only be started from inside a Kuzzle container.

    $ docker exec -ti <kuzzle docker image> npm test

### Using docker, without any Kuzzle instance running

A docker-compose script is available to run tests on a non-running Kuzzle. This script will pop a Kuzzle stack using Docker, automatically run tests, and exit once done.

    $ docker-compose -f docker-compose/test.yml up

### With a manually installed and running Kuzzle

From the Kuzzle source directory, launch the following command line:

    $ npm test
    
# Contributing to Kuzzle

You're welcome to contribute to Kuzzle! To do so:

1. fork our Kuzzle repository and install default plugins:

```
$ git submodule init
$ git submodule update
```

2. Check our [contributing documentation](./CONTRIBUTING.md) to know about our coding and pull requests rules


# Full documentation

See [full documentation](http://docs.kuzzle.io/)

# License

Kuzzle is published under [Apache 2 License](LICENSE.md).
