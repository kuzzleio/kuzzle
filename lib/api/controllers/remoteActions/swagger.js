var
  fs = require('fs'),
  _ = require('lodash'),
  path = require('path'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  q = require('q'),
  jsonToYaml = require('json2yaml'),  
  generateSwagger = require('../../core/swagger'),
  writeFiles;

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