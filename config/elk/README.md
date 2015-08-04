#Configuration for Elasticsearch Logstash and Kibana (ELK)

Logstash Elasticsearch and Kibana allow respectively to collect,index and visualize information about logs.

 1. Logstash recive the logs from Kuzzle,
 2. Elasticsearch index the logs,
 3. Kibana vizualise the logs (host http://localhost:5601).

See [docker-compose-perf.yml](../../docker-compose-perf.yml) to manage hosts and corresponding dockers containers.


#Kuzzle Configuration

```js
 docker-compose -f docker-compose-perf.yml up
 ```

#Logstash Configuration

Logstash is configured via [config/elk/logstash.conf](./logstash.conf).
You can : 

  * add a input (to federate log from other process like worker), 
  * filter the log (remove some fields, mutate them,...)
  * add an output.


See  [Logstash doc](https://www.elastic.co/guide/en/logstash/current/index.html) for more details.


#Kibana Configuration

Kibana is available at http://localhost:5601/

All the configuration process will be saved in elasticsearch, and so must be done once.

 * Choose the logstash-* index,
 * Clic on green button with a star to use it as default index,
 * Go to Settings-> Objects and choose Dashboards panel.
 * Clic Import button. Choose the file /config/elk/kibanadashboard.json

The dashboard panel, Searches and Visualizations must be populated. 
You can now go to Dashbord and load the "perf DashBoard".

##perf DashBoard

The first line of the dashboard is used as a control.
To navigate on your differnts tests, you can filter on test type, and on starting date.
To do so, first clic on "bench type" 



#Howto

## What kind of events are already sent to Logstash ?

Basically every data creation, deletion and update, every subscriptions produce a log.
We also log some starting and stopping services process from Kuzzle.
Here, some events aleady send by Kuzzle : 

 * date:\[create,update,delete\] 
 * \[write,read,bulk,remsub,filter\]:\[start,stop\]
 * websocket:disconnect....

    
See [lib/api/perf.js](../../lib/api/perf.js) for an up to date list of events.

## What kind of is send to every event for free  ?

We send informations about Kuzzle State as "kuzzleState" attribute (current nbRooms, current nbCustomers,...).
We also send a lot of informations about Kuzzle as a process in the processData attribute, (process id pid, group id gid, ...).

 * See [lib/services/logger.js](../../lib/services/logger.js) for additional informations about getProcessData.
 * See [lib/hooks/log.js](../../lib/hooks/log.js) for additional informations about getKuzzleState.

Every \[write,read,bulk,remsub,filter\]:\[stop\] event will send a duration time.

## How to add a new event ?

1. Add the hook "myhook" in file [lib/api/perf.js](../lib/api/perf.js)
2. emit your event somewhere in the Kuzzle code :

 kuzzle.emit("myhook", myData);

## How Kuzzle send an event to Logstash ?

Log are sent via http request, see [lib/services/logger.js](../lib/services/logger.js.).
