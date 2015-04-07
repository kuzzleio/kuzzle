var
	// For create the http server
	http = require('http'),
	// For create the websocket server
	io = require('socket.io')(http),
	// For create the unique id of the object that the use send
	uuid = require('node-uuid'),
	// For routing REST call
	Router = require('router'),
	// For parse a request sent by user
	bodyParser = require('body-parser'),
	// For final step to respond to HTTP request
	finalhandler = require('finalhandler');


module.exports = {

	initAll: function (kuzzle, params) {


		runHttpServer(kuzzle, params);
		runWebsocketServer(kuzzle, params);

	}

};

function runHttpServer (kuzzle, params) {

	var port = params.port || process.env.KUZZLE_PORT || 80;

	kuzzle.log.info('Launch http server on port', port);

	// initialize the router & server and add a final callback.
	var router = new Router();
	var server = http.createServer(function (request, response) {

		kuzzle.log.info('Handle HTTP request');
		router(request, response, finalhandler(request, response));
	});

	// create and mount a new router for our API
	var api = new Router();
	router.use('/api/', api);

	// add a body parsing middleware to our API
	api.use(bodyParser.json());

	api.post('/', function (request, response) {
		if (request.body) {
			var object = request.body;

			// TODO: add validation logic -> object is valid ? + schema is valid ?
			object._id = uuid.v4();

			// Emit the main event
			kuzzle.log.verbose('emit event request:http');
			kuzzle.emit('request:http', object);

			// Send response and close connection
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(JSON.stringify({error: null, id: object._id}));
		}
		else {
			// Send response and close connection
			response.writeHead(400, {'Content-Type': 'application/json'});
			response.end(JSON.stringify({error: 'Empty data'}));
		}
	});

	server.listen(port);
}

function runWebsocketServer (kuzzle, params) {

	kuzzle.log.info('Launch websocket server');

	io.on('connection', function(socket){
		socket.on('*', function(data){
			kuzzle.log.info('Handle Websocket request');
		});
	}.bind(this));

}