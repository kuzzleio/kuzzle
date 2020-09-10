'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.publish', () => {
  let kuzzle;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    sinon.stub(notifier, 'notifyDocument').resolves();

    return notifier.init();
  });

  it('should register a "publish" event', async () => {
    sinon.stub(notifier, 'publish');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:publish', 'request');

    should(notifier.publish).calledWith('request');
  });

  it('should publish messages', async () => {
    const rooms = ['foo'];
    const request = new Request({
      controller: 'realtime',
      action: 'publish',
      index: 'foo',
      collection: 'bar',
      _id: 'I am fabulous',
      body: {youAre: 'fabulous too'},
      volatile: {},
    });

    kuzzle.koncorde.test.returns(rooms);

    await notifier.publish(request);

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(rooms, request, 'in', request.input.action, {
        _source: request.input.body,
        _id: request.input.resource._id,
      });
  });
});
