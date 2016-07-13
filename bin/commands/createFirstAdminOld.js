/* eslint-disable no-console */




var
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  request = require('request-promise'),
  rc = require('rc'),
  params = rc('kuzzle'),
  name,
  password,
  resetRoles = false,
  error,
  question,
  notice,
  ok,
  step = 0,
  // steps definitions
  steps = [
    {
      // get username
      prompt: '\n[❓] Which username for the first admin ?\nTip: avoid to name it admin, or root...\n: ',
      check: (userEntry) => {
        var
          _name = userEntry.trim(),
          badNames = ['admin','root'];

        if (badNames.indexOf(_name) === -1) {
          if (_name.length < 4) {
            console.log(ok('[✖] Username should have at least 4 chars'));
            return false;
          }
          
          name = _name;

          console.log(ok('[✔] Given username: ' + name));
          if (_name !== userEntry) {
            console.log(notice('[ℹ] The username has been trimmed.'));
          }
          return true;
        }

        console.log(error('[✖] It is a bad idea to name an admin "' + _name + '"...'));

        if (readlineSync.keyInYNStrict(question('[❓] Are you sure you want to name it "' + _name + '" ?'))) {
          name = _name;
          return true;
        }

        return false;
      }
    },
    {
      // get password
      password: true,
      prompt: '\n[❓] Enter a password for this account ?\nTips: mix lowercase and uppcase letters, digits and special chars. Avoid using spaces or tabs.\n: ',
      check: (userEntry) => {
        var _password = userEntry, userEntryBis;
        if (userEntry.replace('/ /g', '') !== _password || _password.trim() !== userEntry || userEntry.length < 8) {
          console.log(error('[✖] It looks like your password could be too weak or too difficult to use or type...'));
          if (userEntry.length > 0) {
            if (!readlineSync.keyInYNStrict(question('[❓] Are you sure you want to use this password anyway ?'))) {
              return false;
            }
          } else {
            console.log(error('[✖] Password cannot be empty'));
            return false;
          }
        }
        userEntryBis = readlineSync.question(question('\n[❓] Please, confirm the password\n: '), {hideEchoBack: true});
        if (userEntryBis === userEntry) {
          password = userEntryBis;
          console.log(ok('[✔] Given password set'));
          return true;
        }

        console.log(error('[✖] The passwords you typed does not match...'));
        return false;
      }
    },
    {
      // reset rights ?
      yesNo: true,
      prompt: '\n[❓] Do you want to reset roles ?',
      check: (userEntry) => {
        resetRoles = userEntry;
        return true;
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

var resetProfile = (profileId, role) => {
  var
    data = {
      _id: profileId,
      policies: [ role ]
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
    profileId: 'admin'
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
    if (steps[step].yesNo) {
      userEntry = readlineSync.keyInYNStrict(question(steps[step].prompt));
    } else {
      userEntry = readlineSync.question(question(steps[step].prompt), options);
    }
    if (steps[step].check(userEntry)) {
      step++;
      nextStep();
    } else {
      nextStep(notice('███ Please retry...'));
    }
  }
  else if (resetRoles) {
    createAdminUser()
      .then(() =>{
        console.log(ok('[✔] "' + name + '" user created with admin rights'));
        return resetProfile('default', {_id: 'default'});
      })
      .then(() => {
        console.log(ok('[✔] "default" profile reset'));
        return resetProfile('admin', {_id: 'admin', allowInternalIndex: true});
      })
      .then(() => {
        console.log(ok('[✔] "admin" profile reset'));
        return resetProfile('anonymous', {_id: 'anonymous'});
      })
      .then(() => {
        console.log(ok('[✔] "anonymous" profile reset'));
        return resetRole('default');
      })
      .then(() => {
        console.log(ok('[✔] "default" role reset'));
        return resetRole('admin');
      })
      .then(() => {
        console.log(ok('[✔] "admin" role reset'));
        return resetRole('anonymous');
      })
      .then(() => {
        console.log(ok('[✔] "anonymous" role reset'));
        console.log('\n');
        console.log(ok('[✔] Everything is finished'));
      })
      .catch((err) => {
        console.log(error('[✖] Something whent terribly wrong:'));
        switch (err.statusCode) {
          case 409:
            console.log(error('>>> This account already exists!'));
            break;
          case 401:
            console.log(error('>>> You are not allowed to perform this operation.') + '\n>>>This probably means that there is already an admin, so this utility is not allowed to create a new one.');
            break;
          default:
            console.log(err);
        }
      });
  }
  else {
    createAdminUser()
      .then(() =>{
        console.log(ok('[✔] "' + name + '" user created with admin rights'));
        console.log(notice('[ℹ] The roles and profiles have not been reset.'));
      })
      .catch((err) => {
        console.log(error('[✖] Something whent terribly wrong:'));
        switch (err.statusCode) {
          case 409:
            console.log(error('>>> This account already exists!'));
            break;
          case 401:
            console.log(error('>>> You are not allowed to perform this operation.') + '\n>>>This probably means that there is already an admin configured');
            break;
          default:
            console.log(err);
        }
      });
  }
};

var checkIfFistAdminNeeded = () => {
  // try to access to the admin profile
  return request({
    method: 'POST',
    uri: 'http://localhost:7511/api/1.0/users/_search',
    body: {},
    json: true
  });
};

process.stdin.setEncoding('utf8');

module.exports = function FirstAdmin (options, run) {
  if (!(this instanceof FirstAdmin)) {
    return new FirstAdmin(options);
  }
  
  run = (run === undefined) || run;
  
  error = string => options.parent.noColors ? string : clc.red(string);
  question = string => options.parent.noColors ? string : clc.whiteBright(string);
  notice = string => options.parent.noColors ? string : clc.cyanBright(string);
  ok = string => options.parent.noColors ? string : clc.green.bold(string);
  
  this.check = checkIfFistAdminNeeded.bind(this);
  
  if (run) {
    this.check()
      .then(() =>{
        // we can access to the admin role, so no admin account have been created yet
        console.log(ok('███ Kuzzle first admin creation'));
        nextStep();
      })
      .catch(() => {
        console.log(ok('[✔] The first admin has already been created'));
      });
  }
};

