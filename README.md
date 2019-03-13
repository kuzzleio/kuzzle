[![Build Status](https://travis-ci.org/kuzzleio/kuzzle.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle)
[![codecov.io](http://codecov.io/github/kuzzleio/kuzzle/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle?branch=master)
[![Join the chat at https://gitter.im/kuzzleio/kuzzle](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/kuzzleio/kuzzle?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/kuzzleio/kuzzle.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/kuzzle/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/kuzzleio/kuzzle.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kuzzleio/kuzzle/alerts)

![logo](https://kuzzle.io/static/public/images/logo_black.png)

## Why Kuzzle ?

Kuzzle is a ready-to-use, **on-premises backend** that enables you to manage your persistent data and be notified in real-time on whatever happens to it. It also provides you with a flexible and powerful user-management system.

Kuzzle enables you to build modern web applications and complex IoT networks in no time.

* **Persisted data**: store your data and perform advanced searches on it.
* **Real-time notifications**: subscribe to fine-grained subsets of data.
* **User Management**: login, logout and security rules are no more a burden.
* **Extensible**: fit Kuzzle to your needs by leveraging the plugin system.


## Installation

### Quick install

The easiest way to setup a kuzzle server for Linux-like systems without prerequisites is to download and run our installation script:

```bash
$ sudo bash -c "$(curl https://get.kuzzle.io/)"
```

You can get detailed information about how to [start kuzzle with docker on docs.kuzzle.io](https://docs.kuzzle.io/guide/1/essentials/installing-kuzzle/#docker)

### Manual install

Check our [complete installation guide on docs.kuzzle.io](https://docs.kuzzle.io/guide/1/essentials/installing-kuzzle/#manual-installation)

## Quick start with Kuzzle

* [Install and start Kuzzle server](https://docs.kuzzle.io/guide/1/essentials/installing-kuzzle)
* [Choose a SDK](https://docs.kuzzle.io/sdk-reference/)
* Build your application without caring about your backend !

Check the [**Getting started page on docs.kuzzle.io**](https://docs.kuzzle.io/guide/1/getting-started/first-steps/)

### Node.js Sample

```bash
npm install kuzzle-sdk
```

```javascript
const 
  {
    Kuzzle,
    WebSocket
  } = require('kuzzle-sdk');

const kuzzle = new Kuzzle(
  new WebSocket('localhost')
);

try {
  await kuzzle.connect();

  // Subscribes to database changes
  await kuzzle.realtime.subscribe('my-index', 'my-collection', {}, msg => {
    console.log('Realtime notification received from Kuzzle:', msg);
  });
} catch (error) {
  console.error(error);
}

// Creating a document from another app will notify all subscribers
await kuzzle.document.create('my-index', 'my-collection', { document: 'body' });
```

### Useful links

* [Full documentation](https://docs.kuzzle.io/)
* [SDKs Reference](https://docs.kuzzle.io/sdk-reference/)
* [API Documentation](https://docs.kuzzle.io/api/1/essentials/connecting-to-kuzzle/)  
* [Data Validation documentation](https://docs.kuzzle.io/guide/1/datavalidation/introduction/)
* [Realtime filters documentation](https://docs.kuzzle.io/koncorde/1/essentials/introduction/)
* [View release notes](https://github.com/kuzzleio/kuzzle/releases)

## Contributing to Kuzzle

You're welcome to contribute to Kuzzle!
Feel free to report issues, ask for features or even make pull requests!

Check our [contributing documentation](./CONTRIBUTING.md) to know about our coding and pull requests rules

## Join our community

* Follow us on [twitter](https://twitter.com/kuzzleio) to get latest news
* Register to our monthly [newsletter](http://eepurl.com/bxRxpr) to get highlighed news
* Visit our [blog](https://blog.kuzzle.io/) to be informed about what we are doing
* Come chat with us on [gitter](https://gitter.im/kuzzleio/kuzzle)
* Ask technical questions on [stack overflow](https://stackoverflow.com/search?q=kuzzle)

## Kuzzle in production

Kuzzle is production-proof, and provides all the business-critical features your need for your business, as
the scalability, the high-availability (multi-nodes), probes for BI & diagnostic tools.  

Check out our [support plans](https://kuzzle.io/pricing/).

## License

Kuzzle is published under [Apache 2 License](./LICENSE.md).
