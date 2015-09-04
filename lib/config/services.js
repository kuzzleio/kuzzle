module.exports = function (params) {
	return {
		broker: 'internalbroker',
		mqBroker: 'rabbit',
		writeEngine: 'elasticsearch',
		readEngine: 'elasticsearch',
		perf: 'logstash',
		notificationCache: 'redis',
		monitoring: 'newrelic',
		profiling: 'nodegrind',
		remoteActions: 'remoteActions'
	};
}
