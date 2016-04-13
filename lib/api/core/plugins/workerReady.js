var
  config = {},
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
          plugin = new (require(process.env.name))();
        }
        else {
          plugin = new (require(packet.data.path))();
        }

        config = packet.data.config;

        plugin.init(config, packet.data.isDummy);

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

    if (packet.topic === 'trigger' &&
      plugin.hooks[packet.data.event] &&
      typeof plugin[plugin.hooks[packet.data.event]] === 'function') {
      plugin[plugin.hooks[packet.data.event]](packet.data.message, packet.data.event);
    }
  });

  process.send({
    type: 'ready',
    data: {}
  });
};