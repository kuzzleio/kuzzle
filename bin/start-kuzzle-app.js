const S3Plugin = require('kuzzle-plugin-s3');
const { Application, errors } = require('../index');

const app = new Application('omniscient');

app.version = '1.42.21'

// Loguer toutes les actions réalisées pour la déclaration de l'app
app.fixture.import()
app.fixture.add({
  // ...
})

const idx = await sdk.index.list()

for (const index of idx) {
  if (!index.startsWith('customer'))
    continue
  const count = await sdk.document.count(index, 'asset-locations')
  console.log(index, count)
}

app.right.import()
app.user.import('./users.json')

app.index.import('./indexes.json')
app.index.add({
  'nyc-open-data': {
    'green-taxi': {
      'dynamic': false
    },
    'yellow-taxi': {}
  }
})

app.pipe.add('server:afterNow', async request => {
  app.context.log.info(`Server INFO: ${app.name}`);

  request.result.now = (new Date()).toUTCString();
  return request;
})

app.hook.add('server:beforeNow', () => {
  console.log('server before now');
})

app.api.add('asset', {
  url: '/asset' // /_/asset
})

const redisHost = await getRedisHostFromK8S()
app.config.set('services.redis.host', redisHost)

app.config.merge({
  realtime: {
    pcreSupport: true
  }
})

const s3Conf = {
  bucker: 'gordon'
};

const s3Plugin = new S3Plugin(s3Conf)

// optional name
app.plugin.use(s3Plugin, { name: 's3-plugin-eu-west-1' })

app.start()
  .then(() => {
    console.log('Application started')
  });
