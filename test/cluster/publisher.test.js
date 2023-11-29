"use strict";

const should = require("should");
const sinon = require("sinon");
const mockRequire = require("mock-require");
const { NormalizedFilter } = require("koncorde");

class ZeroMQPublisherMock {
  constructor() {
    this.bind = sinon.stub().resolves();
    this.send = sinon.stub().resolves();
    this.close = sinon.stub().resolves();
  }
}

describe("ClusterPublisher", () => {
  let ClusterPublisher;
  let publisher;
  let node = { config: { ports: { sync: 7511 } } };

  before(() => {
    mockRequire("zeromq", { Publisher: ZeroMQPublisherMock });
    ClusterPublisher = mockRequire.reRequire("../../lib/cluster/publisher");
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    publisher = new ClusterPublisher(node);
  });

  describe("#init", () => {
    it("should start binding the socket to the command port and load protobuf", async () => {
      await publisher.init();

      should(publisher.socket.bind).be.calledWith("tcp://*:7511");
      should(publisher.protoroot).not.be.null();
    });
  });

  describe("#send", () => {
    beforeEach(async () => {
      publisher.bufferSend = sinon.stub();
      await publisher.init();
    });

    it("should encode the message with protobuf and pass it to bufferSend", () => {
      const lastMessageId = publisher.lastMessageId;
      const messageId = publisher.send("DumpRequest", { suffix: "suffix" });

      should(messageId).be.eql(publisher.lastMessageId);
      should(publisher.bufferSend).be.calledWith(
        "DumpRequest",
        Buffer.from("08011206737566666978", "hex"),
      );
      should(messageId > lastMessageId).be.true();
    });
  });

  describe("#bufferSend", () => {
    it("should send the content of the buffer", async () => {
      await publisher.init();
      publisher.buffer.push({ data: "data1", topic: "topic1" });

      await publisher.bufferSend("topic2", "data2");

      should(publisher.state).be.eql(1); // READY
      should(publisher.buffer).be.empty();
      should(publisher.socket.send)
        .be.calledWith(["topic1", "data1"])
        .be.calledWith(["topic2", "data2"]);
    });
  });

  describe("#dispose", () => {
    it("should close the socket", async () => {
      await publisher.init();
      const socket = publisher.socket;

      await publisher.dispose();

      should(socket.close).be.called();
      should(publisher.socket).be.null();
    });
  });

  describe("commands", () => {
    beforeEach(() => {
      publisher.send = sinon.stub().returns("response");
    });

    describe("#sendNewRealtimeRoom", () => {
      it("should send the appropriate command and payload", () => {
        const normalized = new NormalizedFilter(
          ["filters"],
          "roomId",
          "index/collection",
        );
        const result = publisher.sendNewRealtimeRoom(normalized);

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("NewRealtimeRoom", {
          filter: '["filters"]',
          id: "roomId",
          index: "index/collection",
        });
      });
    });

    describe("#sendRemoveRealtimeRoom", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendRemoveRealtimeRoom("roomId");

        should(publisher.send).be.calledWith("RemoveRealtimeRoom", {
          roomId: "roomId",
        });
        should(result).be.eql("response");
      });
    });

    describe("#sendUnsubscription", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendUnsubscription("roomId");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("Unsubscription", {
          roomId: "roomId",
        });
      });
    });

    describe("#sendSubscription", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendSubscription("roomId");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("Subscription", {
          roomId: "roomId",
        });
      });
    });

    describe("#sendDocumentNotification", () => {
      it("should send the appropriate command and payload", () => {
        const notification = {
          action: "action",
          collection: "collection",
          controller: "controller",
          index: "index",
          protocol: "protocol",
          requestId: "requestId",
          result: ["result"],
          scope: "scope",
          status: "status",
          timestamp: "timestamp",
          volatile: ["volatile"],
        };
        const result = publisher.sendDocumentNotification(
          ["rooms"],
          notification,
        );

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("DocumentNotification", {
          ...notification,
          rooms: ["rooms"],
          result: '["result"]',
          volatile: '["volatile"]',
        });
      });
    });

    describe("#sendUserNotification", () => {
      it("should send the appropriate command and payload", () => {
        const notification = {
          action: "action",
          collection: "collection",
          controller: "controller",
          index: "index",
          protocol: "protocol",
          result: ["result"],
          status: "status",
          timestamp: "timestamp",
          user: "user",
          volatile: ["volatile"],
        };
        const result = publisher.sendUserNotification("room", notification);

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("UserNotification", {
          ...notification,
          room: "room",
          result: '["result"]',
          volatile: '["volatile"]',
        });
      });
    });

    describe("#sendNewAuthStrategy", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendNewAuthStrategy(
          "strategyName",
          "pluginName",
          "strategy",
        );

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("NewAuthStrategy", {
          pluginName: "pluginName",
          strategy: "strategy",
          strategyName: "strategyName",
        });
      });
    });

    describe("#sendRemoveAuthStrategy", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendRemoveAuthStrategy(
          "strategyName",
          "pluginName",
        );

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("RemoveAuthStrategy", {
          pluginName: "pluginName",
          strategyName: "strategyName",
        });
      });
    });

    describe("#sendDumpRequest", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendDumpRequest("suffix");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("DumpRequest", {
          suffix: "suffix",
        });
      });
    });

    describe("#sendAddIndex", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendAddIndex("scope", "index");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("AddIndex", {
          scope: "scope",
          index: "index",
        });
      });
    });

    describe("#sendAddCollection", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendAddCollection(
          "scope",
          "index",
          "collection",
        );

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("AddCollection", {
          scope: "scope",
          index: "index",
          collection: "collection",
        });
      });
    });

    describe("#sendRemoveIndexes", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendRemoveIndexes("scope", "indexes");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("RemoveIndexes", {
          scope: "scope",
          indexes: "indexes",
        });
      });
    });

    describe("#sendRemoveCollection", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendRemoveCollection(
          "scope",
          "index",
          "collection",
        );

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("RemoveCollection", {
          scope: "scope",
          index: "index",
          collection: "collection",
        });
      });
    });

    describe("#sendClusterWideEvent", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendClusterWideEvent("event", ["payload"]);

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("ClusterWideEvent", {
          event: "event",
          payload: '["payload"]',
        });
      });
    });

    describe("#sendNodeShutdown", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendNodeShutdown("nodeId");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("NodeShutdown", {
          nodeId: "nodeId",
        });
      });
    });

    describe("#sendNodeEvicted", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendNodeEvicted("evictor", "nodeId", "reason");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("NodeEvicted", {
          evictor: "evictor",
          nodeId: "nodeId",
          reason: "reason",
        });
      });
    });

    describe("#sendHeartbeat", () => {
      it("should send the appropriate command and payload", () => {
        const result = publisher.sendHeartbeat("address");

        should(result).be.eql("response");
        should(publisher.send).be.calledWith("Heartbeat", {
          address: "address",
        });
      });
    });
  });
});
