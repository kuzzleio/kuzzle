var
  http = require('http');

/**
 * Run a HTTP server and will use the router object to handle incoming requests
 * @param kuzzle
 * @param params
 */
module.exports = function runHttpServer (kuzzle, params) {
  var
    port = params.httpPort,
    server;

  kuzzle.router.initRouterHttp();

  server = http.createServer(function (request, response) {
    kuzzle.router.routeHttp(request, response);
  });
  server.listen(port);

  kuzzle.pluginsManager.trigger('server:httpStarted', 'Starting: HTTP server on port ' + port);

  return server;
};