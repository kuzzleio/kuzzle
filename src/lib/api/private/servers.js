var
	// For create the http server
	http = require('http'),
	// For create the websocket server
	io = require('socket.io')(http),
	// For routing REST call
	RouterController = require('../controllers/routerController');


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
	kuzzle.router.init();

	var server = http.createServer(function (request, response) {
		kuzzle.log.info('Handle HTTP request');
		kuzzle.router.responseHttp(request, response);
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