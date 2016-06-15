/*eslint no-console: 0*/

var
  clc = require('cli-color'),
  error = clc.red,
  ok = clc.green.bold,
  prepareData,
  onListenCB,
  timeOutCB;

prepareData = () => {
  return {};
};

onListenCB = (response) => {

  if (response.error) {
    console.log(
      error('[✖] An error occured...\n    Here is the error:\n'), 
      response.error
    );
    process.exit(1);
  }
  else {
    if (!response.data.body.isWorker) {
      console.log(ok('[✔] Done. \nThere are now two files: kuzzle-swagger.json and kuzzle-swagger.yml'));
    }
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