var
  http = require('http');


module.exports = {
  initAll: function (kuzzle, params) {
    runHttpServer(kuzzle, params);
    runMQListener(kuzzle, params);
  }
};

/**
 * Run a HTTP server and will use the router object to handle incoming requests
 * @param kuzzle
 * @param params
 */
function runHttpServer (kuzzle, params) {
  var
    port = process.env.KUZZLE_PORT || params.port || 7512,
    server;

  kuzzle.router.initRouterHttp();

  server = http.createServer(function (request, response) {
    kuzzle.router.routeHttp(request, response);
  });
  server.listen(port);

  kuzzle.pluginsManager.trigger('server:httpStarted', 'Starting: HTTP server on port ' + port);

  return server;
}

/**
 * Asks the router controller to start listening to messages coming from RabbitMQ
 * @param kuzzle
 */
function runMQListener (kuzzle) {
  kuzzle.router.routeMQListener();

  kuzzle.pluginsManager.trigger('server:mqStarted', 'Starting: MQ listener');
}