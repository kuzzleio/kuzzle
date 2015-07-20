# Reading content from Kuzzle using REST

This page explains what happens when clients exchange data with Kuzzle, using the REST API.

By "reading", we mean any action involving getting content from the persistent layer: getting a single document, count documents, or search contents with advanced filters.

Remember the [Architecture overview](../architecture.md) and focus on the components involved by reading actions:
![read_scenario_http_overview](../images/kuzzle_read_scenario_http_overview.png)

The following diagram shows how request data is exchanged between the client application, the different Kuzzle components, and the external services:

![read_scenario_http_details](../images/kuzzle_read_scenario_http_details.png)

\#1. The REST client asks for a content using a HTTP GET Request

For instance, to retrieve the document '739c26bc-7a09-469a-803d-623c4045b0cb' in the collection 'users':
```GET http://kuzzle:7512/api/users/739c26bc-7a09-469a-803d-623c4045b0cb```

\#2. The HTTP router handles the input request and forward the message to the ```Funnel Controller```.

Sample message:

```json
{
  "controller": "read",
  "collection": "users",
  "action": "get",
  "_id": "739c26bc-7a09-469a-803d-623c4045b0cb"
}
```

\#3. The ```Funnel Controller``` validates the data before sending the request to the ```Read Controller```

\#4. The ```Read Controller``` calls the ```readEngine service```

\#5. The ```readEngine service``` performs an HTTP Rest request to get the data from the data storage

Sample content retrieval from Elasticsearch:

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

\#6. \#7. \#8. Callback functions are triggered to forward the response message back to the HTTP Router

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
\#9. The HTTP Router sends the response to the REST client.

Sample content:

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

## Related pages

* [Architecture overview](../architecture.md)
* [API Specifications](../api-specifications.md)
