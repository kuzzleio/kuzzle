# Reading content from Kuzzle - The Websocket way

This page explain the scenario that is run while a client is reading contents from Kuzzle through a Websocket connection.

By "reading", we mean any action that gets contents from persistent layer to give them to the client:
get a single content, count a collection, or search contents with advanced filters.

Remember the [Architecture overview](../architecture.md) and focus on the components involved by reading actions:
![read_scenario_websocket_overview](../images/kuzzle_read_scenario_websocket_overview.png)

The following diagram shows how request's data are exchanged between the client application, the different Kuzzle components, and the external services:

![read_scenario_websocket_details](../images/kuzzle_read_scenario_websocket_details.png)

\#1a. The client application opens a Websocket connection and emit a "read" event with the request

Sample data send: retrieve the document '739c26bc-7a09-469a-803d-623c4045b0cb' in the collection 'users':

```json
{
  "requestId": "ed4faaff-253a-464f-a6b3-387af9d8483d",
  "action": "get",
  "collection": "users",
  "_id": "739c26bc-7a09-469a-803d-623c4045b0cb"
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
  "controller": "read",
  "collection": "users",
  "action": "get",
  "_id": "739c26bc-7a09-469a-803d-623c4045b0cb"
}
```

\#3. The Funnel Controller process validation before sending the request to the Read Controller

\#4. The Read Controller calls the readEngine service

\#5. The readEngine service makes a HTTP Rest request to get the data from the data storage

Sample content retrieve from Elasticsearch:

```json
{
  "_index": "mainindex",
  "_type": "users",
  "_id": "739c26bc-7a09-469a-803d-623c4045b0cb",
  "_version": 1,
  "found": true,
  "_source": {
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

\#6. \#7. \#8. Callback functions are triggered to transmit the response message back to the Websocket Router

Sample content exchanged during callback excecution:

```json
{
  "data": {
    "_index": "mainindex",
    "_type": "users",
    "_id": "739c26bc-7a09-469a-803d-623c4045b0cb",
    "_version": 1,
    "found": true,
    "_source": {
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
}
```
\#9. The Websocket Router emits a message to the client's RequestId with the requested content

Sample response content:

```json
{
  "error": null,
  "result": {
    "_index": "mainindex",
    "_type": "users",
    "_id": "739c26bc-7a09-469a-803d-623c4045b0cb",
    "_version": 1,
    "found": true,
    "_source": {
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
}
```

## Related pages

* [Architecture overview](../architecture.md)
* [API Specifications](../api-specifications.md)
