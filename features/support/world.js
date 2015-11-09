module.exports = function () {
  this.World = function World () {
    this.api = null;

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
    this.documentNonPersistentGrace = {
      persist: false,
      body: this.documentGrace
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
    this.globalBulk = [
      { index:  {_id: 1, _type: 'kuzzle-collection-test' } },
      { title: 'foo' },
      { index:  {_id: 2, _type: 'kuzzle-collection-test' } },
      { title: 'bar' },
      { update: {_id: 1, _type: 'kuzzle-collection-test' } },
      { doc: { title: 'foobar' } },
      { delete: {_id: 2, _type: 'kuzzle-collection-test' } }
    ];

    this.schema = {
      properties: {
        firstName: {type: 'string', store: true, index: 'not_analyzed'}
      }
    };

    this.metadata = {
      iwant: 'to break free',
      we: ['will', 'rock', 'you']
    };
  };
};
