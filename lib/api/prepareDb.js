/*eslint-disable no-else-return */
var
  fs = require('fs'),
  RequestObject = require('./core/models/requestObject.js'),
  InternalError = require('./core/errors/internalError'),
  async = require('async'),
  q = require('q'),
  actualIndexes = [],
  env = {
    fixtures: 'FIXTURES',
    mappings: 'DEFAULT_MAPPING'
  },
  data = {};

module.exports = function () {
  if (this.isServer) {
    this.pluginsManager.trigger('preparedb:start', 'Starting DB preparation...');
    this.pluginsManager.trigger('log:info', '== Starting DB preparation...');
    return this.services.list.readEngine.listIndexes(new RequestObject({}))
      .then((_actualIndexes) => {
        actualIndexes = _actualIndexes.data.body.indexes || [];
      })
      .then(() => {
        return readFile.call(this, 'mappings');
      })
      .then(() => {
        return readFile.call(this, 'fixtures');
      })
      .then(() => {
        return createIndexes.call(this);
      })
      .then(() => {
        return importMapping.call(this);
      })
      .then(() => {
        return importFixtures.call(this);
      })
      .then(() => {
        this.pluginsManager.trigger('preparedb:done', 'DB preparation done.');
        this.pluginsManager.trigger('log:info', '== DB preparation done.');
      });
  } else {
    return q();
  }
};

function readFile(which) {
  var
    deferred = q.defer(),
    envVar = env[which];

  if (!process.env[envVar] || process.env[envVar] === '') {
    this.pluginsManager.trigger('log:info', '== No default ' + which + ' file specified in env vars: continue.');
    data[which] = {};
    return deferred.resolve();
  }

  this.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + process.env[envVar] + '...');

  try {
    data[which] = JSON.parse(fs.readFileSync(process.env[envVar], 'utf8'));
    this.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + process.env[envVar] + ' done.');
    deferred.resolve();
    return deferred.promise;
  }
  catch (e) {
    this.pluginsManager.trigger('log:info', 
      'An error occured when reading the ' + process.env[envVar] + ' file! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e.message
    );

    this.pluginsManager.trigger('preparedb:error', 'Error while loading the file ' + process.env[envVar]);
    return deferred.reject(new InternalError('Error while loading the file ' + process.env[envVar]));
  }
  return deferred.promise;
}

function createIndexes () {
  var deferred = q.defer();

  async.map(
    Object.keys(data.mappings).concat(Object.keys(data.fixtures)), 
    (index, callback) => {
      this.pluginsManager.trigger('log:info', '== Trying to create index "' + index + '"...');
      if (actualIndexes.indexOf(index) > -1) {

        this.pluginsManager.trigger('log:info', '== index "' + index + '" already exists.');
        callback(null, true);

      } else {
        this.services.list.writeEngine.createIndex(new RequestObject({index: index}))
          .then(() => {
            this.pluginsManager.trigger('log:info', '== index "' + index + '" created.');
            actualIndexes.push(index);
            callback(null, true);
          })
          .catch((error) => {
            this.pluginsManager.trigger('log:error', '!! index "' + index + '" not created !');
            this.pluginsManager.trigger('preparedb:error', 'index "' + index + '" not created !');
            callback(error);
          });
      }

    }, 
    (error) => {
      this.pluginsManager.trigger('log:info', '== Index creation process terminated.');

      if (error) {
        this.pluginsManager.trigger('preparedb:error',
          '!! An error occured during the indexes creation.\nHere is the original error message:\n'+error.message
        );

        deferred.reject(new InternalError('An error occured during the indexes creation.\nHere is the original error message:\n'+error.message));
        return deferred.promise;
      }

      return deferred.resolve();
    }
  );

  return deferred.promise;
}

function importMapping () {
  var
    deferred = q.defer();

  async.each(Object.keys(data.mappings), (index, callbackIndex) => {

    async.each(Object.keys(data.mappings[index]), (collection, callbackCollection) => {

      this.pluginsManager.trigger('log:info', '== Importing mapping for collection ' + index + ':' + collection + '...');

      async.each(data.mappings[index][collection], (mapping, callbackMapping) => {
        var mappingOptions = {
          action: 'createOrReplaceMapping',
          index: index,
          collection: collection,
          body: mapping
        };

        this.services.list.writeEngine.createOrReplaceMapping(new RequestObject(mappingOptions))
          .then(function () {
            callbackMapping();
          })
          .catch(function (error) {
            callbackMapping('Mapping import error' + error);
          });

      }, function (error) {
        callbackCollection(error);
      });
    }, function (error) {
      callbackIndex(error);
    });

  }, error => {
    if (error) {
      return deferred.reject(error);
    }

    this.pluginsManager.trigger('log:info', '== All mapping imports launched.');
    return deferred.resolve();

  });

  return deferred.promise;
}

function importFixtures() {
  var
    deferred = q.defer();

  async.each(Object.keys(data.fixtures), (index, callbackIndex) => {
    async.each(Object.keys(data.fixtures[index]), (collection, callback) => {
      var fixture = {
        action: 'import',
        index: index,
        collection: collection,
        body: data.fixtures[index][collection]
      };

      this.pluginsManager.trigger('log:info', '== Importing fixtures for collection ' + index + ':' + collection + '...');
      this.services.list.writeEngine.import(new RequestObject(fixture))
        .then(function () {
          callback();
        })
        .catch(function (error) {
          callback('Fixture import error' + error);
        });
    }, function (error) {
      callbackIndex(error);
    });
  }, error => {
    if (error) {
      return deferred.reject(error);
    }

    this.pluginsManager.trigger('log:info', '== All fixtures imports launched.');
    return deferred.resolve();
  });

  return deferred.promise;
}
