var
	captainsLog = require('captains-log'),
	// Load all configuration files (database, brokers...)
	config = require('../config'),
	// Used for emit/listen event
	EventEmitter = require('events').EventEmitter;

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