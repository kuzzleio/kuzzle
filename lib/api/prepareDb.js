/*eslint-disable no-console */
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
  data = {
    fixtures: {},
    mappings: {}
  };

module.exports = function () {
  if (!this.isServer) {
    return q();
  } else {
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
      });
  }
};

function readFile(which) {
  var
    deferred = q.defer(),
    envVar = env[which];

  if (!process.env[envVar] || process.env[envVar] === '') {
    console.log('== No default ' + which + ' file specified in env vars: continue.');
    deferred.resolve();
    return deferred.promise;
  }

  console.log('== Reading default ' + which + ' file ' + process.env[envVar] + '...');

  try {
    data[which] = JSON.parse(fs.readFileSync(process.env[envVar], 'utf8'));
    console.log('== Reading default ' + which + ' file ' + process.env[envVar] + ' done.');
    deferred.resolve();
    return deferred.promise;
  }
  catch (e) {
    console.log(
      'An error occured when reading the ' + process.env[envVar] + ' file! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e.message
    );

    deferred.reject(new InternalError('Error while loading the file ' + process.env[envVar]));
    return deferred.promise;
  }
  return deferred.promise;
}

function createIndexes () {
  var deferred = q.defer();

  async.map(
    Object.keys(data.mappings).concat(Object.keys(data.fixtures)), 
    (index, callback) => {
      console.log('== Trying to create index "' + index + '"...');
      if (actualIndexes.indexOf(index) > -1) {

        console.log('== index "' + index + '" already exists.');
        callback(null, true);

      } else {
        this.services.list.writeEngine.createIndex(new RequestObject({index: index}))
          .then(() => {
            console.log('== index "' + index + '" created.');
            actualIndexes.push(index);
            callback(null, true);
          })
          .catch((error) => {
            console.log('!! index "' + index + '" not created !');
            callback(error);
          });
      }

    }, 
    (error) => {

      console.log('== Index creation process terminated.');

      if (error) {
        console.log(
          '!! An error occured during the indexes creation.\nHere is the original error message:\n'+error.message
        );

        deferred.reject(new InternalError('An error occured during the indexes creation.\nHere is the original error message:\n'+error.message));
        return deferred.promise;
      }

      deferred.resolve();
      return deferred.promise;
    }
  );

  return deferred.promise;
}

function importMapping () {
  var
    deferred = q.defer();

  async.each(Object.keys(data.mappings), (index, callbackIndex) => {

    async.each(Object.keys(data.mappings[index]), (collection, callbackCollection) => {

      console.log('== Importing mapping for collection ' + index + ':' + collection + '...');

      async.each(data.mappings[index][collection], (mapping, callbackMapping) => {
        var mappingOptions = {
          action: 'putMapping',
          index: index,
          collection: collection,
          body: mapping
        };

        this.services.list.writeEngine.putMapping(new RequestObject(mappingOptions))
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

    console.log('== All mapping imports launched.');
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

      console.log('== Importing fixtures for collection ' + index + ':' + collection + '...');
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

    console.log('== All fixtures imports launched.');
    deferred.resolve();

  });

  return deferred.promise;
}
