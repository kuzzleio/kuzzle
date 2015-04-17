#!/bin/sh

npm install

# TODO: find a better way to wait for RabbitMQ
sleep 3
node-debug --web-host 0.0.0.0 app-start.js