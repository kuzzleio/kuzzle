#!/usr/bin/env node

/**
 * This is the main entry when you type kuzzle start command
 *
 * If you want to run the kuzzle service with pm2,
 * take a look at the app-start.js file
 *
 */
var program = require('commander');


var cmd;

// $ kuzzle start
cmd = program.command('start');
cmd.option('--port [port]');
cmd.description('Run Kuzzle');
cmd.action(require('./kuzzle-start'));

cmd = program.command('perf');
cmd.option('--port [port]');
cmd.description('Run Kuzzle for testing performance');
cmd.action(require('./kuzzle-perf'));

// Run user command
program.parse(process.argv);