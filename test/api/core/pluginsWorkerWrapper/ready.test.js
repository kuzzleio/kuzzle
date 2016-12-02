var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  PluginContext = require('../../../../lib/api/core/plugins/pluginContext'),
  ready = rewire('../../../../lib/api/core/plugins/workerReady');

describe('Test plugins Worker Wrapper', () => {
  var
    plugin,
    pluginMock,
    reset;


  beforeEach(() => {
    plugin = {
      init: () => {},
      foo: () => {},
      bar: () => {},
      baz: () => {}
    };

    pluginMock = sandbox.mock(plugin);
    reset = ready.__set__({
      plugin
    });
  });

  afterEach(() => {
    sandbox.restore();
    reset();
  });

  it('should initialize the plugin properly', () => {
    var
      config = { 'foobar': { bar: 'bar', qux: 'qux'}},
      init = pluginMock.expects('init').once(),
      processOn = sandbox.stub().callsArgWith(1, {
        topic: 'initialize',
        data: {
          kuzzleConfig: {
            plugins: {
              common: {
                workerPrefix: 'kpw:'
              }
            }
          },
          config,
          isDummy: 'am I a dummy?'
        }
      }),
      processSend = sandbox.spy();

    plugin.hooks = {
      foo: 'bar',
      baz: 'qux'
    };

    ready.__with__({
      process: {
        env: {
          name: 'foo'
        },
        on: processOn,
        send: processSend
      },
      require: function () {
        return function () {
          return plugin;
        };
      }
    })(() => {
      ready();

      pluginMock.verify();

      should(init).be.calledWith(config, sinon.match.instanceOf(PluginContext));

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


  });

  it('should call attached plugin function with a single target hook', () => {
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
