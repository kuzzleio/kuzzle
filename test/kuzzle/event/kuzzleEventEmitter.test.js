'use strict';

const should = require('should');
const sinon = require('sinon');

const Emitter = require('../../../lib/kuzzle/event/kuzzleEventEmitter');
const {
  InternalError: KuzzleInternalError
} = require('../../../index');

describe('#KuzzleEventEmitter', () => {
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
      emitter.registerPluginHook('plugin-foobar', 'foo:*', wildcard);
      emitter.registerPluginHook('plugin-foobar', 'foo:before*', before);
      emitter.registerPluginHook('plugin-foobar', 'foo:beforeBarQux', exact);

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
      emitter.registerPluginHook('plugin-foobar', 'foo:*', wildcard);
      emitter.registerPluginHook('plugin-foobar', 'foo:after*', before);
      emitter.registerPluginHook('plugin-foobar', 'foo:afterBarQux', exact);

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
      emitter.registerPluginHook('plugin-foobar', 'fooafterBar', exact);
      emitter.registerPluginHook('plugin-foobar', '*', globalWildcard);

      emitter.emit('fooafterBar');

      should(exact).calledTwice();
      should(globalWildcard).not.called();
    });

    it('should catch errors thrown by hook and emit hook:onError', done => {
      const exception = new Error('exception');
      const rejection = new Error('rejection');
      const hookOnError = sinon.stub();
      const throws = sinon.stub().throws(exception);
      const rejects = sinon.stub().rejects(rejection);

      emitter.on('hook:onError', hookOnError);
      emitter.registerPluginHook('plugin-foobar', 'foo:throw', throws);
      emitter.registerPluginHook('plugin-foobar', 'foo:reject', rejects);

      emitter.emit('foo:throw');
      emitter.emit('foo:reject');

      setImmediate(() => {
        should(hookOnError)
          .be.calledWith({
            pluginName: 'plugin-foobar',
            event: 'foo:throw',
            error: exception
          })
          .be.calledWith({
            pluginName: 'plugin-foobar',
            event: 'foo:reject',
            error: rejection
          });

        done();
      });
    });

    it('should not loop on hook:onError event', done => {
      const infiniteLoopHook = sinon.stub();
      const hookOnError = sinon.stub().throws(new Error('exception'));

      emitter.on('plugin:hook:loop-error', infiniteLoopHook);
      emitter.registerPluginHook('plugin-foobar', 'hook:onError', hookOnError);

      emitter.emit('hook:onError', 'plugin-foobar', 'foo:bar', new Error('error'));

      setImmediate(() => {
        should(hookOnError).be.calledOnce();
        should(infiniteLoopHook).be.calledOnce();
        done();
      });
    });

    it('should be able to have multiple handles on the same hook', () => {
      const exact = sinon.stub();

      emitter.on('foo:bar', exact);
      emitter.on('foo:bar', exact);
      emitter.registerPluginHook('plugin-foobar', 'foo:bar', exact);
      emitter.registerPluginHook('plugin-foobar', 'foo:bar', exact);

      emitter.emit('foo:bar');

      should(exact.callCount).eql(4);
    });
  });

  describe('#pipes', () => {
    it('should return a promise by default', async () => {
      const pipe = sinon.stub().resolves();

      emitter.on('foo:bar', pipe);

      await should(emitter.pipe('foo:bar', 'foobar'))
        .be.a.Promise()
        .and.be.fulfilled();

      should(pipe).calledOnce().calledWith('foobar');
    });

    it('should be able to accept a callback instead of returning a promise', done => {
      const pipe = sinon.stub().resolves();

      emitter.on('foo:bar', pipe);

      let res;

      res = emitter.pipe('foo:bar', 'foobar', (error, result) => {
        try {
          should(res).not.be.a.Promise();
          should(pipe).calledOnce().calledWith('foobar');
          should(error).be.null();
          should(result).eql('foobar');
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });

    it('should pass the right number of arguments between pipes', async () => {
      const pipe1 = sinon.stub().yields(null, 'pipe1');
      const pipe2 = sinon.stub().yields(null, 'pipe2');
      const pipe3 = sinon.stub().yields(null, 'pipe3');

      emitter.registerPluginPipe('foo:bar', pipe1);
      emitter.registerPluginPipe('foo:bar', pipe2);
      emitter.registerPluginPipe('foo:bar', pipe3);

      const result = await emitter.pipe('foo:bar', 'foo', 'bar', 'baz');

      should(pipe1).calledOnce().calledWith('foo', 'bar', 'baz');
      should(pipe2).calledOnce().calledWith('pipe1', 'bar', 'baz');
      should(pipe3).calledOnce().calledWith('pipe2', 'bar', 'baz');
      should(result).eql('pipe3');
    });

    it('should trigger plugin pipes with wildcarded "before" events', async () => {
      const exact = sinon.stub().yields(null);
      const wildcard = sinon.stub().yields(null);
      const before = sinon.stub().yields(null);

      emitter.registerPluginPipe('foo:*', wildcard);
      emitter.registerPluginPipe('foo:before*', before);
      emitter.registerPluginPipe('foo:beforeBarQux', exact);

      await emitter.pipe('foo:beforeBarQux');

      should(exact).calledOnce();
      should(wildcard).calledOnce();
      should(before).calledOnce();
    });

    it('should trigger core pipes with only exact events', async () => {
      const exact = sinon.stub().resolves();
      const wildcard = sinon.stub().resolves();
      const before = sinon.stub().resolves();

      emitter.onPipe('foo:*', wildcard);
      emitter.onPipe('foo:before*', before);
      emitter.onPipe('foo:beforeBarQux', exact);

      await emitter.pipe('foo:beforeBarQux');

      should(exact).calledOnce();
      should(wildcard).not.called();
      should(before).not.called();
    });

    it('should trigger plugins pipes with wildcarded "after" events', async () => {
      const exact = sinon.stub().yields(null);
      const wildcard = sinon.stub().yields(null);
      const before = sinon.stub().yields(null);

      emitter.registerPluginPipe('foo:*', wildcard);
      emitter.registerPluginPipe('foo:after*', before);
      emitter.registerPluginPipe('foo:afterBarQux', exact);

      await emitter.pipe('foo:afterBarQux');

      should(exact).calledOnce();
      should(wildcard).calledOnce();
      should(before).calledOnce();
    });

    it('should trigger plugins pipes with wildcarded "after" events', async () => {
      const exact = sinon.stub().resolves();
      const wildcard = sinon.stub().resolves();
      const before = sinon.stub().resolves();

      emitter.onPipe('foo:*', wildcard);
      emitter.onPipe('foo:after*', before);
      emitter.onPipe('foo:afterBarQux', exact);

      await emitter.pipe('foo:afterBarQux');

      should(exact).calledOnce();
      should(wildcard).not.called();
      should(before).not.called();
    });

    it('should trigger pipes even on non-wildcardable events', async () => {
      const exactPlugin = sinon.stub().yields(null);
      const exactCore = sinon.stub().resolves();
      const globalWildcard = sinon.stub();

      emitter.onPipe('fooafterBar', exactCore);
      emitter.onPipe('*', globalWildcard);
      emitter.registerPluginPipe('fooafterBar', exactPlugin);
      emitter.registerPluginPipe('*', globalWildcard);

      await emitter.pipe('fooafterBar');

      should(exactPlugin).calledOnce();
      should(exactCore).calledOnce();
      should(globalWildcard).not.called();
    });

    it('should be able to trigger multiple pipes on the same event', async () => {
      const exactPlugin = sinon.stub().yields(null);
      const exactCore = sinon.stub().resolves();

      emitter.onPipe('foo:bar', exactCore);
      emitter.onPipe('foo:bar', exactCore);
      emitter.registerPluginPipe('foo:bar', exactPlugin);
      emitter.registerPluginPipe('foo:bar', exactPlugin);

      await emitter.pipe('foo:bar');

      should(exactPlugin).calledTwice();
      should(exactCore).calledTwice();
    });

    it('should invoke core pipes only after plugin pipes are resolved', async () => {
      const wait = (_, callback) => setTimeout(() => callback(null), 50);
      const exactPlugin1 = sinon.stub().callsFake(wait);
      const exactPlugin2 = sinon.stub().callsFake(wait);
      const exactPlugin3 = sinon.stub().callsFake(wait);
      const exactCore = sinon.stub().resolves();

      emitter.onPipe('foo:bar', exactCore);
      emitter.registerPluginPipe('foo:bar', exactPlugin1);
      emitter.registerPluginPipe('foo:bar', exactPlugin2);
      emitter.registerPluginPipe('foo:bar', exactPlugin3);

      await emitter.pipe('foo:bar');

      should(exactPlugin1).calledOnce();
      should(exactPlugin2).calledOnce();
      should(exactPlugin3).calledOnce();
      should(exactCore).calledOnce();

      should(exactCore.calledAfter(exactPlugin1)).be.true();
      should(exactCore.calledAfter(exactPlugin2)).be.true();
      should(exactCore.calledAfter(exactPlugin3)).be.true();
    });

    it('should not invoke core pipes if a plugin pipe throws an exception', async () => {
      const pluginPipe = sinon.stub().throws();
      const corePipe = sinon.stub().resolves();

      emitter.onPipe('foo:bar', corePipe);
      emitter.registerPluginPipe('foo:bar', pluginPipe);

      await should(emitter.pipe('foo:bar')).rejected();

      should(pluginPipe).calledOnce();
      should(corePipe).not.called();
    });
  });

  describe('#ask', () => {
    it('should throw if a non-function answerer is submitted', () => {
      [{}, [], null, undefined, 123, false, true, 'foo'].forEach(fn => {
        should(() => emitter.onAsk('foo:bar', fn)).throw(
          `Cannot listen to ask event "foo:bar": "${fn}" is not a function`);
      });
    });

    it('should throw if an answerer has already been registered on the same event', () => {
      emitter.onAsk('foo:bar', sinon.stub());

      should(() => emitter.onAsk('foo:bar', sinon.stub())).throw(
        'Cannot add a listener to the ask event "foo:bar": event has already an answerer');
    });

    it('should reject if no answerer listens to an event', async () => {
      await should(emitter.ask('foo:bar')).rejectedWith(KuzzleInternalError, {
        id: 'core.fatal.assertion_failed'
      });
    });

    it('should resolve to the answerer result when one is registered', async () => {
      const answerer = sinon.stub().resolves('foobar');

      emitter.onAsk('foo:bar', answerer);

      should(await emitter.ask('foo:bar', 'foo', 'bar')).eql('foobar');
      should(answerer).calledWith('foo', 'bar');
    });

    it('should trigger wildcarded hooks on ask events', async () => {
      const answerer = sinon.stub().resolves('oh noes');
      const listener1 = sinon.stub();
      const listener2 = sinon.stub();
      const listener3 = sinon.stub();

      emitter.onAsk('foo:bar', answerer);
      emitter.on('foo:bar', listener1);
      emitter.on('foo:bar', listener2);
      emitter.on('foo:*', listener3);

      should(await emitter.ask('foo:bar', 'foo', 'bar')).eql('oh noes');

      should(answerer).calledOnce().calledWith('foo', 'bar');
      should(listener1).calledOnce().calledWith('foo', 'bar');
      should(listener2).calledOnce().calledWith('foo', 'bar');
      should(listener3).calledOnce().calledWith('foo', 'bar');
    });
  });
});
