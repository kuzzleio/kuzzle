'use strict';

const
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
      index: 'foo',
      collection: 'bar',
      _id: 'I am fabulous',
      body: {youAre: 'fabulous too'},
      volatile: {}
    };

    notifier.notifyDocument = sinon.stub();
  });

  it('should publish messages', () => {
    kuzzle.realtime.test.returns(rooms);

    const request = new Request(rawRequest);
    should(notifier.publish(request, 'foo', 'bar')).match({published: true});

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(rooms, request, 'foo', 'bar', rawRequest.action, {
        _source: rawRequest.body,
        _id: rawRequest._id
      });

    should(kuzzle.services.list.internalCache.setex).not.be.called();
  });

  it('should do nothing if there is no room to notify', () => {
    kuzzle.realtime.test.returns([]);

    const result = notifier.publish(new Request(rawRequest), 'foo', 'bar');

    should(notifier.notifyDocument).not.be.called();
    should(result).match({published: true});

    should(kuzzle.services.list.internalCache.setex).not.be.called();
  });
});
