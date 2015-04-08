module.exports = {
	controllers: require('./controllers'),
	mongo: require('./models/mongo'),
	broker: require('./brokers/rabbit'),
	hooks: require('./hooks'),
	workers: require('./workers')
};