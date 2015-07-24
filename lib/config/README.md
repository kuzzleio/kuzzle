#Config

* index.js: the entry point, loads configuration files
* hooks.js: configures actions listening to hooks
* ipc.js: configures the internal IPC broker between Kuzzle and its workers
* queues.js: lists all internal message 'queues' (can be queues, socket names, whatever is used for brokers)
* rabbit.js: RabbitMQ messaging, used for the MQ Broker
* workers.js: lists known workers
* models the engine for data persistence.