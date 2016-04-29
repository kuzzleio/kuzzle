var
  childProcess = require('child_process');

// "kuzzle install" is an alias for "kuzzle plugins --install"

module.exports = function () {
  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-install: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

console.log(childProcess
    .execSync(require.main.filename + ' plugins --install')
    .toString());
};
