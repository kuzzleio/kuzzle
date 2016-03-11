var
  firstAdmin = require('./kuzzle-createFirstAdmin'),
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  request = require('request-promise'),
  error = clc.red,
  warn = clc.yellow,
  question = clc.whiteBright,
  notice = clc.cyanBright,
  ok = clc.green.bold,
  kuz = clc.greenBright.bold;

var interractiveLogin = (args) => {
  var username, password, token;
    
  username = readlineSync.question(question('[❓] User name: '));
  password = readlineSync.question(question('[❓] Password: '), {hideEchoBack: true});

  request({
    method: 'POST',
    uri: 'http://localhost:7511/api/1.0/_login',
    body: {
      body: {
        username: username,
        password: password
      }
    },
    json: true
  })
    .then((res) => {
      console.log(ok('[✔] User ' + username + ' successfully logged in!'))
      doReset(res.result.jwt, args);
    })
    .catch((error) => {
      console.log(error('Bad credentials'));
      process.exit(1);
    });

};

var doReset = (token, args) => {
  var 
    deferred = q.defer(),
    options = {
    method: 'DELETE',
    uri: 'http://localhost:7511/api/1.0/_cleanDb',
    body: {},
    json: true
  };

  if (token) {
    options.headers = {
        'Authorization': 'Bearer ' + token
    };
  }

  if (args.fixtures) {
    options.body.fixtures = args.fixtures;
  }

  if (args.mappings) {
    options.body.mappings = args.mappings;
  }

  console.log(notice('[ℹ] Doing the reset...'));

  request(options)
    .then((res) => {
      setTimeout(() => {
        console.log(ok('\n[✔] Reset done.'));
        console.log(notice('[ℹ] Kuzle is now like a virgin, touched for the very first time.\n'));
        if (args.fixtures) {
          console.log(notice('[ℹ] The specified fixtures file has been applied.'));
        }
        if (args.mappings) {
          console.log(notice('[ℹ] The specified mappings file has been applied.'));
        }
        if (args.fixtures || args.mappings) {
          console.log(warn('[ℹ] Please, refer to the Kuzzle logs to see if everything is OK.'));
        }
      }, 1200);
    })
    .catch((err) => {
      console.log(error('\nSomething wrong just happened. Here is the original error'), err);
    });
};


module.exports = function (args) {
  firstAdmin.check()
    .then((res) => {
      console.log(notice('[ℹ] No-administrator mode: everyone has administrator rights.'));
      doReset(null, args);
    })
    .catch((err) => {
      console.log(notice('[ℹ] You need to log in to do the reset.'));
      interractiveLogin(args);
    });
};