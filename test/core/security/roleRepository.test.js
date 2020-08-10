'use strict';

const sinon = require('sinon');
const should = require('should');
const {
  BadRequestError,
  NotFoundError,
  PreconditionError,
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Role = require('../../../lib/model/security/role');
const RoleRepository = require('../../../lib/core/security/roleRepository');
const Repository = require('../../../lib/core/shared/repository');

describe('Test: security/roleRepository', () => {
  let kuzzle;
  let roleRepository;
  let profileRepositoryMock;
  let fakeRole;

  beforeEach(() => {
    fakeRole = new Role();
    fakeRole._id = 'foo';

    kuzzle = new KuzzleMock();
    kuzzle.ask.restore();

    profileRepositoryMock = {
      searchProfiles: sinon.stub(),
    };

    roleRepository = new RoleRepository(kuzzle, {
      profile: profileRepositoryMock,
    });

    return roleRepository.init();
  });

  describe('#loadOneFromDatabase', () => {
    beforeEach(() => {
      sinon.stub(Repository.prototype, 'loadOneFromDatabase');
    });

    afterEach(() => {
      Repository.prototype.loadOneFromDatabase.restore();
    });

    it('should invoke its super function', async () => {
      Repository.prototype.loadOneFromDatabase.resolves('foo');

      await should(roleRepository.loadOneFromDatabase('bar'))
        .fulfilledWith('foo');

      should(Repository.prototype.loadOneFromDatabase)
        .calledWith('bar');
    });

    it('should wrap generic 404s into profile dedicated errors', () => {
      const error = new Error('foo');
      error.status = 404;

      Repository.prototype.loadOneFromDatabase.rejects(error);

      return should(roleRepository.loadOneFromDatabase('foo'))
        .rejectedWith(NotFoundError, { id: 'security.role.not_found' });
    });

    it('should re-throw non-404 errors as is', () => {
      const error = new Error('foo');

      Repository.prototype.loadOneFromDatabase.rejects(error);

      return should(roleRepository.loadOneFromDatabase('foo'))
        .rejectedWith(error);
    });
  });


  describe('#mGet', () => {
    const mGetEvent = 'core:security:role:mGet';

    beforeEach(() => {
      sinon.stub(roleRepository, 'loadOneFromDatabase');
    });

    it('should register a mGet event', async () => {
      sinon.stub(roleRepository, 'loadRoles');

      await kuzzle.ask(mGetEvent, 'foo');

      should(roleRepository.loadRoles).calledWith('foo');
    });

    it('should return in memory roles', async () => {
      roleRepository.roles.set(fakeRole._id, fakeRole);
      roleRepository.loadOneFromDatabase = sinon.stub();

      const result = await kuzzle.ask(mGetEvent, [fakeRole._id]);

      should(result).be.eql([fakeRole]);
      should(roleRepository.loadOneFromDatabase).not.called();
    });

    it('should load roles from memory & database', async () => {
      const role1 = new Role();
      const role2 = new Role();
      const role3 = new Role();
      const role4 = new Role();

      role1._id = 'role1';
      role2._id = 'role2';
      role3._id = 'role3';
      role4._id = 'role4';

      roleRepository.roles.set('role3', role3);

      roleRepository.loadOneFromDatabase.withArgs('role1').resolves(role1);
      roleRepository.loadOneFromDatabase.withArgs('role2').resolves(role2);
      roleRepository.loadOneFromDatabase.withArgs('role4').resolves(role4);

      const result = await kuzzle.ask(mGetEvent, [
        'role1',
        'role2',
        'role3',
        'role4'
      ]);

      should(result)
        .be.an.Array()
        .match([role1, role2, role3, role4])
        .have.length(4);
      should(roleRepository.loadOneFromDatabase).calledWith('role1');
      should(roleRepository.loadOneFromDatabase).calledWith('role2');
      should(roleRepository.loadOneFromDatabase).neverCalledWith('role3');
      should(roleRepository.loadOneFromDatabase).calledWith('role4');
    });
  });

  describe('#get', () => {
    const getEvent = 'core:security:role:get';

    beforeEach(() => {
      sinon.stub(roleRepository, 'loadOneFromDatabase');
    });

    it('should register a "get" event', async () => {
      sinon.stub(roleRepository, 'load');

      await kuzzle.ask(getEvent, 'foo');

      should(roleRepository.load).calledWithMatch('foo');
    });

    it('should load the role directly from the cache, if present', async () => {
      roleRepository.roles.set(fakeRole._id, fakeRole);

      const result = await kuzzle.ask(getEvent, fakeRole._id);

      should(result).be.exactly(fakeRole);
    });

    it('should load the role directly from DB if it is not in memory', async () => {
      roleRepository.loadOneFromDatabase
        .withArgs(fakeRole._id)
        .resolves(fakeRole);

      const result = await kuzzle.ask(getEvent, fakeRole._id);

      should(result).be.exactly(fakeRole);
      should(roleRepository.roles).have.key(fakeRole._id, fakeRole);
    });
  });

  describe('#search', () => {
    const searchEvent = 'core:security:role:search';

    it('should register a "search" event', async () => {
      sinon.stub(roleRepository, 'searchRole');

      await kuzzle.ask(searchEvent, 'foo', 'bar');

      should(roleRepository.searchRole).calledWith('foo', 'bar');
    });

    it('should filter the role list with the given controllers', async () => {
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

      sinon.stub(roleRepository, 'search').resolves({
        total: 4,
        hits: [
          roles.default,
          roles.foo,
          roles.bar,
          roles.foobar
        ]
      });

      let result;

      result = await kuzzle.ask(searchEvent, ['foo']);
      should(result.total).be.exactly(3);
      should(result.hits.length).be.exactly(3);
      should(result.hits).match([roles.default, roles.foo, roles.foobar]);

      result = await kuzzle.ask(searchEvent, ['bar']);
      should(result.total).be.exactly(3);
      should(result.hits.length).be.exactly(3);
      should(result.hits).match([roles.default, roles.bar, roles.foobar]);

      result = await kuzzle.ask(searchEvent, ['foo', 'bar']);
      should(result.total).be.exactly(4);
      should(result.hits.length).be.exactly(4);
      should(result.hits).match([roles.default, roles.foo, roles.bar, roles.foobar]);

      result = await kuzzle.ask(searchEvent, ['baz']);
      should(result.total).be.exactly(1);
      should(result.hits.length).be.exactly(1);
      should(result.hits).match([roles.default]);

      result = await kuzzle.ask(searchEvent, ['foo'], {from: 1});
      should(result.total).be.exactly(3);
      should(result.hits.length).be.exactly(2);
      should(result.hits).match([roles.foo, roles.foobar]);
      should(result.hits).not.match([roles.default]);

      result = await kuzzle.ask(searchEvent, ['foo'], {size: 2});
      should(result.total).be.exactly(3);
      should(result.hits.length).be.exactly(2);
      should(result.hits).match([roles.default, roles.foo]);
      should(result.hits).not.match([roles.foobar]);

      result = await kuzzle.ask(searchEvent, ['foo', 'bar'], {
        from: 1,
        size: 2
      });
      should(result.total).be.exactly(4);
      should(result.hits.length).be.exactly(2);
      should(result.hits).match([roles.foo, roles.bar]);
      should(result.hits).not.match([roles.default]);
      should(result.hits).not.match([roles.foobar]);
    });
  });

  describe('#delete', () => {
    const deleteEvent = 'core:security:role:delete';

    beforeEach(() => {
      sinon.stub(roleRepository, 'deleteFromDatabase').resolves();
      sinon.stub(roleRepository, 'load')
        .withArgs(fakeRole._id)
        .resolves(fakeRole);
    });

    it('should register a "delete" event', async () => {
      sinon.stub(roleRepository, 'deleteById').resolves();

      await kuzzle.ask(deleteEvent, 'foo', 'bar');

      should(roleRepository.deleteById).calledWith('foo', 'bar');
    });

    it('should reject if trying to delete a reserved role', async () => {
      for (const id of ['admin', 'default', 'anonymous']) {
        let role = new Role();
        role._id = id;

        roleRepository.load.withArgs(id).resolves(role);

        await should(kuzzle.ask(deleteEvent, id))
          .rejectedWith(BadRequestError, { id: 'security.role.cannot_delete' });

        should(kuzzle.emit).not.be.called();
        should(roleRepository.deleteFromDatabase).not.called();
      }
    });

    it('should reject if a profile uses the role about to be deleted', async () => {
      profileRepositoryMock.searchProfiles.resolves({
        total: 1,
        hits: [fakeRole._id]
      });

      await should(kuzzle.ask(deleteEvent, fakeRole._id))
        .rejectedWith(PreconditionError, { id: 'security.role.in_use' });

      should(kuzzle.emit).not.be.called();
      should(roleRepository.deleteFromDatabase).not.called();
    });

    it('should call thoroughly delete a role', async () => {
      profileRepositoryMock.searchProfiles.resolves({total: 0});
      roleRepository.roles.set(fakeRole._id, fakeRole);

      await kuzzle.ask(deleteEvent, fakeRole._id);

      should(roleRepository.deleteFromDatabase)
        .be.calledOnce()
        .be.calledWith(fakeRole._id);
      should(roleRepository.roles).not.have.key(fakeRole._id);
      should(kuzzle.emit)
        .be.calledOnce()
        .be.calledWith('core:roleRepository:delete', {_id: fakeRole._id});
    });

    it('should reject if the role to delete cannot be loaded', async () => {
      const error = new Error('foo');

      roleRepository.load.withArgs(fakeRole._id).rejects(error);

      return should(kuzzle.ask(deleteEvent, fakeRole._id)).rejectedWith(error);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should return a plain flat object', () => {
      let result;
      let controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      fakeRole.controllers = controllers;

      result = roleRepository.serializeToDatabase(fakeRole);

      should(result).not.be.an.instanceOf(Role);
      should(result).be.an.Object();
      should(result.controllers).be.an.Object();
      should(result.controllers).match(controllers);
      should(result).not.have.property('_id');
      should(result).not.have.property('restrictedTo');
    });
  });

  describe('#validateAndSaveRole', () => {
    it('should throw if we update the anonymous with a role it cannot log with - case 1', async () => {
      const bad1 = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      fakeRole._id = 'anonymous';
      fakeRole.controllers = bad1;

      await should(roleRepository.validateAndSaveRole(fakeRole))
        .rejectedWith(BadRequestError, {id: 'security.role.login_required'});
    });

    it('should throw if we update the anonymous with a role it cannot log with - case 2', async () => {
      const bad = {
        '*': {
          actions: {
            '*': false
          }
        }
      };

      fakeRole._id = 'anonymous';
      fakeRole.controllers = bad;

      await should(roleRepository.validateAndSaveRole(fakeRole))
        .rejectedWith(BadRequestError, {id: 'security.role.login_required'});
    });

    it('should throw if we update the anonymous with a role it cannot log with - case 3', async () => {
      const bad = {
        auth: {
          actions: {
            login: false
          }
        }
      };

      fakeRole._id = 'anonymous';
      fakeRole.controllers = bad;

      await should(roleRepository.validateAndSaveRole(fakeRole))
        .rejectedWith(BadRequestError, {id: 'security.role.login_required'});
    });

    it('should allow updating the anonymous as long as it can log in', async () => {
      const rights = {
        '*': {
          actions: {
            login: true
          }
        }
      };

      fakeRole._id = 'anonymous';
      fakeRole.controllers = rights;
      sinon.stub(roleRepository, 'loadOneFromDatabase').resolves(fakeRole);
      sinon.stub(roleRepository, 'checkRoleNativeRights').resolves();
      sinon.stub(roleRepository, 'checkRolePluginsRights').resolves();

      const response = await roleRepository.validateAndSaveRole(fakeRole);

      should(response._id).be.eql('anonymous');
    });

    it('should correctly persist the role', async () => {
      const controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      fakeRole._id = 'test';
      fakeRole.controllers = controllers;

      sinon.stub(roleRepository, 'checkRoleNativeRights').resolves();
      sinon.stub(roleRepository, 'checkRolePluginsRights').resolves();
      sinon.stub(roleRepository, 'persistToDatabase').resolves();
      sinon.stub(roleRepository, 'loadOneFromDatabase').resolves(fakeRole);

      roleRepository.indexStorage._storageEngine.get.resolves({});

      await roleRepository.validateAndSaveRole(fakeRole);

      should(roleRepository.persistToDatabase)
        .be.calledOnce()
        .be.calledWith(fakeRole);
      should(kuzzle.emit)
        .be.calledOnce()
        .be.calledWith(
          'core:roleRepository:save',
          { _id: 'test', controllers: controllers });
    });
  });

  describe('#checkRoleNativeRights', () => {
    const { NativeController } = require('../../../lib/api/controller/base');

    beforeEach(() => {
      kuzzle.funnel.controllers.set('document', new NativeController(kuzzle, [
        'create',
        'delete'
      ]));

      kuzzle.funnel.isNativeController
        .callsFake(ctrl => kuzzle.funnel.controllers.has(ctrl));
    });

    it('should skip if the tested role does not concern native controllers', () => {
      const role = new Role();

      role.controllers = { 'foo': 'trolololo' };

      should(() => roleRepository.checkRoleNativeRights(role)).not.throw();
    });

    it('should throw if a role contains an unknown action', () => {
      const role = new Role();

      role._id = 'test';
      role.controllers = {
        document: {
          actions: {
            create: true,
            delete: false,
            iDontExist: true,
          }
        }
      };

      should(() => roleRepository.checkRoleNativeRights(role)).throw({
        id: 'security.role.unknown_action'
      });
    });

    it('should validate if a role contains known actions', () => {
      const role = new Role();
      role._id = 'test';
      role.controllers = {
        document: {
          actions: {
            create: true,
            delete: false,
          }
        }
      };

      should(() => roleRepository.checkRoleNativeRights(role)).not.throw();
    });

    it('should validate if a role contains a wildcarded action', () => {
      const role = new Role();

      role._id = 'test';
      role.controllers = {
        document: {
          actions: {
            '*': true,
            create: true,
            delete: false,
          }
        }
      };

      should(() => roleRepository.checkRoleNativeRights(role)).not.throw();
    });

    it('should validate if a wildcarded role contains specific actions', () => {
      const role = new Role();

      role._id = 'test';
      role.controllers = {
        '*': {
          actions: {
            '*': true,
            create: true,
            delete: false,
          }
        }
      };

      should(() => roleRepository.checkRoleNativeRights(role)).throw({
        id: 'security.role.unknown_action'
      });
    });
  });

  describe('#checkRolePluginsRights', () => {
    let plugin_test;

    beforeEach(() => {
      plugin_test = {
        object: {
          controllers: {
            foobar: { publicMethod: 'function' }
          }
        }
      };

      kuzzle.pluginsManager.plugins = { plugin_test };
    });

    it('should skip non-plugins or wildcarded controllers', () => {
      kuzzle.pluginsManager.isController.returns(false);

      const role = new Role();
      role.controllers = { '*': 123 };

      kuzzle.funnel.isNativeController.returns(false);
      should(() => roleRepository.checkRolePluginsRights(role)).not.throw();

      role.controllers = { 'foo': 0 };

      kuzzle.funnel.isNativeController.returns(true);
      should(() => roleRepository.checkRolePluginsRights(role)).not.throw();
    });

    it('should warn if we force a role having an invalid plugin controller.', () => {
      kuzzle.pluginsManager.isController.returns(false);
      const role = new Role();

      role._id = 'test';
      role.controllers = {
        'invalid_controller': {
          actions: {
            publicMethod: true
          }
        }
      };

      roleRepository.checkRolePluginsRights(role, {force: true});

      should(kuzzle.log.warn).be.calledWith('The role "test" gives access to the non-existing controller "invalid_controller".');
    });

    it('should throw if we try to write a role with an invalid plugin controller.', () => {
      kuzzle.pluginsManager.isController.returns(false);
      kuzzle.pluginsManager.getControllerNames.returns(['foobar']);

      const role = new Role();

      role._id = 'test';
      role.controllers = {
        'invalid_controller': {
          actions: {
            publicMethod: true
          }
        }
      };

      should(() => roleRepository.checkRolePluginsRights(role)).throw({
        id: 'security.role.unknown_controller'
      });
    });

    it('should warn if we force a role having an invalid plugin action.', () => {
      kuzzle.pluginsManager.isController = sinon.stub().returns(true);
      kuzzle.pluginsManager.isAction = sinon.stub().returns(false);
      const controllers = {
          'foobar': {
            actions: {
              iDontExist: true
            }
          }
        },
        role = new Role();
      role._id = 'test';
      role.controllers = controllers;
      roleRepository.checkRolePluginsRights(role, {force: true});
      should(kuzzle.log.warn).be.calledWith('The role "test" gives access to the non-existing action "iDontExist" for the controller "foobar".');
    });

    it('should throw if we try to write a role with an invalid plugin action.', () => {
      kuzzle.pluginsManager.isController.returns(true);
      kuzzle.pluginsManager.getActions.returns(['foobar']);
      const role = new Role();

      role._id = 'test';
      role.controllers = {
        'foobar': {
          actions: {
            iDontExist: true
          }
        }
      };

      should(() => roleRepository.checkRolePluginsRights(role)).throw({
        id: 'security.role.unknown_action'
      });
    });

    it('should not warn nor throw when a role contains valid controller and action.', () => {
      kuzzle.pluginsManager.isController.returns(true);
      kuzzle.pluginsManager.isAction.returns(true);

      const role = new Role();

      role._id = 'test';
      role.controllers = {
        'foobar': {
          actions: {
            publicMethod: true
          }
        }
      };

      should(() => roleRepository.checkRolePluginsRights(role)).not.throw();
      should(kuzzle.log.warn).be.not.called();
    });

    it('should throw on an unknown plugin action, if not forced', () => {
    });
  });

  describe('#create', () => {
    const createEvent = 'core:security:role:create';

    beforeEach(() => {
      sinon.stub(roleRepository, 'validateAndSaveRole');
    });

    it('should register a "create" event', async () => {
      sinon.stub(roleRepository, 'create');

      await kuzzle.ask(createEvent, 'foo', 'bar', 'baz');

      should(roleRepository.create).calledWith('foo', 'bar', 'baz');
    });

    it('should pass the right configuration to validateAndSaveRole', async () => {
      const content = {
        _id: 'ohnoes',
        _kuzzle_info: 'nope',
        bar: 'bar',
        foo: 'foo',
      };

      await kuzzle.ask(createEvent, 'foobar', content, {
        refresh: 'refresh',
        userId: 'userId',
      });

      should(roleRepository.validateAndSaveRole)
        .calledWithMatch(sinon.match.object, {
          method: 'create',
          refresh: 'refresh'
        });

      const role = roleRepository.validateAndSaveRole.firstCall.args[0];
      should(role).instanceOf(Role);
      should(role._id).eql('foobar');
      should(role.bar).eql('bar');
      should(role.foo).eql('foo');
      should(role._kuzzle_info).match({
        author: 'userId',
        updatedAt: null,
        updater: null,
      });
      should(role._kuzzle_info.createdAt).approximately(Date.now(), 1000);
    });

    it('should resolve to the validateAndSaveRole result', () => {
      roleRepository.validateAndSaveRole.resolves('foobar');

      return should(kuzzle.ask(createEvent, 'foo', {}, {}))
        .fulfilledWith('foobar');
    });
  });

  describe('#createOrReplace', () => {
    const createOrReplaceEvent = 'core:security:role:createOrReplace';

    beforeEach(() => {
      sinon.stub(roleRepository, 'validateAndSaveRole');
    });

    it('should register a "createOrReplace" event', async () => {
      sinon.stub(roleRepository, 'createOrReplace');

      await kuzzle.ask(createOrReplaceEvent, 'foo', 'bar', 'baz');

      should(roleRepository.createOrReplace).calledWith('foo', 'bar', 'baz');
    });

    it('should pass the right configuration to validateAndSaveRole', async () => {
      const content = {
        _id: 'ohnoes',
        _kuzzle_info: 'nope',
        bar: 'bar',
        foo: 'foo',
      };

      await kuzzle.ask(createOrReplaceEvent, 'foobar', content, {
        refresh: 'refresh',
        userId: 'userId',
      });

      should(roleRepository.validateAndSaveRole)
        .calledWithMatch(sinon.match.object, {
          method: 'createOrReplace',
          refresh: 'refresh'
        });

      const role = roleRepository.validateAndSaveRole.firstCall.args[0];
      should(role).instanceOf(Role);
      should(role._id).eql('foobar');
      should(role.bar).eql('bar');
      should(role.foo).eql('foo');
      should(role._kuzzle_info).match({
        author: 'userId',
        updatedAt: null,
        updater: null,
      });
      should(role._kuzzle_info.createdAt).approximately(Date.now(), 1000);
    });

    it('should resolve to the validateAndSaveRole result', () => {
      roleRepository.validateAndSaveRole.resolves('foobar');

      return should(kuzzle.ask(createOrReplaceEvent, 'foo', {}, {}))
        .fulfilledWith('foobar');
    });
  });

  describe('#truncate', () => {
    const truncateEvent = 'core:security:role:truncate';

    beforeEach(() => {
      sinon.stub(Repository.prototype, 'truncate').resolves();
    });

    afterEach(() => {
      Repository.prototype.truncate.restore();
    });

    it('should register a "truncate" event', async () => {
      sinon.stub(roleRepository, 'truncate');

      await kuzzle.ask(truncateEvent, 'foo');

      should(roleRepository.truncate).calledWith('foo');
    });

    it('should clear the RAM cache once the truncate succeeds', async () => {
      const opts = {foo: 'bar'};

      roleRepository.roles.set('foo', 'bar');
      roleRepository.roles.set('baz', 'qux');

      await roleRepository.truncate(opts);

      should(Repository.prototype.truncate).calledWith(opts);
      should(roleRepository.roles).be.empty();
    });

    it('should clear the RAM cache even if the truncate fails', async () => {
      const error = new Error('foo');

      Repository.prototype.truncate.rejects(error);

      roleRepository.roles.set('foo', 'bar');
      roleRepository.roles.set('baz', 'qux');

      await should(roleRepository.truncate()).rejectedWith(error);

      should(roleRepository.roles).be.empty();
    });
  });

  describe('#update', () => {
    const updateEvent = 'core:security:role:update';

    beforeEach(() => {
      sinon.stub(roleRepository, 'validateAndSaveRole');
      sinon.stub(roleRepository, 'load').resolves(fakeRole);
    });

    it('should register a "update" event', async () => {
      sinon.stub(roleRepository, 'update');

      await kuzzle.ask(updateEvent, 'foo', 'bar', 'baz');

      should(roleRepository.update).calledWith('foo', 'bar', 'baz');
    });

    it('should reject if the role does not exist', () => {
      const error = new Error('foo');
      roleRepository.load.rejects(new Error('foo'));

      return should(kuzzle.ask(updateEvent, 'foo', {}, {}))
        .rejectedWith(error);
    });

    it('should pass the right configuration to validateAndSaveRole', async () => {
      const content = {
        _id: 'ohnoes',
        _kuzzle_info: 'nope',
        bar: 'bar',
        foo: 'foo',
      };

      await kuzzle.ask(updateEvent, 'foobar', content, {
        refresh: 'refresh',
        userId: 'userId',
      });

      should(roleRepository.validateAndSaveRole)
        .calledWithMatch(sinon.match.object, {
          method: 'update',
          refresh: 'refresh'
        });

      const role = roleRepository.validateAndSaveRole.firstCall.args[0];
      should(role).instanceOf(Role);
      should(role._id).eql('foobar');
      should(role.bar).eql('bar');
      should(role.foo).eql('foo');
      should(role._kuzzle_info).match({
        updater: 'userId',
      });
      should(role._kuzzle_info.updatedAt).approximately(Date.now(), 1000);
    });

    it('should resolve to the validateAndSaveRole result', () => {
      roleRepository.validateAndSaveRole.resolves('foobar');

      return should(kuzzle.ask(updateEvent, 'foo', {}, {}))
        .fulfilledWith('foobar');
    });
  });

  describe('#sanityCheck', () => {
    const sanityCheckEvent = 'core:security:verify';

    it('should register a "verify" event', async () => {
      sinon.stub(roleRepository, 'sanityCheck');

      await kuzzle.ask(sanityCheckEvent);

      should(roleRepository.sanityCheck).calledOnce();
    });

    it('should perform a check on all plugin roles', async () => {
      const role1 = new Role();
      const role2 = new Role();
      const role3 = new Role();

      sinon.stub(roleRepository, 'search').resolves({
        hits: [ role1, role2, role3 ],
      });

      sinon.stub(roleRepository, 'checkRolePluginsRights');

      await kuzzle.ask(sanityCheckEvent);

      should(roleRepository.checkRolePluginsRights)
        .calledWithMatch(role1, { force: true })
        .calledWithMatch(role2, { force: true })
        .calledWithMatch(role3, { force: true });
    });
  });

  describe('#invalidate', () => {
    const invalidateEvent = 'core:security:role:invalidate';

    it('should register an "invalidate" event', async () => {
      sinon.stub(roleRepository, 'invalidate');

      await kuzzle.ask(invalidateEvent, 'foo');

      should(roleRepository.invalidate).calledWith('foo');
    });

    it('should invalidate only the provided role', async () => {
      roleRepository.roles.set('foo', 'bar');
      roleRepository.roles.set('baz', 'qux');

      await kuzzle.ask(invalidateEvent, 'baz');

      should(roleRepository.roles).has.key('foo');
      should(roleRepository.roles).not.has.key('baz');
    });

    it('should invalidate the entire cache with no argument', async () => {
      roleRepository.roles.set('foo', 'bar');
      roleRepository.roles.set('baz', 'qux');

      await kuzzle.ask(invalidateEvent);

      should(roleRepository.roles).be.empty();
    });
  });
});
