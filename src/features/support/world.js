var
  config = require('./config'),
  rp = require('request-promise'),
  captainsLog = require('captains-log'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

module.exports = function () {
  this.World = function World (callback) {

    this.kuzzle = new Kuzzle();
    this.kuzzle.log = new captainsLog({level: 'silent'});
    this.kuzzle.start({}, {workers: false, servers: false});

    this.fakeCollection = 'kuzzle-collection-test';

    this.documentGrace = {
      collection: this.fakeCollection,
      body: {
        firstName: 'Grace',
        lastName: 'Hopper',
        age: 85,
        location: {
          lat: 32.692742,
          lon: -97.114127
        },
        city: 'NYC',
        hobby: 'computer'
      }
    };
    this.documentAda = {
      collection: this.fakeCollection,
      body: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        age: 36,
        location: {
          lat: 51.519291,
          lon: -0.149817
        },
        city: 'London',
        hobby: 'computer'
      }
    };

    this.pathApi = function (path) {
      return config.apiUrl + path;
    };

    this.callApi = function (options) {
      return rp(options);
    };

    this.getDocumentById = function (id) {
      var options = {
        url: this.pathApi(this.fakeCollection + '/' + id),
        method: 'GET',
        json: true
      };

      return this.callApi(options);
    };

    callback();
  };
};