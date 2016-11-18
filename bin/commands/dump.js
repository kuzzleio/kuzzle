/* eslint-disable no-console */

var
  clc = require('cli-color'),
  Kuzzle = require('../../lib/api/kuzzle');

module.exports = function commandDump (options) {
  var
    error = string => options.parent.noColors ? string : clc.red(string),
    ok = string => options.parent.noColors ? string: clc.green.bold(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    kuzzle = new Kuzzle();

  console.log(notice('[ℹ] Creating dump file...'));

  kuzzle.cli.do('dump', {sufix: 'cli'})
    .then(dumpPath => {
      console.log(ok('[✔] Done!'));
      console.log('\n' + warn(`[ℹ] Dump has been successfully generated in "${dumpPath.data.body}" folder`));
      console.log(warn('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io'));
      process.exit(0);
    })
    .catch(err => {
      console.log(error('[✖]', err));
      process.exit(1);
    });
};
