---
code: false
type: page
title: Getting Started
description: Develop your first application with Kuzzle
order: 1
---

# Getting Started

Dans ce tutoriel, nous allons voir comment se lancer dans le développement de notre première application avec Kuzzle.

Sommaire:
 - [Mise en place de l'environnement]
 - [Lancer son application Kuzzle]
 - [Étendre l'API avec une nouvelle action]
 - [Modifier une action existante avec un pipe]
 - [Exécuter un traitement en parallèle avec un hook]

Before proceeding, please make sure your system has the following requirement:
 - Node.js version 12 ou supérieur
 - Docker

## Mise en place de l'environnement

Nous allons voir comment mettre en place un environnement de développement adapté à Kuzzle

Tout d'abord, il va falloir avoir à disposition une instance Redis et Elasticsearch.

Nous allons utiliser Docker et lancer les conteneurs suivants:

```bash
$ docker run -d -p 6379:6379 redis:5
$ docker run -d -p 9200:9200 kuzzleio/elasticsearch:7
```

::: info
Elasticsearch peut mettre quelques secondes à se lancer.
:::

Ensuite nous allons créer un répertoire pour notre application, initialiser un module NPM et installer Kuzzle:

```bash
$ mkdir kuzzle
$ cd kuzzle/
$ npm init
$ npm install kuzzle
```

Tout est maintenant en place pour que nous puissions commencer à développer.

## Lancer son application Kuzzle

Nous allons maintenant créer un fichier `index.js` qui contiendra le code de notre application.

La première étape est d'importer la classe [Backend] depuis le paquet [kuzzle] et d'initialiser notre application.

```js
const { Backend } = require('kuzzle');

const app = new Backend('lambda-core');
```

L'argument passé au constructeur est le nom de votre application.

Nous allons ensuite appeller la méthode [Backend.start] pour démarrer notre application.

Pour l'instant nous n'avons ajouté aucune fonctionnalité mais les fonctionnalités de base de Kuzzle seront tout de même disponibles.

```js
const { Backend } = require('kuzzle');

const app = new Backend('lambda-core');

app.start()
  .then(() => {
    app.context.log.info(`Application "${app.name}" successfully started!`);
  })
  .catch(error => {
    app.context.log.error(`Error starting "${app.name}": ${error})`);
  });
```

Nous pouvons à présent lancer notre application:

```bash
$ node index.js
Application "lambda-core" successfully started!
```

Vous pouvez le vérifier en ouvrant l'url suivante dans votre navigateur: http://localhost:7512

::: warning
A chaque fois que nous allons rajouter des fonctionnalités il sera nécessaire de relancer l'application.
:::

Pour aller plus loin:
 - [Application Boilerplate]

## Étendre l'API avec une nouvelle action

Les nouvelles actions d'API se déclarent au moyen d'une structure nommée contrôleur.

Chaque contrôleur doit être enregistré via la méthode [Backend.controller.register].  

Le premier paramètre est le nom du contrôleur et le deuxième est la description de ses actions.

Chaque action doit définir un `handler`, c'est à dire une fonction qui sera executée à chaque fois que cette action est appellée via l'API.

::: info
Le handler d'une action doit retourner une promesse. Le résultat de cette promesse sera envoyé dans la réponse à l'intérieur du champ `result`.
:::

```js
// register a controller named "greetings"
app.controller.register('greetings', {
  actions: {
    // declare an action called "hello"
    helloWorld: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`;
      }
    }
  }
});
```

Par défault, Kuzzle génère une route Http de la forme suivante pour vos actions: `GET /_/<controller>/<action>`.
Les noms de contrôleurs et d'actions seront convertis en kebab-case.

Pour tester notre action nous pouvons donc visiter l'url suivante: http://localhost:7512/_/greetings/hello-world

Pour aller plus loin:
 - [Request Input]
 - [Rights management]

## Modifier une action existante avec un pipe

Nous allons maintenant utiliser un pipe branché sur un évènement de Kuzzle pour modifier une action existante.

Un pipe est une fonction qui sera executée à chaque fois que l'évènement correspondant est déclenché.

Les pipes doivent être enregistrés avec la méthode [Backend.pipe.register].  
Le premier paramètre est le [nom de l'évènement] et le deuxième est la fonction qui sera exécutée.

Nous allons enregistrer un pipe sur l'évènement [server:afterNow] qui est déclenché après l'action [server:now].

::: info
La fonction enregistrée doit retourner une promise résolvant la requête passé en paramètre pour que celle-ci soit ensuite passée aux éventuels pipes suivant ou Kuzzle.
:::

```js
app.pipe.register('server:afterNow', async request => {
  // Returns date in UTC format instead of timestamp
  request.result.now = (new Date()).toUTCString();

  return request;
});
```

Appellons maintenant l'action [server:now] en ouvrant l'URL suivante dans notre navigateur: http://localhost:7512/_now

## Exécuter un traitement en parallèle avec un hook