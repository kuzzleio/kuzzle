'use strict';

const should = require('should');

const Kuzzle = require('../mocks/kuzzle.mock');
const Deprecate = require('../../lib/util/deprecate');

describe('Test: Deprecate util', () => {
  let object;
  let kuzzle;
  let deprecatedObject;

  beforeEach(() => {
    global.NODE_ENV = 'development';

    kuzzle = new Kuzzle();

    object = {
      foo: 'bar',
      FOO: 'baz',
      leet: 1337,
      '1337': 'leet'
    };

    deprecatedObject = Deprecate.deprecateProperties(kuzzle.log, object, {
      foo: 'FOO',
      leet: null,
      '1337': { message: 'gig' }
    });
  });

  describe('#deprecateProperties', () => {
    it('should return original object when not in development environment', () => {
      global.NODE_ENV = 'production';

      deprecatedObject = Deprecate.deprecateProperties(object, {
        foo: 'FOO',
        leet: null,
        '1337': { message: 'gig' }
      });

      should(deprecatedObject.__isProxy).not.be.true();
    });

    it('should return proxied object', () => {
      should(deprecatedObject.__isProxy).be.true();
    });

    it('should print default deprecation warning', () => {
      let something = deprecatedObject.foo;
      something = deprecatedObject.leet;

      should(something).not.be.undefined();
      should(kuzzle.log.warn.callCount).be.eql(4);
      should(kuzzle.log.warn.getCall(0).args[0]).be.eql('DEPRECATION WARNING');
      should(kuzzle.log.warn.getCall(1).args[0]).be.eql('Use of \'foo\' property is deprecated. Please, use \'FOO\' instead.');
      should(kuzzle.log.warn.getCall(3).args[0]).be.eql('Use of \'leet\' property is deprecated.');
    });

    it('should print custom deprecation warning', () => {
      let something = deprecatedObject['1337'];

      should(something).not.be.undefined();
      should(kuzzle.log.warn).be.calledTwice();
      should(kuzzle.log.warn.getCall(0).args[0]).be.eql('DEPRECATION WARNING');
      should(kuzzle.log.warn.getCall(1).args[0]).be.eql('gig');
    });
  });
});
