module.exports = function () {
  this.World = function World (callback) {

    // Fake values for test
    this.fakeCollection = 'kuzzle-collection-test';

    this.documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      age: 85,
      location: {
        lat: 32.692742,
        lon: -97.114127
      },
      city: 'NYC',
      hobby: 'computer'
    };
    this.documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      age: 36,
      location: {
        lat: 51.519291,
        lon: -0.149817
      },
      city: 'London',
      hobby: 'computer'
    };
    this.bulk = [
      { index:  {_id: 1 } },
      { title: 'foo' },
      { index:  {_id: 2 } },
      { title: 'bar' },
      { update: {_id: 1 } },
      { doc: { title: 'foobar' } },
      { delete: {_id: 2 } }
    ];

    this.defaultSchema = {
      properties: {
        firstName: {type: 'string', store: true}
      }
    };
    this.schema = {
      properties: {
        firstName: {type: 'string', store: true, index: 'not_analyzed'}
      }
    };

    // Load API interfaces
    this.apiTypes = {
      rest: require('./apiRest'),
      websocket: require('./apiWebsocket'),
      mqtt: require('./apiMQTT')
    };
    this.apiTypes.rest.init(this);
    this.apiTypes.websocket.init(this);

    // by default, use REST API
    this.api = this.apiTypes.rest;

    callback();
  };
};