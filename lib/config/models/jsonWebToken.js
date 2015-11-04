module.exports = function (params) {
  var config = {
    algorithm: params.jsonWebToken.algorithm || 'HS256',
    secret: params.jsonWebToken.secret || 'Kuzzle Rocks'
  };

  return config;
};
