var
  PluginContext = require('./pluginsContext'),
  config = {},
  kuzzleConfig = {},
  // Can only be true during tests
  isDummy = false,
  plugin = null;

module.exports = function ready () {
  process.on('message', packet => {
    if (packet.topic === 'initialize') {
      try {
        if (isDummy) {
          // plugin is injected by tests
        }
        else if (!packet.data.path) {
          // Get the cluster worker name. The environment variable "name" is populated by PM2
          plugin = new (require(process.env.name))();
        }
        else {
          plugin = new (require(packet.data.path))();
        }

        kuzzleConfig = packet.data.kuzzleConfig;
        config = packet.data.config;

        plugin.init(config, new PluginContext({config: kuzzleConfig}), packet.data.isDummy);

        process.send({
          type: 'initialized',
          data: {
            events: Object.keys(plugin.hooks)
          }
        });
      }
      catch (e) {
        /*eslint-disable no-console */
        console.error(e);
        /*eslint-enable no-console */
      }
    }

    if (packet.topic === 'trigger' && plugin.hooks[packet.data.event]) {
      if (Array.isArray(plugin.hooks[packet.data.event])) {
        plugin.hooks[packet.data.event]
          .filter(target => typeof plugin[target] === 'function')
          .forEach(func => plugin[func](packet.data.message, packet.data.event));
      }
      else if (typeof plugin[plugin.hooks[packet.data.event]] === 'function') {
        plugin[plugin.hooks[packet.data.event]](packet.data.message, packet.data.event);
      }
    }
  });

  process.send({
    type: 'ready',
    data: {}
  });
};