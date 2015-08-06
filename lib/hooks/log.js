module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  /**
   * return the Kuzzle state
   *
   */
  getKuzzleState: function(){
    var kuzzleState = {};

    if(this.kuzzle.hotelClerk){
      kuzzleState.nbRooms = Object.keys(this.kuzzle.hotelClerk.rooms).length;
      kuzzleState.nbCustomers = Object.keys(this.kuzzle.hotelClerk.customers).length;
    };

    if(this.kuzzle.testingparam)
      kuzzleState.testingparam = this.kuzzle.testingparam;
    return kuzzleState;
  },

  getTestParam: function (object, hookEvent) {
    //TODO adding this as a JS hook in perf.js ?
    if(object && object.data && object.data.body && object.data.body.testingparam){
      this.kuzzle.testingparam = object.data.body.testingparam;
    }
  },

  log: function (object, hookEvent) {
    this.kuzzle.services.list.logger.log(object, hookEvent, this.getKuzzleState());
  },

  error: function (error, hookEvent) {
    this.kuzzle.services.list.logger.error(error, hookEvent, this.getKuzzleState());
  }

};