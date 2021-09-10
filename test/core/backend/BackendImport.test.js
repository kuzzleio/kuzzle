'use strict';

const should = require('should');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('BackendImport', () => {
  let application;
  let Backend;

  beforeEach(() => {
    mockrequire('../../../lib/kuzzle', KuzzleMock);

    ({ Backend } = mockrequire.reRequire('../../../lib/core/backend/backend'));

    application = new Backend('black-mesa');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#mappings', () => {
    let mappings;

    beforeEach(() => {
      mappings = {
        index1: {
          collection1: {
            mappings: {
              dynamic: 'strict',
              _meta: {
                field: 'value',
              },
              properties: {
                fieldA: { type: 'keyword'},
                fieldB: { type: 'integer'}
              },
            },
            settings: {
              analysis : {
                analyzer:{
                  content:{
                    type:'custom',
                    tokenizer:'whitespace'
                  }
                }
              }
            }
          },
          collection2: { mappings: { properties: { fieldC: { type: 'keyword'} } } },
        },
        index2: {
          collection1: { mappings: { properties: { fieldD: { type: 'integer'} } } },
        },
      };
    });

    it('should import new mappings', () => {
      application.import.mappings(mappings);

      should(application._import.mappings).be.deepEqual(mappings);
    });

    it('should be idempotent', () => {
      application.import.mappings(mappings);
      application.import.mappings(mappings);

      should(application._import.mappings).be.deepEqual(mappings);
    });

    it('should merge collection mappings from different calls', () => {
      application.import.mappings(mappings);
      mappings.index1.collection3 =
        { mappings: { properties: { fieldE: { type: 'keyword'} } } };
      delete mappings.index1.collection2;

      application.import.mappings(mappings);

      should(application._import.mappings).be.deepEqual({
        index1: {
          collection2: { mappings: { properties: { fieldC: { type: 'keyword'} } } },
          ...mappings.index1
        },
        index2: mappings.index2
      });
    });

    it('should throw an error if mappings is not an object', () => {
      should(() => {
        application.import.mappings('not an object');
      }).throwError({ id: 'validation.assert.invalid_type' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.import.mappings(mappings);
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('#profiles', () => {
    let profiles;

    beforeEach(() => {
      profiles = {
        profileA: {
          rateLimit: 50,
          policies: [
            {
              roleId: 'roleA'
            },
            {
              roleId: 'roleB',
              restrictedTo: [
                {
                  index: 'index1'
                },
                {
                  index: 'index2',
                  collections: [ 'collectionA', 'collectionB']
                }
              ]
            }
          ]
        },
        profileB: { policies: [{ roleId: 'roleA' }] },
      };
    });

    it('should import a new profile', () => {
      application.import.profiles(profiles);

      should(application._import.profiles).be.deepEqual(profiles);
    });

    it('should be idempotent', () => {
      application.import.profiles(profiles);
      application.import.profiles(profiles);

      should(application._import.profiles).be.deepEqual(profiles);
    });

    it('should merge profiles from different calls', () => {
      application.import.profiles(profiles);
      profiles.profileC = { policies: [{ roleId: 'roleC' }] };
      delete profiles.profileB;

      application.import.profiles(profiles);

      should(application._import.profiles).be.deepEqual({
        profileB: { policies: [{ roleId: 'roleA' }] },
        ...profiles,
      });
    });

    it('should throw an error if profile is not an object', () => {
      should(() => {
        application.import.profiles('not an object');
      }).throwError({ id: 'validation.assert.invalid_type' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.import.profiles(profiles);
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('#roles', () => {
    let roles;

    beforeEach(() => {
      roles = {
        roleA: {
          controllers: {
            controllerA: {
              actions: {
                actionA: true,
                actionB: false,
              }
            },
            controllerB: { actions: { '*': true } },
          }
        },
        roleB: {
          controllers: { '*': { actions: { '*': true } } },
        },
      };
    });

    it('should import a new role', () => {
      application.import.roles(roles);

      should(application._import.roles).be.deepEqual(roles);
    });

    it('should be idempotent', () => {
      application.import.roles(roles);
      application.import.roles(roles);

      should(application._import.roles).be.deepEqual(roles);
    });

    it('should merge roles from different calls', () => {
      application.import.roles(roles);
      roles.roleC = {
        controllers: { controllerC: { actions: { '*': true } } }
      };
      delete roles.roleB;

      application.import.roles(roles);

      should(application._import.roles).be.deepEqual({
        roleB: {
          controllers: { '*': { actions: { '*': true } } }
        },
        ...roles,
      });
    });

    it('should throw an error if role is not an object', () => {
      should(() => {
        application.import.roles('not an object');
      }).throwError({ id: 'validation.assert.invalid_type' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.import.roles(roles);
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('#userMappings', () => {
    let userMappings;

    beforeEach(() => {
      userMappings = {
        properties: {
          fieldA: { type: 'text' },
          fieldB: { type: 'double' }
        }
      };
    });

    it('should import new mappings', () => {
      application.import.userMappings(userMappings);

      should(application._import.userMappings).be.deepEqual(userMappings);
    });

    it('should be idempotent', () => {
      application.import.userMappings(userMappings);
      application.import.userMappings(userMappings);

      should(application._import.userMappings).be.deepEqual(userMappings);
    });

    it('should NOT merge userMappings from different calls', () => {
      application.import.userMappings(userMappings);
      userMappings.profileC = { policies: [{ roleId: 'roleC' }] };
      delete userMappings.profileB;

      application.import.userMappings(userMappings);

      should(application._import.userMappings).be.deepEqual(userMappings);
    });

    it('should throw an error if mappings is not an object', () => {
      should(() => {
        application.import.userMappings('not an object');
      }).throwError({ id: 'validation.assert.invalid_type' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.import.userMappings(userMappings);
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });

  describe('#users', () => {
    let users;

    beforeEach(() => {
      users = {
        userA: {
          content: {
            profileIds: ['profileA', 'profileB'],
            name: 'foo'
          },
          credentials: {
            local: { username: 'bar', password: 'foobar' }
          }
        },
        userB: { content: { profileIds: ['profileA'], name: 'bar'} },
      };
    });

    it('should import a new user', () => {
      application.import.users(users);

      should(application._import.users).be.deepEqual(users);
      should(application._import.onExistingUsers).equals('skip');
    });

    it('should handle onExistingUsers option', () => {
      application.import.users(users, { onExistingUsers: 'overwrite'});

      should(application._import.onExistingUsers).equals('overwrite');
    });

    it('should be idempotent', () => {
      application.import.users(users);
      application.import.users(users);

      should(application._import.users).be.deepEqual(users);
    });

    it('should merge users from different calls', () => {
      application.import.users(users);
      users.userC = { content: { profileIds: ['profileC'], name: 'usr'} };
      delete users.userB;

      application.import.users(users);

      should(application._import.users).be.deepEqual({
        userB: { content: { profileIds: ['profileA'], name: 'bar'} },
        ...users,
      });
    });

    it('should throw an error if user is not an object', () => {
      should(() => {
        application.import.users('not an object');
      }).throwError({ id: 'validation.assert.invalid_type' });
    });

    it('should throw an error if the application is already started', () => {
      application.started = true;

      should(() => {
        application.import.users(users);
      }).throwError({ id: 'plugin.runtime.already_started' });
    });
  });
});
