'use strict';

var
  rewire = require('rewire'),
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  SecurityController = rewire('../../../../lib/api/controllers/securityController');

describe('Test: security controller - users', () => {
  var
    kuzzle,
    request,
    securityController;

  before(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);
  });

  beforeEach(() => {
    request = new Request({controller: 'security'});
    kuzzle.internalEngine.getMapping = sinon.stub().returns(Promise.resolve({internalIndex: {mappings: {users: {properties: {}}}}}));
    kuzzle.internalEngine.get = sandbox.stub().returns(Promise.resolve({}));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#updateUserMapping', () => {
    var foo = {foo: 'bar'};

    it('should throw a BadRequestError if the body is missing', () => {
      return should(() => {
        securityController.updateUserMapping(request);
      }).throw(BadRequestError);
    });

    it('should update the user mapping', () => {
      request.input.body = foo;
      return securityController.updateUserMapping(request)
        .then(response => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('users', request.input.body);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });


  describe('#getUserMapping', () => {
    it('should fulfill with a response object', () => {
      return securityController.getUserMapping(request)
        .then(response => {
          should(kuzzle.internalEngine.getMapping).be.calledOnce();
          should(kuzzle.internalEngine.getMapping).be.calledWith({index: kuzzle.internalEngine.index, type: 'users'});

          should(response).be.instanceof(Object);
          should(response).match({mapping: {}});
        });
    });
  });

  describe('#getUser', () => {
    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.getUser(new Request({}));
      }).throw(BadRequestError);
    });

    it('should reject with NotFoundError when the user is not found', () => {
      kuzzle.repositories.user.load = sandbox.stub().returns(Promise.resolve(null));

      return should(securityController.getUser(new Request({_id: 'i.dont.exist'})))
        .be.rejectedWith(NotFoundError);
    });
  });

  describe('#searchUsers', () => {
    it('should return a valid responseObject', () => {
      kuzzle.repositories.user.search = sandbox.stub().returns(Promise.resolve({
        hits: [{_id: 'admin', _source: { profileIds: ['admin'] }}],
        total: 2
      }));

      return securityController.searchUsers(new Request({body: {from: 0, size: 200}}), {})
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).match({hits: [{_id: 'admin'}], total: 2});
        });
    });

    it('should throw an error if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      let request = new Request({body: {policies: ['role1']}});
      request.input.args.from = 0;
      request.input.args.size = 10;

      return should(() => securityController.searchUsers(request)).throw(SizeLimitError);
    });

    it('should reject an error in case of error', () => {
      var error = new Error('Mocked error');
      kuzzle.repositories.user.search = sandbox.stub().returns(Promise.reject(error));

      return should(securityController.searchUsers(new Request({body: {hydrate: false}})))
        .be.rejectedWith(error);
    });
  });

  describe('#deleteUser', () => {
    it('should return a valid responseObject', () => {
      kuzzle.repositories.user.delete = sandbox.stub().returns(Promise.resolve());

      return securityController.deleteUser(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error when no id is given', () => {
      return should(() => {
        securityController.deleteUser(new Request({}));
      }).throw(BadRequestError);
    });

    it('should reject an error in case of error', () => {
      var error = new Error('Mocked error');

      kuzzle.repositories.user.delete = sandbox.stub().returns(Promise.reject(error));

      return should(securityController.deleteUser(new Request({_id: 'test'}))).be.rejectedWith(error);
    });
  });

  describe('#createUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      kuzzle.repositories.user.hydrate = sandbox.stub().returns(Promise.resolve());

      return securityController.createUser(new Request({
        _id: 'test', body: {name: 'John Doe', profileIds: ['anonymous']}
      }))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
        });
    });

    it('should compute a user id if none is provided', () => {
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      kuzzle.repositories.user.hydrate = sandbox.stub().returns(Promise.resolve());

      return securityController.createUser(new Request({body: {name: 'John Doe', profileIds: ['anonymous']}}))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(kuzzle.repositories.user.hydrate).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
          should(kuzzle.repositories.user.hydrate.firstCall.args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should throw an error if no profile is given', () => {
      return should(() => {
        securityController.createUser(new Request({body: {}}));
      }).throw(BadRequestError);
    });
  });

  describe('#createRestrictedUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      kuzzle.repositories.user.hydrate = sandbox.stub().returns(Promise.resolve());

      return securityController.createRestrictedUser(new Request({
        body: {_id: 'test', name: 'John Doe'}
      }), {})
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response.userContext).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      kuzzle.repositories.user.hydrate = sandbox.stub().returns(Promise.resolve());

      return securityController.createRestrictedUser(new Request({body: {name: 'John Doe'}}))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(kuzzle.repositories.user.hydrate).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
          should(kuzzle.repositories.user.hydrate.firstCall.args[1]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });
    });

    it('should throw an error if a profile is given', () => {
      return should(() => {
        securityController.createRestrictedUser(new Request({body: {profileIds: ['foo']}}));
      }).throw(BadRequestError);
    });
  });

  describe('#updateUser', () => {
    it('should return a valid response', () => {
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      kuzzle.repositories.profile.loadProfile = sandbox.stub().returns(Promise.resolve({_id: 'anonymous', _source: {}}));

      return securityController.updateUser(new Request({_id: 'test', body: {foo: 'bar'}}))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'update'}});
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateUser(new Request({body: {}}));
      }).throw(BadRequestError);
    });

    it('should update the profile correctly', () => {
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test', profileIds: ['anonymous'], foo: 'bar'}));
      kuzzle.repositories.profile.loadProfile = sandbox.stub().returns(Promise.resolve({_id: 'default', _source: {}}));

      return securityController.updateUser(new Request({
        _id: 'test',
        body: {profileIds: ['anonymous'], foo: 'bar'}
      }), {})
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
          should(response._source.profile).be.an.instanceOf(Object);
          should(response._source.foo).be.exactly('bar');
        });
    });
  });

  describe('#createOrReplaceUser', () => {
    it('should return a valid responseObject', () => {
      kuzzle.repositories.user.hydrate = sandbox.stub().returns(Promise.resolve());
      kuzzle.repositories.user.persist = sandbox.stub().returns(Promise.resolve({_id: 'test'}));

      return securityController.createOrReplaceUser(new Request({_id: 'test', body: {profileIds: ['admin']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}});
        });
    });

    it('should reject the promise if no profile is given', () => {
      return should(() => {
        securityController.createOrReplaceUser(new Request({_id: 'test'}));
      }).throw();
    });
  });

  describe('#getUserRights', () => {
    it('should resolve to an object on a getUserRights call', () => {
      kuzzle.repositories.user.load = userId => {
        return Promise.resolve({
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
          var filteredItem;

          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).length(2);

          filteredItem = response.hits.filter(item => {
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
      }).throw();
    });

    it('should reject NotFoundError on a getUserRights call with a bad id', () => {
      kuzzle.repositories.user.load = sandbox.stub().returns(Promise.resolve(null));
      return should(securityController.getUserRights(new Request({_id: 'i.dont.exist'}))).be.rejectedWith(NotFoundError);
    });
  });

  describe('#mDeleteUser', () => {
    it('should forward its args to mDelete', () => {
      const spy = sinon.spy();

      SecurityController.__with__({
        mDelete: spy
      })(() => {
        securityController.mDeleteUsers(request);

        should(spy)
          .be.calledOnce()
          .be.calledWith(kuzzle, 'user', request);
      });
    });
  });
});
