'use strict';

const should = require('should');
const sinon = require('sinon');

const EntryPoint = require('../../../../lib/core/network/entryPoint');
const InternalProtocol = require('../../../../lib/core/network/protocols/internal');
const KuzzleMock = require('../../../../test/mocks/kuzzle.mock');

describe('/lib/core/network/protocols/internal', () => {
  let kuzzle;
  let entrypoint;
  let protocol;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entrypoint = new EntryPoint(kuzzle);

    sinon.stub(entrypoint, 'newConnection');
    sinon.stub(entrypoint, 'removeConnection');

    protocol = new InternalProtocol();
    protocol._kuzzle = kuzzle;
  });

  describe('#init', () => {
    it('should register his internal connection', async () => {
      await protocol.init(entrypoint);

      should(entrypoint.newConnection).be.calledWith(protocol.connection);
    });

    it('should register onAsk response', async () => {
      await protocol.init(entrypoint);

      should(kuzzle.onAsk).be.calledOnce();
      should(kuzzle.onAsk.getCall(0).args[0])
        .be.eql('core:network:internal:connectionId:get');
    });
  });

  describe('#joinChannel', () => {
    it('should add the channel to the list', () => {
      protocol.joinChannel('channel-id');

      should(Array.from(protocol.channels)).be.eql(['channel-id']);
    });
  });

  describe('#leaveChannel', () => {
    it('should add the channel to the list', () => {
      protocol.joinChannel('channel-id1');
      protocol.joinChannel('channel-id2');

      protocol.leaveChannel('channel-id2');

      should(Array.from(protocol.channels)).be.eql(['channel-id1']);
    });
  });

  describe('#broadcast', () => {
    it('should call _send', () => {
      const message = { channels: ['c1', 'c2'], payload: { hello: 'Gordon' } };
      protocol._send = sinon.stub();

      protocol.broadcast(message);

      should(protocol._send).be.calledWith(message);
    });
  });

  describe('#notify', () => {
    it('should call _send', () => {
      const message = { channels: ['c1', 'c2'], payload: { hello: 'Gordon' } };
      protocol._send = sinon.stub();

      protocol.notify(message);

      should(protocol._send).be.calledWith(message);
    });
  });

  describe('#_send', () => {
    it('should emit a message per channel with kuzzle event system', () => {
      const message = { channels: ['c1', 'c2'], payload: { hello: 'Gordon' } };

      protocol._send(message);

      should(kuzzle.emit)
        .be.calledWith('core:network:internal:message', { hello: 'Gordon', room: 'c1' })
        .be.calledWith('core:network:internal:message', { hello: 'Gordon', room: 'c1' });
    });
  });
});
