---
code: false
type: page
title: Quick Start
description: Scaffold your first application and run it
order: 100
---

# Quick Start

Kuzzle est une application Node.js pouvant être installée sur toute les plateformes.

Elle nécessite seulement la présence de deux services: Elasticsearch et Redis.

Pour plus de simplicité, dans ce guide nous utiliserons Docker et Docker Compose.

Prérequis:
 - [Node.js >= 12](https://nodejs.org/en/download/) (with NPM)
 - [Docker](https://docs.docker.com/engine/install/)
 - [Docker Compose](https://docs.docker.com/compose/install/)

Tout au long de ce guide, nous allons avoir besoin de [Kourou](https://github.com/kuzzleio/kourou), la CLI de Kuzzle.

Vous pouvez installer Kourou globalement via NPM: `npm install -g kourou`

Tout d'abord, nous allons initialiser une nouvelle application en utilisant Kourou:

```bash
$ kourou app:scaffold playground
 
 🚀 Kourou - Scaffolds a new Kuzzle application
 
 [ℹ] Scaffold a new Kuzzle application in playground/
 [ℹ] Installing latest Kuzzle version via NPM...
 [✔] Scaffolding complete. Start to develop you application in ./playground/
```

This will create the following files and directories:

```
playground/
├── app.ts               < application entrypoint        
├── .eslintignore
├── .eslintrc.json
├── .gitignore
├── .kuzzlerc            < kuzzle configuration file
├── lib                  < application code
├── .mocharc.json
├── package.json
├── package-lock.json
├── README.md
└── tsconfig.json
```

Now we have to run Kuzzle services, namely Elasticsearch and Redis.

Again you can use Kourou for that: `kourou app:start-services`

The `app.ts` file contain the basic code to run a Kuzzle application. This file is meant to be executed with Node.js as any application.

```ts
import { Backend } from 'kuzzle'

const app = new Backend('playground')

app.start()
  .then(() => {
    app.log.info('Application started')
  })
  .catch(console.error)
```

Vous pouvez donc lancer votre première application avec `npm run dev`

::: info
Under the hood, the command `npm run dev` use [nodemon](https://nodemon.io/) and [ts-node](https://www.npmjs.com/package/ts-node) to run your application.
:::

Now visit http://localhost:7512 with your browser. You should see the result of the [server:info](/core/2/api/controllers/server/info) action.