var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: security controller - roles', function () {
  var
    kuzzle,
    sandbox,
    error,
    mockResponse;

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    error = false;
    mockResponse = {};

    sandbox = sinon.sandbox.create();

    sandbox.stub(kuzzle.repositories.role, 'validateAndSaveRole', role => {
      if (role._id === 'alreadyExists') {
        return q.reject();
      }

      return q(role);
    });

    sandbox.stub(kuzzle.repositories.role, 'loadOneFromDatabase', id => {
      if (id === 'badId') {
        return q(null);
      }

      return q({
        _index: kuzzle.config.internalIndex,
        _type: 'roles',
        _id: id,
        _source: {}
      });
    });

    sandbox.stub(kuzzle.repositories.role, 'loadMultiFromDatabase', ids => {
      if (error) {
        return q.reject(new Error('foobar'));
      }

      return q(ids.map(id => {
        return {
          _id: id,
          _source: null
        };
      }));
    });

    sandbox.stub(kuzzle.repositories.role, 'search', requestObject => {
      if (error) {
        return q.reject(new Error(''));
      }

      return q({
        hits: [{_id: 'test'}],
        total: 1
      });
    });

    sandbox.stub(kuzzle.repositories.role, 'deleteFromDatabase', requestObject => {
      if (error) {
        return q.reject(new Error(''));
      }

      return q({_id: 'test'});
    });
    sandbox.mock(kuzzle.repositories.profile, 'profiles', {});
    sandbox.mock(kuzzle.repositories.role, 'roles', {});
  });

  afterEach(() => {
    sandbox.restore();
  });


  describe('#createOrReplaceRole', function () {
    it('should resolve to a responseObject on a createOrReplaceRole call', () => {
      return kuzzle.funnel.controllers.security.createOrReplaceRole(new RequestObject({
          body: {_id: 'test', controllers: {}}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      return should(kuzzle.funnel.controllers.security.createOrReplaceRole(new RequestObject({
        body: {_id: 'alreadyExists', indexes: {}}
      }))).be.rejected();
    });
  });

  describe('#createRole', function () {
    it('should reject when a role already exists with the id', () => {
      var promise = kuzzle.funnel.controllers.security.createRole(new RequestObject({
        body: {_id: 'alreadyExists', controllers: {}}
      }));

      return should(promise).be.rejected();
    });

    it('should resolve to a responseObject on a createRole call', () => {
      var promise = kuzzle.funnel.controllers.security.createRole(new RequestObject({
        body: {_id: 'test', controllers: {}}
      }));

      return should(promise).be.fulfilled();
    });
  });

  describe('#getRole', function () {
    it('should resolve to a responseObject on a getRole call', () => {
      return kuzzle.funnel.controllers.security.getRole(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
        });
    });

    it('should reject NotFoundError on a getRole call with a bad id', () => {
      return should(kuzzle.funnel.controllers.security.getRole(new RequestObject({body: {_id: 'badId'}}))).be.rejected();
    });
  });

  describe('#mGetRoles', function () {
    it('should reject an error if no ids is provided', () => {
      return should(kuzzle.funnel.controllers.security.mGetRoles(new RequestObject({body: {}}))).be.rejected();
    });

    it('should reject with a response object if loading roles fails', () => {
      var requestObject = new RequestObject({
        body: {ids: ['test']}
      });

      error = true;

      return should(kuzzle.funnel.controllers.security.mGetRoles(requestObject)).be.rejected();
    });

    it('should resolve to a responseObject', done => {
      kuzzle.funnel.controllers.security.mGetRoles(new RequestObject({
          body: {ids: ['test']}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();

          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  describe('#searchRoles', function () {
    it('should return response with an array of roles on searchRole call', () => {
      return kuzzle.funnel.controllers.security.searchRoles(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.security.searchRoles(new RequestObject({
        body: {_id: 'test'}
      }))).be.rejected();
    });
  });

  describe('#updateRole', function () {
    it('should return a valid ResponseObject', done => {
      kuzzle.repositories.role.validateAndSaveRole = role => {
        if (role._id === 'alreadyExists') {
          return q.reject();
        }

        return q(role);
      };

      kuzzle.funnel.controllers.security.updateRole(new RequestObject({
        _id: 'test',
        body: { foo: 'bar' }
      }), {})
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._id).be.exactly('test');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateRole(new RequestObject({
        body: {}
      }), {}))
        .be.rejected();
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      return should(kuzzle.funnel.controllers.security.updateRole(new RequestObject({
        _id: 'badId',
        body: {}
      }), {}))
        .be.rejected();
    });
  });

  describe('#deleteRole', function () {
    it('should return response with on deleteRole call', done => {
      kuzzle.funnel.controllers.security.deleteRole(new RequestObject({
        _id: 'test',
        body: {}
      }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result._id).be.exactly('test');

          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should reject the promise if attempting to delete one of the core roles', function () {
      return should(kuzzle.funnel.controllers.security.deleteRole(new RequestObject({
        _id: 'admin',
        body: {}
      }))).be.rejected();
    });
  });

});
