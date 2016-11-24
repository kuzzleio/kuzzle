var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

describe('Test: security controller - roles', () => {
  var
    kuzzle,
    error;

  before(() => {
    kuzzle = new Kuzzle();
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
            _index: kuzzle.config.internalIndex,
            _type: 'roles',
            _id: id,
            _source: {}
          });
        });

        sandbox.stub(kuzzle.repositories.role, 'loadMultiFromDatabase', ids => {
          if (error) {
            return Promise.reject(new Error('foobar'));
          }

          return Promise.resolve(ids.map(id => {
            return {
              _id: id,
              _source: null
            };
          }));
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
    it('should resolve to a responseObject on a createOrReplaceRole call', () => {
      return kuzzle.funnel.controllers.security.createOrReplaceRole(new RequestObject({
        body: {_id: 'test', controllers: {}}
      }), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      return should(kuzzle.funnel.controllers.security.createOrReplaceRole(new RequestObject({
        body: {_id: 'alreadyExists', indexes: {}}
      }), {})).be.rejectedWith(new Error('Mocked error'));
    });
  });

  describe('#createRole', () => {
    it('should reject when a role already exists with the id', () => {
      return should(kuzzle.funnel.controllers.security.createRole(new RequestObject({
        body: {_id: 'alreadyExists', controllers: {}}
      }), {})).be.rejectedWith(new Error('Mocked error'));
    });

    it('should resolve to a responseObject on a createRole call', () => {
      return should(kuzzle.funnel.controllers.security.createRole(new RequestObject({
        body: {_id: 'test', controllers: {}}
      }), {})).be.fulfilled();
    });
  });

  describe('#getRole', () => {
    it('should resolve to a responseObject on a getRole call', () => {
      return kuzzle.funnel.controllers.security.getRole(new RequestObject({
        body: {_id: 'test'}
      }), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body._id).be.exactly('test');
        });
    });

    it('should reject NotFoundError on a getRole call with a bad id', () => {
      return should(kuzzle.funnel.controllers.security.getRole(new RequestObject({body: {_id: 'badId'}}), {})).be.rejected();
    });
  });

  describe('#mGetRoles', () => {
    it('should reject an error if no ids is provided', () => {
      return should(kuzzle.funnel.controllers.security.mGetRoles(new RequestObject({body: {}}), {})).be.rejected();
    });

    it('should reject with a response object if loading roles fails', () => {
      error = true;

      return should(kuzzle.funnel.controllers.security.mGetRoles(new RequestObject({body: {ids: ['test']}}), {})).be.rejected();
    });

    it('should resolve to a responseObject', done => {
      kuzzle.funnel.controllers.security.mGetRoles(new RequestObject({body: {ids: ['test']}}), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body.hits).be.an.Array();
          should(response.responseObject.data.body.hits).not.be.empty();

          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('#searchRoles', () => {
    it('should return response with an array of roles on searchRole call', () => {
      return kuzzle.funnel.controllers.security.searchRoles(new RequestObject({body: {_id: 'test'}}))
        .then(response => {
          var jsonResponse = response.responseObject.toJson();

          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.security.searchRoles(new RequestObject({body: {_id: 'test'}}), {})).be.rejected();
    });
  });

  describe('#updateRole', () => {
    it('should return a valid ResponseObject', done => {
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = role => {
        if (role._id === 'alreadyExists') {
          return Promise.reject();
        }

        return Promise.resolve(role);
      };

      kuzzle.funnel.controllers.security.updateRole(new RequestObject({_id: 'test',body: { foo: 'bar' }}), {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body._id).be.exactly('test');

          done();
        })
        .catch(err => { done(err); });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateRole(new RequestObject({body: {}}), {}))
        .be.rejected();
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      return should(kuzzle.funnel.controllers.security.updateRole(new RequestObject({_id: 'badId',body: {}}), {})).be.rejected();
    });
  });

  describe('#deleteRole', () => {
    it('should return response with on deleteRole call', done => {
      var
        spyDeleteRole,
        role = {my: 'role'};

      sandbox.stub(kuzzle.repositories.role, 'getRoleFromRequestObject').returns(role);
      spyDeleteRole = sandbox.stub(kuzzle.repositories.role, 'deleteRole');

      kuzzle.funnel.controllers.security.deleteRole(new RequestObject({_id: 'test',body: {}}), {})
        .then(() => {
          should(spyDeleteRole.calledWith(role)).be.true();
          done();
        });
    });

    it('should reject the promise if attempting to delete one of the core roles', () => {
      return should(kuzzle.funnel.controllers.security.deleteRole(new RequestObject({_id: 'admin',body: {}}), {})).be.rejected();
    });
  });
});
