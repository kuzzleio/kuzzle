"use strict";

const should = require("should");
const sinon = require("sinon");
const mockRequire = require("mock-require");
const Long = require("long");

const KuzzleMock = require("../mocks/kuzzle.mock");

class ZeroMQSubscriberMock {
  constructor() {
    this.connect = sinon.stub().resolves();
    this.subscribe = sinon.stub().resolves();
    this.receive = sinon.stub().resolves();
  }
}

class ClusterNodeMock {
  constructor() {
    this.bind = sinon.stub().resolves();
    this.evictNode = sinon.stub().resolves();
    this.evictSelf = sinon.stub().resolves();

    this.fullState = {
      addRealtimeRoom: sinon.stub(),
      addRealtimeSubscription: sinon.stub(),
      removeRealtimeRoom: sinon.stub(),
      removeRealtimeSubscription: sinon.stub(),
      addAuthStrategy: sinon.stub(),
      removeAuthStrategy: sinon.stub(),
    };

    this.eventEmitter = {
      emit: sinon.stub(),
    };

    this.config = { ports: { sync: 7511 } };
    this.heartbeatDelay = 20;
  }
}

describe("ClusterSubscriber", () => {
  const remoteNodeId = "knode-happy-remote-4242";
  const remoteNodeIP = "192.168.1.42";

  let ClusterSubscriber;
  let subscriber;
  let localNode;
  let kuzzle;

  before(() => {
    mockRequire("zeromq", { Subscriber: ZeroMQSubscriberMock });
    ClusterSubscriber = mockRequire.reRequire("../../lib/cluster/subscriber");
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    localNode = new ClusterNodeMock();
    subscriber = new ClusterSubscriber(localNode, remoteNodeId, remoteNodeIP);
  });

  describe("#constructor", () => {
    it("should initialize a subscribe for a remote node", () => {
      should(subscriber.localNode).be.eql(localNode);

      should(subscriber.remoteNodeIP).be.eql(remoteNodeIP);
      should(subscriber.remoteNodeId).be.eql(remoteNodeId);
      should(subscriber.remoteNodeAddress).be.eql("tcp://192.168.1.42:7511");

      should(subscriber.state).be.eql(ClusterSubscriber.stateEnum.BUFFERING);

      should(subscriber.lastHeartbeat).be.approximately(Date.now(), 100);
      should(subscriber.heartbeatDelay).be.eql(localNode.heartbeatDelay * 1.5);

      should(subscriber.handlers).be.eql({
        AddCollection: subscriber.handleCollectionAddition,
        AddIndex: subscriber.handleIndexAddition,
        ClusterWideEvent: subscriber.handleClusterWideEvent,
        DocumentNotification: subscriber.handleDocumentNotification,
        DumpRequest: subscriber.handleDumpRequest,
        Heartbeat: subscriber.handleHeartbeat,
        InvalidateProfile: subscriber.handleProfileInvalidation,
        InvalidateRole: subscriber.handleRoleInvalidation,
        NewAuthStrategy: subscriber.handleNewAuthStrategy,
        NewRealtimeRoom: subscriber.handleNewRealtimeRoom,
        NodeEvicted: subscriber.handleNodeEviction,
        NodePreventEviction: subscriber.handleNodePreventEviction,
        NodeShutdown: subscriber.handleNodeShutdown,
        RefreshIndexCache: subscriber.handleRefreshIndexCache,
        RefreshValidators: subscriber.handleRefreshValidators,
        RemoveAuthStrategy: subscriber.handleAuthStrategyRemoval,
        RemoveCollection: subscriber.handleCollectionRemoval,
        RemoveIndexes: subscriber.handleIndexesRemoval,
        RemoveRealtimeRoom: subscriber.handleRealtimeRoomRemoval,
        ResetSecurity: subscriber.handleResetSecurity,
        Shutdown: subscriber.handleShutdown,
        Subscription: subscriber.handleSubscription,
        Unsubscription: subscriber.handleUnsubscription,
        UserNotification: subscriber.handleUserNotification,
      });
    });
  });

  describe("#init", () => {
    it("should establish connection to remote node and start heartbeat timer", async () => {
      subscriber.listen = sinon.stub().resolves();
      subscriber.checkHeartbeat = sinon.stub();

      await subscriber.init();

      await new Promise((resolve) =>
        setTimeout(resolve, localNode.heartbeatDelay * 1.6),
      );
      should(subscriber.protoroot).not.be.null();
      should(subscriber.socket.connect).be.calledWith(
        subscriber.remoteNodeAddress,
      );
      should(subscriber.socket.subscribe).be.calledOnce();
      should(subscriber.listen).be.calledOnce();
      should(subscriber.checkHeartbeat).be.calledOnce();

      clearInterval(subscriber.heartbeatTimer);
    });
  });

  describe("after init methods", () => {
    beforeEach(async () => {
      const subscriberListen = subscriber.listen;
      subscriber.listen = sinon.stub();

      await subscriber.init();

      subscriber.listen = subscriberListen;
      clearInterval(subscriber.heartbeatTimer);
    });

    describe("#listen", () => {
      let paquetReceived;

      beforeEach(() => {
        subscriber.processData = sinon.stub().resolves();
        let count = 1;
        subscriber.socket.receive = async () => {
          if (count === paquetReceived) {
            subscriber.state = ClusterSubscriber.stateEnum.EVICTED;
          }

          return [Buffer.from(`topic${count}`), `data${count++}`];
        };
      });

      it("should dispatch new received messages while the node is not evicted", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.SANE;
        paquetReceived = 3;

        await subscriber.listen();

        should(subscriber.processData).be.calledTwice();
        should(subscriber.processData)
          .be.calledWith("topic1", "data1")
          .be.calledWith("topic2", "data2");
      });

      it("should buffer new receveid messages if the subscriber is buffering", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.BUFFERING;
        paquetReceived = 2;

        await subscriber.listen();

        should(subscriber.processData).not.be.called();
        should(subscriber.buffer).be.eql([["topic1", "data1"]]);
      });

      it("should evict the localNode if messages can't be received", async () => {
        subscriber.socket.receive = sinon
          .stub()
          .rejects(new Error("you have been a very bad node"));

        await subscriber.listen();

        should(subscriber.localNode.evictNode).be.calledWith(
          subscriber.remoteNodeId,
          {
            broadcast: true,
            reason: "you have been a very bad node",
          },
        );
      });
    });

    describe("#sync", () => {
      it("should plays all buffered messages and set the state", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.BUFFERING;
        subscriber.processData = sinon.stub().resolves();
        subscriber.buffer = [
          ["topic1", "data1"],
          ["topic2", "data2"],
        ];

        await subscriber.sync(42);

        should(subscriber.lastMessageId).be.eql(42);
        should(subscriber.state).be.eql(ClusterSubscriber.stateEnum.SANE);
        should(subscriber.processData).be.calledTwice();
        should(subscriber.processData)
          .be.calledWith("topic1", "data1")
          .be.calledWith("topic2", "data2");
      });
    });

    describe("#processData", () => {
      let addIndexHandler;
      const topic = "AddIndex";
      const message = {
        messageId: new Long(0, 0, true),
        scope: "scope",
        index: "sensors",
      };
      const encodedMessage = Buffer.from(
        "0800120573636f70651a0773656e736f7273",
        "hex",
      );

      beforeEach(() => {
        addIndexHandler = sinon.stub().resolves();
        subscriber.validateMessage = sinon.stub().resolves(true);
        subscriber.handlers = {
          [topic]: addIndexHandler,
        };
        subscriber.localNode.fullState = {
          serialize: sinon.stub(),
        };
      });

      it("should validate the message and call the appropriate handler", async () => {
        await subscriber.processData(topic, encodedMessage);

        should(subscriber.validateMessage).be.calledWith(message);
        should(addIndexHandler).be.calledWith(message);
      });

      it("should refresh the last heartbeat when receiving a message", async () => {
        const heartbeatStub = sinon.stub(subscriber, "handleHeartbeat");
        await subscriber.processData(topic, encodedMessage);

        should(heartbeatStub).be.calledOnce();
      });

      it("should not process invalid messages", async () => {
        subscriber.validateMessage = sinon.stub().resolves(false);

        await subscriber.processData(topic, encodedMessage);

        should(addIndexHandler).not.be.called();
      });

      it("should shutdown the local node if the handler fail to process the message", async () => {
        addIndexHandler.rejects(new Error("duuuude wtf"));

        await subscriber.processData(topic, encodedMessage);

        should(localNode.evictSelf).calledOnce();
      });

      it("should evict the node if an incorrect message is received", async () => {
        await subscriber.processData("AddPokedex", encodedMessage);

        should(subscriber.validateMessage).not.be.called();
        should(addIndexHandler).not.be.called();
        should(subscriber.localNode.evictNode).be.calledWith(
          subscriber.remoteNodeId,
          {
            broadcast: true,
            reason: `received an invalid message from ${subscriber.remoteNodeId} (unknown topic "AddPokedex")`,
          },
        );
      });

      it("should do nothing if the node was evicted", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.EVICTED;

        await subscriber.processData(topic, encodedMessage);

        should(subscriber.validateMessage).not.be.called();
        should(addIndexHandler).not.be.called();
        should(subscriber.localNode.evictNode).not.be.called();
      });
    });

    describe("#checkHeartbeat", () => {
      it("should set state to SANE if heartbeat was recevied", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.MISSING_HEARTBEAT;
        subscriber.heartbeatDelay = 100;
        subscriber.lastHeartbeat = Date.now() - 50;

        await subscriber.checkHeartbeat();

        should(subscriber.state).be.eql(ClusterSubscriber.stateEnum.SANE);
      });

      it("should evict the node if heartbeat is missing and the state was MISSING_HEARTBEAT", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.MISSING_HEARTBEAT;
        subscriber.heartbeatDelay = 100;
        subscriber.lastHeartbeat = Date.now() - 150;

        await subscriber.checkHeartbeat();

        should(subscriber.state).be.eql(ClusterSubscriber.stateEnum.EVICTED);
        should(subscriber.localNode.evictNode).be.calledWith(
          subscriber.remoteNodeId,
          {
            broadcast: true,
            reason: "heartbeat timeout",
          },
        );
      });

      it("should set the state to MISSING_HEARTBEAT if heartbeat is missing", async () => {
        subscriber.heartbeatDelay = 100;
        subscriber.lastHeartbeat = Date.now() - 150;

        await subscriber.checkHeartbeat();

        should(subscriber.state).be.eql(
          ClusterSubscriber.stateEnum.MISSING_HEARTBEAT,
        );
      });
    });

    describe("#dispose", () => {
      it("should close the socket and clear timer", () => {
        subscriber.socket = {
          close: sinon.stub(),
        };

        subscriber.dispose();

        should(subscriber.state).be.eql(ClusterSubscriber.stateEnum.EVICTED);
        should(subscriber.socket).be.null();
        should(subscriber.heartbeatTimer._destroyed).be.true();
      });
    });

    describe("#validateMessage", () => {
      let message;

      beforeEach(() => {
        subscriber.lastMessageId = new Long(0, 0, true);
        message = {
          messageId: new Long(1, 0, true),
        };
      });

      it("should invalidate and evict node if messageId is missing", async () => {
        delete message.messageId;

        const ret = await subscriber.validateMessage(message);

        should(ret).be.false();
        should(subscriber.localNode.evictNode).be.calledWith(
          subscriber.remoteNodeId,
          {
            broadcast: true,
            reason: 'invalid message received (missing "messageId" field)',
          },
        );
        should(subscriber.state).be.eql(ClusterSubscriber.stateEnum.EVICTED);
      });

      it("should invalidate when subscriber is buffering and with a previous messageId", async () => {
        subscriber.state = ClusterSubscriber.stateEnum.BUFFERING;
        subscriber.lastMessageId = new Long(1, 0, true);

        const ret = await subscriber.validateMessage(message);

        should(ret).be.false();
      });

      it("should increment the lastMessageId", async () => {
        const ret = await subscriber.validateMessage(message);

        should(ret).be.true();
        should(subscriber.lastMessageId.toNumber()).be.eql(1);
      });

      it("should invalidate and shutdown if messageId does not match", async () => {
        message.messageId = new Long(3, 0, true);

        const ret = await subscriber.validateMessage(message);

        should(ret).be.false();
        should(localNode.evictSelf).calledOnce();
      });
    });

    describe("#handlerHeartbeat", () => {
      it("should reset lastHeartbeat date", () => {
        subscriber.lastHeartbeat = 42;

        subscriber.handleHeartbeat();

        should(subscriber.lastHeartbeat).be.approximately(Date.now(), 10);
      });
    });

    describe("#handleNodeEviction", () => {
      let message;

      beforeEach(() => {
        message = {
          nodeId: "remote-node-21",
          evictor: "other-node-84",
          reason: "you are a very very bad node",
        };
      });

      it("should kill itself if evicted node is itself", async () => {
        message.nodeId = localNode.nodeId;

        await subscriber.handleNodeEviction(message);

        should(subscriber.localNode.evictNode).not.be.called();
        should(kuzzle.shutdown).be.calledOnce();
      });

      it("should evict the remote node", async () => {
        await subscriber.handleNodeEviction(message);

        should(subscriber.localNode.evictNode).be.calledWith(message.nodeId, {
          broadcast: false,
          reason: "you are a very very bad node",
        });
        should(kuzzle.shutdown).not.be.called();
      });
    });

    describe("#handleNodeShutdown", () => {
      it("should evict the node", async () => {
        await subscriber.handleNodeShutdown({ nodeId: "remote-node-21" });

        should(subscriber.localNode.evictNode).be.calledWith("remote-node-21", {
          broadcast: false,
          reason: "Node is shutting down",
        });
      });
    });

    describe("#handleNewRealtimeRoom", () => {
      it("should add the room to the fullstate", async () => {
        const message = {
          id: "roomId",
          index: "index/collection",
          filter: '["filters"]',
          messageId: "messageId",
        };

        await subscriber.handleNewRealtimeRoom(message);

        should(localNode.fullState.addRealtimeRoom).be.calledWith(
          "roomId",
          "index",
          "collection",
          ["filters"],
          {
            messageId: "messageId",
            nodeId: subscriber.remoteNodeId,
            subscribers: 0,
          },
        );
      });
    });

    describe("#handleSubscription", () => {
      it("should add the subscription to the fullstate", async () => {
        const message = {
          roomId: "roomId",
          messageId: "messageId",
        };

        await subscriber.handleSubscription(message);

        should(localNode.fullState.addRealtimeSubscription).be.calledWith(
          "roomId",
          subscriber.remoteNodeId,
          "messageId",
        );
      });
    });

    describe("#handleRealtimeRoomRemoval", () => {
      it("should remove the room from the fullstate", async () => {
        const message = {
          roomId: "roomId",
          messageId: "messageId",
        };

        await subscriber.handleRealtimeRoomRemoval(message);

        should(localNode.fullState.removeRealtimeRoom).be.calledWith(
          "roomId",
          subscriber.remoteNodeId,
        );
      });
    });

    describe("#handleUnsubscription", () => {
      it("should remove the subscription from the fullstate", async () => {
        const message = {
          roomId: "roomId",
          messageId: "messageId",
        };

        await subscriber.handleUnsubscription(message);

        should(localNode.fullState.removeRealtimeSubscription).be.calledWith(
          "roomId",
          subscriber.remoteNodeId,
          "messageId",
        );
      });
    });

    describe("#handleClusterWideEvent", () => {
      it("should propagate cluster wide event", async () => {
        const message = {
          payload: '["payload"]',
          event: "event",
        };

        await subscriber.handleClusterWideEvent(message);

        should(localNode.eventEmitter.emit).be.calledWith("event", ["payload"]);
      });
    });

    describe("#handleDocumentNotification", () => {
      it("should handle the message", async () => {
        const message = {
          scope: "scope",
          action: "create",
          result: '["result"]',
          status: "status",
          requestId: "requestId",
          timestamp: new Long(0, 0, true),
          index: "index",
          collection: "collection",
          controller: "controller",
          protocol: "protocol",
          volatile: '["volatile"]',
          rooms: "rooms",
        };

        await subscriber.handleDocumentNotification(message);

        // @todo check that the method is called with the notification
        // when the Notification.from method is reay
        should(kuzzle.ask).be.called();
      });
    });

    describe("#handleUserNotification", () => {
      it("should handle the message", async () => {
        const message = {
          scope: "scope",
          action: "create",
          result: '["result"]',
          status: "status",
          requestId: "requestId",
          timestamp: new Long(0, 0, true),
          index: "index",
          collection: "collection",
          controller: "controller",
          protocol: "protocol",
          volatile: '["volatile"]',
          rooms: "rooms",
        };

        await subscriber.handleUserNotification(message);

        // @todo check that the method is called with the notification
        // when the Notification.from method is reay
        should(kuzzle.ask).be.called();
      });
    });

    describe("#handleNewAuthStrategy", () => {
      it("should handle the message", async () => {
        const message = {
          pluginName: "pluginName",
          strategy: "strategy",
          strategyName: "strategyName",
        };

        await subscriber.handleNewAuthStrategy(message);

        should(localNode.fullState.addAuthStrategy).be.calledWith(message);
        should(kuzzle.pluginsManager.registerStrategy).be.calledWith(
          "pluginName",
          "strategyName",
          "strategy",
        );
      });
    });

    describe("#handleAuthStrategyRemoval", () => {
      it("should handle the message", async () => {
        const message = {
          pluginName: "pluginName",
          strategyName: "strategyName",
        };

        await subscriber.handleAuthStrategyRemoval(message);

        should(localNode.fullState.removeAuthStrategy).be.calledWith(
          "strategyName",
        );
        should(kuzzle.pluginsManager.unregisterStrategy).be.calledWith(
          "pluginName",
          "strategyName",
        );
      });
    });

    describe("#handleResetSecurity", () => {
      it("should handle the message", async () => {
        await subscriber.handleResetSecurity();

        should(kuzzle.ask)
          .be.calledWith("core:security:profile:invalidate")
          .be.calledWith("core:security:role:invalidate");
      });
    });

    describe("#handleDumpRequest", () => {
      it("should handle the message", () => {
        const message = {
          suffix: "suffix",
        };

        subscriber.handleDumpRequest(message);

        should(kuzzle.dump).be.calledWith("suffix");
      });
    });

    describe("#handleShutdown", () => {
      it("should handle the message", () => {
        subscriber.handleShutdown();

        should(kuzzle.shutdown).be.called();
      });
    });

    describe("#handleRefreshValidators", () => {
      it("should handle the message", () => {
        subscriber.handleRefreshValidators();

        should(kuzzle.validation.curateSpecification).be.called();
      });
    });

    describe("#handleProfileInvalidation", () => {
      it("should handle the message", async () => {
        const message = {
          profileId: "profileId",
        };

        await subscriber.handleProfileInvalidation(message);

        should(kuzzle.ask).be.calledWith(
          "core:security:profile:invalidate",
          "profileId",
        );
      });
    });

    describe("#handleRoleInvalidation", () => {
      it("should handle the message", async () => {
        const message = {
          roleId: "roleId",
        };

        await subscriber.handleRoleInvalidation(message);

        should(kuzzle.ask).be.calledWith(
          "core:security:role:invalidate",
          "roleId",
        );
      });
    });

    describe("#handleIndexAddition", () => {
      it("should handle the message", async () => {
        const message = {
          index: "index",
          scope: "scope",
        };

        await subscriber.handleIndexAddition(message);

        should(kuzzle.ask).be.calledWith(
          "core:storage:scope:cache:addIndex",
          "index",
        );
      });
    });

    describe("#handleCollectionAddition", () => {
      it("should handle the message", async () => {
        const message = {
          index: "index",
          collection: "collection",
          scope: "scope",
        };

        await subscriber.handleCollectionAddition(message);

        should(kuzzle.ask).be.calledWith(
          "core:storage:scope:cache:addCollection",
          "index",
          "collection",
        );
      });
    });

    describe("#handleCollectionRemoval", () => {
      it("should handle the message", async () => {
        const message = {
          index: "index",
          collection: "collection",
          scope: "scope",
        };

        await subscriber.handleCollectionRemoval(message);

        should(kuzzle.ask).be.calledWith(
          "core:storage:scope:cache:removeCollection",
          "index",
          "collection",
        );
      });
    });
  });
});
