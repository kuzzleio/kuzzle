var
  fs = require('fs'),
  RequestObject = require('./core/models/requestObject.js'),
  async = require('async'),
  q = require('q');

module.exports = function () {
  return importMapping.call(this)
    .then(function () {
      return importFixtures.call(this);
    });
};

var importMapping = function () {
  var deferred = q.defer();

  // is a default mapping file has been specified to be inserted into database at Kuzzle start and we are launching a server ?
  if (!process.env.DEFAULT_MAPPING || process.env.DEFAULT_MAPPING  === '' || !this.isServer) {
    deferred.resolve();
    return deferred.promise;
  }

  var mappings;

  this.pluginsManager.trigger('log:info', 'Reading default mapping file ' + process.env.DEFAULT_MAPPING);

  try {
    mappings = JSON.parse(fs.readFileSync(process.env.DEFAULT_MAPPING, 'utf8'));
  }
  catch (e) {
    this.pluginsManager.trigger('log:info',
      'An error occured when reading the ' + process.env.DEFAULT_MAPPING + ' file! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e.message
    );

    deferred.reject();
    return deferred.promise;
  }

  async.each(Object.keys(mappings), function (collection, callbackCollection) {
    this.pluginsManager.trigger('log:info', '== Importing mapping for collection ' + collection + '...');

    async.each(mappings[collection], function (mapping, callbackMapping) {

      var mappingOptions = {
        action: 'putMapping',
        persist: true,
        collection: collection,
        body: mapping
      };

      this.services.list.writeEngine.putMapping(new RequestObject(mappingOptions))
        .then(function () {
          callbackMapping();
        }.bind(this))
        .catch(function (error) {
          callbackMapping('Mapping import error' + error);
        }.bind(this));

    }.bind(this), function (error) {
      callbackCollection(error);
    });

  }.bind(this), function (error) {
    if (error) {
      return deferred.reject(error);
    }

    this.pluginsManager.trigger('prepare:MappingEnd', 'All fixtures imports launched.');
    return deferred.resolve();

  }.bind(this));

  return deferred.promise;
};

var importFixtures = function () {
  var deferred = q.defer();

  // is a fixture file has been specified to be inserted into database at Kuzzle start and we are launching a server ?
  if (!process.env.FIXTURES || process.env.FIXTURES  === '' || !this.isServer) {
    deferred.resolve();
    return deferred.promise;
  }

  var fixtures;

  this.pluginsManager.trigger('log:info', 'Reading fixtures file ' +  process.env.FIXTURES);

  try {
    fixtures = JSON.parse(fs.readFileSync(process.env.FIXTURES, 'utf8'));
  } catch (e) {
    this.pluginsManager.trigger('log:info',
      'An error occured when reading the ' + process.env.FIXTURES + ' file! \n' +
      'Remember to put the file into the docker scope...\n' +
      'Here is the original error: ' + e.message
    );

    deferred.resolve();
    return deferred.promise;
  }

  async.each(Object.keys(fixtures), function (collection, callback) {
    this.pluginsManager.trigger('log:info', '== Importing fixtures for collection ' + collection + '...');

    var fixture = {
      action: 'import',
      persist: true,
      collection: collection,
      body: fixtures[collection]
    };

    this.services.list.writeEngine.import(new RequestObject(fixture))
      .then(function () {
        callback();
      }.bind(this))
      .catch(function (error) {
        callback('Fixture import error' + error);
      }.bind(this));

  }.bind(this), function (error) {
    if (error) {
      deferred.reject(error);
    }

    this.pluginsManager.trigger('prepare:fixtureEnd', 'All fixtures imports launched.');
    deferred.resolve();

  }.bind(this));

  return deferred.promise;
};