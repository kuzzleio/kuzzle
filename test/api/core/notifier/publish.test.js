'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier'),
  { Request } = require('kuzzle-common-objects');

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

    sinon.stub(notifier, 'notifyDocument').resolves();
  });

  it('should publish messages', () => {
    kuzzle.koncorde.test.returns(rooms);

    const request = new Request(rawRequest);

    return notifier.publish(request)
      .then(() => {
        should(notifier.notifyDocument)
          .calledOnce()
          .calledWith(rooms, request, 'in', rawRequest.action, {
            _source: rawRequest.body,
            _id: rawRequest._id
          });

        should(kuzzle.cacheEngine.internal.setex).not.be.called();
      });
  });
});
