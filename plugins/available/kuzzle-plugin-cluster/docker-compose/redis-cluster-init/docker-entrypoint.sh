#!/bin/sh

args=""
for server in $(host redis | grep address | awk '{ print $4 }'); do
  args="${args} ${server}:6379"
done

sleep 5
echo "yes" | redis-cli --cluster create $args --cluster-replicas 0
