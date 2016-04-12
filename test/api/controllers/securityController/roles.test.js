var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: security controller - roles', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        // Mock
        kuzzle.repositories.role.validateAndSaveRole = role => {
          if (role._id === 'alreadyExists') {
            return q.reject();
          }

          return q(role);
        };
        kuzzle.repositories.role.loadOneFromDatabase = id => {
          if (id === 'badId') {
            return q(null);
          }

          return q({
            _index: kuzzle.config.internalIndex,
            _type: 'roles',
            _id: id,
            _source: {}
          });
        };
        kuzzle.repositories.role.loadMultiFromDatabase = ids => {
          return q(ids.map(id => {
            return {
              _id: id,
              _source: null
            };
          }));
        };
        kuzzle.services.list.readEngine.search = requestObject => {
          return q({
            hits: [{_id: 'test'}],
            total: 1
          });
        };
        kuzzle.repositories.role.deleteFromDatabase = requestObject => {
          return q({_id: 'test'});
        };

        done();
      });
  });

  describe('#createOrReplaceRole', function () {
    it('should resolve to a responseObject on a createOrReplaceRole call', done => {
      kuzzle.funnel.controllers.security.createOrReplaceRole(new RequestObject({
          body: {_id: 'test', indexes: {}}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  describe('#createRole', function () {
    it('should reject when a role already exists with the id', () => {
      var promise = kuzzle.funnel.controllers.security.createRole(new RequestObject({
        body: {_id: 'alreadyExists', indexes: {}}
      }));

      return should(promise).be.rejected();
    });

    it('should resolve to a responseObject on a createRole call', () => {
      var promise = kuzzle.funnel.controllers.security.createRole(new RequestObject({
        body: {_id: 'test', indexes: {}}
      }));

      return should(promise).be.fulfilled();
    });
  });

  describe('#getRole', function () {
    it('should resolve to a responseObject on a getRole call', done => {
      kuzzle.funnel.controllers.security.getRole(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should reject NotFoundError on a getRole call with a bad id', () => {
      return should(kuzzle.funnel.controllers.security.getRole(new RequestObject({body: {_id: 'badId'}}))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#mGetRoles', function () {
    it('should reject an error if no ids is provided', () => {
      return should(kuzzle.funnel.controllers.security.mGetRoles(new RequestObject({body: {}}))).be.rejectedWith(ResponseObject);
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
    it('should return response with an array of roles on searchRole call', done => {
      kuzzle.funnel.controllers.security.searchRoles(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');

          done();
        })
        .catch(error => {
          done(error);
        });
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
        body: { _id: 'test', foo: 'bar' }
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
        .be.rejectedWith(ResponseObject);
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      return should(kuzzle.funnel.controllers.security.updateRole(new RequestObject({
        body: { _id: 'badId' }
      }), {}))
        .be.rejectedWith(ResponseObject);
    });
  });

  describe('#deleteRole', function () {
    it('should return response with on deleteRole call', done => {
      kuzzle.funnel.controllers.security.deleteRole(new RequestObject({
          body: {_id: 'test'}
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
        body: { _id: 'admin'}
      }))).be.rejectedWith(ResponseObject);
    });
  });

});
