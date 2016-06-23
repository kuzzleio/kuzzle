var
  clc = require('cli-color'),
  childProcess = require('child_process'),
  managePlugins = require('../../lib/api/controllers/remoteActions/managePlugins');

var
  clcError = clc.red,
  clcNotice = clc.cyan;

/* eslint-disable no-console */

module.exports = function pluginsManager (plugin, options) {
  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-plugins: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

  checkOptions();

  managePlugins(plugin, options)
    .then(res => {
      if (options.debug) {
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
