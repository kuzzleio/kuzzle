var
  childProcess = require('child_process');

// "kuzzle install" is an alias for "kuzzle plugins --install"

module.exports = function () {
  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-install: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

  runInstall();
};

function runInstall() {
  childProcess
    .spawn(require.main.filename, ['plugins', '--install'], {stdio: 'inherit'})
    .on('close', code => {
      // ES is not ready yet, retry in a few seconds
      // (note: error codes in shell are limited to 256 values)
      if (code === 503 % 256) {
        console.error('Plugins installation failed because Elasticsearch is not ready yet. Retrying in 5s...');
        return setTimeout(() => runInstall(), 5000);
      }

      process.exit(code);
    });
}