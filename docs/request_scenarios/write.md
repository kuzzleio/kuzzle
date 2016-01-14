# Writing persistent data into Kuzzle

This page explains what happens when clients send new content to Kuzzle

Kuzzle is able to manage two different types of data:
* persistent data
* volatile/realtime data

The client decide if a data is persistent or volatile using the "_persist_" metadata (true/false).

Kuzzle handles data differently, depending if it's persistent or not.


This page describes the process for **persistent** data. If you wish to learn about how Kuzzle handles volatile data, please read [Pub/Sub scenario for realtime data](pubsub.md)

Remember the [Architecture overview](../architecture.md).

Kuzzle persistent data writing is a 3-steps process:

## 1st step: Send a Write request to a task queue

Involved components overview:

![persistence_overview1](../images/kuzzle_persistence_scenario_overview1.png)

Detailed workflow:

![persistence_scenario_details1](../images/kuzzle_persistence_scenario_details1.png)

\#1. A client sends new content to Kuzzle, either with an HTTP request, through a websocket connection or using a MQ client (see [Reading scenarios](README.md#Reading-content-from-Kuzzle))

\#2a. The router handles the input request and forward the message to the ```Funnel Controller```

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

\#3. The ```Funnel Controller``` validates the message and forward the request to the ```Write Controller```

\#4. The ```Write Controller``` triggers the ```Plugins Manager``` with a "data:create" event.<br/>
The ```Plugins Manager``` calls all pipes and hooks configured by the active plugins (see [Plugin's documentation](../plugins.md)), and finally trigger the "add" event of the ```Write Hook```.<br/>
The ```Write Hook``` sends the request to the ```Internal Broker```. (see [Hooks Readme](../../lib/hooks/README.md) for more details about hooks).

\#5. The ```Write Controller``` asks the ```Worker Listener``` to listen to the ```Internal Broker```'s feedback message.

That way Kuzzle parallelizes the processing of writing contents.

## 2nd step: Save content into the storage engine

Involved components overview:

![persistence_overview2](../images/kuzzle_persistence_scenario_overview2.png)

Detailed workflow:

![persistence_scenario_details2](../images/kuzzle_persistence_scenario_details2.png)

\#6. A ```Write Worker``` is notified by the internal broker about a new write request.

\#7. The worker calls the ```Write Engine``` service.

\#8. The ```Write Engine``` service performs an HTTP Rest request to send the data to the data storage.

\#9. Callback functions are triggered to transmit the response message back to the ```Write Worker```

\#10. The worker sends the feedback message from ElasticSearch to the input task queue (see \#5b).

\#11. The worker also sends a notification message to the internal broker, to notify subscribing clients, if any (see [Pub/Sub scenario for realtime data](pubsub.md)).

## 3rd step: Send feedback

Involved components overview:

![persistence_overview3](../images/kuzzle_persistence_scenario_overview3.png)

Detailed workflow:

![persistence_scenario_details3](../images/kuzzle_persistence_scenario_details3.png)

\#12. The ```Worker Listener``` that the ```Write Controller``` registered in step 5a. receive a notification from the ```Internal Broker```...

\#13. ... and forward it back to the ```Router Controller```...

\#14. ... which sends a feedback to the client.


## Related pages

* [Architecture overview](../architecture.md)
* [API Specifications](../api-specifications.md)
