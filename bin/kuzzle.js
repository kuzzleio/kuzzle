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

// Run user command
program.parse(process.argv);