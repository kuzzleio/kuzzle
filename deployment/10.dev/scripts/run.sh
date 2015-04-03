#!/bin/sh

npm install

pm2 start app-start.js ${PM2_OPTIONS}
pm2 logs