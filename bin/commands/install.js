var
  childProcess = require('child_process');

// "kuzzle install" is an alias for "kuzzle plugins --install"

module.exports = function () {
  childProcess
    .spawn(require.main.filename, ['plugins', '--install'], {stdio: 'inherit'})
    .on('close', code => {
      process.exit(code);
    });
};
