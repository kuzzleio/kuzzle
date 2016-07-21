/* eslint-disable no-console */

var
  params = require('rc')('kuzzle'),
  Kuzzle = require('../../lib/api'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

module.exports = function () {
  var 
    kuzzle = new Kuzzle(),
    requestObject = new RequestObject({
      body: {install: true}
    });

  console.log('███ kuzzle-plugins: Starting plugins installation...');
  
  kuzzle.start(params, {dummy: true})
    .then(() => kuzzle.remoteActionsController.actions.managePlugins(requestObject))
    .then(() => {
      console.log('███ kuzzle-plugins: Plugins installed');
      process.exit(0);
    })
    .catch(error => {
      console.dir(error, {depth: null});
      process.exit(1);
    });
};


