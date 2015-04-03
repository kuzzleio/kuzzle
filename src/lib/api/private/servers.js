var
	http = require('http'),
	io = require('socket.io')(http),
	uuid = require('node-uuid');

module.exports = {

	initAll: function (kuzzle, params) {

		runHttpServer(kuzzle, params);
		runWebsocketServer(kuzzle, params);

	}

};

function runHttpServer (kuzzle, params) {

	var port = params.port || process.env.KUZZLE_PORT || 80;

	kuzzle.log.info('Launch http server on port', port);

	var server = http.createServer(function (request, response) {

		kuzzle.log.info('Handle HTTP request');

		// Get POST data
		var body = '';
		request.on('data', function (chunk) {
			body += chunk;
		});
		request.on('end', function () {
			var object = JSON.parse(body);

			// TODO: add validation logic -> object is valid ? + schema is valid ?
			object._id = uuid.v4();

			// Emit the main event
			kuzzle.log.verbose('emit event request:http');
			kuzzle.emit('request:http', object);

			// Send response and close connection
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(JSON.stringify({error: null, id: object._id}));
		});

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