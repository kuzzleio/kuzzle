
#Logstash Configuration

Logstash configuration is in three steps :

 * define some inputs into the input fields (logs come from sdtin, http request, file writing,...)
 * eventuallly add some filters for change logs (normalisation process, remove irrelevant data, ...)
 * define the output (stdout, elasticsearch, ...)

Our Logstash is configured via [logstash.conf](./logstash.conf).

As input, we use the file `/var/log/perf.log` from the container `kuzzle`, it will be shared into the `logstash` container.
We do not use any filter, and our output is an Elasticsearch `elasticlogstash` (see [docker-compose/perf.yml](../../docker-compose/perf.yml) for details).

See [Logstash doc](https://www.elastic.co/guide/en/logstash/current/index.html) for more details if you want to :

  * add an input (to federate log from other process like worker),
  * filter the log (remove, mutate some fields,...),
  * add an output.
