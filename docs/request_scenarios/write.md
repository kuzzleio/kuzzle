# Writing persistent data to Kuzzle

This page explain the scenario that is run while a client send a new content to Kuzzle

Note: Kuzzle uses 2 types of managing contents:
* persistent data.
* non persistent (or volatile) data.

At client side, the boolean value of the "_persist_" metadata is used to distinguish these 2 types of contents.

Internally, Kuzzle process do not use the same components to handle input data, according they are persistent or not.

This page describe the process for **persistent** data. For the scenario about volatile data, please see [Pub/Sub scenario for realtime data](pubsub.md)

Remember the [Architecture overview](../architecture.md).

The process is broken down into 3 steps

## 1st step: Send a Writing request to a task queue

Overview of components involved:

![persistence_overview1](../images/kuzzle_persistence_scenario_overview1.png)

Detailed description of the scenario:

![persistence_scenario_details1](../images/kuzzle_persistence_scenario_details1.png)

\#1. A client sends a new content to Kuzzle
(can be sent either through a HTTP request, a Websocket connecition or a MQ client - see [Reading scenarios](README.md#Reading-content-from-Kuzzle) to see differences btw these 3 protocols)

\#2a. The router handles the input request and transmit message to the Funnel Controller

Sample message: (**note that _persist = true_**)

```json
{
  "controller": "write",
  "collection": "users",
  "action": "create",
  "persist": true,
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

\#2b. The router listens to a tasq queue in the MQ broker and waits for the response.

\#3. The Funnel Controller process validation before sending the request to the Write Controller

\#4. \#5. The Write Hook intercepts the request and sends it to the MQ broker. (see [Hooks Readme](../../lib/hooks/README.md) for more details about hooks)

That way Kuzzle can parallelize the treatment of writing requests, while many kuzzle instances can receive and handle the writing message.

## 2nd step: Save content into storage engine

Overview of components involved:

![persistence_overview2](../images/kuzzle_persistence_scenario_overview2.png)

Detailed description of the scenario:

![persistence_scenario_details2](../images/kuzzle_persistence_scenario_details2.png)

\#6. A Write Worker is notified by the MQ broker about a new write request.

\#7. The worker calls the writeEngine service

\#8. The writeEngine service makes a HTTP Rest request to post the data to the data storage

\#9. Callback functions are triggered to transmit the response message back to the Write Worker

\#10. The worker sends the feedback message from ElasticSearch to the input task queue (see \#2b).

\#11. The worker sends also a notification message to the MQ broker, to notify subscribing clients (see step 3 below).

## 3rd step: Send feedback and notity pub/sub clients

Overview of components involved:

![persistence_overview3](../images/kuzzle_persistence_scenario_overview3.png)

Detailed description of the scenario:

![persistence_scenario_details3](../images/kuzzle_persistence_scenario_details3.png)

_(According we have, for example, a MQ client that have already subscribed to a filter related to new content -
see [Pub/Sub scenario for realtime data](pubsub.md) for more details about subscribtions)._

\#12. The Write Controller is notified by the MQ broker about a feedback message for its current request...

\#13. ... and send the feedback to the client.

\#14. The internal Notifier component is notified by the MQ broker about the new content.

\#15. The Notifier component calculates the filtered rooms related to the content, and callls the Notification Cache service to store the relation content/roomId

\#16. The "Notifier" component notifies the subscribing clients, either directly through Websocket, and/or via the MQ Broker.


## Related pages

* [Architecture overview](../architecture.md)
* [API Specifications](../api-specifications.md)
