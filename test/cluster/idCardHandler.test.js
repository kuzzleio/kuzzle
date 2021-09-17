'use strict';

const should = require('should');
const sinon = require('sinon');

const Kuzzle = require('../mocks/kuzzle.mock');

const { ClusterIdCardHandler, IdCard } = require('../../lib/cluster/idCardHandler');

describe('ClusterIdCardHandler', () => {
  let kuzzle;
  let idCardHandler;
  let ip = '192.168.42.42';
  let refreshDelay = 20;
  let evictNodeStub;

  beforeEach(() => {
    kuzzle = new Kuzzle();

    evictNodeStub = sinon.stub();

    idCardHandler = new ClusterIdCardHandler({
      evictSelf: evictNodeStub,
      heartbeatDelay: refreshDelay,
      ip,
    });
  });

  describe('#createIdCard', () => {
    beforeEach(() => {
      kuzzle.ask
        .withArgs('core:cache:internal:store')
        .resolves(true);

      kuzzle.ask
        .withArgs('core:cache:internal:pexpire')
        .resolves(1);
    });

    afterEach(() => {
      if (idCardHandler.refreshTimer) {
        clearInterval(idCardHandler.refreshTimer);
      }
    });

    it('should create a new uniq IdCard and store it in Redis', async () => {
      await idCardHandler.createIdCard();

      should(idCardHandler.nodeId).be.String();
      should(idCardHandler.nodeIdKey).be.eql(`{cluster/node}/${idCardHandler.nodeId}`);
      should(idCardHandler.idCard.id).be.eql(idCardHandler.nodeId);
      should(idCardHandler.idCard.ip).be.eql('192.168.42.42');
      should(idCardHandler.idCard.birthdate).be.approximately(Date.now(), 10);
      should(kuzzle.ask).be.calledWith(
        'core:cache:internal:store',
        `{cluster/node}/${idCardHandler.nodeId}`,
        idCardHandler.idCard.serialize(),
        {
          onlyIfNew: true,
          ttl: refreshDelay * 1.5
        });
    });

    it('should avoid collision for nodeIdKey', async () => {
      kuzzle.ask
        .withArgs('core:cache:internal:store')
        .onCall(0).resolves(false)
        .onCall(1).resolves(true);

      await idCardHandler.createIdCard();

      should(kuzzle.ask).be.calledTwice();
      const args0 = kuzzle.ask.getCall(0).args;
      const args1 = kuzzle.ask.getCall(1).args;
      should(args0[1]).not.eql(args1[1]);
    });

    it('should evict the node an error is received from the refresh worker', async () => {

      await idCardHandler.createIdCard();

      should(idCardHandler.refreshWorker).not.null();

      idCardHandler.refreshWorker.emit('message', { error: 'foo bar' });

      should(evictNodeStub)
        .calledOnce()
        .calledWith('foo bar');
    });
  });

  describe('#dispose', () => {
    it('should clear set disposed to true and notify the refresh worker that it should be disposed', async () => {
      const stub = sinon.stub();
      idCardHandler.refreshWorker = {
        postMessage: stub,
      };

      await idCardHandler.dispose();

      should(stub)
        .be.called()
        .and.be.calledWith({ action: 'dispose' });
      should(idCardHandler.disposed).be.true();
    });
  });

  describe('#getRemoteIdCards', () => {
    it('should returns other nodes idCards from Redis', async () => {
      const idCard1 = new IdCard({ id: 'id1', ip: 'ip1', birthdate: 1001 });
      const idCard2 = new IdCard({ id: 'id2', ip: 'ip2', birthdate: 1002 });
      const idCard3 = new IdCard({ id: 'id3', ip: 'ip3', birthdate: 1003 });
      idCardHandler.idCard = idCard1;
      idCardHandler.nodeIdKey = 'redis/id1';
      kuzzle.ask
        .withArgs('core:cache:internal:searchKeys')
        .resolves(['redis/id1', 'redis/id2', 'redis/id3']);
      kuzzle.ask
        .withArgs('core:cache:internal:mget')
        .resolves([idCard2.serialize(), idCard3.serialize()]);

      const remoteCards = await idCardHandler.getRemoteIdCards();

      should(kuzzle.ask).be.calledWith(
        'core:cache:internal:searchKeys',
        '{cluster/node}/*');
      should(kuzzle.ask).be.calledWith(
        'core:cache:internal:mget',
        ['redis/id2', 'redis/id3']);
      should(remoteCards).be.eql([idCard2, idCard3]);
    });
  });

  describe('#addNode', () => {
    it('should add the remote node to known topology and save the IdCard', async () => {
      idCardHandler._save = sinon.stub().resolves();
      idCardHandler.idCard = new IdCard({ id: 'id1', ip: 'ip1', birthdate: 1001 });

      await idCardHandler.addNode('remoteNodeId');

      should(idCardHandler.idCard.topology.has('remoteNodeId')).be.true();
      should(idCardHandler._save).be.called();
    });

    it('should not add the remote node if it is already known', async () => {
      idCardHandler._save = sinon.stub().resolves();
      idCardHandler.idCard = new IdCard({ id: 'id1', ip: 'ip1', birthdate: 1001 });
      idCardHandler.idCard.topology.add('remoteNodeId');

      await idCardHandler.addNode('remoteNodeId');

      should(idCardHandler._save).not.be.called();
    });

    it('should not add the remote node if the IdCard is disposed', async () => {
      idCardHandler._save = sinon.stub().resolves();
      idCardHandler.disposed = true;

      await idCardHandler.addNode('remoteNodeId');

      should(idCardHandler._save).not.be.called();
    });
  });

  describe('#removeNode', () => {
    it('should remove the remote node to known topology and save the IdCard', async () => {
      idCardHandler._save = sinon.stub().resolves();
      idCardHandler.idCard = new IdCard({ id: 'id1', ip: 'ip1', birthdate: 1001 });
      idCardHandler.idCard.topology.add('remoteNodeId');

      await idCardHandler.removeNode('remoteNodeId');

      should(idCardHandler.idCard.topology.has('remoteNodeId')).be.false();
      should(idCardHandler._save).be.called();
    });

    it('should not remove the remote node if it is not present', async () => {
      idCardHandler._save = sinon.stub().resolves();
      idCardHandler.idCard = new IdCard({ id: 'id1', ip: 'ip1', birthdate: 1001 });

      await idCardHandler.removeNode('remoteNodeId');

      should(idCardHandler._save).not.be.called();
    });

    it('should not remove the remote node if the IdCard is disposed', async () => {
      idCardHandler._save = sinon.stub().resolves();
      idCardHandler.disposed = true;

      await idCardHandler.removeNode('remoteNodeId');

      should(idCardHandler._save).not.be.called();
    });
  });
});
