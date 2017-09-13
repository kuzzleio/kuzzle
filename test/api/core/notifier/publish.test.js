'use strict';

const
  async = require('async'),
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: notifier.publish', () => {
  let
    kuzzle,
    notifier,
    rawRequest,
    rooms = ['foo'];

  beforeEach(() => {
    kuzzle = new Kuzzle();
    notifier = new Notifier(kuzzle);

    rawRequest = {
      controller: 'realtime',
      action: 'publish',
      collection: 'bar',
      _id: 'I am fabulous',
      body: {youAre: 'fabulous too'},
      volatile: {}
    };

    notifier.notifyDocument = sinon.stub();
  });

  it('should publish messages', (done) => {
    kuzzle.realtime.test.returns(rooms);

    const request = new Request(rawRequest);
    should(notifier.publish(request, 'foo', 'bar')).match({published: true});

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(rooms, request, 'foo', 'bar', rawRequest.action, {
        _source: rawRequest.body,
        _id: rawRequest._id
      });

    async.retry({times: 20, interval: 20}, cb => {
      try {
        should(kuzzle.services.list.internalCache.add).not.be.called();
        should(kuzzle.services.list.internalCache.expire).not.be.called();
        cb();
      }
      catch (e) {
        cb(e);
      }
    }, done);
  });

  it('should cache the document in case of a create document rawRequest', (done) => {
    kuzzle.realtime.test.returns(rooms);

    rawRequest.controller = 'document';
    rawRequest.action = 'create';
    const request = new Request(rawRequest);
    should(notifier.publish(request, 'foo', 'bar')).match({published: true});

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(rooms, request, 'foo', 'bar', rawRequest.action, {
        _source: rawRequest.body,
        _id: rawRequest._id
      });

    async.retry({times: 20, interval: 20}, cb => {
      try {
        should(kuzzle.services.list.internalCache.add).be.calledOnce();
        should(kuzzle.services.list.internalCache.expire).be.calledOnce();
        cb();
      }
      catch(e) {
        cb(e);
      }
    }, done);
  });

  it('should cache the document in case of a createOrReplace document rawRequest', (done) => {
    kuzzle.realtime.test.returns(rooms);

    rawRequest.controller = 'document';
    rawRequest.action = 'createOrReplace';
    const request = new Request(rawRequest);
    should(notifier.publish(request, 'foo', 'bar')).match({published: true});

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(rooms, request, 'foo', 'bar', rawRequest.action, {
        _source: rawRequest.body,
        _id: rawRequest._id
      });

    async.retry({times: 20, interval: 20}, cb => {
      try {
        should(kuzzle.services.list.internalCache.add).be.calledOnce();
        should(kuzzle.services.list.internalCache.expire).be.calledOnce();
        cb();
      }
      catch(e) {
        cb(e);
      }
    }, done);
  });

  it('should cache the document in case of a replace document rawRequest', (done) => {
    kuzzle.realtime.test.returns(rooms);

    rawRequest.controller = 'document';
    rawRequest.action = 'replace';
    const request = new Request(rawRequest);
    should(notifier.publish(request, 'foo', 'bar')).match({published: true});

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(rooms, request, 'foo', 'bar', rawRequest.action, {
        _source: rawRequest.body,
        _id: rawRequest._id
      });

    async.retry({times: 20, interval: 20}, cb => {
      try {
        should(kuzzle.services.list.internalCache.add).be.calledOnce();
        should(kuzzle.services.list.internalCache.expire).be.calledOnce();
        cb();
      }
      catch(e) {
        cb(e);
      }
    }, done);
  });

  it('should do nothing if there is no room to notify', (done) => {
    let result;

    kuzzle.realtime.test.returns([]);

    result = notifier.publish(new Request(rawRequest), 'foo', 'bar');

    should(notifier.notifyDocument.called).be.false();
    should(result).match({published: true});

    async.retry({times: 20, interval: 20}, cb => {
      try {
        should(kuzzle.services.list.internalCache.add).not.be.called();
        should(kuzzle.services.list.internalCache.expire).not.be.called();
        cb();
      }
      catch(e) {
        cb(e);
      }
    }, done);
  });
});
