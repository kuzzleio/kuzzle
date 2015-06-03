module.exports = {
  elasticsearch: require('./models/elasticsearch'),
  broker: require('./brokers/rabbit'),
  hooks: require('./hooks'),
  workers: require('./workers')
};