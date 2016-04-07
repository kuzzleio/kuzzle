var
  RequestObject = require('../../core/models/requestObject'),
  ResponseObject = require('../../core/models/responseObject'),
  BadRequestError = require('../../core/errors/badRequestError'),
  q = require('q');

module.exports = function cleanDb (kuzzle, request) {
  var
    deferred = q.defer(),
    requestObject = new RequestObject({controller: 'admin', action: 'deleteIndexes'});
console.log('cleanDb');
  // is a reset has been asked and we are launching a server ?
  if (!kuzzle.isServer) {
    deferred.resolve(request);
    return deferred.promise;
  }

  // @todo : manage internal index properly
  kuzzle.services.list.readEngine.listIndexes(requestObject)
    .then(response => {
      requestObject.data.body.indexes = response.data.body.indexes;
      kuzzle.pluginsManager.trigger('data:deleteIndexes', requestObject);
      return kuzzle.workerListener.add(requestObject);
    })
    .then(() => {
      kuzzle.indexCache.reset();
      kuzzle.pluginsManager.trigger('cleanDb:done', 'Reset done: Kuzzle is now like a virgin, touched for the very first time !');
      deferred.resolve(new ResponseObject(request));
    })
    .catch(err => {
      kuzzle.pluginsManager.trigger('cleanDb:error', err);

      // We resolve the promise, because we don't want stop the start process just because reset didn't work.
      // (can fail if the database is pristine)
      deferred.resolve(new ResponseObject(request, new BadRequestError(err)));
    });

  return deferred.promise;
};