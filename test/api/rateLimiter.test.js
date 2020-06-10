'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  { Request } = require('kuzzle-common-objects'),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  RateLimiter = require('../../lib/api/rateLimiter');

describe('#api.rateLimiter', () => {
  let
    kuzzle,
    request,
    rateLimiter,
    clock,
    profiles;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    rateLimiter = new RateLimiter(kuzzle);
    clock = sinon.useFakeTimers();

    request = new Request({}, {
      user: {
        _id: 'foo',
        profileIds: ['bar', 'baz']
      },
      connection: {
        id: 'qux'
      }
    });

    profiles = [
      {_id: 'bar', rateLimit: 50},
      {_id: 'baz', rateLimit: 200}
    ];

    kuzzle.repositories.profile.loadProfiles.resolves(profiles);
  });

  afterEach(() => {
    clearInterval(rateLimiter.frameResetTimer);
    clock.restore();
  });

  describe('#init', () => {
    it('should start cleaning frames every second or so', () => {
      should(rateLimiter.frame).be.empty();
      should(rateLimiter.frameResetTimer).be.null();

      rateLimiter.init();

      should(rateLimiter.frameResetTimer).not.be.null();

      rateLimiter.frame.foo = 'bar';

      clock.tick(1000);

      should(rateLimiter.frame).be.empty();
    });
  });

  describe('#isAllowed', () => {
    beforeEach(() => {
      rateLimiter.init();
    });

    it('should handle auth:login requests', async () => {
      request.input.controller = 'auth';
      request.input.action = 'login';
      request.context.connection.id = 'foobar';

      rateLimiter.loginsPerSecond = 1;
      should(rateLimiter.frame.foobar).be.undefined();

      should(await rateLimiter.isAllowed(request)).be.true();
      should(rateLimiter.frame.foobar).be.eql(1);
      should(kuzzle.repositories.profile.loadProfiles).not.called();

      should(await rateLimiter.isAllowed(request)).be.false();
      should(rateLimiter.frame.foobar).be.eql(2);
      should(kuzzle.repositories.profile.loadProfiles).not.called();

      request.context.connection.id ='barfoo';
      should(await rateLimiter.isAllowed(request)).be.true();
      should(rateLimiter.frame.barfoo).be.eql(1);
      should(rateLimiter.frame.foobar).be.eql(2);
      should(kuzzle.repositories.profile.loadProfiles).not.called();

      clock.tick(1000);

      request.context.connection.id = 'foobar';
      should(await rateLimiter.isAllowed(request)).be.true();
      should(rateLimiter.frame.foobar).be.eql(1);
      should(kuzzle.repositories.profile.loadProfiles).not.called();
    });

    it('should handle non-logout requests', async () => {
      request.input.controller = 'controller';
      request.input.action = 'action';

      should(rateLimiter.frame.foo).be.undefined();

      // should use the most permissive limit
      for (let i = 0; i < 200; i++) {
        should(await rateLimiter.isAllowed(request)).be.true();
        should(rateLimiter.frame.foo).be.eql(i+1);
        should(kuzzle.repositories.profile.loadProfiles.callCount).eql(i+1);
        should(kuzzle.repositories.profile.loadProfiles)
          .alwaysCalledWithMatch(['bar', 'baz']);
      }

      should(await rateLimiter.isAllowed(request)).be.false();
      should(rateLimiter.frame.foo).be.eql(201);
      should(kuzzle.repositories.profile.loadProfiles.callCount).eql(201);
      should(kuzzle.repositories.profile.loadProfiles)
        .alwaysCalledWithMatch(['bar', 'baz']);

      clock.tick(1000);
      should(await rateLimiter.isAllowed(request)).be.true();
      should(rateLimiter.frame.foo).be.eql(1);
    });

    it('should not limit if at least 1 profile has not a rate limit', async () => {
      profiles.push({_id: 'over9000', rateLimit: 0});
      request.input.controller = 'controller';
      request.input.action = 'action';

      // should use the most permissive limit
      for (let i = 0; i < 9001; i++) {
        should(await rateLimiter.isAllowed(request)).be.true();
        should(rateLimiter.frame.foo).be.undefined();
        should(kuzzle.repositories.profile.loadProfiles.callCount).eql(i+1);
      }
    });

    it('should not limit calls to auth:logout for authenticated users', async () => {
      request.input.controller = 'auth';
      request.input.action = 'logout';

      profiles.pop();
      profiles[0].rateLimit = 1;

      for (let i = 0; i < 50; i++) {
        should(await rateLimiter.isAllowed(request)).be.true();
        should(rateLimiter.frame.foo).be.undefined();
        should(kuzzle.repositories.profile.loadProfiles).not.called();
      }
    });

    it('should limit calls to auth:logout for anonymous users', async () => {
      request.context.user._id = '-1';
      request.input.controller = 'auth';
      request.input.action = 'logout';

      profiles.pop();

      for (let i = 0; i < 50; i++) {
        should(await rateLimiter.isAllowed(request)).be.true();
        should(rateLimiter.frame['-1']).be.eql(i+1);
        should(kuzzle.repositories.profile.loadProfiles.callCount).eql(i+1);
        should(kuzzle.repositories.profile.loadProfiles)
          .alwaysCalledWithMatch(['bar', 'baz']);
      }

      should(await rateLimiter.isAllowed(request)).be.false();
      should(rateLimiter.frame['-1']).be.eql(51);
      should(kuzzle.repositories.profile.loadProfiles.callCount).eql(51);
      should(kuzzle.repositories.profile.loadProfiles)
        .alwaysCalledWithMatch(['bar', 'baz']);

      clock.tick(1000);
      should(await rateLimiter.isAllowed(request)).be.true();
      should(rateLimiter.frame['-1']).be.eql(1);
    });
  });
});

