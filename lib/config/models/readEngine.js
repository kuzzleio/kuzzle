module.exports = {

  host: process.env.READ_ENGINE_HOST || process.env.READ_ENGINE_HOSTS || 'localhost:9200',
  index: process.env.READ_ENGINE_INDEX || 'mainindex',
  apiVersion: '1.3'

};