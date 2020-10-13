/*
 * For development purposes only: this script is meant to be run on top
 * of a Kuzzle starter script. It watches source files (json, ts, js) from
 * Kuzzle core, plugins, configuration files.
 * When a file changes, it automatically shuts the current process down, WAIT
 * until it has correctly been stopped (or kills it after some delay), and only
 * then restarts it.
 *
 * This script is meant to replace solutions like nodemon, which have a few
 * cumbersome caveats.
 *
 * Usage: node reloader.js <config file> <node args> <starter script> <args>
 *
 * With:
 *   - <config file>: this script configuration file
 *   - <node args>: arguments to pass to the node interpreter
 *   - <starter script>: the script to execute using node
 *   - <args>: script arguments
 */

/* eslint-disable no-console */

'use strict';

const path = require('path');
const { fork } = require('child_process');

const chokidar = require('chokidar');
const clc = require('cli-color');

const config = {
  cwd: '/var/app',
  killDelay: 5000,
  watch: [
    'lib',
    'plugins',
    'node_modules',
    'index.*s',
    'docker/scripts/*.ts',
  ],
};

const stateEnum = Object.freeze({
  RUNNING: 1,
  STOPPED: 2,
  STOPPING: 3,
});

const { nodeArgs, script, scriptArgs } = parseArgs();

let childProcess;
let state = stateEnum.STOPPED;

function parseArgs () {
  const args = process.argv.slice(2);
  const idx = args.findIndex(arg => arg.endsWith('.js') || arg.endsWith('.ts'));

  return {
    nodeArgs: args.slice(0, idx),
    script: args[idx],
    scriptArgs: args.slice(idx + 1),
  };
}

function startProcess () {
  childProcess = fork(script, scriptArgs, {
    detached: true,
    execArgv: nodeArgs,
  });

  childProcess.on('exit', (code, signal) => {
    const msg = code !== null
      ? `code ${code}`
      : `signal ${signal}`;

    console.log(clc.red(`[RELOADER] Process exited with ${msg}. Waiting for a file change to restart it.`));
    childProcess = null;
    state = stateEnum.STOPPED;
  });

  state = stateEnum.RUNNING;
}

async function stopProcess () {
  if (state !== stateEnum.RUNNING) {
    return;
  }

  state = stateEnum.STOPPING;

  childProcess.removeAllListeners();

  let exited = false;

  childProcess.on('exit', () => {
    exited = true;
  });

  childProcess.kill();

  // Wait for config.killDelay for the process to stop itself, after that: kill it
  const now = Date.now();
  let forced = false;

  while (!exited) {
    await new Promise(resolve => setTimeout(resolve, 200));

    if (!forced && (Date.now() - now) > config.killDelay) {
      console.log(clc.red(`[RELOADER] Process still here after ${config.killDelay}ms. Sending a SIGKILL signal`));
      childProcess.kill('SIGKILL');
      forced = true;
    }
  }

  state = stateEnum.STOPPED;
}

const watcher = chokidar.watch(script);
watcher.add(config.watch.map(dir => path.join(config.cwd, dir)));

watcher.on('change', async file => {
  if (state === stateEnum.RUNNING) {
    console.log(clc.green(`[RELOADER] Change detected on ${path.relative(config.cwd, file)}. Reloading...`));
    await stopProcess();
    startProcess();
  }
});

startProcess();
