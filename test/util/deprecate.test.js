'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire');

describe('Test: Deprecate util', () => {
  let
    Deprecate,
    object,
    deprecatedObject,
    processStub,
    consoleStub;

  beforeEach(() => {
    consoleStub = Object.assign(console, {
      warn: sinon.stub()
    });
    processStub = Object.assign(process, {
      env: Object.assign(process.env, {
        NODE_ENV: 'development'
      })
    });

    Deprecate = rewire('../../lib/util/deprecate');

    Deprecate.__set__('console', consoleStub);
    Deprecate.__set__('process', processStub);

    object = {
      foo: 'bar',
      FOO: 'baz',
      leet: 1337,
      '1337': 'leet'
    };
    deprecatedObject = Deprecate.deprecateProperties(object, {
      foo: 'FOO',
      leet: null,
      '1337': { message: 'gig' }
    });
  });

  describe('#deprecateProperties', () => {
    it('should return original object when not in development environment', () => {
      processStub.env.NODE_ENV = 'production';

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
      deprecatedObject.foo
      deprecatedObject.leet

      should(consoleStub.warn.callCount).be.eql(4);
      should(consoleStub.warn.getCall(0).args[0]).be.eql('DEPRECATION WARNING');
      should(consoleStub.warn.getCall(1).args[0]).be.eql('Use of \'foo\' property is deprecated. Please, use \'FOO\' instead.');
      should(consoleStub.warn.getCall(3).args[0]).be.eql('Use of \'leet\' property is deprecated.');
    });

    it('should print custom deprecation warning', () => {
      deprecatedObject['1337']

      should(consoleStub.warn).be.calledTwice();
      should(consoleStub.warn.getCall(0).args[0]).be.eql('DEPRECATION WARNING');
      should(consoleStub.warn.getCall(1).args[0]).be.eql('gig');
    });
  });
});
