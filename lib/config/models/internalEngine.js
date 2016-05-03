module.exports = function (params) {
  var config = {
    apiVersion: '2.2',
    hosts: []
  };

  if (process.env.INTERNAL_ENGINE_HOST) {
    config.hosts.push(process.env.INTERNAL_ENGINE_HOST);
    return config;
  }

  if (params.internalEngine) {
    if (!Array.isArray(params.internalEngine)) {
      params.internalEngine = [params.internalEngine];
    }

    params.internalEngine.forEach(cfg => config.hosts.push(cfg.host + ':' +cfg.port));

    return config;
  }

  config.hosts.push('localhost:9200');
  return config;
};
