var
  q = require('q'),
  rp = require('request-promise');

module.exports = function () {
  this.World = function World (callback) {
    this.documentGrace = {
      collection: 'user',
      content: {
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
      collection: 'user',
      content: {
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
      return 'http://localhost:8081/api/' + path;
    };

    this.callApi = function (options) {
      return rp(options);
    };

    callback();
  };
};