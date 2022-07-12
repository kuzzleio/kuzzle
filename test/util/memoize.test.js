"use strict";

const should = require("should");
const sinon = require("sinon");
const memoize = require("../../lib/util/memoize");

describe("#memoize", () => {
  it("should return a function", () => {
    const memoized = memoize(Math.random);
    should(memoized).be.a.Function();
  });

  it("should invoke the underlying function only once for a same argument", () => {
    const spiedFunction = sinon.stub().callsFake(Math.random);
    const memoized = memoize(spiedFunction);

    const foo = memoized("foo");
    const bar = memoized("bar");

    should(memoized("foo")).eql(foo);
    should(memoized("foo")).eql(foo);
    should(memoized("bar")).eql(bar);
    should(memoized("bar")).eql(bar);
    should(memoized("foo")).eql(foo);
    should(memoized("bar")).eql(bar);

    should(spiedFunction).calledTwice().calledWith("foo").calledWith("bar");
  });

  it("should invoke the underlying function using the provided resolver", () => {
    const spiedFunction = sinon.stub().callsFake(Math.random);
    const memoized = memoize(spiedFunction, () => "bar");

    const result = memoized("foo");

    should(memoized("foo")).eql(result);
    should(memoized("baz")).eql(result);
    should(memoized("qux")).eql(result);

    // only invoked once, other calls are using the cache since the resolver
    // always returns the same key
    should(spiedFunction).calledOnce().calledWith("foo");
  });

  it("should work with functions returning promises", async () => {
    const spiedFunction = sinon.stub().callsFake(async () => Math.random());
    const memoized = memoize(spiedFunction);

    const promise = memoized("foo");

    should(promise).be.a.Promise();

    const result = await promise;

    should(memoized("foo")).fulfilledWith(result);
    should(memoized("foo")).fulfilledWith(result);
    should(memoized("foo")).fulfilledWith(result);

    should(spiedFunction).calledOnce().calledWith("foo");
  });
});
