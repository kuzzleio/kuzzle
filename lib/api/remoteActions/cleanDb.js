/*eslint no-console: 0*/

var
  clc = require('cli-color'),
  error = clc.red,
  ok = clc.green.bold,
  prepareData,
  onListenCB,
  timeOutCB;

prepareData = (params) => {
  return {};
};

onListenCB = (response) => {
  if (response.error) {
    console.log(
      error('[✖] An error occured... the process can have started then aborted in the middle.\n    Here is the error:\n'), 
      response.error
    );
    process.exit(1);
  }
  else {
    console.log(ok('[✔] Kuzzle is now like a virgin, touched for the very first time!'));
    process.exit(0);
  }
};

timeOutCB = () => {
  console.log('Can\'t contact Kuzzle');
  process.exit(1);
};

module.exports = {
  prepareData: prepareData,
  onListenCB: onListenCB,
  timeOutCB: timeOutCB,
  isPidMandatory: false
};