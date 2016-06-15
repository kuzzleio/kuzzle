var
  q = require('q'),
  _ = require('lodash');

/**
 * Generates JSON swagger object
 *
 * @param {Object} routes
 * @param {String} apiVersion
 *
 * @returns {Promise} promise
 */
module.exports = function generateSwagger (kuzzle) {
  var swagger, apiVersion, routes = [];
  apiVersion = kuzzle.config.apiVersion;

  kuzzle.config.httpRoutes.forEach(_route => {
    var route = _.assign({}, _route);
    route.url = '/' + apiVersion + route.url;
    routes.push(route);
  });

  routes.push({verb: 'get', url: '/_serverInfo', controller: 'read', action: 'serverInfo'});

  kuzzle.pluginsManager.routes.forEach(_route => {
    var route = _.assign({}, _route);
    route.url = '/' + apiVersion + '/_plugin' + route.url;
    routes.push(route);
  });  

  swagger = {
    basePath: '/api',
    consumes: [
      'application/json'
    ],
    host: 'sandbox.kuzzle.io:7511',
    info: {
      contact: {
        email: 'hello@kuzzle.io',
        name: 'Kuzzle team',
        url: 'http://kuzzle.io'
      },
      description: 'The Kuzzle REST API',
      license: {
        name: 'Apache 2',
        url: 'http://opensource.org/licenses/apache2.0'
      },
      title: 'Kuzzle API',
      version: apiVersion
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

  return q(swagger);
};