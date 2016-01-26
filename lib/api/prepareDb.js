var
  fs = require('fs'),
  RequestObject = require('./core/models/requestObject.js'),
  InternalError = require('./core/errors/internalError'),
  async = require('async'),
  q = require('q'),
  env = {
    fixtures: 'FIXTURES',
    mappings: 'DEFAULT_MAPPING'
  };

module.exports = function () {
  this.actualIndexes = [];
  this.data = {};

  if (this.isServer) {
    this.pluginsManager.trigger('log:info', '== Starting DB preparation...');
    return this.services.list.readEngine.listIndexes(new RequestObject({}))
      .then(_actualIndexes => {
        this.actualIndexes = _actualIndexes.data.body.indexes || [];
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
        this.pluginsManager.trigger('log:info', '== DB preparation done.');
      });
  }

  return q();
};

function readFile(which) {
  var
    envVar = env[which];

  if (!process.env[envVar] || process.env[envVar] === '') {
    this.pluginsManager.trigger('log:info', '== No default ' + which + ' file specified in env vars: continue.');
    this.data[which] = {};
    return q();
  }

  this.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + process.env[envVar] + '...');

  try {
    this.data[which] = JSON.parse(fs.readFileSync(process.env[envVar], 'utf8'));
    this.pluginsManager.trigger('log:info', '== Reading default ' + which + ' file ' + process.env[envVar] + ' done.');
    return q();
  }
  catch (e) {
    this.pluginsManager.trigger('log:info', 
      'An error occured when reading the ' + process.env[envVar] + ' file! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e.message
    );

    this.pluginsManager.trigger('preparedb:error', 'Error while loading the file ' + process.env[envVar]);
    return q.reject(new InternalError('Error while loading the file ' + process.env[envVar]));
  }
}

function createIndexes () {
  var deferred = q.defer();

  async.map(
    Object.keys(this.data.mappings).concat(Object.keys(this.data.fixtures)),
    (index, callback) => {
      var requestObject = new RequestObject({controller: 'admin', action: 'createIndex', index: index});

      this.pluginsManager.trigger('log:info', '== Trying to create index "' + index + '"...');

      if (this.actualIndexes.indexOf(index) > -1) {
        this.pluginsManager.trigger('log:info', '== index "' + index + '" already exists.');
        callback(null, true);

      } else {
        this.pluginsManager.trigger('data:createIndex', requestObject);

        this.workerListener.add(requestObject)
          .then(() => {
            this.pluginsManager.trigger('log:info', '== index "' + index + '" created.');
            this.actualIndexes.push(index);
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

  async.each(Object.keys(this.data.mappings), (index, callbackIndex) => {
    async.each(Object.keys(this.data.mappings[index]), (collection, callbackCollection) => {
      var
        requestObject,
        msg;

      if (!this.data.mappings[index][collection].properties) {
        msg = '== Invalid mapping detected: missing required "properties" field';
        this.pluginsManager.trigger('log:err', msg);
        return callbackCollection(msg);
      }

      this.pluginsManager.trigger('log:info', '== Importing mapping for ' + index + ':' + collection + '...');

      requestObject = new RequestObject({
        controller: 'admin',
        action: 'putMapping',
        index: index,
        collection: collection,
        body: this.data.mappings[index][collection]
      });

      this.pluginsManager.trigger('data:putMapping', requestObject);
      this.workerListener.add(requestObject)
        .then(() => callbackCollection())
        .catch(response => callbackCollection('Mapping import error' + response.error.message));
    }, error => callbackIndex(error));
  }, error => {
    if (error) {
      return deferred.reject(new InternalError(error));
    }

    this.pluginsManager.trigger('log:info', '== All mapping imports launched.');
    return deferred.resolve();

  });

  return deferred.promise;
}

function importFixtures() {
  var
    deferred = q.defer();

  async.each(Object.keys(this.data.fixtures), (index, callbackIndex) => {
    async.each(Object.keys(this.data.fixtures[index]), (collection, callback) => {
      var
        fixture = {
          controller: 'bulk',
          action: 'import',
          index: index,
          collection: collection,
          body: this.data.fixtures[index][collection]
        },
        requestObject = new RequestObject(fixture);

      this.pluginsManager.trigger('log:info', '== Importing fixtures for collection ' + index + ':' + collection + '...');

      this.pluginsManager.trigger('data:bulkImport', requestObject);

      this.workerListener.add(requestObject)
        .then(() => callback())
        .catch(response => {
          // 206 = partial errors
          if (response.status !== 206) {
            return callback(response.error.message);
          }

          // We need to filter "Document already exists" errors
          if (response.error.errors.filter(e => { return e.status !== 409; }).length === 0) {
            callback();
          } else {
            callback(response.error.message);
          }
        });
    }, function (error) {
      callbackIndex(error);
    });
  }, error => {
    if (error) {
      this.pluginsManager.trigger('log:error', '== Fixture import error: ' + error.message);
      return deferred.reject(new InternalError(error));
    }

    this.pluginsManager.trigger('log:info', '== All fixtures imports launched.');
    return deferred.resolve();
  });

  return deferred.promise;
}
