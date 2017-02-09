var _ = require('lodash');

/**
 * Generates JSON swagger object
 *
 * @param {Kuzzle} kuzzle
 * @return {object} swagger object
 */
module.exports = function generateSwagger (kuzzle) {
  var swagger, routes = [];

  kuzzle.config.http.routes.forEach(_route => {
    var route = _.assign({}, _route);
    routes.push(route);
  });

  routes.push({verb: 'get', url: '/_serverInfo', controller: 'server', action: 'info'});

  kuzzle.pluginsManager.routes.forEach(_route => {
    var route = _.assign({}, _route);
    route.url = '/_plugin' + route.url;
    routes.push(route);
  });

  swagger = {
    basePath: '/',
    consumes: [
      'application/json'
    ],
    host: 'sandbox.kuzzle.io:7512',
    info: {
      contact: {
        email: 'hello@kuzzle.io',
        name: 'Kuzzle team',
        url: 'http://kuzzle.io'
      },
      description: 'The Kuzzle HTTP API',
      license: {
        name: 'Apache 2',
        url: 'http://opensource.org/licenses/apache2.0'
      },
      title: 'Kuzzle API'
    },
    produces: [
      'application/json'
    ],
    schemes: [
      'http'
    ],
    swagger: '2.0',
    paths: {}
  };

  routes.forEach(route => {
    var
      reg = /:([^\/]*)/g, // since url parameters got the following form "/:parameterName/:otherParameter" this reg captures, all chars following : which are not a / char
      m;

    // conforms to the swagger format by replacing the parameters notation :parameter by {parameter}
    route.url_ = route.url.replace(/:([^\/]*)/g, '{$1}');

    if (swagger.paths[route.url_] === undefined) {
      swagger.paths[route.url_] = {};
    }

    if (swagger.paths[route.url_][route.verb] === undefined) {

      if (route.infos === undefined) {
        route.infos = {};
      }

      if (route.infos.description === undefined) {
        route.infos.description = 'Controller: ' + route.controller + '. Action: ' + route.action + '.';
      }
      else {
        route.infos.description += '\nController: ' + route.controller + '. Action: ' + route.action + '.';
      }

      if (route.infos.produces === undefined) {
        route.infos.produces = ['applications/json'];
      }

      if (route.infos.parameters === undefined) {
        route.infos.parameters = [];

        while ((m = reg.exec(route.url)) !== null) {
          reg.lastIndex++;
          route.infos.parameters.push({
            description: 'TODO',
            in: 'path',
            name: m[1],
            required: true,
            type: 'string'
          });
        }
      }

      if (route.infos.parameters.length === 0) {
        delete route.infos.parameters;
      }

      if (route.infos.responses === undefined) {
        route.infos.responses = {
          '200': {
            description: 'OK'
          }
        };
      }

      swagger.paths[route.url_][route.verb] = route.infos;
    }
  });

  return swagger;
};
