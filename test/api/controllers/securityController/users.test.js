'use strict';

const
  rewire = require('rewire'),
  Bluebird = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    NotFoundError,
    PluginImplementationError,
    SizeLimitError,
    PreconditionError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors,
  SecurityController = rewire('../../../../lib/api/controllers/securityController');

describe('Test: security controller - users', () => {
  let
    kuzzle,
    request,
    securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);
    request = new Request({controller: 'security'});
    kuzzle.internalEngine.getMapping.resolves({internalIndex: {mappings: {users: {properties: {}}}}});
    kuzzle.internalEngine.get.resolves({});
  });

  describe('#updateUserMapping', () => {
    const foo = {foo: 'bar'};

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
      kuzzle.repositories.user.load.resolves(null);

      return should(securityController.getUser(new Request({_id: 'i.dont.exist'})))
        .be.rejectedWith(NotFoundError);
    });
  });

  describe('#searchUsers', () => {
    it('should return a valid responseObject', () => {
      request = new Request({
        body: { query: {foo: 'bar' }},
        from: 13,
        size: 42,
        scroll: 'foo'
      });

      kuzzle.repositories.user.search.resolves({
        hits: [{_id: 'admin', _source: { profileIds: ['admin'] }, _meta: {}}],
        total: 2,
        scrollId: 'foobar'
      });

      return securityController.searchUsers(request)
        .then(response => {
          should(kuzzle.repositories.user.search).be.calledWithMatch({query: {foo: 'bar'}}, {from: 13, size: 42, scroll: 'foo'});
          should(response).be.instanceof(Object);
          should(response).match({hits: [{_id: 'admin'}], total: 2, scrollId: 'foobar'});
        });
    });

    it('should handle empty body requests', () => {
      kuzzle.repositories.user.search.resolves({
        hits: [{_id: 'admin', _source: { profileIds: ['admin'] }, _meta: {}}],
        total: 2,
        scrollId: 'foobar'
      });

      return securityController.searchUsers(new Request({}))
        .then(response => {
          should(kuzzle.repositories.user.search).be.calledWithMatch({}, {});
          should(response).be.instanceof(Object);
          should(response).match({hits: [{_id: 'admin'}], total: 2, scrollId: 'foobar'});
        });
    });

    it('should pass allowed `aggregations` and `highlight` arguments', () => {
      kuzzle.repositories.user.search.resolves({
        hits: [{_id: 'admin', _source: { profileIds: ['admin'] }, _meta: {}}],
        total: 2,
        scrollId: 'foobar'
      });

      request = new Request({
        body: {
          aggregations: 'aggregations'
        }
      });

      return securityController.searchUsers(request)
        .then(() => {
          should(kuzzle.repositories.user.search)
            .be.calledWith({aggregations: 'aggregations'}, {});

          // highlight only
          return securityController.searchUsers(new Request({
            body: {
              highlight: 'highlight'
            }
          }));
        })
        .then(() => {
          should(kuzzle.repositories.user.search)
            .be.calledWith({highlight: 'highlight'}, {});

          // all in one
          return securityController.searchUsers(new Request({
            body: {
              query: 'query',
              aggregations: 'aggregations',
              highlight: 'highlight'
            }
          }));
        })
        .then(() => {
          should(kuzzle.repositories.user.search)
            .be.calledWith({
              aggregations: 'aggregations',
              highlight: 'highlight',
              query: 'query'
            }, {});
        });
    });

    it('should throw an error if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      request = new Request({
        body: {policies: ['role1']},
        from: 0,
        size: 10
      });

      return should(() => securityController.searchUsers(request)).throw(SizeLimitError);
    });

    it('should reject an error in case of error', () => {
      const error = new Error('Mocked error');
      kuzzle.repositories.user.search.rejects(error);

      return should(securityController.searchUsers(new Request({body: {hydrate: false}})))
        .be.rejectedWith(error);
    });
  });

  describe('#scrollUsers', () => {
    it('should throw if no scrollId is provided', () => {
      should(() => securityController.scrollUsers(new Request({controller: 'security', action: 'scrollUsers'})))
        .throw(BadRequestError, {message: 'The request must specify a scrollId.'});
    });

    it('should reformat search results correctly', () => {
      request = new Request({scrollId: 'foobar'});

      kuzzle.repositories.user.scroll.resolves({
        hits: [{_id: 'admin', _source: { profileIds: ['admin'] }, _meta: {}}],
        total: 2,
        scrollId: 'foobar'
      });

      return securityController.scrollUsers(request)
        .then(response => {
          should(kuzzle.repositories.user.scroll).be.calledWithMatch('foobar', undefined);
          should(response).be.instanceof(Object);
          should(response).match({hits: [{_id: 'admin'}], total: 2, scrollId: 'foobar'});
        });
    });

    it('should handle the scroll argument', () => {
      request = new Request({scrollId: 'foobar', scroll: 'qux'});

      kuzzle.repositories.user.scroll.resolves({
        hits: [{_id: 'admin', _source: { profileIds: ['admin'] }, _meta: {}}],
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
      const error = new Error('Mocked error');
      kuzzle.repositories.user.delete.rejects(error);

      return should(securityController.deleteUser(new Request({_id: 'test'}))).be.rejectedWith(error);
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

      return securityController.deleteUser(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.delete.resolves({_id: 'test'});

      return securityController.deleteUser(new Request({_id: 'test', refresh: 'wait_for'}))
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
          should(response).be.match({_id: 'test', _source: {}, _meta: {}});
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
          should(response).be.match({_id: 'test', _source: {}, _meta: {}});
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
      }))).be.rejectedWith(PreconditionError);
    });

    it('should throw an error if no profile is given', () => {
      return should(() => {
        securityController.createUser(new Request({body: {content: {}}}));
      }).throw(BadRequestError);
    });

    it('should throw an error if profileIds is not an array', () => {
      return should(() => {
        securityController.createUser(new Request({body: {content: {profileIds: 'notAnArray'}}}));
      }).throw(BadRequestError);
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

  describe('#persistUserAndCredentials', () => {
    beforeEach(() => {
      request = new Request({
        _id: 'test',
        body: {
          content: {name: 'John Doe', profileIds: ['anonymous']},
          credentials: {someStrategy: {some: 'credentials'}}
        }
      });
    });

    it('should reject an error if a strategy is unknown', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
      
      request.input.body.credentials = {unknownStrategy: {some: 'credentials'}};

      return should(securityController.createUser(request)).be.rejectedWith(BadRequestError);
    });

    it('should reject an error if credentials don\'t validate the strategy', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'exists')
        .returns(sinon.stub().resolves(false));

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'validate')
        .returns(sinon.stub().rejects(new Error('error')));

      return should(securityController.createUser(request)).be.rejectedWith(BadRequestError);
    });

    it('should reject if credentials already exist on the provided user id', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod
        .withArgs('someStrategy', 'exists')
        .returns(sinon.stub().resolves(true));

      return should(securityController.createUser(request)).be.rejectedWith(KuzzleInternalError);
    });

    it('should throw an error and rollback if credentials don\'t create properly', done => {
      const
        validateStub = sinon.stub().resolves(),
        existsStub = sinon.stub().resolves(false),
        createStub = sinon.stub().rejects(new Error('some error')),
        deleteStub = sinon.stub().resolves();

      kuzzle.repositories.user.load.resolves(null);
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'validate').returns(validateStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'exists').returns(existsStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'create').returns(createStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'delete').returns(deleteStub);

      securityController.createUser(request)
        .then(() => done('Expected promise to fail'))
        .catch(error => {
          should(error).be.instanceof(PluginImplementationError);
          should(kuzzle.repositories.user.delete)
            .calledOnce()
            .calledWith('test');

          done();
        });
    });

    it('should intercept errors during deletion of a recovery phase', done => {
      const
        validateStub = sinon.stub().resolves(),
        existsStub = sinon.stub().resolves(false),
        createStub = sinon.stub().rejects(new Error('some error')),
        deleteStub = sinon.stub().rejects(new Error('some error'));

      kuzzle.repositories.user.load.resolves(null);
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'validate').returns(validateStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'exists').returns(existsStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'create').returns(createStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'delete').returns(deleteStub);

      securityController.createUser(request)
        .then(() => done('Expected promise to fail'))
        .catch(error => {
          should(error).be.instanceof(PluginImplementationError);
          should(kuzzle.repositories.user.delete)
            .calledOnce()
            .calledWith('test');

          done();
        });
    });

    it('should not create credentials if user creation fails', done => {
      const
        error = new Error('foobar'),
        validateStub = sinon.stub().resolves(),
        existsStub = sinon.stub().resolves(false),
        createStub = sinon.stub().resolves();

      kuzzle.repositories.user.load.resolves(null);
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);
      kuzzle.repositories.user.persist.rejects(error);

      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'validate').returns(validateStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'exists').returns(existsStub);
      kuzzle.pluginsManager.getStrategyMethod.withArgs('someStrategy', 'create').returns(createStub);

      securityController.createUser(request)
        .then(() => done('Expected promise to fail'))
        .catch(err => {
          should(err).be.eql(error);
          should(kuzzle.repositories.user.delete).not.be.called();
          should(createStub).not.be.called();
          done();
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
          should(response).be.match({_id: 'test', _source: {}, _meta: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
        });
    });

    it('should compute a user id if none is provided', () => {
      kuzzle.repositories.user.load.resolves(null);
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.user.fromDTO.callsFake((...args) => Bluebird.resolve(args[0]));

      return securityController.createRestrictedUser(new Request({body: {content: {name: 'John Doe'}}}))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}, _meta: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[0]._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'create'}});
        });
    });

    it('should throw an error if a profile is given', () => {
      return should(() => {
        securityController.createRestrictedUser(new Request({body: {content: {profileIds: ['foo']}}}));
      }).throw(BadRequestError);
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

      return securityController.updateUser(new Request({_id: 'test', body: {foo: 'bar'}}))
        .then(response => {
          should(kuzzle.repositories.user.persist).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).be.match({_id: 'test', _source: {}, _meta: {}});
          should(kuzzle.repositories.user.persist.firstCall.args[1]).match({database: {method: 'update'}});
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateUser(new Request({body: {}}));
      }).throw(BadRequestError);
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
          should(response._meta).be.an.instanceOf(Object);
        });
    });

    it('should reject the promise if the user cannot be found in the database', () => {
      kuzzle.repositories.user.load.resolves(null);
      return should(securityController.updateUser(new Request({_id: 'badId', body: {}, context: {action: 'updateProfile'}}))).be.rejected();
    });

    it('should return an error if an unknown profile is provided', () => {
      return should(() => {
        securityController.updateUser(new Request({
          _id: 'test',
          body: {profileIds: ['foobar']}
        })).throw(NotFoundError);
      });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.fromDTO.callsFake((...args) => Bluebird.resolve(args[0]));
      kuzzle.repositories.user.toDTO.returns({});
      kuzzle.repositories.user.persist.resolves({_id: 'test'});
      kuzzle.repositories.profile.load.resolves({
        _id: 'anonymous',
        _source: {},
        _meta: {}
      });

      return securityController.updateUser(new Request({_id: 'test', body: {foo: 'bar'}, refresh: 'wait_for'}))
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
      return should(() => {
        securityController.replaceUser(new Request({_id: 'test'}));
      }).throw(BadRequestError);
    });

    it('should replace the user correctly', () => {
      kuzzle.repositories.user.persist.resolves({_id: 'test', profileIds: ['anonymous'], foo: 'bar'});
      kuzzle.repositories.user.load = userId => Bluebird.resolve({_id: userId, _source: {}, _meta: {}});

      return securityController.replaceUser(new Request({
        _id: 'test',
        body: {profileIds: ['anonymous'], foo: 'bar'}
      }), {})
        .then(response => {
          should(response).be.instanceOf(Object);
          should(response).match({
            _id: 'test',
            _source: {profileIds: ['anonymous']},
            _meta: {}
          });
        });
    });

    it('should return an error if the user is not found', () => {
      kuzzle.repositories.user.load.resolves(null);

      return should(securityController.replaceUser(new Request({_id: 'i.dont.exist', body: {profileIds: ['anonymous']}}))).be.rejectedWith(NotFoundError);
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.user.persist.resolves({_id: 'test', profileIds: ['anonymous'], foo: 'bar'});
      kuzzle.repositories.user.load = userId => Bluebird.resolve({_id: userId, _source: {}, _meta: {}});

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
      }).throw();
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
