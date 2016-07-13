var
  rc = require('rc'),
  Kuzzle = require('../../lib/api'),
  kuzzle = new Kuzzle(),
  params = rc('kuzzle');

module.exports = function (options, run) {
  return kuzzle.remoteActions.do('adminExists', params)
    .then(response => {
      if (response.data.body) {
        console.log('admin user is already set');
        process.exit(0);
      }
      
      
    })
    .then(() => {
            
    })
    .catch(err => console.log(err));
  
};
