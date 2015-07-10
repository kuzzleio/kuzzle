#Functional testing

Tests features using [cucumber.js](https://cucumber.io/docs/reference/javascript).

It is recommended to launch these tests from within a Kuzzle docker container, to avoid the hassle of installing all the needed dependencies.

See the [Getting Started](../README.md) documentation for more information about installing Kuzzle.

## Running Functional Tests

    $ npm run functional-testing

If your Kuzzle instance use a different configuration than the default one, you can make these tests point at other locations.

**REST and WebSocket API**

    $ KUZZLE_URL=http://host:port npm run functional-testing

**MQTT API**

    $ KUZZLE_MQTT_URL=mqtt://host:port npm run functional-testing

**AMQP API**

    $ KUZZLE_AMQP_URL=amqp://host:port npm run functional-testing
