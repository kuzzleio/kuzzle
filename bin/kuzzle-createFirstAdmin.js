#!/usr/bin/env node
var
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  request = require('request-promise'),
  name,
  password,
  step = 0,
  // steps definitions
  steps = [
    {
      // get username
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
            console.log(clc.cyan('[ℹ] The username has been trimmed.'));
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
      // get password
      password: true,
      prompt: '\n[?] Enter a password for this account ?\nTips: mix lowercase and uppcase letters, digits and special chars. Avoid using spaces or tabs.\n: ',
      check: function(userEntry) {
        var _password = userEntry, userEntryBis;
        if (userEntry.replace('/ /g', '') !== _password || _password.trim() !== userEntry || userEntry.length < 8) {
          console.log(clc.red('[✖] It looks like your password could be too weak or too difficult to use or type...'));
          if (userEntry.length > 0) {
            if (!readlineSync.keyInYNStrict('[❓] Are you sure you want to use this password anyway ?')) {
              return false;
            }
          } else {
            console.log(clc.red('[✖] Password cannot be empty'));
            return false;
          }
        }
        userEntryBis = readlineSync.question('\n[?] Please, confirm the password\n: ', {hideEchoBack: true});
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

var createAdminRole = () => {
  var data = {
    indexes: {
      _canCreate: true,
      '*': {
      collections: {
        _canCreate: true,
        '*': {
          controllers: {
            '*': {
              actions: {
                '*': true
                }
              }
            }
          }
        }
      },
      '%kuzzle': {
      collections: {
        _canCreate: true,
        '*': {
          controllers: {
           '*': {
              actions: {
                '*': true
                }
              }
            }
          }
        }
      }
    }    
  };

  return request({
    method: 'PUT',
    uri: 'http://localhost:7511/api/1.0/roles/admin',
    body: data,
    json: true
  });
};

var createAdminUser = () => {
  var data = {
    _id: name,
    password: password,
    profile: 'admin'
  };

  return request({
    method: 'POST',
    uri: 'http://localhost:7511/api/1.0/users/_create',
    body: data,
    json: true
  });
};

var createAdmin = () => {
  return createAdminRole()
    .then(() => {
      console.log(clc.green('[✔] "admin" role created'));
      return resetProfile('admin', 'admin');
    })
    .then(() => {
      console.log(clc.green('[✔] "admin" profile created'));
      return createAdminUser();
    });
};

var resetRoles = (roleId) => {
  var data = {
    indexes: {
      _canCreate: false,
      '*': {
      collections: {
        _canCreate: false,
        '*': {
          controllers: {
            '*': {
              actions: {
                '*': false
                }
              }
            }
          }
        }
      },
      '%kuzzle': {
      collections: {
        _canCreate: false,
        '*': {
          controllers: {
           '*': {
              actions: {
                '*': false
                }
              }
            }
          }
        }
      }
    }    
  };

  return request({
    method: 'PUT',
    uri: 'http://localhost:7511/api/1.0/roles/' + roleId,
    body: data,
    json: true
  });
};

var resetProfile = (profileId, roleId) => {
  var data = {
      _id: profileId,
      roles: [ roleId ]
  };

  return request({
    method: 'PUT',
    uri: 'http://localhost:7511/api/1.0/profiles/' + profileId,
    body: data,
    json: true
  });  
 
};

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
      nextStep(clc.cyan('███ Please retry...'));
    }
  } else {
    createAdmin()
      .then((res) => {
        console.log(clc.green('[✔] First admin created'));
        return resetRoles('default');
      })
      .then((res) => {
        console.log(clc.green('[✔] "default" Role reseted'));
        return resetRoles('anonymous');
      })
      .then((res) => {
        console.log(clc.green('[✔] "anonymous" Role reseted'));
        return resetProfile('default', 'default');
      })
      .then((res) => {
        console.log(clc.green('[✔] "default" profile reseted'));
        return resetProfile('anonymous', 'anonymous');
      })
      .then((res) => {
        console.log(clc.green('[✔] "anonymous" profile reseted'));
        console.log('\n');
        console.log(clc.green('[✔] Everything is fisnished'));
      })
      .catch((err) => {
        console.log(clc.red('[✖] Something whent terribly wrong:'));
        switch(err.statusCode) {
          case 409:
            console.log(clc.red('>>> This account already exists!'));
            break;
          case 401:
            console.log(clc.red('>>> You are not allowed to perform this operation.') + '\n>>>This probably means that there is already an admin, so this utility is not allowed to create a new one.');
            break;
          default:
            console.log(err);
        }
      });
  }
};


module.exports = function () {
  // try to access to the admin profile
  request({
    method: 'GET',
    uri: 'http://localhost:7511/api/1.0/%25kuzzle/profiles/admin',
    json: true
  })
    .catch((err) => {
      if (err.statusCode === 404) {
        // if the response is "Not Found" then we do not have an admin profile
        console.log(clc.green('███ Kuzzle first admin creation'));
        nextStep();
      } else {
        console.log(clc.green('[✔] The first admin has already been created'));
      }
    });
};