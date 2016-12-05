var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  SecurityController = require('../../../../lib/api/controllers/securityController');

describe('Test: security controller - roles', () => {
  var
    kuzzle,
    error,
    securityController;

  before(() => {
    kuzzle = new Kuzzle();
    securityController = new SecurityController(kuzzle);
  });

  beforeEach(() => {
    error = false;

    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        sandbox.stub(kuzzle.repositories.role, 'validateAndSaveRole', role => {
          if (role._id === 'alreadyExists') {
            return Promise.reject(new Error('Mocked error'));
          }

          return Promise.resolve(role);
        });

        sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase', id => {
          if (id === 'badId') {
            return Promise.resolve(null);
          }

          return Promise.resolve({
            _index: kuzzle.internalEngine.index,
            _type: 'roles',
            _id: id,
            _source: {}
          });
        });

        sandbox.stub(kuzzle.repositories.role, 'loadMultiFromDatabase', ids => {
          if (error) {
            return Promise.reject(new Error('foobar'));
          }

          return Promise.resolve(ids.map(id => ({_id: id, _source: null})));
        });

        sandbox.stub(kuzzle.repositories.role, 'search', () => {
          if (error) {
            return Promise.reject(new Error(''));
          }

          return Promise.resolve({
            hits: [{_id: 'test'}],
            total: 1
          });
        });

        sandbox.stub(kuzzle.repositories.role, 'deleteFromDatabase', () => {
          if (error) {
            return Promise.reject(new Error(''));
          }

          return Promise.resolve({_id: 'test'});
        });
        sandbox.mock(kuzzle.repositories.profile, 'profiles', {});
        sandbox.mock(kuzzle.repositories.role, 'roles', {});
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createOrReplaceRole', () => {
    it('should resolve to an object on a createOrReplaceRole call', () => {
      return securityController.createOrReplaceRole(new Request({_id: 'test', body: {controllers: {}}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject an error in case of error', () => {
      return should(securityController.createOrReplaceRole(new Request({_id: 'alreadyExists', body: {indexes: {}}})))
        .be.rejectedWith(new Error('Mocked error'));
    });
  });

  describe('#createRole', () => {
    it('should reject when a role already exists with the id', () => {
      return should(securityController.createRole(new Request({_id: 'alreadyExists', body: {controllers: {}}})))
        .be.rejectedWith(new Error('Mocked error'));
    });

    it('should resolve to an object on a createRole call', () => {
      return should(securityController.createRole(new Request({_id: 'test', body: {controllers: {}}})))
        .be.fulfilled();
    });
  });

  describe('#getRole', () => {
    it('should resolve to an object on a getRole call', () => {
      return securityController.getRole(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject NotFoundError on a getRole call with a bad id', () => {
      return should(securityController.getRole(new Request({_id: 'badId'}))).be.rejected();
    });
  });

  describe('#mGetRoles', () => {
    it('should throw an error if no ids is provided', () => {
      return should(() => {
        securityController.mGetRoles(new Request({body: {}}));
      }).throw(BadRequestError);
    });

    it('should reject an error if loading roles fails', () => {
      error = true;

      return should(securityController.mGetRoles(new Request({body: {ids: ['test']}}))).be.rejected();
    });

    it('should resolve to an object', done => {
      securityController.mGetRoles(new Request({body: {ids: ['test']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).not.be.empty();

          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('#searchRoles', () => {
    it('should return response with an array of roles on searchRole call', () => {
      return securityController.searchRoles(new Request({body: {_id: 'test'}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
        });
    });

    it('should reject an error in case of error', () => {
      error = true;

      return should(securityController.searchRoles(new Request({_id: 'test'}))).be.rejected();
    });
  });

  describe('#updateRole', () => {
    it('should return a valid response', done => {
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = role => {
        if (role._id === 'alreadyExists') {
          return Promise.reject();
        }

        return Promise.resolve(role);
      };

      securityController.updateRole(new Request({_id: 'test', body: {foo: 'bar'}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');

          done();
        })
        .catch(err => { done(err); });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateRole(new Request({body: {}}));
      }).throw();
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      return should(securityController.updateRole(new Request({_id: 'badId',body: {}}))).be.rejected();
    });
  });

  describe('#deleteRole', () => {
    it('should return response with on deleteRole call', done => {
      var
        spyDeleteRole,
        role = {my: 'role'};

      sandbox.stub(kuzzle.repositories.role, 'getRoleFromRequest').returns(role);
      spyDeleteRole = sandbox.stub(kuzzle.repositories.role, 'deleteRole').returns(Promise.resolve());

      securityController.deleteRole(new Request({_id: 'test',body: {}}))
        .then(() => {
          should(spyDeleteRole.calledWith(role)).be.true();
          done();
        });
    });

    it('should reject the promise if attempting to delete one of the core roles', () => {
      return should(securityController.deleteRole(new Request({_id: 'admin',body: {}}))).be.rejected();
    });
  });
});
