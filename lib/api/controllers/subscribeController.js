var
  q = require('q'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function SubscribeController (kuzzle) {
  this.on = function (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeOn', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.hotelClerk.addSubscription(modifiedRequestObject, context);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterOn', new ResponseObject(modifiedRequestObject, response)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };

  this.join = function (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeJoin', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.hotelClerk.join(modifiedRequestObject, context);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterJoin', new ResponseObject(modifiedRequestObject, response)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };

  this.off = function (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeOff', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.hotelClerk.removeSubscription(modifiedRequestObject, context);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterOff', new ResponseObject(modifiedRequestObject, response)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };

  this.count = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeCount', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.hotelClerk.countSubscription(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterCount', new ResponseObject(modifiedRequestObject, response)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };

  this.list = function (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeList', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.hotelClerk.listSubscriptions(modifiedRequestObject, context);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterList', new ResponseObject(modifiedRequestObject, response)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };
};
