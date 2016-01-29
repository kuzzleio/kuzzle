var
  rc = require('rc');

module.exports = function () {
  this.World = function World () {
    this.api = null;
    this.kuzzleConfig = rc('kuzzle');
    this.idPrefix = 'kuzzle-functional-tests-';

    this.currentUser = null;

    // Fake values for test
    this.fakeIndex = 'index-test';
    this.fakeAltIndex = 'index-test-alt';
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
    this.globalBulk = [
      { index:  {_id: 1, _type: this.fakeCollection, _index: this.fakeIndex } },
      { title: 'foo' },
      { index:  {_id: 2, _type: this.fakeCollection, _index: this.fakeIndex } },
      { title: 'bar' },
      { update: {_id: 1, _type: this.fakeCollection, _index: this.fakeIndex } },
      { doc: { title: 'foobar' } },
      { delete: {_id: 2, _type: this.fakeCollection, _index: this.fakeIndex } }
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

    this.roles = {
      role1: {
        indexes: {
          'fakeIndex1': {
            collections: {
              'fakeCollection1': {
                controllers: {
                  'fakeController1': {
                    actions: {
                      'fakeAction1': true
                    }
                  }
                }
              }
            }
          }
        }
      },
      role2: {
        indexes: {
          'fakeIndex2': {
            collections: {
              'fakeCollection2': {
                controllers: {
                  'fakeController2': {
                    actions: {
                      'fakeAction2': true
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    this.profiles = {
      profile1: {
        roles: [this.idPrefix + 'role1']
      },
      profile2: {
        roles: [this.idPrefix + 'role1', this.idPrefix + 'role2']
      },
      profile3: {
        roles: [this.idPrefix + 'role2']
      },
      invalidProfile: {
        roles: ['unexisting-role']
      },
      emptyProfile: {
        roles: []
      }
    };

    this.users = {
      user1: {
        name: {
          first: 'David',
          last: 'Bowie',
          real: 'David Robert Jones'
        },
        profile: 'admin',
        password: '30b64e1a26bc4f6e40d1a4b0388a58b7821afa1f'
      },
      user2: {
        name: {
          first: 'Steve',
          last: 'Wozniak'
        },
        hobby: 'Segway Polo',
        profile: this.idPrefix + 'profile2'
      },
      unexistingprofile: {
        name: 'John Doe',
        profile: this.idPrefix + 'i-dont-exist'
      },
      invalidprofileType: {
        name: 'John Doe',
        profile: null
      }
    };
  };
};
