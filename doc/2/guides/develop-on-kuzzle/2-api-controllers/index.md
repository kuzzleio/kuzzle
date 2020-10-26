---
code: false
type: page
title: API Controllers
description: Extend Kuzzle API with controllers and actions
order: 200
---

# API Controllers

Kuzzle propose d'étendre son API existante en utilisant des controleurs. Les contrôleurs sont des conteneurs logiques contenant plusieurs actions.  

Ces actions sont ensuites traitées comme n'importe quelle autre action d'API et peuvent être executées par les utilisateurs en passant par les différents mécanismes de protection et de standardisation des requêtes.

## Add a new Controller

Chaque contrôleur possède donc plusieurs actions. Chacun de ces actions est associée à une fonction de traitement que l'on appelle [handler](/core/2/guides/develop-on-kuzzle/2-api-controllers#action-handler).

La syntax de la définition des ces actions et des `handler` associés est définie par l'interface [ControllerDefinition](/core/2/some-link).  

Nous avons choisis de permettre aux utilisateurs d'ajouter des contrôleurs de deux manières différentes afin de s'adapter au mieux aux besoins de chacun.  

Ces deux manières sont très similaires et exposent les mêmes fonctionnalités.  

::: warning
Les contrôleurs doivent être ajoutés à l'application avant que cette dernière soit démarrée avec la méthode [Backend.start](/core/2/some-link).
:::

Par convention, on identifie une action de contrôleur avec le nom du contrôleur suivi de l'action séparé par deux points: `<controller>:<action>` (e.g. [document:create](/core/2/api/controllers/document/create))

### Register a Controller

La méthode [Backend.controller.register](/core/2/some-link) permet d'ajouter un nouveau contrôleur à l'aide d'un objet Javascript standard respectant l'interface [ControllerDefinition](/core/2/some-link).  

Cette méthode prend en paramètre le nom du contrôleur suivi de sa définition:

```js
app.controller.register('email', {
  actions: {
    send: {
      handler: async request => /* ... */
    },
    receive: {
      handler: async request => /* ... */
    },
  }
})
```

Cette manière de faire est plus rapide à développer mais la maintenance peut se révéler couteuse à long terme pour des applications de plus grande taille avec beaucoup de contrôleurs et actions.

### Use a Controller class

La méthode [Backend.controller.use](/core/2/some-link) permet d'ajouter un nouveau contrôleur à l'aide d'une classe héritant de [Controller](/core/2/some-link).  

Cette classe doit respecter les conventions suivantes:
 - extend the `Controller` class
 - call the super constructor with the application instance
 - define the controller actions under the `definition` property

The controller name will be inferred from the class name (unless the `name` property is defined). E.g. `PaymentSolutionController` will become `payment-solution`.

```js
import { Controller } from 'kuzzle'

class EmailController extends Controller {
  constructor (app: Backend) {
    super(app);

    // type ControllerDefinition
    this.definition = {
      actions: {
        send: {
          handler: this.send
        },
        receive: {
          handler: this.receive
        }
      }
    }
  }

  async send (request: Request) { /* ... */ }

  async receive (request: Request) { /* ... */ }
}
```

Once you have defined your controller class, you can instantiate it and pass it to the `Backend.controller.use` method:

```js
const emailController = new EmailController(app)

app.controller.use(emailController)
```

Cette manière de faire est plus longue à développer mais elle permet de mieux architecturer son code en respectant les notions de POO.

## Handler Function

Le handler est la fonction qui sera appellée à chaque fois que notre action d'API sera executée.

Cette fonction prend un [Request object](/core/2/some-link) en paramètre et doit renvoyer une `Promise` resolvant sur le résultat à renvoyer au client.

Cette fonction est définie dans la propriété `handler` d'une action. Sa signature est la suivante: `(request: Request) => Promise<any>`.

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      // Handler function for the "greeting:sayHello" action
      handler: async (request: Request) => {
        return `Hello, ${request.input.args}`
      }
    }
  }
})
```

Le résultat retourné par notre `handler` sera convertit au format JSON et intégré à la réponse standard de Kuzzle dans la propriété `result`.

```bash
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "name": "Yagmur"
}'

{
  "requestId": "a6f4f5b6-1aa2-4cf9-9724-12b12575c047",
  "status": 200,
  "error": null,
  "controller": "greeting",
  "action": "sayHello",
  "collection": null,
  "index": null,
  "volatile": null,
  "result": "Hello, Yagmur", # <= handler function return value
  "room": "a6f4f5b6-1aa2-4cf9-9724-12b12575c047"
}
```

## HTTP routes

L'utilisation d'une action d'API au travers du protocol HTTP est sensiblement différente des autres protocols.  

En effet, le protocol HTTP utilise des verbes et des routes afin d'adresser une action alors que les autres protocols se contentent de payloads au format JSON.

### Define a HTTP route

Lors de la définition d'une action de contrôleur, il est également possible de spécifier une ou plusieurs routes HTTP qui permettront d'exécuter notre action au moyen de la propriété `http`.

Cette propriété se situe au même niveau que `handler` et prend un tableau de routes en paramètre.  
Chaque route est un objet constitué des propriétés `verb` et `path`.

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        return `Hello, ${request.input.args}`
      },
      http: [
        // generated route: "GET http://<host>:<port>/email/send"
        { verb: 'get', path: '/email/send' },
        // generated route: "GET http://<host>:<port>/_/mail/send"
        { verb: 'post', path: 'mail/send' },
      ]
    }
  }
})
```

Lorsque que le `path` commence par un `/` alors la route est ajoutée tel quelle, sinon la route sera préfixée par `/_/`.

::: info
Il est préférable de laisser Kuzzle préfixer les routes avec `/_/` afin de ne pas entrer en conflit avec les routes existantes.
:::

Handler: paramètre, return value, 
Define http routes, et autogénération
Request format: input (args, resources, and body), context (user, connection)
Response format: return raw response
Use custom controller action
Allow access through role
