var config = {};

function ready () {
  process.on('message', packet => {
    if (packet.topic === 'initialize') {
      try {
        var plugin;

        if (!packet.data.path) {
          plugin = new (require(process.env.name))();
        } else {
          plugin = new (require(packet.data.path))();
        }

        plugin.init(packet.data.config, packet.data.isDummy);

        process.send({
          type: 'initialized',
          data: {
            events: Object.keys(plugin.hooks)
          }
        });
      }
      catch (e) {
        console.error(e);
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
console.log('READY')
ready();