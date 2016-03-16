module.exports = function (params) {

  var config = {
    apiVersion: '2.2',
    hosts: []
  };

  if (process.env.READ_ENGINE_HOST) {
    config.hosts.push(process.env.READ_ENGINE_HOST);
    return config;
  }

  if (params.readEngine) {
    if (!Array.isArray(params.readEngine)) {
      params.readEngine = [params.readEngine];
    }

    params.readEngine.forEach(function (readEngineConfig) {
      config.hosts.push(readEngineConfig.host + ':' +readEngineConfig.port);
    });

    return config;
  }

  config.hosts.push('localhost:9200');
  return config;
};
