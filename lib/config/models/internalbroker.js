module.exports = function (params) {

  if (process.env.IPC_BROKER_HOST && process.env.IPC_BROKER_PORT) {
    return {
      host: process.env.IPC_BROKER_HOST,
      port: process.env.IPC_BROKER_PORT
    };
  }

  return {
    host: params.ipcBroker.host || 'localhost',
    port: params.ipcBroker.port || 7911
  };

};