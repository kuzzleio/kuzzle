var
  _ = require('lodash'),
  es = require('elasticsearch');

module.exports = function (kuzzle) {

  if (kuzzle.config.writeEngine.host.indexOf(',') !== -1) {
    kuzzle.config.writeEngine.host = kuzzle.config.writeEngine.host.split(',');
  }

  this.client = new es.Client({
    host: kuzzle.config.writeEngine.host
  });

  this.write = function (data) {
    data.type = data.collection;
    delete data.collection;

    data.index = kuzzle.config.model.index;
    data.id = data.content._id;
    delete data.content._id;

    data.body = data.content;
    delete data.content;

    console.log(data);
    //return this.client.create(data);
  };
};