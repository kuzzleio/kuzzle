var
  http = require('http');

/**
 * Run a HTTP server and will use the router object to handle incoming requests
 * @param {Kuzzle} kuzzle
 * @param {Params} params
 * @constructor
 */
function HttpServer (kuzzle, params) {
  this.kuzzle = kuzzle;
  this.params = params;
  this.http = http;
}

HttpServer.prototype.init = function () {
  var
    port = this.params.httpPort,
    server;

  this.kuzzle.router.initRouterHttp();

  server = this.http.createServer((request, response) => {
    this.kuzzle.router.routeHttp(request, response);
  });
  server.listen(port);

  this.kuzzle.pluginsManager.trigger('server:httpStarted', 'Starting: HTTP server on port ' + port);

  return server;
};

module.exports = HttpServer;
