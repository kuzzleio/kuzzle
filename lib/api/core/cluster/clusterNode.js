var
  uuid = require('node-uuid'),
  InternalError = require('./errors/internalError');

function ClusterNode () { }

ClusterNode.prototype.uuid = function () {
  if (this._uuid === undefined) {
    this._uuid = uuid.v4();
  }
  return this._uuid;
};

ClusterNode.prototype.outSocket = function () {
  throw new InternalError(`${arguments.callee.toString()} called from its prototype. Child implementation is missing`);
};

ClusterNode.prototype.send = function (msg) {
  msg._uuid = this.uuid();

  return this.outSocket().send(JSON.stringify(msg));
};

module.exports = ClusterNode;

