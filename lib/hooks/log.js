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

    return kuzzleState;
  },

  log: function (object, hookEvent) {
    this.kuzzle.services.list.logger.log(object, hookEvent, this.getKuzzleState());
  },

  error: function (error, hookEvent) {
    this.kuzzle.services.list.logger.error(error, hookEvent, this.getKuzzleState());
  }

};