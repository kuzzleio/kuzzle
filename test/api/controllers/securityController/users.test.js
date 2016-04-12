var
  q = require('q'),
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: security controller - users', function () {
  var
    persistOptions,
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        // Mock
        kuzzle.services.list.readEngine.search = () => {
          return q({
            hits: [{_id: 'admin', _source: { profile: 'admin' }}],
            total: 1
          });
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
          persistOptions = opts;
          return q(user);
        };
        kuzzle.repositories.user.deleteFromDatabase = () => {
          return q({_id: 'test'});
        };

        done();
      });
  });

  beforeEach(function () {
    persistOptions = {};
  });

  describe('#getUser', function () {
    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.getUser(new RequestObject({})))
        .be.rejectedWith(ResponseObject);
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

      return should(promise).be.rejectedWith(ResponseObject);
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
        .be.rejectedWith(ResponseObject);
    });
  });

  describe('#createUser', function () {
    it('should return a valid a valid response', done => {
      kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: { _id: 'test', name: 'John Doe', profile: 'anonymous' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(persistOptions.database.method).be.exactly('create');

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
          should(persistOptions.database.method).be.exactly('create');
          should(response.data.body._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject the promise if no profile is given', () => {
      return should(kuzzle.funnel.controllers.security.createUser(new RequestObject({
        body: {}
      })))
        .be.rejectedWith(ResponseObject);
    });
  });

  describe('#updateUser', function () {
    it('should return a valid ResponseObject', done => {
      kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        body: { _id: 'anonymous', foo: 'bar' }
      }))
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(persistOptions.database.method).be.exactly('update');
          should(response.data.body._id).be.exactly('anonymous');

          done();
        })
        .catch(error => { done(error); });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateUser(new RequestObject({
        body: {}
      })))
        .be.rejectedWith(ResponseObject);
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
        .be.rejectedWith(ResponseObject);
    });
  });

});
