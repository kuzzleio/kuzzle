module.exports = {

  host: process.env.WRITE_ENGINE_HOST || process.env.WRITE_ENGINE_HOSTS || 'localhost:9200',
  index: process.env.WRITE_ENGINE_INDEX || 'mainindex',
  apiVersion: '1.3'

};