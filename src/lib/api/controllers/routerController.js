var
	Router = require('router'),
	// For parse a request sent by user
	bodyParser = require('body-parser'),
	// For final step to respond to HTTP request
	finalhandler = require('finalhandler');


module.exports = function RouterController (kuzzle) {

	this.router = null;

	this.init = function () {

		this.router = new Router();

		// create and mount a new router for our API
		var api = new Router();
		this.router.use('/api/', api);

		// add a body parsing middleware to our API
		api.use(bodyParser.json());

		api.post('/', function (request, response) {
			if (request.body) {

				var result = kuzzle.funnel.execute(request.body);

				// Send response and close connection
				response.writeHead(200, {'Content-Type': 'application/json'});
				response.end(JSON.stringify({error: null, result: result}));
			}
			else {
				// Send response and close connection
				response.writeHead(400, {'Content-Type': 'application/json'});
				response.end(JSON.stringify({error: 'Empty data'}));
			}
		}.bind(this));

	};

	this.responseHttp = function (request, response) {
		this.router(request, response, finalhandler(request, response));
	};
};