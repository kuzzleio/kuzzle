'use strict';

const
  should = require('should'),
  waterfall = require('../../lib/util/waterfall');

describe('waterfall', () => {
  it('should chain callback and pass the result', done => {
    const chain = [
      cb => cb(null, { data: 'foobar' }),
      (data, cb) => cb(null, data),
      (data, cb) => cb(null, data)
    ];
    const context = { done };

    waterfall(chain, function (error, result) {
      should(error).be.null();
      should(result).be.eql({ data: 'foobar' });

      this.done();
    }, context);
  });

  it('should chain callback with many arguments', done => {
    const chain = [
      cb => cb(null, 21, 42, 84),
      (...args) => {
        const cb = args.pop();
        cb(null, ...args);
      },
      (...args) => {
        const cb = args.pop();
        cb(null, ...args);
      },
    ];
    const context = { done };

    waterfall(chain, function (error, ...result) {
      should(error).be.null();
      should(result).be.eql([21, 42, 84]);

      this.done();
    }, context);
  });

  it('should propagate error', done => {
    const chain = [
      cb => cb(null, { data: 'foobar' }),
      (data, cb) => cb(new Error('error'), data),
      (data, cb) => cb(null, data)
    ];
    const context = { done };

    waterfall(chain, function (error, result) {
      should(error).not.be.null();
      should(result).be.null();

      this.done();
    }, context);
  });
});
