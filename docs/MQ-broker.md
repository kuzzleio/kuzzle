# MQ Broker

You can communicate with Kuzzle in AMQP, MQTT and STOMP by enabling MQ Broker. Internally, we use [Rabbit MQ](https://www.rabbitmq.com/) for communicate with external world in these protocols.  

## Enable MQ Broker with docker and docker-compose

In order to run a Rabbit container, if you use docker and docker-compose you have to add these lines in your own docker-compose.yml :

```
rabbit:
  image: kuzzleio/rabbitmq
  ports:
    - "61613:61613"
    - "1883:1883"
    - "5672:5672"
    - "15672:15672"
```

And add an environment variable and link in main Kuzzle container:

```
kuzzle:
  image: kuzzleio/kuzzle
  ports:
    - "7512:7512"
  links:
    - rabbit
    - elasticsearch
    - redis
  environment:
    - MQ_BROKER_ENABLED=1
```

The file docker-compose-test.yml already contains all dependencies for launch Rabbit, you can have a look for a great example.

## Enable without Docker

You can enable Kuzzle MQ Broker service by set environment variable MQ_BROKER_ENABLED to 1 and by configuring the file `.kuzzlerc` for set your Rabbit host and port:

```json
[...]
"mqBroker": {
  "host" : "localhost",
  "port": 5672
}
[...]
```