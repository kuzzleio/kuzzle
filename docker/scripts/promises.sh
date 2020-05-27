#!/bin/sh

################################################################################
#
#      Bash Promise library
#      https://github.com/Aschen/bash-promises
#
################################################################################

# Init the promise library.
#
# {param} mode - Set to "strict" to terminate the program if a promise fail (like set -e)
init_promises () {
  catch_mode=$1

  promises=0
  rm -rf /tmp/promise_*
  rm -rf /tmp/resolve_*
  rm -rf /tmp/reject_*
}

# Run a command in a subprocess
#
# Example: promise_run echo "Hello, world"
#
# {return} - Returns the promise ID
promise_run () {
  local command=$@

  local identifier=$promises
  local lockfile=/tmp/promise_$identifier
  local resolve=/tmp/resolve_$identifier
  local reject=/tmp/reject_$identifier

  test -f $lockfile && rm $lockfile
  eval $command \
    && [[ $? -eq 0 ]] \
    && (test -f $resolve && eval "$(cat $resolve)" && touch $lockfile || touch $lockfile) \
    || (test -f $reject && eval "$(cat $reject)" && touch $lockfile || touch $lockfile) \
    &

  promises=$((promises+1))

  return $identifier
}

promise_then () {
  local identifier=$?
  local command=$@

  local resolve=/tmp/resolve_$identifier

  echo "$command" > $resolve

  return $identifier
}

promise_catch () {
  local identifier=$?
  local command=$@

  local reject=/tmp/reject_$identifier

  echo "$command" > $reject

  return $identifier
}

# Wait for every current promises to be fulfilled
await_promises () {
  local resolved=0

  until [ $resolved -eq $promises ]
  do
    resolved=0

    i=0
    while [ $i -ne $promises ]
    do
      test -f /tmp/promise_$i && resolved=$((resolved+1))
      i=$((i+1))
    done

    sleep 0.1
  done
}

# Wait for the last executed promise to be fulfilled
await_promise () {
  local lockfile=/tmp/promise_$?
  local resolved=0

  until [ $resolved -eq 1 ]
  do
    resolved=0

    test -f $lockfile && resolved=1

    sleep 0.1
  done
}
