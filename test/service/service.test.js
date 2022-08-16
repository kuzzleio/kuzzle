"use strict";

const sinon = require("sinon"),
  should = require("should"),
  KuzzleMock = require("../mocks/kuzzle.mock"),
  Service = require("../../lib/service/service");

describe("Service", () => {
  let name, config, kuzzle, service;

  beforeEach(() => {
    name = "dummyService";

    config = {
      some: "configuration",
    };

    kuzzle = new KuzzleMock();

    service = new Service(name, config);
  });

  describe("#constructor", () => {
    it("should use provided timeout or service default timeout", () => {
      const service2 = new Service(name, { initTimeout: 1000 });

      should(service._initTimeout).be.eql(
        kuzzle.config.services.common.defaultInitTimeout
      );
      should(service2._initTimeout).be.eql(1000);
    });
  });

  describe("#init", () => {
    beforeEach(() => {
      service._initSequence = sinon.stub().resolves();
    });

    it("should call _initSequence", async () => {
      await service.init();

      should(service._initSequence).be.called();
    });

    it("should rejects if _initSequence take too long to resolve", () => {
      service._initTimeout = 10;
      service._initSequence = () => new Promise(() => {});

      const promise = service.init();

      return should(promise).be.rejectedWith({
        id: "core.fatal.service_timeout",
      });
    });
  });
});
