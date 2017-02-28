var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  SecurityController = rewire('../../../../lib/api/controllers/securityController'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  sandbox = sinon.sandbox.create();

describe('Test: security controller - createFirstAdmin', () => {
  var
    adminController,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    adminController = new SecurityController(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createFirstAdmin', () => {
    var
      reset,
      resetRolesStub,
      resetProfilesStub,
      createOrReplaceUser;

    beforeEach(() => {
      reset = SecurityController.__set__({
        resetRoles: sandbox.stub().returns(Promise.resolve()),
        resetProfiles: sandbox.stub().returns(Promise.resolve())
      });
      resetRolesStub = SecurityController.__get__('resetRoles');
      resetProfilesStub = SecurityController.__get__('resetProfiles');
      createOrReplaceUser = sandbox.stub().returns(Promise.resolve());

      kuzzle.funnel.controllers.security.createOrReplaceUser = createOrReplaceUser;
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if admin already exists', () => {
      kuzzle.funnel.controllers.server.adminExists = sandbox.stub().returns(Promise.resolve({exists: true}));

      return should(adminController.createFirstAdmin(new Request({
        _id: 'toto',
        body: {password: 'pwd'}
      }), {})).be.rejected();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', () => {
      kuzzle.funnel.controllers.server.adminExists = sandbox.stub().returns(Promise.resolve({exists: false}));

      return adminController.createFirstAdmin(new Request({_id: 'toto', body: {password: 'pwd'}}))
        .then(() => {
          should(createOrReplaceUser).be.calledOnce();
          should(createOrReplaceUser.firstCall.args[0]).be.instanceOf(Request);
          should(resetRolesStub).have.callCount(0);
          should(resetProfilesStub).have.callCount(0);
        });
    });

    it('should create the admin user and reset roles & profiles if asked to', () => {
      kuzzle.funnel.controllers.server.adminExists = sandbox.stub().returns(Promise.resolve({exists: false}));
      kuzzle.funnel.controllers.index = {
        refreshInternal: sandbox.stub().returns(Promise.resolve({}))
      };

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
    it('should call validateAndSaveRole with all default roles', () => {
      const
        validateAndSaveRole = sandbox.stub().returns(Promise.resolve()),
        mock = {
          repositories: {
            role: {
              validateAndSaveRole
            }
          },
          config: {
            security: {
              standard: {
                roles: {
                  admin: {
                    controllers: {
                      foo: {
                        actions: {
                          bar: true
                        }
                      }
                    }
                  },
                  default: {
                    controllers: {
                      baz: {
                        actions: {
                          yolo: true
                        }
                      }
                    }
                  },
                  anonymous: {
                    controllers: {
                      anon: {
                        actions: {
                          ymous: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        };

      return SecurityController.__get__('resetRoles').call(mock)
        .then(() => {
          try {
            should(validateAndSaveRole).have.callCount(3);
            should(validateAndSaveRole.firstCall).be.calledWithMatch({_id: 'admin', controllers: {foo: {actions: {bar: true}}}});
            should(validateAndSaveRole.secondCall).be.calledWithMatch({_id: 'default', controllers: {baz: {actions: {yolo: true}}}});
            should(validateAndSaveRole.thirdCall).be.calledWithMatch({_id: 'anonymous', controllers: {anon: {actions: {ymous: true}}}});
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#resetProfiles', () => {
    it('should call validateAndSaveProfile with all default profiles and rights policies', () => {
      const
        validateAndSaveProfile = sandbox.stub().returns(Promise.resolve()),
        mock = {repositories: {profile: {validateAndSaveProfile}}};

      return SecurityController.__get__('resetProfiles').call(mock)
        .then(() => {

          try {
            should(validateAndSaveProfile).have.callCount(3);
            should(validateAndSaveProfile.firstCall).be.calledWithMatch({
              _id: 'admin',
              policies: [{roleId: 'admin'}]
            });
            should(validateAndSaveProfile.secondCall).be.calledWithMatch({
              _id: 'default',
              policies: [{roleId: 'default'}]
            });
            should(validateAndSaveProfile.thirdCall).be.calledWithMatch({
              _id: 'anonymous',
              policies: [{roleId: 'anonymous'}]
            });
            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });
});
