'use strict';

const should = require('should');
const sinon = require('sinon');
const Emitter = require('../../../lib/core/events/emitter');

describe.only('#KuzzleEventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new Emitter(10, 50);
  });

  describe('#hooks', () => {
    it('should trigger hooks with wildcarded "before" events', () => {
      const exact = sinon.stub();
      const wildcard = sinon.stub();
      const before = sinon.stub();

      emitter.on('foo:*', wildcard);
      emitter.on('foo:before*', before);
      emitter.on('foo:beforeBarQux', exact);
      emitter.registerPluginHook('foo:*', wildcard);
      emitter.registerPluginHook('foo:before*', before);
      emitter.registerPluginHook('foo:beforeBarQux', exact);

      emitter.emit('foo:beforeBarQux');

      should(exact).calledTwice();
      should(wildcard).calledTwice();
      should(before).calledTwice();
    });

    it('should trigger hooks with wildcarded "after" events', () => {
      const exact = sinon.stub();
      const wildcard = sinon.stub();
      const before = sinon.stub();

      emitter.on('foo:*', wildcard);
      emitter.on('foo:after*', before);
      emitter.on('foo:afterBarQux', exact);
      emitter.registerPluginHook('foo:*', wildcard);
      emitter.registerPluginHook('foo:after*', before);
      emitter.registerPluginHook('foo:afterBarQux', exact);

      emitter.emit('foo:afterBarQux');

      should(exact).calledTwice();
      should(wildcard).calledTwice();
      should(before).calledTwice();
    });

    it('should trigger hooks even on non-wildcardable events', () => {
      const exact = sinon.stub();
      const globalWildcard = sinon.stub();

      emitter.on('fooafterBar', exact);
      emitter.on('*', globalWildcard);
      emitter.registerPluginHook('fooafterBar', exact);
      emitter.registerPluginHook('*', globalWildcard);

      emitter.emit('fooafterBar');

      should(exact).calledTwice();
      should(globalWildcard).not.called();
    });

    it('should wrap exception thrown by plugins', () => {
      const throws = sinon.stub().throws();

      emitter.registerPluginHook('foo:bar', throws);

      should(() => emitter.emit('foo:bar')).throw({
        id: 'plugin.runtime.unexpected_error',
        name: 'PluginImplementationError',
      });
    });
  });

  describe('#pipes', () => {
    it.only('should trigger plugin pipes with wildcarded "before" events', async () => {
      const exact = sinon.stub().resolves();
      const wildcard = sinon.stub().resolves();
      const before = sinon.stub().resolves();

      emitter.registerPluginPipe('foo:*', wildcard);
      emitter.registerPluginPipe('foo:before*', before);
      emitter.registerPluginPipe('foo:beforeBarQux', exact);

      await emitter.pipe('foo:beforeBarQux');

      should(exact).calledOnce();
      should(wildcard).calledOnce();
      should(before).calledOnce();
    });

    it('should trigger core pipes with only exact events', () => {
      const exact = sinon.stub().resolves();
      const wildcard = sinon.stub().resolves();
      const before = sinon.stub().resolves();

      emitter.onPipe('foo:*', wildcard);
      emitter.onPipe('foo:before*', before);
      emitter.onPipe('foo:beforeBarQux', exact);

      emitter.pipe('foo:beforeBarQux');

      should(exact).calledOnce();
      should(wildcard).not.called();
      should(before).not.called();
    });

    it('should trigger plugins pipes with wildcarded "after" events', () => {
      const exact = sinon.stub.resolves();
      const wildcard = sinon.stub.resolves();
      const before = sinon.stub.resolves();

      emitter.registerPluginPipe('foo:*', wildcard);
      emitter.registerPluginPipe('foo:after*', before);
      emitter.registerPluginPipe('foo:afterBarQux', exact);

      emitter.pipe('foo:afterBarQux');

      should(exact).calledOnce();
      should(wildcard).calledOnce();
      should(before).calledOnce();
    });

    it('should trigger plugins pipes with wildcarded "after" events', () => {
      const exact = sinon.stub.resolves();
      const wildcard = sinon.stub.resolves();
      const before = sinon.stub.resolves();

      emitter.onPipe('foo:*', wildcard);
      emitter.onPipe('foo:after*', before);
      emitter.onPipe('foo:afterBarQux', exact);

      emitter.pipe('foo:afterBarQux');

      should(exact).calledOnce();
      should(wildcard).not.called();
      should(before).not.called();
    });

    it('should trigger pipes even on non-wildcardable events', () => {
      const exact = sinon.stub();
      const globalWildcard = sinon.stub();

      emitter.onPipe('fooafterBar', exact);
      emitter.onPipe('*', globalWildcard);
      emitter.registerPluginPipe('fooafterBar', exact);
      emitter.registerPluginPipe('*', globalWildcard);

      emitter.pipe('fooafterBar');

      should(exact).calledTwice();
      should(globalWildcard).not.called();
    });
  });
});
