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

  rm -rf /tmp/bash-promise/
  mkdir -p /tmp/bash-promise/
}

# Run a command in a subprocess
#
# Example: promise_run echo "Hello, world"
#
# {return} - Returns the promise ID
promise_run () {
  local command=$@

  local identifier=$promises
  local promise_dir=/tmp/bash-promise/$identifier
  local lockfile=$promise_dir/lock
  local pidfile=$promise_dir/pid
  local resolve=$promise_dir/resolve
  local reject=$promise_dir/reject

  test -d $promise_dir && rm -rf $promise_dir
  mkdir -p $promise_dir

  eval $command \
    && [[ $? -eq 0 ]] \
    && (test -f $resolve && eval "$(cat $resolve)" && touch $lockfile || touch $lockfile) \
    || ([[ $catch_mode = "strict" ]] && _promise_exit || test -f $reject && eval "$(cat $reject)" \
      && touch $lockfile || touch $lockfile) \
    &

  echo $! > $pidfile

  promises=$((promises+1))

  return $identifier
}

_promise_exit () {
  local parent_pid=$$

  for pidfile in $(find /tmp/bash-promise/ -name pid);
  do
    pid=$(cat $pidfile)
    pid_lines=$(ps $pid | wc -l)
    if [[ ! $pid_lines = "1" ]];
    then
      kill $pid
    fi
  done

  kill $parent_pid
}

promise_then () {
  local identifier=$?
  local command=$@

  local resolve=/tmp/bash-promise/$identifier/resolve

  echo "$command" > $resolve

  return $identifier
}

promise_catch () {
  local identifier=$?
  local command=$@

  local reject=/tmp/bash-promise/$identifier/reject

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
      test -f /tmp/bash-promise/$i/lock && resolved=$((resolved+1))
      i=$((i+1))
    done

    sleep 0.1
  done
}

# Wait for the last executed promise to be fulfilled
await_promise () {
  local lockfile=/tmp/bash-promise/$?/lock
  local resolved=0

  until [ $resolved -eq 1 ]
  do
    resolved=0

    test -f $lockfile && resolved=1

    sleep 0.1
  done
}
