#!/bin/sh

timeout 15 docker exec haproxy sh -c '
  if [ -f /var/run/haproxy.pid ]; then
    haproxy -D -f /usr/local/etc/haproxy/haproxy.cfg -p /var/run/haproxy.pid -st $(cat /var/run/haproxy.pid)
  else
    haproxy -D -f /usr/local/etc/haproxy/haproxy.cfg -p /var/run/haproxy.pid
  fi
  ' || true
