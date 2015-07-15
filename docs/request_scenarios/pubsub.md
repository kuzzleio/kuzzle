# Realtime Pub/Sub scenario

This page explain the scenario that is run while clients exchange realtime data with the [Publish/Subscribe pattern](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) through Kuzzle.

Note: Kuzzle uses 2 types of managing contents :
* persistent data.
* non persistent (or volatile) data.

At client side, the boolean value of the "_persist_" metadata is used to distinguish these 2 types of contents.

Internally, Kuzzle process do not use the same components to handle input data, according they are persistent or not.

This page describe the process for **non persistent** data. For the scenario about persistent data, please see [Writing persistent data to Kuzzle](write.md)

Remember the [Architecture overview](../architecture.md) and focus on the components involved by reading actions:
![pubsub_overview](../images/kuzzle_pubsub_scenario_overview.png)

## 1st step : subscribtion

The following diagram shows how a Websocket client and a MQ client subscribe to new filtered data.

![pubsub_scenario_details1](../images/kuzzle_pubsub_scenario_details1.png)

\#1a. The client application opens a Websocket connection and emit a "subscribe" event with the filters

(see [Filters](../filters.md) for more details about filters)
Sample data send: filter to any new user containing a field "hobby" named "computer":

```json
{
  "requestId": "ed4faaff-253a-464f-a6b3-387af9d8483d",
  "action": "on",
  "collection": "users",
  "filter": {
    "term": {"hobby": "computer" }
  }
}
```

\#1b. The client listens to the <requestId> event on the socket. The result of its request will be send to that event.

Sample JS code :

```javascript
  this.socket.once("ed4faaff-253a-464f-a6b3-387af9d8483d", function(response) {
    callback(response);
  });
```


\#2. The Websocket router handles the input request and transmit message to the Funnel Controller.

Sample message:

```json
{
  "controller": "subscribe",
  "collection": "users",
  "action": "on",
  "filter": {
    "term": {"hobby": "computer" }
  }
}
```

\#3. The Funnel Controller process validation before sending the request to the Subscribe Controller

\#4. The Subscribe Controller calculates the pub/sub room related to this filter, adds an internal reference to the client, and returns the roomId.

\#5. Callback functions are triggered to transmit the response message back to the Websocket Router

\#6. The Websocket Router emits a message to the client's RequestId with the subscribed room Id

Sample response content:

```json
{
  "error": null,
  "result": "891b0d98-7a2c-4c60-9edd-d3444ffe4a8e"
}
```

\#7. The Websocket client listen to the "roomId" event to be notified when new data according to its filters are send to Kuzzle.

\#8. => \#15. Same scenario for a MQ client. Subscribtion are send through a MQ broker like RabbitMQ.

## 2nd step : notify new contents to subscribing clients

According we have Websocket and/or MQ clients that have subscribed to some filters, the following diagram shows how a a new message is handled by Kuzzle :

![pubsub_scenario_details2](../images/kuzzle_pubsub_scenario_details2.png)

\#1. A client sends a new content to Kuzzle
(can be sent either through a HTTP request, a Websocket connecition or a MQ client - see [Reading scenarios](README.md#Reading-content-from-Kuzzle) to see differences btw these 3 protocols)

\#2. The router handles the input request and transmit message to the Funnel Controller.

Sample message: (**note that _persist = false_**)

```json
{
  "controller": "write",
  "collection": "users",
  "action": "create",
  "persist": false,
  "body": {
      "firstName": "Grace",
      "lastName": "Hopper",
      "age": 85,
      "location": {
        "lat": 32.692742,
        "lon": -97.114127
      },
      "city": "NYC",
      "hobby": "computer"
  }
}
```

\#3. The Funnel Controller process validation before sending the request to the Write Controller

\#4. The Write Controller sends a feedback to the client.

\#5. The Write Controller calculates the filtered rooms related to the input content and calls the internal "Notifier" component.

\#6. The "Notifier" component notifies the subscribing clients, either directly through Websocket, and/or via the MQ Broker.


## Related pages

* [Architecture overview](../architecture.md)
* [API Specifications](../api-specifications.md)
