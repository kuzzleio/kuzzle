module.exports = function (params) {

  var config = {
    apiVersion: '1.7',
    index: 'mainindex',
    hosts: []
  };

  if (process.env.WRITE_ENGINE_HOST) {
    config.hosts.push(process.env.WRITE_ENGINE_HOST);
    return config;
  }

  if (params.writeEngine) {
    if (!Array.isArray(params.writeEngine)) {
      params.writeEngine = [params.writeEngine];
    }

    params.writeEngine.forEach(function (writeEngineConfig) {
      config.hosts.push(writeEngineConfig.host + ':' +writeEngineConfig.port);
    });

    return config;
  }

  config.hosts.push('localhost:9200');
  return config;
};