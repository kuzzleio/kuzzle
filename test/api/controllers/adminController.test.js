var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  AdminController = rewire('../../../lib/api/controllers/adminController'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  sandbox = sinon.sandbox.create();

describe('Test: admin controller', () => {
  var
    adminController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
    collection = 'unit-test-adminController',
    request;

  beforeEach(() => {
    var data = {
      controller: 'admin',
      index,
      collection
    };
    kuzzle = new KuzzleMock();

    adminController = new AdminController(kuzzle);
    request = new Request(data);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#updateMapping', () => {
    it('should activate a hook on a mapping update call and add the collection to the cache', () => {
      return adminController.updateMapping(request, {})
        .then(response => {

          should(kuzzle.services.list.storageEngine.updateMapping).be.calledOnce();
          should(kuzzle.services.list.storageEngine.updateMapping).be.calledWith(request);

          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWith(request.input.resource.index, request.input.resource.collection);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getMapping', () => {
    it('should fulfill with a response object', () => {
      return adminController.getMapping(request, {})
        .then(response => {

          should(kuzzle.services.list.storageEngine.getMapping).be.calledOnce();
          should(kuzzle.services.list.storageEngine.getMapping).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getStats', () => {
    it('should trigger the plugin manager and return a proper response', () => {
      return adminController.getStats(request, {})
        .then(response => {
          should(kuzzle.statistics.getStats).be.calledOnce();
          should(kuzzle.statistics.getStats).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });

    });
  });

  describe('#getLastStats', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.getLastStats(request, {})
        .then(response => {
          should(kuzzle.statistics.getLastStats).be.calledOnce();

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getAllStats', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.getAllStats(request, {})
        .then(response => {
          should(kuzzle.statistics.getAllStats).be.calledOnce();

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });

    });
  });

  describe('#truncateCollection', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.truncateCollection(request, {})
        .then(response => {
          var truncate = kuzzle.services.list.storageEngine.truncateCollection;

          should(truncate).be.calledOnce();
          should(truncate).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#deleteIndexes', () => {
    var isActionAllowedStub;

    beforeEach(() => {
      isActionAllowedStub = sinon.stub();
      isActionAllowedStub.onCall(0).returns(Promise.resolve(true));
      isActionAllowedStub.onCall(1).returns(Promise.resolve(false));
      isActionAllowedStub.onCall(2).returns(Promise.resolve(true));
      isActionAllowedStub.onCall(3).returns(Promise.resolve(false));
      isActionAllowedStub.returns(Promise.resolve(true));

      kuzzle.repositories = {
        user: {
          load: sinon.spy(() => {
            return Promise.resolve({
              isActionAllowed: isActionAllowedStub
            });
          })
        }
      };
      adminController = new AdminController(kuzzle);
    });

    it('should trigger the proper methods and return a valid response', () => {
      request.input.body = {
        indexes: ['a', 'c', 'e', 'g', 'i']
      };
      request.context.token = {userId: '42'};

      return adminController.deleteIndexes(request)
        .then(response => {
          var engine = kuzzle.services.list.storageEngine;

          try {
            should(kuzzle.repositories.user.load).be.calledOnce();
            should(kuzzle.repositories.user.load).be.calledWith('42');

            should(isActionAllowedStub).have.callCount(5);

            should(engine.deleteIndexes).be.calledOnce();
            should(engine.deleteIndexes.firstCall.args[0]).be.an.instanceOf(Request);
            should(engine.deleteIndexes.firstCall.args[0].serialize()).match({
              data: {
                body: {
                  indexes: ['a', 'e', 'i']
                }
              }
            });

            should(kuzzle.indexCache.remove).be.calledThrice();
            should(kuzzle.indexCache.remove.getCall(0)).be.calledWith('a');
            should(kuzzle.indexCache.remove.getCall(1)).be.calledWith('e');
            should(kuzzle.indexCache.remove.getCall(2)).be.calledWith('i');

            should(response).be.instanceof(Object);
            should(response).match({deleted: ['a', 'e', 'i']});
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

  });

  describe('#createIndex', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.createIndex(request, {})
        .then(response => {
          var createIndex = kuzzle.services.list.storageEngine.createIndex;

          should(createIndex).be.calledOnce();
          should(createIndex).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#deleteIndex', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.deleteIndex(request, {})
        .then(response => {
          var deleteIndex = kuzzle.services.list.storageEngine.deleteIndex;

          should(deleteIndex).be.calledOnce();
          should(deleteIndex).be.calledWith(request);

          should(kuzzle.indexCache.remove).be.calledOnce();
          should(kuzzle.indexCache.remove).be.calledWith(request.input.resource.index);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#removeRooms', () => {
    var stub;

    beforeEach(() => {
      stub = sinon.stub();

      kuzzle.hotelClerk = {
        removeRooms: stub
      };
      adminController = new AdminController(kuzzle);
    });

    it('should trigger the proper methods and resolve to a valid response', () => {
      stub.returns(Promise.resolve(foo));

      return adminController.removeRooms(request, {})
        .then(response => {
          should(stub).be.calledOnce();
          should(stub).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });

    it('should handle partial errors', () => {
      var partialErrors = ['error1', 'error2', 'error3'];

      stub.returns(Promise.resolve({partialErrors}));

      return adminController.removeRooms(request, {})
        .then(response => {
          should(stub).be.calledOnce();
          should(stub).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(request.error).be.an.instanceOf(PartialError);
          should(request.status).be.an.eql(206);
          should(response).match({partialErrors});
        });
    });
  });

  describe('#refreshIndex', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return adminController.refreshIndex(request, {})
        .then(response => {
          var engine = kuzzle.services.list.storageEngine;
          should(engine.refreshIndex).be.calledOnce();
          should(engine.refreshIndex).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#refreshInternalIndex', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return adminController.refreshInternalIndex(request, {})
        .then(response => {
          should(kuzzle.internalEngine.refresh).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).match({ acknowledged: true });
        });
    });
  });

  describe('#getAutoRefresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return adminController.getAutoRefresh(request, {})
        .then(response => {
          var engine = kuzzle.services.list.storageEngine;

          should(engine.getAutoRefresh).be.calledOnce();
          should(engine.getAutoRefresh).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(false);
        });
    });
  });

  describe('#setAutoRefresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      request.input.body = {autoRefresh: true};

      return adminController.setAutoRefresh(request, {})
        .then(response => {
          var engine = kuzzle.services.list.storageEngine;

          should(engine.setAutoRefresh).be.calledOnce();
          should(engine.setAutoRefresh).be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match({response: true});
        });
    });

    it('should return a rejected promise if the request does not contain a body', () => {
      return should(() => {
        adminController.setAutoRefresh(request, {});
      }).throw(BadRequestError);
    });

    it('should return a rejected promise if the request does not contain the autoRefresh field', () => {
      request.input.body = {foo};

      return should(() => {
        adminController.setAutoRefresh(request, {});
      }).throw(BadRequestError);
    });

    it('should reject the promise if the autoRefresh value is not a boolean', () => {
      request.input.body = {autoRefresh: -42};

      return should(() => {
        adminController.setAutoRefresh(request, {});
      }).throw(BadRequestError);
    });
  });

  describe('#adminExists', () => {
    it('should call search with right query', () => {
      return adminController.adminExists()
        .then(() => {
          should(kuzzle.internalEngine.bootstrap.adminExists).be.calledOnce();
        });
    });

    it('should return false if there is no result', () => {
      kuzzle.internalEngine.bootstrap.adminExists.returns(Promise.resolve(false));

      return adminController.adminExists()
        .then((response) => {
          should(response).match({ exists: false });
        });
    });

    it('should return true if there is result', () => {
      kuzzle.internalEngine.bootstrap.adminExists.returns(Promise.resolve(true));

      return adminController.adminExists()
        .then((response) => {
          should(response).match({ exists: true });
        });
    });
  });

  describe('#createFirstAdmin', () => {
    var
      reset,
      resetRolesStub,
      resetProfilesStub,
      createOrReplaceUser;

    beforeEach(() => {
      reset = AdminController.__set__({
        resetRoles: sandbox.stub().returns(Promise.resolve()),
        resetProfiles: sandbox.stub().returns(Promise.resolve())
      });
      resetRolesStub = AdminController.__get__('resetRoles');
      resetProfilesStub = AdminController.__get__('resetProfiles');
      createOrReplaceUser = sandbox.stub().returns(Promise.resolve());

      kuzzle.funnel = {controllers: {security: {createOrReplaceUser}}};
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if admin already exists', () => {
      adminController.adminExists = sandbox.stub().returns(Promise.resolve({exists: true}));

      return should(adminController.createFirstAdmin(new Request({_id: 'toto', body: {password: 'pwd'}}), {})).be.rejected();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', () => {

      adminController.adminExists = sandbox.stub().returns(Promise.resolve({exists: false}));

      return adminController.createFirstAdmin(new Request({_id: 'toto', body: {password: 'pwd'}}))
        .then(() => {
          should(createOrReplaceUser).be.calledOnce();
          should(createOrReplaceUser.firstCall.args[0]).be.instanceOf(Request);
          should(resetRolesStub).have.callCount(0);
          should(resetProfilesStub).have.callCount(0);
        });
    });

    it('should create the admin user and reset roles & profiles if asked to', () => {
      adminController.adminExists = sandbox.stub().returns(Promise.resolve({exists: false}));
      sandbox.stub(adminController, 'refreshIndex').returns(Promise.resolve({}));

      return adminController.createFirstAdmin(new Request({_id: 'toto', body: {password: 'pwd'}, reset: true}))
        .then(() => {
          should(createOrReplaceUser).be.calledOnce();
          should(createOrReplaceUser.firstCall.args[0]).be.instanceOf(Request);
          should(resetRolesStub).have.callCount(1);
          should(resetProfilesStub).have.callCount(1);
        });
    });
  });

  describe('#resetRoles', () => {
    it('should call createOrReplace roles with all default roles', () => {
      var
        createOrReplace = sandbox.stub().returns(Promise.resolve()),
        mock = {
          internalEngine: {
            createOrReplace
          },
          config: {
            security: {
              standard: {
                roles: {
                  admin: 'admin', default: 'default', anonymous: 'anonymous'
                }
              }
            }
          }
        };

      return AdminController.__get__('resetRoles').call(mock)
        .then(() => {
          try {
            should(createOrReplace).have.callCount(3);
            should(createOrReplace.firstCall).be.calledWith('roles', 'admin', 'admin');
            should(createOrReplace.secondCall).be.calledWith('roles', 'default', 'default');
            should(createOrReplace.thirdCall).be.calledWith('roles', 'anonymous', 'anonymous');
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#resetProfiles', () => {
    it('should call createOrReplace profiles with all default profiles and rights policies', () => {
      var
        createOrReplace = sandbox.stub().returns(Promise.resolve()),
        mock = {internalEngine: {createOrReplace}};

      return AdminController.__get__('resetProfiles').call(mock)
        .then(() => {

          try {
            should(createOrReplace).have.callCount(3);
            should(createOrReplace.firstCall).be.calledWithMatch('profiles', 'admin', {
              policies: [{
                roleId: 'admin',
                allowInternalIndex: true
              }]
            });
            should(createOrReplace.secondCall).be.calledWithMatch('profiles', 'anonymous', {policies: [{roleId: 'anonymous'}]});
            should(createOrReplace.thirdCall).be.calledWithMatch('profiles', 'default', {policies: [{roleId: 'default'}]});
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#getSpecifications', () => {
    it('should call internalEngine with the right id', () => {
      kuzzle.internalEngine.get = sandbox.stub().returns(Promise.resolve({_source: {foo: 'bar'}}));

      return adminController.getSpecifications(request, {})
        .then(response => {
          try {
            should(kuzzle.internalEngine.get).be.calledOnce();
            should(kuzzle.internalEngine.get).be.calledWithMatch('validations', `${index}#${collection}`);
            should(response).match(foo);
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#searchSpecifications', () => {
    it('should call internalEngine with the right data', () => {
      kuzzle.internalEngine.search = sandbox.stub().returns(Promise.resolve({hits: [{_id: 'bar'}]}));

      request.input.body = {
        query: {
          match_all: {}
        }
      };
      request.input.args.from = 0;
      request.input.args.size = 20;

      return adminController.searchSpecifications(request, {})
        .then(response => {
          try {
            should(kuzzle.internalEngine.search).be.calledOnce();
            should(kuzzle.internalEngine.search).be.calledWithMatch('validations', request.input.body.query, request.input.args.from, request.input.args.size);
            should(response).match({hits: [{_id: 'bar'}]});
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#updateSpecifications', () => {
    it('should create or replace specifications', () => {
      index = 'myindex';
      collection = 'mycollection';
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'integer',
                defaultValue: 42
              }
            }
          }
        }
      };

      kuzzle.validation.isValidSpecification = sandbox.stub().returns(Promise.resolve({isValid: true}));
      kuzzle.validation.curateSpecification = sandbox.stub().returns(Promise.resolve());

      return adminController.updateSpecifications(request, {})
        .then(response => {
          try {
            should(kuzzle.internalEngine.refresh).be.calledOnce();
            should(kuzzle.validation.curateSpecification).be.called();
            should(kuzzle.internalEngine.createOrReplace).be.calledOnce();
            should(kuzzle.internalEngine.createOrReplace).be.calledWithMatch('validations', `${index}#${collection}`);
            should(response).match(request.input.body);

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should rejects and do not create or replace specifications if the specs are wrong', () => {
      index = 'myindex';
      collection = 'mycollection';
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'bad bad',
                defaultValue: 42
              }
            }
          }
        }
      };

      kuzzle.validation.isValidSpecification = sandbox.stub().returns(Promise.resolve({
        isValid: false,
        errors: ['bad bad is a bad type !']
      }));
      kuzzle.validation.curateSpecification = sandbox.stub();

      return adminController.updateSpecifications(request, {})
        .catch(error => {
          try {
            should(kuzzle.internalEngine.refresh).not.be.called();
            should(kuzzle.validation.curateSpecification).not.be.called();
            should(kuzzle.internalEngine.createOrReplace).not.be.called();

            should(error).be.an.instanceOf(BadRequestError);
            should(error.message).be.exactly('Some errors with provided specifications.');
            should(error.details).match([ 'bad bad is a bad type !' ]);

            return Promise.resolve();
          }
          catch (er) {
            return Promise.reject(er);
          }
        });
    });
  });

  describe('#validateSpecifications', () => {
    it('should call the right functions and respond with the right response', () => {
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'integer',
                defaultValue: 42
              }
            }
          }
        }
      };

      AdminController.__set__({
        prepareSpecificationValidation: sandbox.stub().returns(Promise.resolve(request.input.body))
      });

      return adminController.validateSpecifications(request, {})
        .then(response => {
          try {
            should(response).match({valid: true});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should call the right functions and respond with the right response if there is an error', () => {
      var err = new Error('error');
      request.input.body = {
        myindex: {
          mycollection: {
            strict: true,
            fields: {
              myField: {
                mandatory: true,
                type: 'bad bad',
                defaultValue: 42
              }
            }
          }
        }
      };

      err.details = 'some error';

      AdminController.__set__({
        prepareSpecificationValidation: sandbox.stub().returns(Promise.reject(err))
      });

      return adminController.validateSpecifications(request, {})
        .then(response => {

          try {
            should(response).match({
              valid: false,
              errors: 'some error'
            });

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#deleteSpecifications', () => {
    it('should call the right functions and respond with the right response if the validation specification exists', () => {
      kuzzle.internalEngine.delete = sandbox.stub().returns(Promise.resolve());

      kuzzle.validation.specification = {};
      kuzzle.validation.specification[index] = {};
      kuzzle.validation.specification[index][collection] = {};

      return adminController.deleteSpecifications(request, {})
        .then(response => {

          try {
            should(kuzzle.internalEngine.delete).be.calledOnce();
            should(response).match({});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });

    it('should resolves if there is no specification set', () => {
      kuzzle.internalEngine.delete = sandbox.stub();
      kuzzle.validation.specification = {};

      return adminController.deleteSpecifications(request, {})
        .then(response => {
          try {
            should(kuzzle.internalEngine.delete).not.be.called();
            should(response).match({});

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });
});