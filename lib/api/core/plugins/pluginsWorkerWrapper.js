var
  config = {},
  plugin = null;

function ready () {
  process.on('message', packet => {
    if (packet.topic === 'initialize') {
      try {
        if (!packet.data.path) {
          plugin = new (require(process.env.name))();
        } else {
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

    if (packet.topic === 'trigger') {
      if (plugin.hooks[packet.data.event]) {
        if (typeof plugin[plugin.hooks[packet.data.event]] === 'function') {
          plugin[plugin.hooks[packet.data.event]](packet.data.message, packet.data.event);
        }
      }
    }
  });

  process.send({
    type: 'ready',
    data: {}
  });
}

ready();