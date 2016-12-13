module.exports = function () {
  this.World = function World () {
    this.api = null;
    this.kuzzleConfig = require('../../lib/config');
    this.idPrefix = 'kuzzle-functional-tests-';

    this.currentUser = null;

    // Fake values for test
    this.fakeIndex = 'kuzzle-test-index';
    this.fakeAltIndex = 'kuzzle-test-index-alt';
    this.fakeNewIndex = 'kuzzle-test-index-new';
    this.fakeCollection = 'kuzzle-collection-test';
    this.fakeAltCollection = 'kuzzle-collection-test-alt';

    this.documentGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      info: {
        age: 85,
        city: 'NYC',
        hobby: 'computer'
      },
      location: {
        lat: 32.692742,
        lon: -97.114127
      }
    };
    this.documentAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      info: {
        age: 36,
        city: 'London',
        hobby: 'computer'
      },
      location: {
        lat: 51.519291,
        lon: -0.149817
      }
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

    this.metadata = {
      iwant: 'to break free',
      we: ['will', 'rock', 'you']
    };

    this.roles = {
      role1: {
        controllers: {
          '*': {
            actions: {
              '*': true
            }
          }
        }
      },
      role2: {
        controllers: {
          'document': {
            actions: {
              '*': true
            }
          },
          'auth': {actions: {logout: true}}
        }
      },
      role3: {
        controllers: {
          'document': {
            actions: {
              'search': true
            }
          },
          'auth': {actions: {logout: true}}
        }
      }
    };

    this.profiles = {
      profile1: {
        policies: [{roleId: this.idPrefix + 'role1'}]
      },
      profile2: {
        policies: [
          {
            roleId: this.idPrefix + 'role1',
            restrictedTo: [{index: this.fakeIndex}]
          },
          {
            roleId: this.idPrefix + 'role2'
          }
        ]
      },
      profile3: {
        policies: [{
          roleId: this.idPrefix + 'role2',
          restrictedTo: [{index: this.fakeAltIndex, collections:[this.fakeCollection]}]
        }]
      },
      profile4: {
        policies: [{
          roleId: this.idPrefix + 'role3'
        }]
      },
      profile5: {
        policies: [{
          roleId: this.idPrefix + 'role3',
          restrictedTo: [{index: this.fakeIndex}]
        }]
      },
      profile6: {
        policies: [{
          roleId: this.idPrefix + 'role3',
          restrictedTo: [{index: this.fakeIndex, collections:[this.fakeCollection]}]
        }]
      },
      invalidProfile: {
        policies: [{roleId: 'unexisting-role'}]
      },
      emptyProfile: {
        policies: []
      }
    };

    this.users = {
      useradmin: {
        name: {
          first: 'David',
          last: 'Bowie',
          real: 'David Robert Jones'
        },
        profileIds: ['admin'],
        password: 'testpwd'
      },
      user1: {
        profileIds: [this.idPrefix + 'profile1'],
        password: 'testpwd1'
      },
      user2: {
        name: {
          first: 'Steve',
          last: 'Wozniak'
        },
        hobby: 'Segway Polo',
        profileIds: [this.idPrefix + 'profile2'],
        password: 'testpwd2'
      },
      user3: {
        profileIds: [this.idPrefix + 'profile3'],
        password: 'testpwd3'
      },
      user4: {
        profileIds: [this.idPrefix + 'profile4'],
        password: 'testpwd4'
      },
      user5: {
        profileIds: [this.idPrefix + 'profile5'],
        password: 'testpwd5'
      },
      user6: {
        profileIds: [this.idPrefix + 'profile6'],
        password: 'testpwd6'
      },
      restricteduser1: {
        password: 'testpwd1'
      },
      unexistingprofile: {
        name: 'John Doe',
        profileIds: [this.idPrefix + 'i-dont-exist']
      },
      invalidprofileType: {
        name: 'John Doe',
        profileIds: [null]
      }
    };

    this.memoryStorageResult = null;
  };
};
