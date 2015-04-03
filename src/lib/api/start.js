/**
 * Main file when you type kuzzle start command
 *
 * This script will run both HTTP and Websocket server
 * for listen requests and handle them
 */

var
	servers = require('./private/servers.js');


module.exports = function start (params) {

	this.workers.run(this);
	servers.initAll(this, params);

};