"use strict";

const should = require("should");
const sinon = require("sinon");

const KuzzleMock = require("../../../mocks/kuzzle.mock");

const { HotelClerk } = require("../../../../lib/core/realtime/hotelClerk");

describe("Test: hotelClerk.list", () => {
  let kuzzle;
  let hotelClerk;
  let user;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk({});

    user = {
      _id: "user",
      isActionAllowed: sinon.stub().resolves(true),
    };

    return hotelClerk.init();
  });

  it('should register a "list" event', async () => {
    sinon.stub(hotelClerk, "list");

    kuzzle.ask.restore();
    await kuzzle.ask("core:realtime:list", "user");

    should(hotelClerk.list).calledWith("user");
  });

  it("should return an empty object if there is no room", async () => {
    kuzzle.ask.withArgs("cluster:realtime:room:list").resolves({});

    should(await hotelClerk.list(user))
      .be.empty()
      .Object();
  });

  it("should return a correct list according to subscribe on filter", async () => {
    kuzzle.ask.withArgs("cluster:realtime:room:list").resolves({
      anotherIndex: {
        anotherCollection: {
          baz: 42,
        },
      },
      index: {
        collection: {
          foo: 12,
          bar: 24,
        },
      },
    });

    const response = await hotelClerk.list(user);

    should(response).match({
      index: {
        collection: {
          foo: 12,
          bar: 24,
        },
      },
      anotherIndex: {
        anotherCollection: {
          baz: 42,
        },
      },
    });
  });

  it("should return a correct list according to subscribe on filter and user right", async () => {
    kuzzle.ask.withArgs("cluster:realtime:room:list").resolves({
      andAnotherOne: {
        collection: {
          foobar: 26,
        },
      },
      anotherIndex: {
        anotherCollection: {
          baz: 42,
        },
      },
      index: {
        collection: {
          foo: 12,
          bar: 24,
        },
        forbidden: {
          foo: 54,
        },
      },
    });

    user.isActionAllowed.onSecondCall().resolves(false);
    user.isActionAllowed.onThirdCall().resolves(false);

    const response = await hotelClerk.list(user);

    console.log(response);

    should(response).match({
      index: {
        collection: {
          foo: 12,
          bar: 24,
        },
      },
      andAnotherOne: {
        collection: {
          foobar: 26,
        },
      },
    });
  });
});
