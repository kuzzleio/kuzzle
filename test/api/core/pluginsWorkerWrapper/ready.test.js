var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  PluginContext = require.main.require('lib/api/core/plugins/pluginContext'),
  ready = rewire('../../../../lib/api/core/plugins/workerReady');

describe('Test plugins manager run', function () {
  var
    sandbox,
    plugin,
    pluginMock;

  before(function() {
    ready.__set__('isDummy', true);
  });

  beforeEach(function () {
    plugin = {
      init: function () {},
      foo: function () {},
      bar: function () {},
      baz: function () {}
    };

    sandbox = sinon.sandbox.create();
    pluginMock = sandbox.mock(plugin);
    ready.__set__('plugin', plugin);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should initialize the plugin properly', function () {
    var
      config = { 'foobar': { bar: 'bar', qux: 'qux'}},
      init = pluginMock.expects('init').once(),
      processOn = sandbox.stub().callsArgWith(1, {
        topic: 'initialize',
        data: {
          config,
          isDummy: 'am I a dummy?'
        }
      }),
      processSend = sandbox.spy();

    ready.__set__('process', {on: processOn, send: processSend});
    plugin.hooks = {
      foo: 'bar',
      baz: 'qux'
    };

    ready();

    pluginMock.verify();
    should(init.firstCall.calledWithMatch(config, sinon.match.instanceOf(PluginContext), 'am I a dummy?')).be.true();

    should(processSend.firstCall.calledWithMatch({
      type: 'initialized',
      data: {
        events: ['foo', 'baz']
      }
    })).be.true();

    should(processSend.secondCall.calledWithMatch({
      type: 'ready',
      data: {}
    })).be.true();
  });

  it('should call attached plugin function with a single target hook', function () {
    var
      processOn = sandbox.stub().callsArgWith(1, {
        topic: 'trigger',
        data: {
          event: 'foo:bar',
          message: ''
        }
      });

    pluginMock.expects('init').never();
    pluginMock.expects('foo').never();
    pluginMock.expects('bar').once();
    pluginMock.expects('baz').never();

    plugin.hooks = {
      'foo:bar': 'bar'
    };

    ready.__set__('process', {on: processOn, send: () => {}});

    ready();
    pluginMock.verify();
  });

  it('should call attached plugin functions with a multi-target hook', () => {
    var
      processOn = sandbox.stub().callsArgWith(1, {
        topic: 'trigger',
        data: {
          event: 'foo:bar',
          message: ''
        }
      });

    pluginMock.expects('init').never();
    pluginMock.expects('foo').once();
    pluginMock.expects('bar').never();
    pluginMock.expects('baz').twice();

    plugin.hooks = {
      'foo:bar': ['foo', 'baz', 'baz']
    };

    ready.__set__('process', {on: processOn, send: () => {}});

    ready();
    pluginMock.verify();
  });
});
