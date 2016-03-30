var
  q = require('q'),
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError');

describe('Test: security controller - users', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        // Mock
        kuzzle.services.list.readEngine.search = requestObject => {
          return q(new ResponseObject(requestObject, {
            hits: [{_id: 'admin', _source: { profile: 'admin' }}],
            total: 1
          }));
        };
        kuzzle.repositories.user.load = id => {
          if (id === 'anonymous') {
            return kuzzle.repositories.user.anonymous();
          }
          if (id === 'admin') {
            return kuzzle.repositories.user.admin();
          }

          return q(null);
        };
        kuzzle.repositories.user.persist = (user, opts) => {
          return q(new ResponseObject(new RequestObject(user), {
            _index: '%kuzzle',
            _type: 'users',
            _method: (opts && opts.database && opts.database.method) ? opts.database.method : 'createOrReplace',
            _id: user._id,
            _version: 1,
            created: true,
            _source: kuzzle.repositories.user.serializeToDatabase(user)
          }));
        };
        kuzzle.repositories.user.deleteFromDatabase = requestObject => {
          return q(new ResponseObject(requestObject, {_id: 'test'}));
        };

        done();
      });
  });

  describe('#getUser', function () {
    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.getUser(new RequestObject({})))
        .be.rejectedWith(BadRequestError);
    });

    it('should return an hydrated responseObject', done => {
      kuzzle.funnel.controllers.security.getUser(new RequestObject({
        body: { _id: 'anonymous' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._id).be.exactly(-1);
          should(response.data.body._source.profile).not.be.empty().Object();
          should(response.data.body._source.profile._id).be.exactly('anonymous');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject with NotFoundError when the user is not found', () => {
      var promise = kuzzle.funnel.controllers.security.getUser(new RequestObject({
        body: { _id: 'i.dont.exist' }
      }));

      return should(promise).be.rejectedWith(NotFoundError);
    });
  });

  describe('#searchUsers', function () {
    it('should return a valid responseObject', done => {
      kuzzle.funnel.controllers.security.searchUsers(new RequestObject({
        body: {
          filter: {},
          from: 0,
          size: 200
        }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body).match({hits: [{_id: 'admin'}], total: 1});

          done();
        })
        .catch(error => { done(error); });
    });

    it('should return some unhydrated users when asked', done => {
      kuzzle.funnel.controllers.security.searchUsers(new RequestObject({
        body: { hydrate: false }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          response.data.body.hits.every(doc => {
            should(doc._source.profile).be.a.String();
          });

          done();
        })
        .catch(error => { done(error); });
    });
  });

  describe('#deleteUser', function () {
    it('should return a valid responseObject', done => {
      kuzzle.funnel.controllers.security.deleteUser(new RequestObject({
        body: { _id: 'test' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.status).be.exactly(200);

          done();
        })
        .catch(error => { done(error); });
    });

    it('should not resolve the promise when no id is given', () => {
      return should(kuzzle.funnel.controllers.security.deleteUser(new RequestObject({})))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#createUser', function () {
    it('should return a valid a valid response', done => {
      kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: { _id: 'test', name: 'John Doe', profile: 'anonymous' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body.created).be.exactly(true);
          should(response.data.body._method).be.exactly('create');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should compute a user id if none is provided', done => {
      kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: { name: 'John Doe', profile: 'anonymous' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._method).be.exactly('create');
          should(response.data.body._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: {}
      })))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#updateUser', function () {
    it('should return a valid ResponseObject', done => {
      kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        body: { _id: 'anonymous', foo: 'bar' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._method).be.exactly('update');
          should(response.data.body._id).be.exactly('anonymous');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        body: {}
      })))
        .be.rejectedWith(BadRequestError);
    });
  });

  describe('#createOrReplaceUser', function () {
    it('should return a valid responseObject', done => {
      kuzzle.funnel.controllers.security.createOrReplaceUser(new RequestObject({
        body: {
          _id: 'test',
          profile: 'admin'
        }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.status).be.exactly(200);

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createOrReplaceUser(new RequestObject({
        _id: 'test'
      })))
        .be.rejectedWith(BadRequestError);
    });
  });

});
