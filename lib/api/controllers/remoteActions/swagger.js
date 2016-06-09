var
  fs = require('fs'),
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
  if (! kuzzle.isServer) {
    return q({isWorker: true});
  }

  return generateSwagger(kuzzle)
    .then(swagger => writeFiles(swagger));
};