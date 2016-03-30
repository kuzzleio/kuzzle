/*eslint no-console: 0*/

var
  prepareData,
  onListenCB,
  timeOutCB;

prepareData = (params, args) => {
  var 
    data = {},
    service = params._[2];

  if (!service) {
    console.error('Error: missing required argument: service name');
    process.exit(1);
  }

  data.service = service;
  data.enable = (args.enable === undefined) || args.enable;

  return data;
};

onListenCB = (response) => {
  if (response.error) {
    console.error(response.error);
    process.exit(1);
  }
  else {
    console.log(response.result);
    process.exit(0);
  }
};

timeOutCB = () => {
  console.log('Can\'t contact Kuzzle');
  process.exit(1);
};

module.exports = {
  name : 'enableServices',
  prepareData: prepareData,
  onListenCB: onListenCB,
  timeOutCB: timeOutCB,
  isPidMandatory: true
};