#Configuration

Every config from non mandatory services, like perf monitoring.

##Logstash.conf

[Logstash](https://www.elastic.co/products/logstash) allow you to manage all logs generated in a simple process input -> filter -> output. [Kibana](https://www.elastic.co/products/kibana) is used to explore and visualize the data.

### How to launch Kuzzle into perf mode :

 docker-compose -f docker-compose-perf.yml up

### What kind of events are already sent to Logstash ?

Basically every data creation, deletion update, every Subscriptions added and removed are logged.
We also log some starting and stopping services from Kuzzle.


See [lib/api/perf.js](../lib/api/perf.js)

### Is there any informations about Kuzzle send to every event for free  ?

Yes.

We send a lot of informations about Kuzzle has a process as "processData" attribute, (process id pid, group id gid, ...)

We also send informations about Kuzzle State as "kuzzleState" attribute (current nbRooms, current nbCustomers,...)



### How to add a new event  ?

1) Add the hook "myhook" in file [lib/api/perf.js](../lib/api/perf.js)

2) emit your event somewhere in the Kuzzle code :

 kuzzle.emit("myhook", myData);

### How Kuzzle send the event to Logstash ?

Log are sent via http request

See [lib/services/logger.js](../lib/services/logger.js)


### Where are my log ?

By default, all your logs belong to elasticlogstash.
Kibana is available by default to http://localhost:5601 for visualisation (see docker-compose-perf.yml for options).

If you want your log in a file and/or in tty, see section output from logstash.conf.

With file option, log are send to log_stash component in directory  :

 /var/log/logstash/kuzzle/...

### How to modify my log into Logstash ?

See [/logstash.conf](./logstash.conf)

The filter mutate has a lot of commented/documented filters.
See the doc from [Logstash](https://www.elastic.co/guide/en/logstash/current/index.html) for more details.
