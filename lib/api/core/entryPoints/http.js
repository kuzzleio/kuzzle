var
  http = require('http');

/**
 * Run a HTTP server and will use the router object to handle incoming requests
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function HttpServer (kuzzle) {
  this.kuzzle = kuzzle;
}

HttpServer.prototype.init = function () {
  var
    port = this.kuzzle.config.server.http.port,
    server;

  this.kuzzle.router.initHttpRouter();

  server = http.createServer((request, response) => {
    this.kuzzle.router.routeHttp(request, response);
  });
  server.listen(port);

  this.kuzzle.pluginsManager.trigger('server:httpStarted', 'Starting: HTTP server on port ' + port);

  return server;
};

module.exports = HttpServer;
