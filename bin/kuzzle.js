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

// $ kuzzle install
program
  .command('install')
  .description('Install plugin dependencies')
  .action(require('./kuzzle-install'));

// $ kuzzle firstAdmin
program
  .command('firstAdmin')
  .description('Create the first administrator')
  .action(require('./kuzzle-firstAdmin'));

// Run user command
program.parse(process.argv);