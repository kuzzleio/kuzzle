<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/103797784-32337580-5049-11eb-8917-3fcf4487644c.png"/>
</p>
<p align="center">
  <img alt="GitHub branch checks state" src="https://img.shields.io/github/checks-status/kuzzleio/kuzzle/master">
  <img alt="Sonarcloud" src="https://sonarcloud.io/api/project_badges/measure?project=kuzzleio_kuzzle&metric=alert_status&branch=master">
  <a href="https://codecov.io/gh/kuzzleio/kuzzle">
    <img src="https://codecov.io/gh/kuzzleio/kuzzle/branch/master/graph/badge.svg?token=jOrGhzslSM"/>
  </a>
  <a href="https://lgtm.com/projects/g/kuzzleio/kuzzle/context:javascript">
    <img src="https://img.shields.io/lgtm/grade/javascript/g/kuzzleio/kuzzle.svg?logo=lgtm&logoWidth=18" />
  </a>
  <a href="https://lgtm.com/projects/g/kuzzleio/kuzzle/alerts">
    <img src="https://img.shields.io/lgtm/alerts/g/kuzzleio/kuzzle.svg?logo=lgtm&logoWidth=18" />
  </a>
  <a href="https://github.com/kuzzleio/kuzzle/blob/master/LICENSE">
    <img alt="undefined" src="https://img.shields.io/github/license/kuzzleio/kuzzle.svg?style=flat">
  </a>
</p>

## Why Kuzzle ?

Kuzzle is a [generic backend](https://docs.kuzzle.io/core/2/guides/introduction/general-purpose-backend/) offering **the basic building blocks common to every application**.

Rather than developing the same standard features over and over again each time you create a new application, Kuzzle proposes them off the shelf, allowing you to focus on building **high-level, high-value business functionalities**.

Kuzzle enables you to build modern web applications and complex IoT networks in no time.

* **API First**: use a standardised multi-protocol API.
* **Persisted Data**: store your data and perform advanced searches on it.
* **Realtime Notifications**: use the pub/sub system or subscribe to database notifications.
* **User Management**: login, logout and security rules are no more a burden.
* **Extensible**: develop advanced business feature directly with the integrated framework.
* **Client SDKs**: use our SDKs to accelerate the frontend development.

Learn how Kuzzle will accelerate your developments :point_right: https://docs.kuzzle.io/core/2/guides/introduction/what-is-kuzzle/

## Kuzzle in production

Kuzzle is production-proof, and can be [deployed anywhere](https://kuzzle.io/products/by-features/on-premises/). 

With Kuzzle, it is possible to deploy applications that can serve tens of thousands of users with very good performances.  

Check out our [support plans](https://kuzzle.io/pricing/).

## Run Kuzzle

The easiest way to start a Kuzzle application is to use [Kourou](https://github.com/kuzzleio/kourou):

```bash
npx kourou app:scaffold playground

 🚀 Kourou - Scaffolds a new Kuzzle application
 
  ✔ Creating playground/ directory
  ✔ Creating and rendering application files
  ✔ Installing latest Kuzzle version via NPM and Docker (this can take some time)
 [✔] Scaffolding complete! Use "npm run dev:docker" to run your application
```

Then you need to run Kuzzle services, Elasticsearch and Redis: `kourou app:start-services`

Finally you can run your application inside Docker with `npm run dev:docker`

Kuzzle is now listening for requests on the port `7512`!

## Use the framework

Your first Kuzzle application is inside the `app.ts` file.

For example, you can add a new [API Controller](https://docs.kuzzle.io/core/2/guides/develop-on-kuzzle/api-controllers):

```ts
import { Backend } from 'kuzzle';

const app = new Backend('playground');

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => `Hello, ${request.input.args.name}` 
    }
  }
});

app.start()
  .then(() => {
    app.log.info('Application started');
  })
  .catch(console.error);
```

Now try to call your new API action by:
 - opening the generated URL in your browser: http://localhost:7512/_/greeting/say-hello?name=Yagmur
 - using Kourou: `npx kourou greeting:sayHello --arg name=Yagmur`

Learn how to [Write an Application](https://docs.kuzzle.io/core/2/guides/getting-started/write-application/).

### Useful links

* [Getting Started with Kuzzle](https://docs.kuzzle.io/core/2/guides/getting-started/run-kuzzle/)
* [API](https://docs.kuzzle.io/core/2/guides/main-concepts/api/)
* [Data Storage](https://docs.kuzzle.io/core/2/guides/main-concepts/data-storage/)
* [Querying](https://docs.kuzzle.io/core/2/guides/main-concepts/querying/)
* [Permissions](https://docs.kuzzle.io/core/2/guides/main-concepts/permissions/)
* [Authentication](https://docs.kuzzle.io/core/2/guides/main-concepts/authentication/)
* [Realtime Engine](https://docs.kuzzle.io/core/2/guides/main-concepts/realtime-engine/)
* [Discover our SDKs](https://docs.kuzzle.io/core/2/sdk/)
* [Release Notes](https://github.com/kuzzleio/kuzzle/releases)

## Get trained by the creators of Kuzzle :zap:

Train yourself and your teams to use Kuzzle to maximize its potential and accelerate the development of your projects.  
Our teams will be able to meet your needs in terms of expertise and multi-technology support for IoT, mobile/web, backend/frontend, devops.  
:point_right: [Get a quote](https://hubs.ly/H0jkfJ_0)

## Public Roadmap

You can consult the public roadmap on Trello. Come and vote for the features you need!  
:point_right: [Kuzzle Public Roadmap](https://trello.com/b/za9vOgRh/kuzzle-public-roadmap)

## Contributing to Kuzzle

You're welcome to contribute to Kuzzle!
Feel free to report issues, ask for features or even make pull requests!

Check our [contributing documentation](./CONTRIBUTING.md) to know about our coding and pull requests rules

## Join our community

* Follow us on [twitter](https://twitter.com/kuzzleio) to get latest news
* Register to our monthly [newsletter](http://eepurl.com/bxRxpr) to get highlighed news
* Visit our [blog](https://blog.kuzzle.io/) to be informed about what we are doing
* Come chat with us on [Discord](http://join.discord.kuzzle.io)
* Ask technical questions on [stack overflow](https://stackoverflow.com/search?q=kuzzle)
* Check out our [public roadmap](https://trello.com/b/za9vOgRh/kuzzle-public-roadmap) and vote for the upcoming features

## License

Kuzzle is published under [Apache 2 License](./LICENSE.md).

## About Mac M1

First of all make sure that you have at least `4GB` of ram allocated to your vm **docker desktop** and that it is running.

Run the following command to install all the dependencies in your container:
```bash
npm run docker:install
```

finally run the command `docker-compose up` to launch your kuzzle stack.