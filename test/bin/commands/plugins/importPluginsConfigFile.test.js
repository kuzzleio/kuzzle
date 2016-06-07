var
  should = require('should'),
  _ = require('lodash'),
  cliPlugins = require.main.require('bin/commands/plugins');

describe('Test: cli/importConfigFile', function () {

  it('should raise an error if no config file passed as parameter', function(done) {
    var cli = new cliPlugins({}, {outputHelp: () => {
        done();
      }
    });
  });

});