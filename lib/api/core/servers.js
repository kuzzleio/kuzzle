var
  http = require('http');


module.exports = {
  initAll: function (kuzzle, params) {
    var server = runHttpServer(kuzzle, params);
    runWebsocketServer(server, kuzzle, params);
    runMQListener(kuzzle, params);
  }
};

/**
 * Run a HTTP server and will use the router object to handle incoming requests
 * @param kuzzle
 * @param params
 */
function runHttpServer (kuzzle, params) {
  var port = process.env.KUZZLE_PORT || params.port || 7512;

  kuzzle.log.info('Starting: HTTP server on port', port);

  kuzzle.router.initRouterHttp();

  var server = http.createServer(function (request, response) {
    kuzzle.router.routeHttp(request, response);
  });

  server.listen(port);

  return server;
}

/**
 * Run a websocket server forwarding requests to the router controller
 * @param server
 * @param kuzzle
 */
function runWebsocketServer (server, kuzzle) {
  kuzzle.io = require('socket.io')(server);

  kuzzle.io.set('origins', '*:*');

  kuzzle.log.info('Starting: WebSocket server');
  kuzzle.io.on('connection', function (socket) {
    kuzzle.router.routeWebsocket(socket);
  });
}

/**
 * Asks the router controller to start listening to messages coming from RabbitMQ
 * @param kuzzle
 */
function runMQListener (kuzzle) {
  kuzzle.log.info('Starting: MQ listener');
  kuzzle.router.routeMQListener();
}