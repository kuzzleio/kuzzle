"use strict";

const should = require("should");
const sinon = require("sinon");

const { Request } = require("../../../../index");
const KuzzleMock = require("../../../mocks/kuzzle.mock");

const Notifier = require("../../../../lib/core/realtime/notifier");

describe("Test: notifier.notifyDocumentCreate", () => {
  let kuzzle;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier();

    return notifier.init();
  });

  it("should send a document notification and return the matched rooms", async () => {
    const rooms = ["bar", "baz"];
    sinon.stub(notifier, "notifyDocument");
    kuzzle.koncorde.test.returns(rooms);

    const request = new Request({
      collection: "collection",
      index: "index",
    });
    const _id = "foo";
    const _source = { foo: "bar" };

    const result = await notifier.notifyDocumentCreate(request, {
      _id,
      _source,
    });

    should(kuzzle.koncorde.test).calledWith(
      { ..._source, _id },
      "index/collection"
    );
    should(notifier.notifyDocument).calledWithMatch(
      rooms,
      request,
      "in",
      "create",
      { _id, _source }
    );
    should(result).match(rooms);
  });
});
