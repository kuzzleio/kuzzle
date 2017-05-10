'use strict';

const
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Request = require('kuzzle-common-objects').Request,
  Role = require('../../../../../lib/api/core/models/security/role'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  RoleRepository = require('../../../../../lib/api/core/models/repositories/roleRepository');

describe('Test: repositories/roleRepository', () => {
  let
    kuzzle,
    roleRepository;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    roleRepository = new RoleRepository(kuzzle);

    return roleRepository.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#loadRoles', () => {
    it('should return in memory roles', () => {
      const role = {foo: 'bar'};

      roleRepository.roles.foo = role;
      roleRepository.loadMultiFromDatabase = sinon.stub();

      return roleRepository.loadRoles(['foo'])
        .then(result => {
          should(result)
            .be.eql([role]);
          should(roleRepository.loadMultiFromDatabase)
            .have.callCount(0);
        });
    });

    it('should complete unfetched default roles from config', () => {
      const role = {foo: 'bar'};

      roleRepository.roles.foo = role;
      roleRepository.loadMultiFromDatabase = sinon.stub();

      return roleRepository.loadRoles(['foo', 'admin', 'anonymous'])
        .then(result => {
          should(result)
            .be.an.Array()
            .have.length(3);

          should(result[0])
            .be.exactly(role);

          should(result[1])
            .be.an.instanceOf(Role)
            .match({
              _id: 'admin',
              controllers: {
                '*': {
                  actions: {
                    '*': true
                  }
                }
              }
            });

          should(result[2])
            .be.an.instanceOf(Role)
            .match({
              _id: 'anonymous'
            });
        });
    });

    it('should load roles from memory & database', () => {
      const
        role1 = new Role(),
        role2 = new Role(),
        role3 = new Role(),
        role4 = new Role();

      role1._id = 'role1';
      role2._id = 'role2';
      role3._id = 'role3';
      role4._id = 'role4';

      roleRepository.roles.role3 = role3;

      roleRepository.loadMultiFromDatabase = sinon.stub().returns(Promise.resolve([role1, role2, role4]));

      return roleRepository.loadRoles(['role1', 'role2', 'role3', 'role4'])
        .then(result => {
          // in memory roles are first in the result array
          should(result)
            .be.an.Array()
            .match([
              role3,
              role1,
              role2,
              role4
            ])
            .have.length(4);
        });
    });

  });

  describe('#loadRole', () => {
    it('should return a bad request error when no _id is provided', () => {
      return should(roleRepository.loadRole({})).rejectedWith(BadRequestError);
    });

    it('should load the role directly from memory if it\'s in memory', () => {
      const role = {foo: 'bar'};

      roleRepository.roles.foo = role;

      return roleRepository.loadRole('foo')
        .then(result => {
          should(result)
            .be.exactly(role);
        });
    });

    it('should load the role directly from DB if it\'s not in memory', () => {
      const role = {_id: 'foobar'};

      roleRepository.loadOneFromDatabase = sinon.stub().returns(Promise.resolve(role));

      return roleRepository.loadRole('foo')
        .then(result => {
          should(result)
            .be.exactly(role);

          should(roleRepository.roles.foobar)
            .be.exactly(role);
        });
    });
  });

  describe('#searchRole', () => {
    it('should filter the role list with the given controllers', () => {
      const roles = {
        default: {
          _id: 'default',
          controllers: {
            '*': {
              actions: {
                '*': true
              }
            }
          }
        },
        foo: {
          _id: 'foo',
          controllers: {
            foo: {
              actions: {
                '*': true
              }
            }
          }
        },
        bar: {
          _id: 'bar',
          controllers: {
            bar: {
              actions: {
                '*': true
              }
            }
          }
        },
        foobar: {
          _id: 'foobar',
          controllers: {
            foo: {
              actions: {
                '*': true
              }
            },
            bar: {
              actions: {
                '*': true
              }
            }
          }
        }
      };

      roleRepository.search = sinon.stub().returns(Promise.resolve({
        total: 4,
        hits: [
          roles.default,
          roles.foo,
          roles.bar,
          roles.foobar
        ]
      }));

      return roleRepository.searchRole(['foo'])
        .then(result => {
          should(result.total).be.exactly(3);
          should(result.hits.length).be.exactly(3);
          should(result.hits).match([roles.default, roles.foo, roles.foobar]);
          return roleRepository.searchRole(['bar']);
        })
        .then(result => {
          should(result.total).be.exactly(3);
          should(result.hits.length).be.exactly(3);
          should(result.hits).match([roles.default, roles.bar, roles.foobar]);
          return roleRepository.searchRole(['foo', 'bar']);
        })
        .then(result => {
          should(result.total).be.exactly(4);
          should(result.hits.length).be.exactly(4);
          should(result.hits).match([roles.default, roles.foo, roles.bar, roles.foobar]);
          return roleRepository.searchRole(['baz']);
        })
        .then(result => {
          should(result.total).be.exactly(1);
          should(result.hits.length).be.exactly(1);
          should(result.hits).match([roles.default]);
          return roleRepository.searchRole(['foo'], 1);
        })
        .then(result => {
          should(result.total).be.exactly(3);
          should(result.hits.length).be.exactly(2);
          should(result.hits).match([roles.foo, roles.foobar]);
          should(result.hits).not.match([roles.default]);
          return roleRepository.searchRole(['foo'], 0, 2);
        })
        .then(result => {
          should(result.total).be.exactly(3);
          should(result.hits.length).be.exactly(2);
          should(result.hits).match([roles.default, roles.foo]);
          should(result.hits).not.match([roles.foobar]);
          return roleRepository.searchRole(['foo', 'bar'], 1, 2);
        })
        .then(result => {
          should(result.total).be.exactly(4);
          should(result.hits.length).be.exactly(2);
          should(result.hits).match([roles.foo, roles.bar]);
          should(result.hits).not.match([roles.default]);
          should(result.hits).not.match([roles.foobar]);
        });
    });
  });

  describe('#deleteRole', () => {
    it('should reject and not trigger any event if trying to delete a reserved role', done => {
      let role = new Role();
      role._id = 'admin';

      roleRepository.deleteRole(role)
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError);
          should(e.message).be.exactly('admin is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.');
          should(kuzzle.pluginsManager.trigger).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should reject and not trigger any event if a profile uses the role about to be deleted', done => {
      kuzzle.repositories.profile.searchProfiles.returns(Promise.resolve({
        total: 1,
        hits: [
          'test'
        ]
      }));

      roleRepository.deleteRole({_id: 'test'})
        .then(() => {
          done(new Error('The promise is not rejected'));
        })
        .catch(e => {
          should(e).be.an.instanceOf(BadRequestError);
          should(e.message).be.exactly('The role "test" cannot be deleted since it is used by some profile.');
          should(kuzzle.pluginsManager.trigger).not.be.called();
          done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('should call deleteFromDatabase, remove the role from memory and trigger a "core:roleRepository:delete" event', () => {
      const role = new Role();
      role._id = 'foo';

      kuzzle.repositories.profile.searchProfiles.returns(Promise.resolve({total: 0}));
      roleRepository.deleteFromDatabase = sinon.stub().returns(Promise.resolve());
      roleRepository.roles.foo = true;

      return roleRepository.deleteRole(role)
        .then(() => {
          should(roleRepository.deleteFromDatabase)
            .be.calledOnce()
            .be.calledWith('foo');
          should(roleRepository.roles)
            .not.have.property('foo');
          should(kuzzle.pluginsManager.trigger)
            .be.calledOnce()
            .be.calledWith('core:roleRepository:delete', {_id: 'foo'});
        });
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      let
        result,
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        role = new Role();

      role._id = 'test';
      role.controllers = controllers;

      result = roleRepository.serializeToDatabase(role);


      should(result).not.be.an.instanceOf(Role);
      should(result).be.an.Object();
      should(result.controllers).be.an.Object();
      should(result.controllers).match(controllers);
      should(result).not.have.property('_id');
      should(result).not.have.property('restrictedTo');
      should(result).not.have.property('closures');
    });
  });

  describe('#getRoleFromRequest', () => {
    it('should build a valid role object', () => {
      const
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        request = new Request({
          collection: 'collection',
          controller: 'controller',
          action: 'action',
          _id: 'roleId',
          body: {
            controllers: controllers
          }
        }),
        role = roleRepository.getRoleFromRequest(request);

      should(role._id).be.exactly('roleId');
      should(role.controllers).be.eql(controllers);
    });
  });

  describe('#validateAndSaveRole', () => {
    it('should reject if we update the anonymous with a role it cannot log with - case 1', () => {
      const
        bad1 = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        role = new Role();

      role._id = 'anonymous';
      role.controllers = bad1;

      return should(roleRepository.validateAndSaveRole(role))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject if we update the anonymous with a role it cannot log with - case 2', () => {
      const
        bad = {
          '*': {
            actions: {
              '*': false
            }
          }
        },
        role = new Role();

      role._id = 'anonymous';
      role.controllers = bad;

      return should(roleRepository.validateAndSaveRole(role))
        .be.rejectedWith(BadRequestError);
    });

    it('should reject if we update the anonymous with a role it cannot log with - case 3', () => {
      const
        bad = {
          auth: {
            actions: {
              login: false
            }
          }
        },
        role = new Role();

      role._id = 'anonymous';
      role.controllers = bad;

      return should(roleRepository.validateAndSaveRole(role))
        .be.rejectedWith(BadRequestError);
    });

    it('should allow updating the anonymous as long as it can log in', () => {
      const
        rights = {
          '*': {
            actions: {
              login: true
            }
          }
        },
        role = new Role();

      role._id = 'anonymous';
      role.controllers = rights;

      return roleRepository.validateAndSaveRole(role)
        .then(response => {
          should(response._id)
            .be.eql('anonymous');
        });
    });

    it('should persist the role to the database and trigger a "core:roleRepository:save" event when ok', () => {
      const
        controllers = {
          controller: {
            actions: {
              action: true
            }
          }
        },
        role = new Role();
      role._id = 'test';
      role.controllers = controllers;

      roleRepository.persistToDatabase = sinon.stub().returns(Promise.resolve());

      return roleRepository.validateAndSaveRole(role)
        .then(() => {
          should(roleRepository.persistToDatabase)
            .be.calledOnce()
            .be.calledWith(role);
          should(kuzzle.pluginsManager.trigger)
            .be.calledOnce()
            .be.calledWith('core:roleRepository:save', {_id: 'test', controllers: controllers});
        });
    });
  });
});
