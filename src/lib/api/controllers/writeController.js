var
  // For create the unique id of the object that the user send
  uuid = require('node-uuid');

module.exports = function WriteController (kuzzle) {

  this.create = function (data) {
    // TODO: add validation logic -> object is valid ? + schema is valid ?
    if (data.persist !== false) {
      data.content._id = uuid.v4();
    }

    // Emit the main event
    kuzzle.log.verbose('emit event request:http');
    kuzzle.emit('data:create', data);

    return {id: data.content._id, requestId: data.requestId};
  };

};