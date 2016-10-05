var
  freeport = require('freeport'),
  http = require('http'),
  Promise = require('bluebird');

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
    server;

  this.kuzzle.router.initHttpRouter();

  server = http.createServer((request, response) => {
    this.kuzzle.router.routeHttp(request, response);
  });

  return new Promise(resolve => {
    if (this.kuzzle.config.server.http.port) {
      server.listen(this.kuzzle.config.server.http.port);
      return resolve();
    }

    return Promise.promisify(freeport)()
      .then(port => {
        this.kuzzle.config.server.http.port = port;
        server.listen(port);
        resolve();
      });
  })
    .then(() => {
      this.kuzzle.pluginsManager.trigger('server:httpStarted',
        `Starting: HTTP server on port ${this.kuzzle.config.server.http.port}`);
    });
};

module.exports = HttpServer;
