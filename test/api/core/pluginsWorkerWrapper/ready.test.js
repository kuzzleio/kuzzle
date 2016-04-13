var
  should = require('should'),
  rewire = require('rewire'),
  ready = rewire('../../../../lib/api/core/plugins/workerReady');

describe('Test plugins manager run', function () {
  var pluginMock = function () {
    var
      hookTriggered,
      isMyFuncCalled,
      pluginConfig;
    return {
      init: function(config, isDummy) {
        pluginConfig = config;
      },
      myFunc: function(data, event) {
        isMyFuncCalled = true;
      },
      hooks: {
        'foo:bar': 'myFunc'
      },
      /** Mock only methods */
      resetMock: function() {
        hookTriggered = false;
        pluginConfig = {};
        isMyFuncCalled = false;
      },
      getHookTriggered: function() {
        return hookTriggered;
      },
      getMyFuncCalled: function() {
        return isMyFuncCalled;
      },
      getPluginConfig: function() {
        return pluginConfig;
      }
      /** END - Mock only methods */
    };
  }();
  var processMock = function () {
    var
      callbackList = {},
      sentMessages = [];
    var triggerData = {
      trigger: {
        topic: 'trigger',
        data: {
          event: 'foo:bar',
          message: {
            'firstName': 'Ada'
          }
        }
      },
      initialize: {
        topic: 'initialize',
        env: {
          name: 'kpw:foo'
        },
        data: {
          isDummy: true,
          event: 'foo:bar',
          message: {
            'firstName': 'Ada'
          },
          config: {
            'foo': 'bar'
          }
        }
      }
    };
    return {
      on: function (event, callback) {
        if (!callbackList[event]) {
          callbackList[event] = [];
        }

        callbackList[event].push(callback);
      },
      send: function (data) {
        sentMessages.push(data);
      },
      /** Mock only methods */
      triggerEvent: function (event) {
        if (callbackList['message']) {
          callbackList['message'].forEach(item => {
            item(triggerData[event]);
          });
        }
      },
      resetMock: function () {
        callbackList = [];
        sentMessages = [];
      },
      getSentMessages: function () {
        return sentMessages;
      }
      /** END - Mock only methods */
    };
  }();
  before(function() {
    ready.__set__('isDummy', true);
    ready.__set__('plugin', pluginMock);
    ready.__set__('process', processMock);
  });

  beforeEach(function () {
    pluginMock.resetMock();
    processMock.resetMock();
  });

  it('should send a ready message', function (done) {
    ready();
    should(processMock.getSentMessages()).length(1);
    should(processMock.getSentMessages()[0].type).be.equal('ready');
    done();
  });

  it('should initialize with expected configuration', function (done) {
    var config;

    ready();
    processMock.triggerEvent('initialize');
    should(pluginMock.getPluginConfig().foo).be.equal('bar');
    done();
  });

  it('should send an initialized message when an initialize message is received', function (done) {
    ready();
    processMock.triggerEvent('initialize');
    should(processMock.getSentMessages()).length(2);
    should(processMock.getSentMessages()[0].type).be.equal('ready');
    should(processMock.getSentMessages()[1].type).be.equal('initialized');
    should(processMock.getSentMessages()[1].data.events).length(1);
    done();
  });

  it('should call attached plugin function when according event is triggered', function (done) {
    ready();
    processMock.triggerEvent('initialize');
    should(processMock.getSentMessages()).length(2);
    should(processMock.getSentMessages()[0].type).be.equal('ready');
    should(processMock.getSentMessages()[1].type).be.equal('initialized');
    should(processMock.getSentMessages()[1].data.events).length(1);
    processMock.triggerEvent('trigger');
    should(pluginMock.getMyFuncCalled()).be.true();
    done();
  });
});