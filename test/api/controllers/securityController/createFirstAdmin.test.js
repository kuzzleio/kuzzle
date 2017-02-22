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

      return SecurityController.__get__('resetRoles').call(mock)
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

      return SecurityController.__get__('resetProfiles').call(mock)
        .then(() => {

          try {
            should(createOrReplace).have.callCount(3);
            should(createOrReplace.firstCall).be.calledWithMatch('profiles', 'admin', {
              policies: [{
                roleId: 'admin'
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
});
