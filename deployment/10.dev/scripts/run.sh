#!/bin/sh

npm install

# TODO: find a better way to wait for RabbitMQ
sleep 3
pm2 start app-start.js ${PM2_OPTIONS}
pm2 logs