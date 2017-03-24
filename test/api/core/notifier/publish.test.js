'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: notifier.publish', () => {
  let
    kuzzle,
    notifier,
    notification,
    request,
    rooms = ['foo'];

  beforeEach(() => {
    kuzzle = new Kuzzle();
    notifier = new Notifier(kuzzle);

    request = {
      controller: 'realtime',
      action: 'publish',
      requestId: 'foo',
      collection: 'bar',
      _id: 'I am fabulous',
      body: {youAre: 'fabulous too'},
      metadata: {}
    };

    sandbox.stub(notifier, 'notify', (r, rq, n) => {notification = n;});
    notification = null;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should publish messages', (done) => {
    let result;

    kuzzle.dsl.test.returns(rooms);

    result = notifier.publish(new Request(request));
    should(result).match({published: true});
    should(notification.state).be.eql('done');
    should(notification.scope).be.eql('in');
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);

    setTimeout(() => {
      should(kuzzle.services.list.internalCache.add).not.be.called();
      should(kuzzle.services.list.internalCache.expire).not.be.called();
      done();
    }, 20);
  });

  it('should cache the document in case of a create document request', (done) => {
    kuzzle.dsl.test.returns(rooms);

    request.controller = 'document';
    request.action = 'create';
    notifier.publish(new Request(request));
    should(notification.state).be.eql('pending');
    should(notification.scope).be.undefined();
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);

    setTimeout(() => {
      should(kuzzle.services.list.internalCache.add).be.calledOnce();
      should(kuzzle.services.list.internalCache.expire).be.calledOnce();
      done();
    }, 20);
  });

  it('should cache the document in case of a createOrReplace document request', (done) => {
    kuzzle.dsl.test.returns(rooms);

    request.controller = 'document';
    request.action = 'createOrReplace';
    notifier.publish(new Request(request));
    should(notification.state).be.eql('pending');
    should(notification.scope).be.undefined();
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);
    setTimeout(() => {
      should(kuzzle.services.list.internalCache.add).be.calledOnce();
      should(kuzzle.services.list.internalCache.expire).be.calledOnce();
      done();
    }, 20);
  });

  it('should cache the document in case of a replace document request', (done) => {
    kuzzle.dsl.test.returns(rooms);

    request.controller = 'document';
    request.action = 'replace';
    notifier.publish(new Request(request));
    should(notification.state).be.eql('pending');
    should(notification.scope).be.undefined();
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);
    setTimeout(() => {
      should(kuzzle.services.list.internalCache.add).be.calledOnce();
      should(kuzzle.services.list.internalCache.expire).be.calledOnce();
      done();
    }, 20);
  });

  it('should do nothing if there is no room to notify', (done) => {
    let result;

    kuzzle.dsl.test.returns([]);

    result = notifier.publish(new Request(request));
    should(result).match({published: true});
    should(notification).be.null();
    setTimeout(() => {
      should(kuzzle.services.list.internalCache.add).not.be.called();
      should(kuzzle.services.list.internalCache.expire).not.be.called();
      done();
    }, 20);
  });
});
