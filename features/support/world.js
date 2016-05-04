var
  rc = require('rc');

module.exports = function () {
  this.World = function World () {
    this.api = null;
    this.kuzzleConfig = rc('kuzzle');
    this.idPrefix = 'kuzzle-functional-tests-';

    this.currentUser = null;

    // Fake values for test
    this.fakeIndex = 'kuzzle-test-index';
    this.fakeAltIndex = 'kuzzle-test-index-alt';
    this.fakeNewIndex = 'kuzzle-test-index-new';
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


    /* jshint camelcase: false */
    this.schema = {
      properties: {
        firstName: {
          type: 'string',
          copy_to: 'newFirstName'
        },
        newFirstName: {
          type: 'string',
          store: true,
          index: 'not_analyzed'
        }
      }
    };
    /* jshint camelcase: true */

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
        password: 'testpwd'
      },
      user2: {
        name: {
          first: 'Steve',
          last: 'Wozniak'
        },
        hobby: 'Segway Polo',
        profile: this.idPrefix + 'profile2',
        password: 'testpwd2'
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

    this.memoryStorageResult = null;
  };
};
