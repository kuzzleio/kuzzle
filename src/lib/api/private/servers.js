var
	// For create the http server
	http = require('http'),
	// For create the websocket server
	io;


module.exports = {

	initAll: function (kuzzle, params) {
		var server = runHttpServer(kuzzle, params);
		runWebsocketServer(server, kuzzle, params);
	}

};

function runHttpServer (kuzzle, params) {

	var port = params.port || process.env.KUZZLE_PORT || 80;

	kuzzle.log.info('Launch http server on port', port);

	// initialize the router & server and add a final callback.
	kuzzle.router.init();

	var server = http.createServer(function (request, response) {
		kuzzle.log.silly('Handle HTTP request');
		kuzzle.router.responseHttp(request, response);
	});

	server.listen(port);

	return server;
}

function runWebsocketServer (server, kuzzle, params) {

	io = require('socket.io')(server);

	kuzzle.log.info('Launch websocket server');

	io.on('connection', function(socket){
		socket.on('entrypoint', function(data){
			kuzzle.log.silly('Handle Websocket request');
			kuzzle.funnel.execute(data);
		});
	});

}