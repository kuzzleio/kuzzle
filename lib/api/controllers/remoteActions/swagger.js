var
  fs = require('fs'),
  _ = require('lodash'),
  path = require('path'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  q = require('q'),
  stringify = require('json-stable-stringify'),
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
      reg = /:([^\/]*)/g, 
      m;

    if (swagger.paths[route.url] === undefined) {
      swagger.paths[route.url] = {};
    }

    if (swagger.paths[route.url][route.verb] === undefined) {
      if (route.infos !== undefined) {
        if (route.infos.description === undefined) {
          route.infos.description = 'Controller: ' + route.controller + '. Action: ' + route.action + '.';
        }
        else {
          route.infos.description += '\nController: ' + route.controller + '. Action: ' + route.action + '.';
        }
        swagger.paths[route.url][route.verb] = route.infos;
      } 
      else {
        // the route definision is minimal, lets create a default one
        swagger.paths[route.url][route.verb] = {
          description: 'Controller: ' + route.controller + '. Action: ' + route.action + '.',
          produces: 'application/json',
          responses: {
            '200': {
              description: 'OK',
              schema: {
                action: 'string',
                controller: 'string',
                error: 'object or null',
                metadata: 'object',
                requestId: 'string',
                result: 'object',
                scope: 'string or null',
                state: 'string',
                status: 'integer'
              }
            }
          },
          parameters: []
        };
      }

      while ((m = reg.exec(route.url)) !== null) {
        reg.lastIndex++;
        swagger.paths[route.url][route.verb].parameters.push({
          description: 'TODO',
          in: 'path',
          name: m[1],
          required: true,
          type: 'string'
        });
      }
    }
  });

  return q(swagger);
};

writeFiles = swagger => {
  var baseDir = path.join(__dirname, '..', '..', '..', '..');

  try {
    fs.writeFileSync(path.join(baseDir, 'kuzzle-swagger.json'), stringify(swagger));
  }
  catch (e) {
    q.reject(new InternalError('Unable to write the kuzzle-swagger.json file'));
  }
  try {
    fs.writeFileSync(path.join(baseDir, 'kuzzle-swagger.yml'), jsonToYaml.stringify(swagger));
  }
  catch (e) {
    q.reject(new InternalError('Unable to write the kuzzle-swagger.yml file'));
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