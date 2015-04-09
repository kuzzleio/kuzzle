var
	// library for execute asynchronous methods
	async = require('async'),
	_ = require('lodash'),
	Router = require('router'),
	// For parse a request sent by user
	bodyParser = require('body-parser'),
	// For final step to respond to HTTP request
	finalhandler = require('finalhandler');


module.exports = function RouterController (kuzzle) {

	this.router = null;

	this.initRouterHttp = function () {

		this.router = new Router();

		// create and mount a new router for our API
		var api = new Router();
		this.router.use('/api/', api);

		// add a body parsing middleware to our API
		api.use(bodyParser.json());

		api.post('/article', function (request, response) {
			if (request.body) {

				var data = wrapObject(request.body, 'write', 'article', 'create');
				kuzzle.funnel.execute(data)
					.then(function onExecuteSuccess (result) {
						// Send response and close connection
						response.writeHead(200, {'Content-Type': 'application/json'});
						response.end(JSON.stringify({error: null, result: result}));
					})
					.catch(function onExecuteError (error) {
						response.writeHead(400, {'Content-Type': 'application/json'});
						response.end(JSON.stringify({error: error, result: null}));
					});
			}
			else {
				// Send response and close connection
				response.writeHead(400, {'Content-Type': 'application/json'});
				response.end(JSON.stringify({error: 'Empty data'}));
			}
		}.bind(this));

	};

	this.routeHttp = function (request, response) {
		this.router(request, response, finalhandler(request, response));
	};

	this.routeWebsocket = function (socket) {
		async.each(['write', 'read', 'subscribe'], function recordSocketListener (controller) {
			socket.on(controller, function (data){
				kuzzle.log.silly('Handle Websocket', controller, 'request');
				data = wrapObject(data, controller);
				kuzzle.funnel.execute(data);
			});
		});
	};
};

function wrapObject (data, controller, collection, action) {
	if (!data.content) {
		data = {content: data};
	}

	data.controller = controller;

	if (collection) {
		data.collection = collection;
	}

	if (action) {
		data.action = action;
	}

	return data;
}