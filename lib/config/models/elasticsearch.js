module.exports = {

  host: process.env.ELASTICSEARCH_HOST || process.env.ELASTICSEARCH_HOSTS || 'localhost:9200',
  index: process.env.ELASTICSEARCH_INDEX || 'mainindex',
  apiVersion: '1.3'

};