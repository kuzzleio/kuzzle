module.exports = {

	host: process.env.MONGO_HOST || 'mongo',
	port: process.env.MONGO_PORT || 27017,
	user: process.env.MONGO_USER,
	password: process.env.MONGO_PASSWORD

};