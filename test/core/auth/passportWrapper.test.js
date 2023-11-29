"use strict";

const should = require("should");
const sinon = require("sinon");
const mockrequire = require("mock-require");
const passport = require("passport");

const {
  ForbiddenError,
  PluginImplementationError,
  UnauthorizedError,
} = require("../../../index");
const PassportResponse = require("../../../lib/core/auth/passportResponse");

describe("Test the passport Wrapper", () => {
  let PassportWrapper, passportWrapper, passportMock;

  beforeEach(() => {
    passportMock = {
      use: sinon.stub(),
      unuse: sinon.stub(),
      authenticate: sinon.stub(),
      _strategy: sinon.stub().returns(true),
    };

    mockrequire("passport", passportMock);
    PassportWrapper = mockrequire.reRequire(
      "../../../lib/core/auth/passportWrapper",
    );

    passportWrapper = new PassportWrapper();
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it("should register and unregister strategies correctly", () => {
    const stub = sinon.stub();

    passportWrapper.use("foobar", stub);
    should(passportWrapper.options.foobar).be.an.Object().and.be.empty();
    should(passportMock.use).calledOnce().and.calledWith("foobar", stub);

    passportWrapper.unuse("foobar");
    should(passportWrapper.options.foobar).be.undefined();
    should(passportMock.unuse).calledOnce().and.calledWith("foobar");
  });

  it("should store strategy options and use them when authenticating", () => {
    const stub = sinon.stub(),
      opts = { foo: "bar" };

    passportWrapper.use("foobar", stub, opts);
    should(passportWrapper.options.foobar).be.eql(opts);

    passportMock.authenticate.yields(null, {});

    return passportWrapper.authenticate({}, "foobar").then(() => {
      should(passportMock.authenticate)
        .calledOnce()
        .calledWithMatch("foobar", opts);
    });
  });

  it("should resolve to the user if credentials are verified", () => {
    const user = { username: "jdoe" };

    passportMock.authenticate.yields(null, user);

    return should(passportWrapper.authenticate("foo", "bar")).be.fulfilledWith(
      user,
    );
  });

  it("should reject if passport does not return a user", () => {
    passportMock.authenticate.yields(null, null, new Error("foobar"));

    return should(passportWrapper.authenticate("foo", "bar")).be.rejectedWith(
      UnauthorizedError,
      { message: "foobar" },
    );
  });

  it("should reject in case of an authentication error", () => {
    const err = new ForbiddenError("foobar");
    passportMock.authenticate.yields(err);

    return should(passportWrapper.authenticate("foo", "bar")).be.rejectedWith(
      err,
    );
  });

  it("should wrap the error if not an instance of KuzzleError", (done) => {
    passportMock.authenticate.yields(new Error("foobar"));

    passportWrapper
      .authenticate("foo", "bar")
      .then(() => done("should have failed"))
      .catch((err) => {
        try {
          should(err).be.instanceOf(PluginImplementationError);
          should(err.id).eql("plugin.runtime.unexpected_error");
          done();
        } catch (e) {
          done(e);
        }
      });
  });

  it("should return a PassportResponse if the strategy calls a HTTP redirection", () => {
    class MockupStrategy extends passport.Strategy {
      constructor(name, verify) {
        super(name, verify);
        this.name = name;
        this._verify = verify;
      }

      authenticate() {
        this.redirect("http://example.org");
      }
    }

    const stub = sinon.stub();

    mockrequire("passport", passport);
    PassportWrapper = mockrequire.reRequire(
      "../../../lib/core/auth/passportWrapper",
    );
    passportWrapper = new PassportWrapper();
    passportWrapper.use(new MockupStrategy("mockup", stub));

    return passportWrapper.authenticate("foobar", "mockup").then((response) => {
      should(response).be.an.instanceOf(PassportResponse);
      should(response.statusCode).be.equal(302);
      should(response.getHeader("Location")).be.equal("http://example.org");
      should(stub).not.be.called();
    });
  });

  it("should reject a promise because an exception has been thrown", () => {
    passportMock.authenticate.throws(new ForbiddenError("foobar"));

    return should(passportWrapper.authenticate("foo", "bar")).be.rejectedWith(
      "foobar",
    );
  });

  it("should wrap a promise rejection if a non-KuzzleError error is thrown", () => {
    passportMock.authenticate.throws(new Error("foobar"));

    return should(passportWrapper.authenticate("foo", "bar")).be.rejectedWith(
      PluginImplementationError,
      { id: "plugin.runtime.unexpected_error" },
    );
  });
});
