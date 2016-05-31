var
  fs = require('fs'),
  path = require('path'),
  RequestObject = require('../../core/models/requestObject.js'),
  InternalError = require('../../core/errors/internalError'),
  async = require('async'),
  q = require('q'),
  rc = require('rc'),
  stringify = require('json-stable-stringify'),
  jsonToYaml = require('json2yaml'),  
  generateSwagger,
  writeFiles;


generateSwagger = (routes, apiVersion) => {
  var swagger, _routes;

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

  _routes = routes.concat([{verb: 'get', url: '/_serverInfo', controller: 'read', action: 'serverInfo'}]);

  _routes.forEach((route) => {
    var 
      reg = /:([^\/]*)/g, 
      m;

    if (swagger.paths['/' + apiVersion + route.url] === undefined) {
      swagger.paths['/' + apiVersion + route.url] = {};
    }

    if (swagger.paths['/' + apiVersion + route.url][route.verb] === undefined) {
      swagger.paths['/' + apiVersion + route.url][route.verb] = {
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
      if (m.index === reg.lastIndex) {
        reg.lastIndex++;
      }
      swagger.paths['/' + apiVersion + route.url][route.verb].parameters.push({
        description: 'TODO',
        in: 'path',
        name: m[1],
        required: true,
        type: 'string'
      });
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
    q.reject(new InternalError('Unable to write the kuzzle-swagger.json file'))
  }
  try {
    fs.writeFileSync(path.join(baseDir, 'kuzzle-swagger.yml'), jsonToYaml.stringify(swagger));
  }
  catch (e) {
    q.reject(new InternalError('Unable to write the kuzzle-swagger.yml file'))
  }
  return q({});
}

module.exports = function GenerateSwaggerFiles (kuzzle, request) {
  this.kuzzle = kuzzle;

  if (this.kuzzle.isServer) {
    return generateSwagger(kuzzle.config.httpRoutes, kuzzle.config.apiVersion)
      .then(swagger => writeFiles(swagger));
  }

  return q({isWorker: true});
}