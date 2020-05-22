'use strict';

const Bluebird = require('bluebird');
const should = require('should');
const sinon = require('sinon');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const {
  Request,
  errors: {
    BadRequestError,
    NotFoundError,
    PluginImplementationError,
    SizeLimitError,
    PreconditionError
  }
} = require('kuzzle-common-objects');
const SecurityController = require('../../../../lib/api/controller/security');
const User = require('../../../../lib/model/security/user');

describe('Test: security controller - users', () => {
  let kuzzle;
  let request;
  let securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);
    request = new Request({controller: 'security'});
    kuzzle.internalIndex.getMapping.resolves({
      internalIndex: {
        mappings: {
          users: {
            properties: {}
          }
        }
      }
    });
    kuzzle.internalIndex.get.resolves({});
  });

  describe('#persistUser', () => {
    const createEvent = 'core:security:user:create';
    const deleteEvent = 'core:security:user:delete';
    const content = { foo: 'bar' };
    let fakeUser;
    let profileIds;
    let createStub;
    let deleteStub;
    let strategyCreateStub;
    let strategyExistsStub;
    let strategyValidateStub;

    beforeEach(() => {
      profileIds = ['foo' ];
      request.input.resource._id = 'test';
      request.input.body = {
        content: {name: 'John Doe', profileIds},
        credentials: {someStrategy: {some: 'credentials'}}
      };
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      fakeUser = new User();
      createStub = kuzzle.ask
        .withArgs(
          createEvent,
          request.input.resource._id,
          profileIds,
          content,
          sinon.match.object)
        .resolves(fakeUser);
      deleteStub = kuzzle.ask
        .withArgs(deleteEvent, request.input.resource._id, sinon.match.object)
        .resolves();

      strategyCreateStub = sinon.stub().resolves();
      strategyExistsStub = sinon.stub().resolves(false);
      strategyValidateStub = sinon.stub().resolves();

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'create')
        .returns(strategyCreateStub);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'exists')
        .returns(strategyExistsStub);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'validate')
        .returns(strategyValidateStub);
    });

    it('should reject if a strategy is unknown', async () => {
      kuzzle.pluginsManager.listStrategies.returns(['oops']);

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(BadRequestError, {
          id: 'security.credentials.unknown_strategy'
        });

      should(createStub).not.called();
      should(deleteStub).not.called();
    });

    it('should reject if credentials already exist on the provided user id', async () => {
      strategyExistsStub.resolves(false);

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(PluginImplementationError, {
          id: 'security.credentials.database_inconsistency'
        });

      should(createStub).not.called();
      should(deleteStub).not.called();
    });

    it('should rollback if credentials don\'t validate the strategy', async () => {
      strategyValidateStub.rejects(new Error('error'));

      await should(securityController._persistUser(request, profileIds, content))
        .be.rejectedWith(BadRequestError, {
          id: 'security.credentials.rejected'
        });

      should(kuzzle.ask).calledWithMatch(
        createEvent,
        request.input.resource._id,
        profileIds,
        content,
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWithMatch(
        deleteEvent,
        request.input.resource._id,
        { refresh: 'false' });
    });

    it('should reject and rollback if credentials don\'t create properly', async () => {
      strategyCreateStub.rejects(new Error('some error'));

      await should(securityController._persistUser(request, profileIds, content))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.runtime.unexpected_error',
        });

      should(kuzzle.ask).calledWithMatch(
        deleteEvent,
        request.input.resource._id,
        { refresh: 'false' });
    });

    it('should not create credentials if user creation fails', async () => {
      const error = new Error('error');
      createStub.rejects(error);

      await should(securityController._persistUser(request, profileIds, content))
        .rejectedWith(error);

      should(strategyCreateStub).not.called();
    });

    it('should intercept errors during deletion of a rollback phase', async () => {
      kuzzle.pluginsManager.listStrategies.returns(['foo', 'someStrategy']);

      // "foo" should be created before "someStrategy": we make the stub
      // succeeds when the "create" method is invoked, and fail when its
      // "delete" one is invoked
      const fooDeleteStub = sinon.stub().rejects(new Error('foo delete error'));
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'validate')
        .returns(sinon.stub().resolves());
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'exists')
        .returns(sinon.stub().resolves(false));
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'create')
        .returns(sinon.stub().resolves());
      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('foo', 'delete')
        .returns(fooDeleteStub);

      strategyCreateStub.rejects(new Error('oh noes'));

      request.input.body.credentials.foo = { firstname: 'X Æ A-12' };

      await should(securityController._persistUser(request, profileIds, content))
        .rejectedWith(PluginImplementationError, {
          id: 'plugin.runtime.unexpected_error',
          message: /.*ohnoes\nfoo delete error.*/,
        });

      should(fooDeleteStub).calledWithMatch(
        request,
        request.input.resource._id,
        'foo');
    });
  });

  describe('#updateUserMapping', () => {
    const foo = {foo: 'bar'};

    it('should reject if the body is missing', () => {
      return should(securityController.updateUserMapping(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required'});
    });

    it('should update the user mapping', async () => {
      request.input.body = foo;
      kuzzle.internalIndex.updateMapping.resolves(foo);

      const response = await securityController.updateUserMapping(request);

      should(kuzzle.internalIndex.updateMapping)
        .be.calledOnce()
        .be.calledWith('users', request.input.body);

      should(response).eql(foo);
    });
  });

  describe('#getUserMapping', () => {
    it('should fulfill with a response object', async () => {
      kuzzle.internalIndex.getMapping.resolves({ properties: { foo: 'bar' } });

      const response = await securityController.getUserMapping(request);

      should(kuzzle.internalIndex.getMapping)
        .be.calledOnce()
        .be.calledWith('users');

      should(response).match({ mapping: { foo: 'bar' } });
    });
  });

  describe('#getUser', () => {
    it('should reject if no id is given', () => {
      return should(securityController.getUser(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should load and return the requested user', async () => {
      const user = new User();

      user._id = 'foo';
      user._source = { bar: 'baz' };

      request.input.resource._id = 'foo';

      kuzzle.ask
        .withArgs('core:security:user:get', request.input.resource._id)
        .resolves(user);

      const response = await securityController.getUser(request);

      should(response).match({
        _id: 'foo',
        _source: {bar: 'baz'},
      });
    });

    it('should forward errors from the security module', () => {
      request.input.resource._id = 'foo';

      const error = new Error('oh noes');

      kuzzle.ask
        .withArgs('core:security:user:get', request.input.resource._id)
        .rejects(error);

      return should(securityController.get(request)).rejectedWith(error);
    });
  });

  describe('#mGetUsers', () => {
    it('should forward to the generic _mDelete method', async () => {
      sinon.stub(securityController, '_mDelete').resolves('foobar');

      await should(securityController.mGetUsers(request)).fulfilledWith('foobar');

      should(securityController._mDelete).calledWith('user', request);
    });
  });

  describe('#searchUsers', () => {
    const searchEvent = 'core:security:user:search';
    let searchStub;

    beforeEach(() => {
      request.input.body = { query: {foo: 'bar' } };
      request.input.args.from = 13;
      request.input.args.size = 42;
      request.input.args.scroll = 'foo';

      searchStub = kuzzle.ask
        .withArgs(searchEvent, sinon.match.any, sinon.match.object)
        .resolves({
          hits: [{ _id: 'admin', _source: { profileIds: ['admin'] } }],
          total: 2,
          scrollId: 'foobar'
        });
    });

    it('should return a valid responseObject', async () => {
      const response = await securityController.searchUsers(request);

      should(searchStub).be.calledWithMatch(
        searchEvent,
        request.input.body,
        {from: 13, size: 42, scroll: 'foo'});

      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should handle empty body requests', async () => {
      request.input.body = null;

      const response = await securityController.searchUsers(new Request({}));

      should(searchStub).be.calledWithMatch(searchEvent, {}, {});

      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should allow `aggregations` and `highlight` arguments', async () => {
      request.input.body.aggregations = 'aggregations';

      await securityController.searchUsers(new Request({
        body: { aggregations: 'aggregations' }
      }));

      should(searchStub).be.calledWithMatch(
        searchEvent,
        { aggregations: 'aggregations' },
        { from: 0, size: 10, scroll: undefined });

      // highlight only
      searchStub.resetHistory();
      await securityController.searchUsers(new Request({
        body: {
          highlight: 'highlight'
        }
      }));

      should(searchStub).be.calledWithMatch(
        searchEvent,
        { highlight: 'highlight' },
        { from: 0, size: 10, scroll: undefined });

      // all in one
      searchStub.resetHistory();
      await securityController.searchUsers(new Request({
        body: {
          query: { match_all: {} },
          aggregations: 'aggregations',
          highlight: 'highlight'
        }
      }));

      should(searchStub).be.calledWithMatch(
        searchEvent,
        {
          aggregations: 'aggregations',
          highlight: 'highlight',
          query: { match_all: {} },
        },
        { from: 0, size: 10, scroll: undefined });
    });

    it('should reject if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;
      request = new Request({ size: 10 });

      return should(securityController.searchUsers(request))
        .rejectedWith(SizeLimitError, {
          id: 'services.storage.get_limit_exceeded'
        });
    });

    it('should forward a security module exception', () => {
      const error = new Error('Mocked error');
      searchStub.rejects(error);

      return should(securityController.searchUsers(request))
        .be.rejectedWith(error);
    });
  });

  describe('#scrollUsers', () => {
    const scrollEvent = 'core:security:user:scroll';
    let scrollStub;

    beforeEach(() => {
      request.input.args.scrollId = 'foobar';
      scrollStub = kuzzle.ask
        .withArgs(scrollEvent, sinon.match.string, sinon.match.string)
        .resolves({
          hits: [{ _id: 'admin', _source: { profileIds: ['admin'] } }],
          total: 2,
          scrollId: 'foobar'
        });
    });

    it('should reject if no scrollId is provided', () => {
      request.input.args.scrollId = null;

      return should(securityController.scrollUsers(request))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reformat search results correctly', async () => {
      const response = await securityController.scrollUsers(request);

      should(scrollStub).be.calledWith(scrollEvent, 'foobar', undefined);
      should(response).match({
        hits: [{_id: 'admin'}],
        scrollId: 'foobar',
        total: 2,
      });
    });

    it('should handle the scroll argument', () => {
      request = new Request({scrollId: 'foobar', scroll: 'qux'});

      kuzzle.repositories.user.scroll.resolves({
        hits: [{ _id: 'admin', _source: { profileIds: ['admin'] } }],
        total: 2,
        scrollId: 'foobar'
      });

      return securityController.scrollUsers(request)
        .then(response => {
          should(kuzzle.repositories.user.scroll).be.calledWithMatch('foobar', 'qux');
          should(response).be.instanceof(Object);
          should(response).match({hits: [{_id: 'admin'}], total: 2, scrollId: 'foobar'});
        });
    });
  });

  describe('#deleteUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.delete.resolves({_id: 'test'});

      return securityController.deleteUser(new Request({ _id: 'test' }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error when no id is given', async () => {
      const promise = securityController.deleteUser(new Request({}));

      await should(promise).be.rejectedWith(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "_id".'
      });
    });

    it('should reject an error in case of error', () => {
      const error = new Error('Mocked error');
      kuzzle.repositories.user.delete.rejects(error);

      return should(securityController.deleteUser(new Request({_id: 'test'})))
        .be.rejectedWith(error);
    });

    it('should delete user credentials', () => {
      const
        existsMethod = sinon.stub().resolves(true),
        deleteMethod = sinon.stub().resolves();
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
      kuzzle.repositories.user.delete.resolves({_id: 'test'});

      kuzzle.pluginsManager.getStrategyMethod
        .onFirstCall().returns(existsMethod)
        .onSecondCall().returns(deleteMethod);

      return securityController.deleteUser(new Request({ _id: 'test' }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.delete.resolves({_id: 'test'});

      return securityController.deleteUser(new Request({ _id: 'test', refresh: 'wait_for' }))
        .then(() => {
          const options = kuzzle.repositories.user.delete.firstCall.args[1];
          should(options).match({
            refresh: 'wait_for'
          });
        });

    });
  });

  describe('#createUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.user.hydrate.resolves();

      return securityController.createUser(new Request({
        _id: 'test',
        body: {
          content: {name: 'John Doe', profileIds: ['anonymous']}
        }
      }))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
          should(response).be.instanceof(Object);
          should(response).be.match({ _id: 'test', _source: {} });
        });
    });

    it('should compute a user id if none is provided', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.fromDTO.callsFake((...args) => Bluebird.resolve(args[0]));
      kuzzle.repositories.user.persist.resolves({_id: 'test'});

      return securityController.createUser(new Request({
        body: {
          content: {
            name: 'John Doe',
            profileIds: ['anonymous']
          }
        }
      }))
        .then(response => {
          should(kuzzle.repositories.user.persist)
            .be.calledOnce();
          should(kuzzle.repositories.user.persist.firstCall.args[0]._id)
            .match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {} });
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
        });
    });

    it('should reject an error if user already exists', () => {
      kuzzle.repositories.user.load.resolves({_id: 'test'});

      return should(securityController.createUser(new Request({
        _id: 'test',
        body: {
          content: {name: 'John Doe', profileIds: ['anonymous']}
        }
      }))).be.rejectedWith(PreconditionError, { id: 'security.user.already_exists'});
    });

    it('should throw an error if no profile is given', () => {
      return should(() => {
        securityController.createUser(new Request({body: {content: {}}}));
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "body.content.profileIds".'
      });
    });

    it('should throw an error if profileIds is not an array', () => {
      return should(() => {
        securityController.createUser(new Request({body: {content: {profileIds: 'notAnArray'}}}));
      }).throw(BadRequestError, {
        id: 'api.assert.invalid_type',
        message: 'Wrong type for argument "body.content.profileIds" (expected: array)'
      });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.user.hydrate.resolves();

      return securityController.createUser(new Request({
        _id: 'test',
        body: {
          content: {name: 'John Doe', profileIds: ['anonymous']}
        },
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.user.persist.firstCall.args[1];
          should(options).match({
            database: {
              refresh: 'wait_for'
            }
          });
        });
    });
  });

  describe('#createRestrictedUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.user.hydrate.resolves();

      return securityController.createRestrictedUser(new Request({
        body: {content: {_id: 'test', name: 'John Doe'}}
      }), {})
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response.userContext).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {} });
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.user.fromDTO.callsFake((...args) => Bluebird.resolve(args[0]));

      return securityController.createRestrictedUser(new Request({ body: { content: { name: 'John Doe' } } }))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {} });
          should(kuzzle.repositories.user.persist.firstCall.args[0]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
        });
    });

    it('should throw an error if a profile is given', () => {
      return should(() => {
        securityController.createRestrictedUser(new Request({ body: { content: { profileIds: ['foo'] } } }));
      }).throw(BadRequestError, {
        id: 'api.assert.forbidden_argument',
        message: 'The argument "body.content.profileIds" is not allowed by this API action.'
      });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.user.hydrate.resolves();

      return securityController.createRestrictedUser(new Request({
        body: {content: {_id: 'test', name: 'John Doe'}},
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.user.persist.firstCall.args[1];
          should(options).match({
            database: {
              refresh: 'wait_for'
            }
          });
        });
    });
  });

  describe('#updateUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.toDTO.returns({_id: 'test'});
      kuzzle.repositories.user.persist.resolves({_id: 'test'});

      return securityController.updateUser(new Request({ _id: 'test', body: { foo: 'bar' } }))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {} });
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'update'}});
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateUser(new Request({body: {}}));
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "_id".'
      });
    });

    it('should update the profile correctly', () => {
      kuzzle.repositories.user.fromDTO.callsFake((...args) => Bluebird.resolve(args[0]));
      kuzzle.repositories.user.toDTO.returns({
        _id: 'test',
        profileIds: ['anonymous'],
        foo: 'bar',
        bar: 'baz'
      });
      kuzzle.repositories.user.persist.callsFake((...args) => Bluebird.resolve(args[0]));

      return securityController.updateUser(new Request({
        _id: 'test',
        body: {profileIds: ['anonymous'], foo: 'bar'}
      }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
          should(response._source.profile).be.an.instanceOf(Object);
          should(response._source.foo).be.exactly('bar');
          should(response._source.bar).be.exactly('baz');
        });
    });

    it('should reject the promise if the user cannot be found in the database', () => {
      kuzzle.repositories.user.load.resolves(null);
      return should(securityController.updateUser(new Request({
        _id: 'badId',
        body: {},
        action: 'updateProfile'
      }))).be.rejectedWith(NotFoundError, { id: 'security.profile.not_found'});
    });

    it('should return an error if an unknown profile is provided', () => {
      return should(() => {
        securityController.updateUser(new Request({
          _id: 'test',
          body: {profileIds: ['foobar']}
        })).throw(NotFoundError, { id: 'security.profile.not_found' });
      });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.fromDTO.callsFake((...args) => Bluebird.resolve(args[0]));
      kuzzle.repositories.user.toDTO.returns({});
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.profile.load.resolves({
        _id: 'anonymous',
        _source: {}
      });

      return securityController
        .updateUser(
          new Request({ _id: 'test', body: { foo: 'bar' }, refresh: 'wait_for' }))
        .then(() => {
          const options = kuzzle.repositories.user.persist.firstCall.args[1];
          should(options).match({
            database: {
              refresh: 'wait_for'
            }
          });
        });

    });
  });

  describe('#replaceUser', () => {
    it('should return an error if the request is invalid', () => {
      return should(securityController.replaceUser(new Request({_id: 'test'})))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should replace the user correctly', () => {
      kuzzle.repositories.user.persist.resolves({
        _id: 'test',
        profileIds: ['anonymous'],
        foo: 'bar'
      });
      kuzzle.repositories.user.load = userId => Bluebird.resolve({
        _id: userId,
        _source: {}
      });

      return securityController
        .replaceUser(
          new Request({
            _id: 'test',
            body: { profileIds: ['anonymous'], foo: 'bar' }
          }),
          {})
        .then(response => {
          should(response).be.instanceOf(Object);
          should(response).match({
            _id: 'test',
            _source: {profileIds: ['anonymous']}
          });
        });
    });

    it('should return an error if the user is not found', () => {
      kuzzle.repositories.user.load.resolves(null);

      return should(securityController.replaceUser(new Request({
        _id: 'i.dont.exist',
        body: { profileIds: ['anonymous'] }
      }))).be.rejectedWith(NotFoundError, { id: 'security.user.not_found'});
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.persist.resolves({
        _id: 'test',
        profileIds: ['anonymous'],
        foo: 'bar'
      });

      kuzzle.repositories.user.load = userId => Bluebird.resolve({
        _id: userId,
        _source: {}
      });

      return securityController.replaceUser(new Request({
        _id: 'test',
        body: {profileIds: ['anonymous'], foo: 'bar'},
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.user.persist.firstCall.args[1];

          should(options).match({
            database: {
              refresh: 'wait_for'
            }
          });
        });
    });
  });

  describe('#getUserRights', () => {
    it('should resolve to an object on a getUserRights call', () => {
      kuzzle.repositories.user.load = userId => {
        return Bluebird.resolve({
          _id: userId,
          _source: {},
          getRights: () => {
            return {
              rights1: {
                controller: 'read', action: 'get', index: 'foo', collection: 'bar',
                value: 'allowed'
              },
              rights2: {
                controller: 'write', action: 'delete', index: '*', collection: '*',
                value: 'conditional'
              }
            };
          }
        });
      };

      return securityController.getUserRights(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).length(2);

          let filteredItem = response.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = response.hits.filter(item => {
            return item.controller === 'write' &&
                   item.action === 'delete' &&
                   item.index === '*' &&
                   item.collection === '*';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('conditional');
        });
    });

    it('should throw an error on a getUserRights call without id', () => {
      return should(() => {
        securityController.getUserRights(new Request({_id: ''}));
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "_id".'
      });
    });

    it('should reject NotFoundError on a getUserRights call with a bad id', () => {
      kuzzle.repositories.user.load.resolves(null);

      return securityController.getUserRights(new Request({ _id: 'i.dont.exist' }))
        .catch((e) => {
          should(e).be.instanceOf(NotFoundError);
        });
    });
  });

  describe('#mDeleteUser', () => {
    it('should forward its args to mDelete', () => {
      securityController.mDelete = sinon.spy();
      securityController.mDeleteUsers(request);

      should(securityController.mDelete)
        .be.calledOnce()
        .be.calledWith('user', request);
    });
  });

  describe('#revokeTokens', () => {
    it('should revoke all tokens related to a given user', () => {

      return securityController.revokeTokens((new Request({ _id: 'test', })))
        .then(() => {
          should(kuzzle.repositories.token.deleteByUserId).be.calledOnce().be.calledWith('test');
        });
    });

    it('should reject an error if the user doesn\'t exists.', () => {
      kuzzle.repositories.user.load.resolves(null);
      return should(securityController.revokeTokens(new Request({
        _id: 'test'
      }))).be.rejectedWith(NotFoundError, { id: 'security.user.not_found' });
    });
  });

  describe('#createFirstAdmin', () => {
    it('should reject if an admin already exists', () => {
      const request = new Request(
        {
          controller: 'security',
          action: 'createFirstAdmin',
          _id: 'toto',
          body: {content: {password: 'pwd'}}
        });

      kuzzle.adminExists.resolves(true);

      return should(securityController.createFirstAdmin(request))
        .be.rejectedWith(PreconditionError, {id: 'api.process.admin_exists'});
    });

    it('should create the admin user and not reset roles & profiles if not asked to', async () => {
      const request = new Request({
        _id: 'toto',
        action: 'createFirstAdmin',
        controller: 'security',
      });

      kuzzle.adminExists.resolves(false);

      await securityController.createFirstAdmin(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['admin'], {});
      should(resetRolesStub).not.called();
      should(resetProfilesStub).not.called();
      should(kuzzle.internalIndex.refreshCollection).not.called();
    });

    it('should create the admin user and reset roles & profiles if asked to', async () => {
      const request = new Request({
        _id: 'toto',
        action: 'createFirstAdmin',
        body: {content: {foo: 'bar'}},
        controller: 'security',
        reset: true,
      });

      kuzzle.adminExists.resolves(false);

      await securityController.createFirstAdmin(request);

      should(securityController._persistUser)
        .calledOnce()
        .calledWithMatch(request, ['admin'], request.body.content);

      for (const [key, content] of kuzzle.config.security.standard.roles) {
        should(resetRolesStub).calledWithMatch(
          'core:security:role:createOrReplace',
          key,
          content);
      }

      for (const [key, content] of kuzzle.config.security.standard.profiles) {
        should(resetRolesStub).calledWithMatch(
          'core:security:profile:createOrReplace',
          key,
          content);
      }

      should(kuzzle.internalIndex.refreshCollection).be.calledWith('users');
    });
  });
});
