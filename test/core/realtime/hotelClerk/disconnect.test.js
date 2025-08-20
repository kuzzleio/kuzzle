"use strict";

const should = require("should");
const sinon = require("sinon");

const KuzzleMock = require("../../../mocks/kuzzle.mock");

const { HotelClerk } = require("../../../../lib/core/realtime/hotelClerk");
const {
  ConnectionRooms,
} = require("../../../../lib/core/realtime/connectionRooms");
const { Room } = require("../../../../lib/core/realtime/room");
const { Channel } = require("../../../../lib/core/realtime/channel");

describe("Test: hotelClerk.removeConnection", () => {
  const connectionId = "connectionid";
  const collection = "user";
  const index = "%test";
  let kuzzle;
  let hotelClerk;
  let realtimeModule;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    realtimeModule = {
      notifier: {
        notifyUser: sinon.stub(),
      },
    };

    hotelClerk = new HotelClerk(realtimeModule);

    hotelClerk.subscriptions.set(
      connectionId,
      new ConnectionRooms(
        new Map([
          ["foo", { volatile: "room foo" }],
          ["bar", { volatile: "room bar" }],
        ]),
      ),
    );

    hotelClerk.subscriptions.set(
      "a",
      new ConnectionRooms(new Map([["foo", null]])),
    );
    hotelClerk.subscriptions.set(
      "b",
      new ConnectionRooms(new Map([["foo", null]])),
    );

    hotelClerk.rooms.set(
      "foo",
      new Room(
        "foo",
        index,
        collection,
        new Map([["foobar", new Channel("foo")]]),
        new Set([connectionId, "a", "b"]),
      ),
    );
    hotelClerk.rooms.set(
      "bar",
      new Room(
        "bar",
        index,
        collection,
        new Map([["barfoo", new Channel("bar")]]),
        new Set([connectionId]),
      ),
    );

    hotelClerk.roomsCount = 2;

    return hotelClerk.init();
  });

  it('should register a "connection:remove" event', async () => {
    sinon.stub(hotelClerk, "removeConnection");

    kuzzle.ask.restore();
    await kuzzle.ask("core:realtime:connection:remove", "connectionId");

    should(hotelClerk.removeConnection).calledWith("connectionId");
  });

  it("should do nothing when a bad connectionId is given", async () => {
    sinon.stub(hotelClerk, "unsubscribe");

    await hotelClerk.removeConnection("nope");

    should(hotelClerk.unsubscribe).not.be.called();
    should(hotelClerk.roomsCount).be.eql(2);
  });

  it("should clean up subscriptions, rooms object", async () => {
    await hotelClerk.removeConnection(connectionId);

    should(hotelClerk.rooms).have.key("foo");
    should(hotelClerk.rooms).not.have.key("bar");

    should(hotelClerk.subscriptions).have.key("a");
    should(hotelClerk.subscriptions).have.key("b");
    should(hotelClerk.subscriptions).not.have.key(connectionId);
    should(hotelClerk.roomsCount).be.eql(1);

    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      "foo",
      {
        input: {
          resource: { index, collection },
          action: "unsubscribe",
          controller: "realtime",
          volatile: { volatile: "room foo" },
        },
      },
      "out",
      { count: 2 },
    );

    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      "bar",
      {
        input: {
          resource: { index, collection },
          action: "unsubscribe",
          controller: "realtime",
          volatile: { volatile: "room bar" },
        },
      },
      "out",
      { count: 0 },
    );
  });

  it("should log an error if a problem occurs while unsubscribing", async () => {
    const error = new Error("Mocked error");
    realtimeModule.notifier.notifyUser.throws(error);

    await hotelClerk.removeConnection(connectionId);

    should(hotelClerk.logger.error).be.calledWith(error);
  });
});
