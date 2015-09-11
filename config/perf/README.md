# Performance testing 

We choose Elasticsearch, Logstash and Kibana (ELK) for our performance test :

 1. [collecting](./collect.md) the logs from Kuzzle is done with Logstash,
 2. indexing the logs is done with Elasticsearch,
 3. [vizualization](./visualize.md) is done with Kibana (host http://localhost:5601).


You can refer to [collect](./collect.md) and [vizualize](./visualize.md) for more details about the process.
Indexing is done into the `elasticlogstash` container without any modification. See [docker-compose-perf.yml](../../docker-compose-perf.yml) if you want to replace or modify one of this three elements.

In this document we will explain how to launch the performance test, and how to add your own customs events.
To navigate and visualize into log informations with Kibana, see [vizualization](./visualize.md).

# Launch Kuzzle in performance mode

```js
 docker-compose -f docker-compose-perf.yml up
```

Again see [docker-compose-perf.yml](../../docker-compose-perf.yml) to manage hosts and corresponding dockers containers.
But thanks to Docker, you do not need any extra configurations.

# Data to send from my stress test

Suppose you launch differents tests ("write test, "filter test",...  ) several time in a day as an http request.
If you want to focus on a particular test for a particular time, or correlate a particular test with an other one, you must be able to identify them. To do so, a `testName` name and a `testStartDate` must be send into a `testingParam` variable.
As an example we add into all yours body request :

```javascript
   body.testingParam = {
      testName: "write some huge documents",
      testStartDate: startDate.getTime()
    };
```

All others global parameters relevants to the current test must be send into `testingParam`. As an example, suppose
you make some differents writing tests for documents with differents length. You can add : 

```javascript
    body.testingParam.nbChar = nbChar;
```

By the way all theses informations will be indexed, and you will be able to do some interesting correlations into Kibana with them.

# What kind of logs are already sent into Logstash ?

We has some focus on four actions type ("write","read","bulk" and "admin") over the three protocols ("rest","mq","websocket"). This is done by sending the events matching the regular expression :

`["write","read","bulk","admin"]:["rest","mq","websocket"]["start","stop"]`

For all the stop event (*:"stop") Kuzzle had a `duration` field. This elapsed time will be used for the performance
tests on the corresponding operation.

We also log some errors events :

 * ["write","bulk","admin"]funnel:reject....
 * ["filter","remsub",...]:error
 * ["websocket"]:["disconnect","error"]....


See [lib/api/perf.js](../../lib/api/perf.js) for an up-to-date list of log events.

# What kind of data is send on every log ?

Kuzzle send informations from his State as "kuzzleState" attribute (current nbRooms, current nbCustomers,...).
Kuzzle send also a lot of informations about the process in the processData attribute, (process id pid, group id gid, ...).

 * See [lib/services/logstash.js](../../lib/services/logstash.js) for additional informations about getProcessData.
 * See [lib/hooks/perf.js](../../lib/hooks/perf.js) for additional informations about getKuzzleState.

Every \[write,read,bulk,remsub,filter\]:\[stop\] event will send a message.object.duration time.

# How to add a new event ?

1. Add the hook `myhook` in the file [lib/api/perf.js](../../lib/api/perf.js)
2. emit your event somewhere in the Kuzzle code :

 `kuzzle.emit("myhook", myData);`
