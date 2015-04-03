var
	captainsLog = require('captains-log'),
	config = require('../config'),
	EventEmitter = require('events').EventEmitter,
	util = require('util');

function Kuzzle () {

	this.log = captainsLog();
	this.config = config;

	// Add hooks
	require('../hooks')(this);
	this.workers = require('../workers');

	// Add methods
	this.start = require('./start');

}

// Add capability to listen/emit events for hooks
Kuzzle.prototype = new EventEmitter();

module.exports = Kuzzle;