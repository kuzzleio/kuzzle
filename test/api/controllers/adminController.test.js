var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  AdminController = rewire('../../../lib/api/controllers/adminController'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  sandbox = sinon.sandbox.create();

describe('Test: admin controller', () => {
  var
    adminController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
    collection = 'unit-test-adminController',
    requestObject;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    adminController = new AdminController(kuzzle);
    requestObject = new RequestObject({controller: 'admin'}, {index, collection}, 'unit-test');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#updateMapping', () => {
    it('should activate a hook on a mapping update call and add the collection to the cache', () => {
      return adminController.updateMapping(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeUpdateMapping', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterUpdateMapping');

          should(kuzzle.services.list.storageEngine.updateMapping).be.calledOnce();
          should(kuzzle.services.list.storageEngine.updateMapping).be.calledWith(requestObject);

          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWith(requestObject.index, requestObject.collection);

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#getMapping', () => {
    it('should fulfill with a response object', () => {
      return adminController.getMapping(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeGetMapping', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterGetMapping');

          should(kuzzle.services.list.storageEngine.getMapping).be.calledOnce();
          should(kuzzle.services.list.storageEngine.getMapping).be.calledWith(requestObject);

          should(response).be.instanceof(ResponseObject);
        });
    });
  });

  describe('#getStats', () => {
    it('should trigger the plugin manager and return a proper response', () => {
      return adminController.getStats(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeGetStats', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterGetStats');

          should(kuzzle.statistics.getStats).be.calledOnce();
          should(kuzzle.statistics.getStats).be.calledWith(requestObject);

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });

    });
  });

  describe('#getLastStats', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.getLastStats(requestObject)
        .then(response => {
          var trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeGetLastStats', requestObject);
          should(trigger.secondCall).be.calledWith('data:afterGetLastStats');

          should(kuzzle.statistics.getLastStats).be.calledOnce();

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#getAllStats', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.getAllStats(requestObject)
        .then(response => {
          var trigger = kuzzle.pluginsManager.trigger;
          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeGetAllStats', requestObject);
          should(trigger.secondCall).be.calledWith('data:afterGetAllStats');

          should(kuzzle.statistics.getAllStats).be.calledOnce();
          should(kuzzle.statistics.getAllStats).be.calledWith(requestObject);

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });

    });
  });

  describe('#truncateCollection', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.truncateCollection(requestObject)
        .then(response => {
          var
            truncate = kuzzle.services.list.storageEngine.truncateCollection,
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeTruncateCollection', requestObject);
          should(trigger.secondCall).be.calledWith('data:afterTruncateCollection');

          should(truncate).be.calledOnce();
          should(truncate).be.calledWith(requestObject);

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
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
      requestObject.data.body = {
        indexes: ['a', 'c', 'e', 'g', 'i']
      };

      return adminController.deleteIndexes(requestObject, {token: {userId: 42}})
        .then(response => {
          var
            engine = kuzzle.services.list.storageEngine,
            trigger = kuzzle.pluginsManager.trigger;

          should(kuzzle.repositories.user.load).be.calledOnce();
          should(kuzzle.repositories.user.load).be.calledWith(42);

          should(isActionAllowedStub).have.callCount(5);

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeDeleteIndexes');
          should(trigger.firstCall.args[1]).be.an.instanceOf(RequestObject);
          should(trigger.firstCall.args[1]).match({
            data: {
              body: {
                indexes: ['a', 'e', 'i']
              }
            }
          });

          should(engine.deleteIndexes).be.calledOnce();
          should(engine.deleteIndexes.firstCall.args[0]).be.an.instanceOf(RequestObject);
          should(engine.deleteIndexes.firstCall.args[0]).match({
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

          should(trigger.secondCall).be.calledWith('data:afterDeleteIndexes');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: {
                deleted: ['a', 'e', 'i']
              }
            }
          });
        });
    });

  });

  describe('#createIndex', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.createIndex(requestObject)
        .then(response => {
          var
            createIndex = kuzzle.services.list.storageEngine.createIndex,
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeCreateIndex', requestObject);

          should(createIndex).be.calledOnce();
          should(createIndex).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterCreateIndex');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#deleteIndex', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return adminController.deleteIndex(requestObject)
        .then(response => {
          var
            deleteIndex = kuzzle.services.list.storageEngine.deleteIndex,
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeDeleteIndex', requestObject);

          should(deleteIndex).be.calledOnce();
          should(deleteIndex).be.calledWith(requestObject);

          should(kuzzle.indexCache.remove).be.calledOnce();
          should(kuzzle.indexCache.remove).be.calledWith(requestObject.index);

          should(trigger.secondCall).be.calledWith('data:afterDeleteIndex');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });

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
      stub.resolves(foo);

      return adminController.removeRooms(requestObject)
        .then(response => {
          var
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('subscription:beforeRemoveRooms', requestObject);

          should(stub).be.calledOnce();
          should(stub).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('subscription:afterRemoveRooms');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });

    it('should handle partial errors', () => {
      var
        partialErrors = [
          'error1',
          'error2',
          'error3'
        ];

      stub.resolves({partialErrors});

      return adminController.removeRooms(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(stub).be.calledOnce();
          should(stub).be.calledWith(requestObject);

          should(response).be.an.instanceOf(ResponseObject);
          should(response.error).be.an.instanceOf(PartialError);
          should(response).match({
            status: 206,
            error: {}
          });
        });
    });
  });

  describe('#refreshIndex', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return adminController.refreshIndex(requestObject)
        .then(response => {
          var
            engine = kuzzle.services.list.storageEngine,
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeRefreshIndex', requestObject);

          should(engine.refreshIndex).be.calledOnce();
          should(engine.refreshIndex).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterRefreshIndex');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: foo
            }
          });
        });
    });
  });

  describe('#getAutoRefresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      return adminController.getAutoRefresh(requestObject)
        .then(response => {
          var
            engine = kuzzle.services.list.storageEngine,
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeGetAutoRefresh', requestObject);

          should(engine.getAutoRefresh).be.calledOnce();
          should(engine.getAutoRefresh).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterGetAutoRefresh');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: false
            }
          });
        });
    });
  });

  describe('#setAutoRefresh', () => {
    it('should trigger the proper methods and resolve to a valid response', () => {
      requestObject.data.body = {
        autoRefresh: true
      };

      return adminController.setAutoRefresh(requestObject)
        .then(response => {
          var
            engine = kuzzle.services.list.storageEngine,
            trigger = kuzzle.pluginsManager.trigger;

          should(trigger).be.calledTwice();
          should(trigger.firstCall).be.calledWith('data:beforeSetAutoRefresh', requestObject);

          should(engine.setAutoRefresh).be.calledOnce();
          should(engine.setAutoRefresh).be.calledWith(requestObject);

          should(trigger.secondCall).be.calledWith('data:afterSetAutoRefresh');

          should(response).be.an.instanceOf(ResponseObject);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: true
            }
          });
        });
    });

    it('should return a rejected promise if the reqest does not contain the autoRefresh field', () => {
      return should(adminController.setAutoRefresh(requestObject))
        .be.rejectedWith(BadRequestError, {message: 'mandatory parameter "autoRefresh" not found.'});
    });

    it('should reject the promise if the autoRefresh value is not a boolean', () => {
      requestObject.data.body = {
        autoRefresh: -42
      };

      return should(adminController.setAutoRefresh(requestObject))
        .be.rejectedWith(BadRequestError, {message: 'Invalid type for autoRefresh, expected Boolean got number'});
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
      kuzzle.internalEngine.bootstrap.adminExists.resolves(false);

      return adminController.adminExists()
        .then((response) => {
          should(response).match({data: {body: {exists: false}}});
        });
    });

    it('should return true if there is result', () => {
      kuzzle.internalEngine.bootstrap.adminExists.resolves(true);

      return adminController.adminExists()
        .then((response) => {
          should(response).match({data: {body: {exists: true}}});
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
        resetRoles: sandbox.stub().resolves(),
        resetProfiles: sandbox.stub().resolves()
      });
      resetRolesStub = AdminController.__get__('resetRoles');
      resetProfilesStub = AdminController.__get__('resetProfiles');
      createOrReplaceUser = sandbox.stub().resolves();

      kuzzle.funnel = {controllers: {security: {createOrReplaceUser}}};
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if admin already exists', () => {
      var request = new RequestObject({
        _id: 'toto',
        body: {
          password: 'pwd'
        }
      });

      adminController.adminExists = sandbox.stub().resolves({data: {body: {exists: true}}});

      return should(adminController.createFirstAdmin(request)).be.rejected();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', () => {
      var request = new RequestObject({
        _id: 'toto',
        body: {
          password: 'pwd'
        }
      });

      adminController.adminExists = sandbox.stub().resolves({data: {body: {exists: false}}});

      return adminController.createFirstAdmin(request)
        .then(() => {
          should(createOrReplaceUser).be.calledOnce();
          should(createOrReplaceUser).be.calledWithMatch({
            data: {
              _id: 'toto',
              body: {password: 'pwd', profileIds: ['admin']}
            }
          });
          should(resetRolesStub).have.callCount(0);
          should(resetProfilesStub).have.callCount(0);
        });
    });

    it('should create the admin user and reset roles & profiles if asked to', () => {
      var request = new RequestObject({
        _id: 'toto',
        body: {
          password: 'pwd',
          reset: true
        }
      });

      adminController.adminExists = sandbox.stub().resolves({data: {body: {exists: false}}});
      sandbox.stub(adminController, 'refreshIndex').resolves({});

      return adminController.createFirstAdmin(request)
        .then(() => {
          should(createOrReplaceUser).be.calledOnce();
          should(createOrReplaceUser).be.calledWithMatch({
            data: {
              _id: 'toto',
              body: {password: 'pwd', profileIds: ['admin']}
            }
          });
          should(resetRolesStub).have.callCount(1);
          should(resetProfilesStub).have.callCount(1);
        });
    });
  });

  describe('#resetRoles', () => {
    it('should call createOrReplace roles with all default roles', () => {
      var
        createOrReplace = sandbox.stub().resolves(),
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
          should(createOrReplace).have.callCount(3);
          should(createOrReplace.firstCall).be.calledWith('roles', 'admin', 'admin');
          should(createOrReplace.secondCall).be.calledWith('roles', 'default', 'default');
          should(createOrReplace.thirdCall).be.calledWith('roles', 'anonymous', 'anonymous');
        });
    });
  });

  describe('#resetProfiles', () => {
    it('should call createOrReplace profiles with all default profiles and rights policies', () => {
      var
        createOrReplace = sandbox.stub().resolves(),
        mock = {internalEngine: {createOrReplace}};

      return AdminController.__get__('resetProfiles').call(mock)
        .then(() => {
          should(createOrReplace).have.callCount(3);
          should(createOrReplace.firstCall).be.calledWithMatch('profiles', 'admin', {
            policies: [{
              roleId: 'admin',
              allowInternalIndex: true
            }]
          });
          should(createOrReplace.secondCall).be.calledWithMatch('profiles', 'anonymous', {policies: [{roleId: 'anonymous'}]});
          should(createOrReplace.thirdCall).be.calledWithMatch('profiles', 'default', {policies: [{roleId: 'default'}]});
        });
    });
  });

  describe('#getSpecifications', () => {
    it('should call internalEngine with the right id', () => {
      kuzzle.internalEngine.get = sandbox.stub().resolves({_source: {foo: 'bar'}});

      return adminController.getSpecifications(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeGetSpecifications', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterGetSpecifications');
          should(kuzzle.internalEngine.get).be.calledOnce();
          should(kuzzle.internalEngine.get).be.calledWithMatch('validations', `${index}#${collection}`);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: {
                foo: 'bar'
              }
            }
          });
        });
    });
  });

  describe('#updateSpecifications', () => {
    it('should create or replace specifications', () => {
      index = 'myindex';
      collection = 'mycollection';
      requestObject.data.body = {
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

      kuzzle.validation.isValidSpecification = sandbox.stub().resolves({isValid: true});
      kuzzle.validation.curateSpecification = sandbox.stub().resolves();

      return adminController.updateSpecifications(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledThrice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeUpdateSpecifications', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterUpdateSpecifications');
          should(kuzzle.internalEngine.refresh).be.calledOnce();
          should(kuzzle.validation.curateSpecification).be.called();
          should(kuzzle.internalEngine.createOrReplace).be.calledOnce();
          should(kuzzle.internalEngine.createOrReplace).be.calledWithMatch('validations', `${index}#${collection}`);
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: requestObject.data.body
            }
          });
        });
    });

    it('should rejects and do not create or replace specifications if the specs are wrong', () => {
      index = 'myindex';
      collection = 'mycollection';
      requestObject.data.body = {
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

      kuzzle.validation.isValidSpecification = sandbox.stub().resolves({
        isValid: false,
        errors: ['bad bad is a bad type !']
      });
      kuzzle.validation.curateSpecification = sandbox.stub();

      return adminController.updateSpecifications(requestObject)
        .catch(response => {
          should(kuzzle.pluginsManager.trigger).be.calledOnce();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeUpdateSpecifications', requestObject);
          should(kuzzle.internalEngine.refresh).not.be.called();
          should(kuzzle.validation.curateSpecification).not.be.called();
          should(kuzzle.internalEngine.createOrReplace).not.be.called();
          should(response).match({
            status: 400,
            message: 'Some errors with provided specifications.',
            error: [ 'bad bad is a bad type !' ],
            data: {
              body: requestObject.data.body
            }
          });
        });
    });
  });

  describe('#validateSpecifications', () => {
    it('should call the right functions and respond with the right response', () => {
      requestObject.data.body = {
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
        prepareSpecificationValidation: sandbox.stub().resolves({error: false, specifications: requestObject.data.body})
      });

      return adminController.validateSpecifications(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeValidateSpecifications', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterValidateSpecifications');
          should(response).match({
            status: 200,
            error: null,
            data: {
              body: requestObject.data.body
            }
          });
        });
    });

    it('should call the right functions and respond with the right response if there is an error', () => {
      requestObject.data.body = {
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

      AdminController.__set__({
        prepareSpecificationValidation: sandbox.stub().resolves({
          error: true, responseObject: {
            status: 400,
            data: {body: requestObject.data.body}
          }
        })
      });

      return adminController.validateSpecifications(requestObject)
        .then(response => {
          should(kuzzle.pluginsManager.trigger).be.calledTwice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeValidateSpecifications', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterValidateSpecifications');
          should(response).match({
            status: 400,
            error: {
              message: 'Internal error',
              _source: {
                body: requestObject.data.body
              }
            },
            data: {
              body: null
            }
          });
        });
    });
  });

  describe('#deleteSpecifications', () => {
    it('should call the right functions and respond with the right response if the validation specification exists', () => {
      kuzzle.internalEngine.delete = sandbox.stub().resolves();

      kuzzle.validation.specification = {};
      kuzzle.validation.specification[index] = {};
      kuzzle.validation.specification[index][collection] = {};

      return adminController.deleteSpecifications(requestObject)
        .then(response => {
          should(kuzzle.internalEngine.delete).be.calledOnce();
          should(kuzzle.pluginsManager.trigger).be.calledThrice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeDeleteSpecifications', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterDeleteSpecifications');
          should(response).match({status: 200});
        });
    });
    it('should resolves if there is no specification set', () => {
      kuzzle.internalEngine.delete = sandbox.stub().rejects({status: 404});
      kuzzle.validation.specification = {};

      return adminController.deleteSpecifications(requestObject)
        .then(response => {
          should(kuzzle.internalEngine.delete).not.be.called();
          should(kuzzle.pluginsManager.trigger).be.calledThrice();
          should(kuzzle.pluginsManager.trigger.firstCall).be.calledWith('data:beforeDeleteSpecifications', requestObject);
          should(kuzzle.pluginsManager.trigger.secondCall).be.calledWith('data:afterDeleteSpecifications');
          should(response).match({status: 200});
        });
    });
  });
});