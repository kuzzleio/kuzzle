/* eslint-disable no-console */

var
  Kuzzle = require('../../lib/api');

module.exports = function (options) {
  var 
    kuzzle = new Kuzzle();

  console.log('███ kuzzle-plugins: Starting plugins installation...');

  kuzzle.remoteActions.do('managePlugins', {install: true}, {pid: options.pid, debug: options.parent.debug})
    .then(() => {
      console.log('███ kuzzle-plugins: Plugins installed');
      process.exit(0);
    })
    .catch(error => {
      console.dir(error, {depth: null});
      process.exit(1);
    });
};


