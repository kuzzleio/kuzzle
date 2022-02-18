'use strict';

const
  { setWorldConstructor } = require('cucumber'),
  HttpApi = require('./api/http'),
  MqttApi = require('./api/mqtt'),
  WebSocketApi = require('./api/websocket');

let
  _init;

class KWorld {
  constructor (config) {
    this.config = Object.assign({
      protocol: 'websocket',
      host: 'localhost',
      port: 7512
    }, config.parameters);

    switch (this.config.protocol) {
      case 'http':
        this.api = new HttpApi(this);
        break;
      case 'mqtt':
        this.api = new MqttApi(this);
        break;
      default:
        // websocket
        this.api = new WebSocketApi(this);
        this.config.protocol = 'websocket';
    }

    if (! _init && ! this.config.silent) {
      console.log(`[${this.config.protocol}] ${this.config.host}:${this.config.port}`);
      _init = true;
    }

    this.kuzzleConfig = require('../../lib/config').loadConfig();
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
      { index: { _id: 1 } },
      { title: 'foo' },
      { index: { _id: 2 } },
      { title: 'bar' },
      { update: { _id: 1 } },
      { doc: { title: 'foobar' } },
      { delete: { _id: 2 } }
    ];

    this.mapping = {
      properties: {
        firstName: {
          type: 'text',
          copy_to: 'newFirstName'
        },
        newFirstName: {
          type: 'keyword',
          store: true
        }
      }
    };

    this.securitymapping = {
      properties: {
        foo: {
          type: 'text',
          copy_to: 'bar'
        },
        bar: {
          type: 'keyword',
          store: true
        }
      }
    };

    this.volatile = {
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
          'auth': { actions: { logout: true } }
        }
      },
      role3: {
        controllers: {
          'document': {
            actions: {
              'search': true
            }
          },
          'auth': { actions: { logout: true } }
        }
      },
      foo: {
        controllers: {
          'foo': {
            actions: {
              '*': true
            }
          }
        }
      },
      bar: {
        controllers: {
          'bar': {
            actions: {
              '*': true
            }
          }
        }
      },
      foobar: {
        controllers: {
          'foo': {
            actions: {
              '*': true
            }
          },
          'bar': {
            actions: {
              '*': true
            }
          }
        }
      },
      admin: {
        controllers: {
          '*': {
            actions: {
              '*': true
            }
          }
        }
      },
      default: {
        controllers: {
          auth: {
            actions: {
              checkToken: true,
              getCurrentUser: true,
              getMyRights: true,
              logout: true,
              updateSelf: true
            }
          },
          server: {
            actions: {
              info: true
            }
          }
        }
      },
      anonymous: {
        controllers: {
          auth: {
            actions: {
              checkToken: true,
              getCurrentUser: true,
              getMyRights: true,
              login: true
            }
          },
          server: {
            actions: {
              info: true
            }
          }
        }
      }
    };

    this.policies = {
      profile1: [
        { controller: '*', action: '*', index: '*', collection: '*', value: 'allowed' }
      ],
      profile2: [
        { controller: '*', action: '*', index: this.fakeIndex, collection: '*', value: 'allowed' },
        { controller: 'document', action: '*', index: '*', collection: '*', value: 'allowed' },
        { controller: 'auth', action: 'logout', index: '*', collection: '*', value: 'allowed' }
      ]
    };

    this.profiles = {
      profile1: {
        policies: [{ roleId: this.idPrefix + 'role1' }]
      },
      profile2: {
        policies: [
          {
            roleId: this.idPrefix + 'role1',
            restrictedTo: [{ index: this.fakeIndex }]
          },
          {
            roleId: this.idPrefix + 'role2'
          }
        ]
      },
      profile3: {
        policies: [{
          roleId: this.idPrefix + 'role2',
          restrictedTo: [{ index: this.fakeAltIndex, collections: [this.fakeCollection] }]
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
          restrictedTo: [{ index: this.fakeIndex }]
        }]
      },
      profile6: {
        policies: [{
          roleId: this.idPrefix + 'role3',
          restrictedTo: [{ index: this.fakeIndex, collections: [this.fakeCollection] }]
        }]
      },
      invalidProfile: {
        policies: [{ roleId: 'unexisting-role' }]
      },
      emptyProfile: {
        policies: []
      },
      admin: {
        policies: [{ roleId: 'admin' }]
      },
      adminfoo: {
        policies: [{ roleId: 'admin' }, { roleId: this.idPrefix + 'foo' }]
      },
      default: {
        policies: [{ roleId: 'default' }]
      },
      defaultfoo: {
        policies: [{ roleId: 'default' }, { roleId: this.idPrefix + 'foo' }]
      },
      anonymous: {
        policies: [{ roleId: 'anonymous' }]
      },
      anonymousfoo: {
        policies: [{ roleId: 'anonymous' }, { roleId: this.idPrefix + 'foo' }]
      }
    };

    this.users = {
      useradmin: {
        content: {
          name: {
            first: 'David',
            last: 'Bowie',
            real: 'David Robert Jones'
          },
          profileIds: ['admin']
        },
        credentials: {
          local: {
            username: this.idPrefix + 'useradmin',
            password: 'testpwd'
          }
        }
      },
      user1: {
        content: {
          profileIds: [this.idPrefix + 'profile1']
        },
        credentials: {
          local: {
            username: this.idPrefix + 'user1',
            password: 'testpwd1'
          }
        }
      },
      user2: {
        content: {
          name: {
            first: 'Steve',
            last: 'Wozniak'
          },
          hobby: 'Segway Polo',
          profileIds: [this.idPrefix + 'profile2']
        },
        credentials: {
          local: {
            username: this.idPrefix + 'user2',
            password: 'testpwd2'
          }
        }
      },
      user3: {
        content: {
          profileIds: [this.idPrefix + 'profile3']
        },
        credentials: {
          local: {
            username: this.idPrefix + 'user3',
            password: 'testpwd3'
          }
        }
      },
      user4: {
        content: {
          profileIds: [this.idPrefix + 'profile4']
        },
        credentials: {
          local: {
            username: this.idPrefix + 'user4',
            password: 'testpwd4'
          }
        }
      },
      user5: {
        content: {
          profileIds: [this.idPrefix + 'profile5']
        },
        password: 'testpwd5',
        credentials: {
          local: {
            username: this.idPrefix + 'user5',
            password: 'testpwd5'
          }
        }
      },
      user6: {
        content: {
          profileIds: [this.idPrefix + 'profile6']
        },
        credentials: {
          local: {
            username: this.idPrefix + 'user6',
            password: 'testpwd6'
          }
        }
      },
      restricteduser1: {
        content: {
          name: {
            first: 'Restricted',
            last: 'User'
          }
        },
        credentials: {
          local: {
            username: this.idPrefix + 'restricteduser1',
            password: 'testpwd1'
          }
        }
      },
      nocredentialuser: {
        content: {
          name: {
            first: 'Non Connectable',
            last: 'User'
          },
          profileIds: ['admin']
        }
      },
      unexistingprofile: {
        content: {
          name: {
            first: 'John',
            last: 'Doe'
          },
          profileIds: [this.idPrefix + 'i-dont-exist']
        }
      },
      invalidprofileType: {
        content: {
          name: {
            first: 'John',
            last: 'Doe'
          },
          profileIds: [null]
        }
      }
    };

    this.credentials = {
      nocredentialuser: {
        username: this.idPrefix + 'nocredentialuser',
        password: 'testpwd1'
      }
    };

    this.memoryStorageResult = null;
  }
}

setWorldConstructor(KWorld);

module.exports = KWorld;
