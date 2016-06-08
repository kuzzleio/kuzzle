#Config

* index.js: the entry point, loads configuration files
* hooks.js: configures actions listening to hooks (see [../hooks/README.md](Hooks documentation))
* queues.js: lists all internal message 'queues' (can be queues, socket names, whatever is used for brokers)
* services.js: list available services (see [../services/README.md](Services documentation))
* workers.js: lists known workers (see [../workers/README.md](Workers documentation))
* models the engine for data persistence.
* httpRoutes.js: list Kuzzle HTTP routes and provides information about them in [swagger format](http://swagger.io/specification/)