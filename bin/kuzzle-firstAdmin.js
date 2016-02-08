#!/usr/bin/env node
var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../lib/api/Kuzzle'),
  kuzzle = new Kuzzle(false),
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  name,
  password,
  step = 0,
  steps = [
  	{
      // username
  		prompt: '\n[❓] Which username for the first admin ?\nTip: avoid to name it admin, or root...\n: ',
  		check: function(userEntry) {
  			var _name = userEntry.trim(),
  			badNames = ['admin','root'];
  			if (badNames.indexOf(_name) === -1) {
          if (_name.length < 4) {
            console.log(clc.red('[✖] Username should have at least 4 chars'));
            return false;
          }

          name = _name
  				console.log(clc.green('[✔] Given username: ' + name));
  				if (_name !== userEntry) {
  					console.log(clc.lightblue('[ℹ] The username have been trimmed.'));
  				}
  				name = _name;
  				return true;
  			} else {
  				console.log(clc.red('[✖] It is a bad idea to name an admin "' + _name + '"...'));
          if (readlineSync.keyInYNStrict('[❓] Are you sure you want to name it "' + _name + '" ?')) {
            name = _name;
            return true;
          }
  				return false;
  			}
  		}
  	},
    {
      // password
      password: true,
      prompt: '\n[?] Which password do you want to set for this account ?\nTips: try to mix lowercased and uppcased letters, digits and special chars. It is always a bad idea to put space char in a password.\n: ',
      check: function(userEntry) {
        var _password = userEntry, userEntryBis;
        if (userEntry.replace('/ /g', '') !== _password || _password.trim() !== userEntry || userEntry.length < 8) {
          console.log(clc.red('[✖] It looks like your password could be too weak or too difficult to use or type...'));
          if (!readlineSync.keyInYNStrict('[❓] Are you sure you want to use this password anyway ?')) {
            return false;
          }
        }
        userEntryBis = readlineSync.question('\n[?] Could you, please, type it again ?\n: ', {hideEchoBack: true});
        if (userEntryBis === userEntry) {
          password = userEntryBis;
          console.log(clc.green('[✔] Given password set'));
          return true;
        } else {
          console.log(clc.red('[✖] The passwords you typed does not match...'));
          return false;
        }
      }
    }
  ];

process.stdin.setEncoding('utf8');

if (process.env.NEW_RELIC_APP_NAME) {
  require('newrelic');
}

if (process.env.FEATURE_COVERAGE == 1) {
  var coverage = require('istanbul-middleware');
  console.log('Hook loader for coverage - ensure this is not production!');
  coverage.hookLoader(__dirname+'/lib');
}


var nextStep = (message) => {
  var userEntry, 
    options = {};
  
  if (message) {
    console.log(message);
  }

  if (step < steps.length) {
    if (steps[step].password) {
      options.hideEchoBack = true;
    }
    userEntry = readlineSync.question(steps[step].prompt, options);
    if (steps[step].check(userEntry)) {
      step++;
      nextStep();
    } else {
      nextStep(clc.lightblue('███ Please retry...'));
    }
  } else {
    console.log(name,password);
    kuzzle.controllers.securityController.createUser({
      _id: name,
      profile: 'admin',
      password: password
    })
      .then((response)=>{
        console.log(response);
      });
    console.log(clc.green('███ Finished!'));
  }
};

module.exports = function () {
  console.log(kuzzle.funnel.security.getUser);
  console.log(clc.green('███ Kuzzle first admin creation'));
  nextStep();
};

