var
  fs = require('fs'),
  _ = require('lodash'),
  path = require('path'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  q = require('q'),
  jsonToYaml = require('json2yaml'),  
  generateSwagger,
  writeFiles;

generateSwagger = (routes, apiVersion) => {
  var swagger;

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
                          // the first and las / are reg delimiters
                          // the ( ) tells which part we want to capture (we do not need the :)
                          // the [ ] define a char group
                          // the ^ is a "not"
                          // the * is a quantifier saying 1 or more
                          // the \/ is an escaped / (/ is the reg delimiter)
                          // the last g is the "greedy" flag, saying that we want to catch all occurences
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

writeFiles = swagger => {
  var baseDir = path.join(__dirname, '..', '..', '..', '..');

  try {
    fs.writeFileSync(path.join(baseDir, 'kuzzle-swagger.json'), JSON.stringify(swagger));
  }
  catch (e) {
    return q.reject(new InternalError('Unable to write the kuzzle-swagger.json file'));
  }
  try {
    fs.writeFileSync(path.join(baseDir, 'kuzzle-swagger.yml'), jsonToYaml.stringify(swagger));
  }
  catch (e) {
    return q.reject(new InternalError('Unable to write the kuzzle-swagger.yml file'));
  }
  return q(swagger);
};

module.exports = function GenerateSwaggerFiles (kuzzle) {
  var routes = [];

  this.kuzzle = kuzzle;

  if (! this.kuzzle.isServer) {
    return q({isWorker: true});
  }

  kuzzle.config.httpRoutes.forEach(_route => {
    var route = _.assign({}, _route);
    route.url = '/' + kuzzle.config.apiVersion + route.url;
    routes.push(route);
  });

  routes.push({verb: 'get', url: '/_serverInfo', controller: 'read', action: 'serverInfo'});

  kuzzle.pluginsManager.routes.forEach(_route => {
    var route = _.assign({}, _route);
    route.url = '/' + kuzzle.config.apiVersion + '/_plugin' + route.url;
    routes.push(route);
  });

  return generateSwagger(routes, kuzzle.config.apiVersion)
    .then(swagger => writeFiles(swagger));
};