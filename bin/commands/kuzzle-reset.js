var
  firstAdmin = require('./kuzzle-createFirstAdmin'),
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  error = clc.red,
  warn = clc.yellow,
  question = clc.whiteBright,
  notice = clc.cyanBright,
  ok = clc.green.bold,
  kuz = clc.greenBright.bold,
  request = require('request-promise');

var interractiveLogin = () => {
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
      doReset(res.result.jwt);
    })
    .catch((error) => {
      console.log(error('Bad credentials'));
      process.exit(1);
    });

};

var doReset = (token) => {
  var options = {
    method: 'DELETE',
    uri: 'http://localhost:7511/api/1.0/_deleteIndexes',
    body: {},
    json: true
  };

  if (token) {
    options.headers = {
        'Authorization': 'Bearer '+token
    };
  }

  console.log(notice('[ℹ] Doing the reset...'));

  request(options)
    .then((res) => {
      setTimeout(() => {
        console.log(ok('\n[✔] Reset done.'));
        console.log(notice('[ℹ] Kuzle is now like a virgin, touched for the very first time.'));
      }, 1200);
    })
    .catch((err) => {
      console.log(error('\nSomething wrong just happened. Here is the original error'), err);
    })
};

module.exports = function () {
  firstAdmin.check()
    .then((res) => {
      console.log(notice('[ℹ] No-administrator mode: everyone has administrator rights.'));
      doReset();
    })
    .catch((err) => {
      console.log(notice('[ℹ] You need to log in to do the reset.'));
      interractiveLogin();
    });
};