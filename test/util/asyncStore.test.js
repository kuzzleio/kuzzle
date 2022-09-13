"use strict";

const should = require("should");
const sinon = require("sinon");
const mockRequire = require("mock-require");

class AsyncLocalStorageStub {
  constructor() {
    this._store = new Map();

    this.run = sinon.stub();
    this.getStore = sinon.stub().returns(this._store);
  }
}

describe("AsyncStore", () => {
  let asyncStore;
  let AsyncStore;

  if (process.version >= "v12.18.1") {
    beforeEach(() => {
      mockRequire("async_hooks", { AsyncLocalStorage: AsyncLocalStorageStub });

      AsyncStore = mockRequire.reRequire("../../lib/util/asyncStore");

      asyncStore = new AsyncStore();
    });

    describe("#run", () => {
      it("should calls asyncLocalStorage.run", () => {
        asyncStore.run("callback");

        should(asyncStore._asyncLocalStorage.run).be.calledOnce();

        const args = asyncStore._asyncLocalStorage.run.getCall(0).args;
        should(args[0]).be.instanceOf(Map);
        should(args[1]).be.eql("callback");
      });
    });

    describe("#exists", () => {
      it("should returns false if the store is not set", () => {
        asyncStore._asyncLocalStorage.getStore.returns(undefined);

        const result = asyncStore.exists();

        should(asyncStore._asyncLocalStorage.getStore).be.calledOnce();
        should(result).be.false();
      });
    });

    describe("#set", () => {
      it("should sets an item in the underlaying Map", () => {
        asyncStore.set("REQUEST", { id: "azerty12345 " });

        should(asyncStore._asyncLocalStorage._store.get("REQUEST")).be.eql({
          id: "azerty12345 ",
        });
      });
    });

    describe("#get", () => {
      it("should gets an item from the underlaying Map", () => {
        asyncStore.set("REQUEST", { id: "azerty12345 " });

        const result = asyncStore.get("REQUEST");

        should(result).be.eql({ id: "azerty12345 " });
      });
    });

    describe("#get", () => {
      it("should check if the key exists in the underlaying Map", () => {
        asyncStore.set("REQUEST", { id: "azerty12345 " });

        should(asyncStore.has("REQUEST")).be.true();
        should(asyncStore.has("TSEUQER")).be.false();
      });
    });
  } else {
    beforeEach(() => {
      AsyncStore = require("../../lib/util/asyncStore");

      asyncStore = new AsyncStore();
    });

    // Prior to Node 12.18.1
    it("should exports a stubed module", () => {
      should(asyncStore.constructor.name).be.eql("AsyncStoreStub");

      const callback = sinon.stub();
      asyncStore.run(callback);
      should(callback).be.calledOnce();

      should(asyncStore.exists()).be.false();
    });
  }
});
