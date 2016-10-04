var
  exec = require('child_process').exec,
  path = require('path'),
  Promise = require('bluebird');

function Plugin (kuzzle, definition) {
  this.kuzzle = kuzzle;

  ['name', 'path', 'gitUrl', 'npmVersion'].forEach(k => {
    if (definition[k] !== undefined) {
      this[k] = definition[k];
    }
  });


}

Plugin.prototype.install = function () {
  var package;

  if (this.path) {
    package = path;
  } else if (this.npmVersion) {
    package = this.name + '@' + this.npmVersion;
  } else {
    package = this.name;
  }

  return new Promise((resolve, reject) => {
    exec(`npm install ${package}`, (error, stdout, stderr) => {
      if (error) {
        return reject({error, stderr});
      }

      resolve(stdout);
    });
  });
};

module.exports = Plugin;


