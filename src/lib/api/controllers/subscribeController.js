module.exports = function SubscribeController (kuzzle) {

  this.on = function (data) {
    console.log('subscribe');
  };

  this.off = function (data) {
    console.log('unsubscribe');
  };

};