var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  CreateFirstAdmin = rewire('../../../../lib/api/controllers/remoteActions/createFirstAdmin'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  sandbox = sinon.sandbox.create();


describe('Test: remoteActionsController/createFirstAdmin', () => {
  var kuzzle;

  beforeEach(() => {
    kuzzle = {
      config: {
        defaultUserRoles: {
          admin: 'adminDefaultRole',
          default: 'defaultDefaultRole',
          anonymous: 'anonymousDefaultRole'
        }
      },
      funnel: {
        controllers: {
          security: {
            createOrReplaceUser: sandbox.stub().resolves()
          }
        }
      },
      internalEngine: {
        createOrReplace: sandbox.stub().resolves()
      }
    };
    CreateFirstAdmin(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createFirstAdmin', () => {
    var
      createFirstAdmim = CreateFirstAdmin.__get__('createFirstAdmin'),
      reset,
      createAdminUserStub,
      resetRolesStub,
      resetProfilesStub;

    beforeEach(() => {
      reset = CreateFirstAdmin.__set__({
        createAdminUser: sandbox.stub().resolves(),
        resetRoles: sandbox.stub().resolves(),
        resetProfiles: sandbox.stub().resolves()
      });
      createAdminUserStub = CreateFirstAdmin.__get__('createAdminUser');
      resetRolesStub = CreateFirstAdmin.__get__('resetRoles');
      resetProfilesStub = CreateFirstAdmin.__get__('resetProfiles');
    });

    afterEach(() => {
      reset();
    });

    it('should create the admin user and not reset roles & profiles if not asked to', () => {
      var request = new RequestObject({
        _id: 'admin',
        body: {
          password: 'pwd'
        }
      });

      return createFirstAdmim(request)
        .then(() => {
          should(createAdminUserStub).be.calledOnce();
          should(createAdminUserStub).be.calledWithExactly('admin', 'pwd');
          should(resetRolesStub).have.callCount(0);
          should(resetProfilesStub).have.callCount(0);
        });
    });

    it('should create the admin user and reset roles & profiles if asked to', () => {
      var request = new RequestObject({
        _id: 'admin',
        body: {
          password: 'pwd',
          reset: true
        }
      });

      return createFirstAdmim(request)
        .then(() => {
          should(createAdminUserStub).be.calledOnce();
          should(createAdminUserStub).be.calledWithExactly('admin', 'pwd');
          should(resetRolesStub).be.calledOnce();
          should(resetProfilesStub).be.calledOnce();
          sinon.assert.callOrder(createAdminUserStub, resetRolesStub, resetProfilesStub);
        });
    });

  });

  describe('#resetRoles', () => {
    var
      resetRoles = CreateFirstAdmin.__get__('resetRoles');

    it('should update all roles', () => {
      return resetRoles()
        .then(() => {
          var replace = kuzzle.internalEngine.createOrReplace;

          should(replace).be.calledThrice();
          should(replace.firstCall).be.calledWithExactly('roles', 'admin', 'adminDefaultRole');
          should(replace.secondCall).be.calledWithExactly('roles', 'default', 'defaultDefaultRole');
          should(replace.thirdCall).be.calledWithExactly('roles', 'anonymous', 'anonymousDefaultRole');
        });
    });

  });

  describe('#resetProfiles', () => {
    var
      resetProfiles = CreateFirstAdmin.__get__('resetProfiles');

    it('should do its job', () => {
      return resetProfiles()
        .then(() => {
          var replace = kuzzle.internalEngine.createOrReplace;

          should(replace).be.calledThrice();
          should(replace).be.calledWith('profiles', 'admin', {
            policies: [{roleId: 'admin', allowInternalIndex: true}]
          });
          should(replace).be.calledWith('profiles', 'anonymous', {
            policies: [{roleId: 'anonymous'}]
          });
          should(replace).be.calledWith('profiles', 'default', {
            policies: [{roleId: 'default'}]
          });
        });
    });

  });

  describe('#createAdminUser', () => {
    var
      createAdminUser = CreateFirstAdmin.__get__('createAdminUser');

    it('should use the security controller to create or replace the user', () => {
      return createAdminUser('admin', 'pwd')
        .then(() => {
          var replace = kuzzle.funnel.controllers.security.createOrReplaceUser;

          should(replace).be.calledOnce();
          should(replace.firstCall.args[0]).match({
            data: {
              _id: 'admin',
              body: {
                password: 'pwd',
                profilesIds: ['admin']
              }
            }
          });
        });
    });

  });

});
