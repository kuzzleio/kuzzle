#!/bin/sh

elastic=${READ_ENGINE_HOST:-elasticsearch:9200}
rabbit=${MQ_BROKER_HOST:-rabbit}
rabbitPort=${MQ_BROKER_PORT:-5672}

npm install

while ! curl -silent -output /dev/null http://$elastic > /dev/null
do
 echo "$(date) - still trying connecting to http://$elastic"
  sleep 1
done
echo "$(date) - connected successfully to ElasticSearch"

while ! nmap -p $rabbitPort $rabbit
do
  echo "$(date) - still trying connecting to http://$rabbit:$rabbitPort"
  sleep 1
done
echo "$(date) - connected successfully to RabbitMQ"

echo "Starting Kuzzle..."

node bin/kuzzle install && pm2 start /config/pm2-dev.json

nohup node-inspector --web-port=8080 --debug-port=7000 > /dev/null 2>&1&
nohup node-inspector --web-port=8081 --debug-port=7001 > /dev/null 2>&1&
pm2 sendSignal -s SIGUSR1 KuzzleServer
pm2 sendSignal -s SIGUSR1 KuzzleWorker

pm2 logs

