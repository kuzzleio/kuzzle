#!/usr/bin/env node
var
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  request = require('request-promise'),
  rc = require('rc'),
  params = rc('kuzzle'),
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

var resetRole = (roleId) => {
  return request({
    method: 'PUT',
    uri: 'http://localhost:7511/api/1.0/roles/' + roleId,
    body: params.userRoles[roleId],
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
    createAdminUser()
      .then((res) =>{
        console.log(clc.green('[✔] "' + name + '" user created with admin rights'));
        return resetProfile('default', 'default');
      })
      .then((res) => {
        console.log(clc.green('[✔] "default" profile reset'));
        return resetProfile('admin', 'admin');
      })
      .then((res) => {
        console.log(clc.green('[✔] "admin" profile reset'));
        return resetProfile('anonymous', 'anonymous');
      })
      .then((res) => {
        console.log(clc.green('[✔] "anonymous" profile reset'));
        return resetRole('default')
      })
      .then((res) => {
        console.log(clc.green('[✔] "default" role reset'));
        return resetRole('admin');
      })
      .then((res) => {
        console.log(clc.green('[✔] "admin" role reset'));
        return resetRole('anonymous');
      })
      .then((res) => {
        console.log(clc.green('[✔] "anonymous" role reset'));
        console.log('\n');
        console.log(clc.green('[✔] Everything is finished'));
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

process.stdin.setEncoding('utf8');

module.exports = function () {
  // try to access to the admin profile
  request({
    method: 'GET',
    uri: 'http://localhost:7511/api/1.0/%25kuzzle/roles/admin',
    json: true
  })
    .then((res) =>{
      // we can access to the admin role, so no admin account have been created yet
      console.log(clc.green('███ Kuzzle first admin creation'));
      nextStep();
    })
    .catch((err) => {
      console.log(clc.green('[✔] The first admin has already been created'));
    });
};