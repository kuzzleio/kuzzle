#!/usr/bin/env node

/**
 * This is the main entry when you type kuzzle start command
 *
 * If you want to run a Kuzzle instance using PM2,
 * take a look at the app-start.js file instead
 */
var program = require('commander');

// $ kuzzle start
program
  .command('start')
  .option('--port [port]', 'Kuzzle port number', parseInt)
  .option('--server', 'start an instance without workers')
  .option('--worker', 'spawn a single set of workers instead of starting a Kuzzle instance')
  .description('Start a Kuzzle instance')
  .action(require('./kuzzle-start'));


// $ kuzzle perf
program
  .command('perf')
  .option('-p, --port [port]', 'Kuzzle port number', parseInt)
  .description('Start a Kuzzle instance in performance recording mode')
  .action(require('./kuzzle-perf'));

// $ kuzzle enable <service>
program
  .command('enable')
  .description('Enable a service without reloading Kuzzle')
  .action(require('./kuzzle-enable'));

// $ kuzzle disable <service>
program
  .command('disable')
  .description('Disable a service without reloading Kuzzle')
  .action(require('./kuzzle-disable'));

// Run user command
program.parse(process.argv);