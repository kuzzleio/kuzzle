var
  clc = require('cli-color'),
  childProcess = require('child_process'),
  KuzzleServer = require('../../lib/api/kuzzle');

/* eslint-disable no-console */

module.exports = function pluginsManager (plugin, options) {
  var
    clcError = string => options.parent.noColors ? string : clc.red(string),
    clcNotice = string => options.parent.noColors ? string : clc.cyan(string),
    clcOk = string => options.parent.noColors ? string: clc.green.bold(string),
    kuzzle = new KuzzleServer(),
    data = {};

  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-plugins: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

  checkOptions();

  options.options.forEach(opt => {
    var k = opt.long.replace(/^--/, '');
    data[k] = options[k];
  });
  data._id = plugin;

  if (options.install) {
    if (plugin) {
      console.log('███ kuzzle-plugins: Installing plugin ' + plugin + '...');
    }
    else {
      console.log('███ kuzzle-plugins: Starting plugins installation...');
    }
  }

  return kuzzle.remoteActions.do('managePlugins', data, {pid: options.pid, debug: options.parent.debug})
    .then(res => {
      if (options.list) {
        console.dir(res.data.body, {depth: null, colors: !options.parent.noColors});
      }
      else if (options.install) {
        if (plugin) {
          console.log(clcOk('███ kuzzle-plugins: Plugin ' + plugin + ' installed'));
        }
        else {
          console.log(clcOk('███ kuzzle-plugins: Plugins installed'));
        }
      }
      else if (options.importConfig) {
        console.log(clcOk('[✔] Successfully imported configuration'));
      }
      else {
        console.dir(res.data.body, {depth: null, colors: !options.parent.noColrs});
      }

      if (options.parent.debug) {
        console.log('\n\nDebug: -------------------------------------------');
        console.dir(res, {depth: null, colors: true});
      }

      process.exit(0);
    })
    .catch(err => {
      console.error(clcError(err.message));
      process.exit(err.status);
    });

  /**
   * Check the command-line validity.
   * Either this function completes successfully, or it exits the program
   * with a non-zero error code.
   *
   * @param plugin name
   * @param options provided on the command-line (commander object)
   */
  function checkOptions() {
    var
      requiredOptions,
      installOptions;

    // Check if at least one of the action option is supplied
    requiredOptions = [0, 'install', 'remove', 'get', 'list', 'set', 'replace', 'unset', 'activate', 'deactivate', 'importConfig']
      .reduce((p, c) => {
        return p + (options[c] !== undefined);
      });

    if (requiredOptions > 1) {
      console.error(clcError('Only one plugin action is allowed'));
      process.exit(1);
    }
    else if (requiredOptions === 0) {
      console.error(clcError('A plugin action is required'));
      /*
       options.help() also exits the program, but with an error code of zero
       A non-zero error code is preferred to allow scripts to fail
       */
      options.outputHelp();
      process.exit(1);
    }

    // --install and --list are the only options working without specifying a plugin name
    if (!plugin && !options.install && !options.list) {
      console.error(clcError('A plugin [name] is required for this operation'));
      process.exit(1);
    }

    if (options.install && options.list) {
      console.error(clcError('Options --install and --list are mutually exclusive'));
      process.exit(1);
    }

    // Checking mutually exclusive --install options
    installOptions = [0, 'npmVersion', 'gitUrl', 'path'].reduce((p, c) => {
      return p + (options[c] !== undefined);
    });

    if (installOptions > 0 && !options.install) {
      console.error(clcNotice('Options --npmVersion, --path and --gitUrl only work with --install. Ignoring them from now on.'));
    }
    else if (installOptions > 1) {
      console.error(clcError('Options --npmVersion, --path and --gitUrl are mutually exclusive'));
      process.exit(1);
    }
    else if (installOptions === 0 && options.install && plugin) {
      console.error(clcError('An installation configuration must be provided, with --npmVersion, --gitUrl or --path'));
      process.exit(1);
    }
  }
};
