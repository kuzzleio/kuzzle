"use strict";
/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const murmurhash_native_1 = require("murmurhash-native");
const json_stable_stringify_1 = __importDefault(require("json-stable-stringify"));
const koncorde_1 = require("koncorde");
const bluebird_1 = __importDefault(require("bluebird"));
const segfault_handler_1 = __importDefault(require("segfault-handler"));
const lodash_1 = __importDefault(require("lodash"));
const kuzzleStateEnum_1 = __importDefault(require("./kuzzleStateEnum"));
const kuzzleEventEmitter_1 = __importDefault(require("./event/kuzzleEventEmitter"));
const entryPoint_1 = __importDefault(require("../core/network/entryPoint"));
const funnel_1 = __importDefault(require("../api/funnel"));
const passportWrapper_1 = __importDefault(require("../core/auth/passportWrapper"));
const pluginsManager_1 = __importDefault(require("../core/plugin/pluginsManager"));
const router_1 = __importDefault(require("../core/network/router"));
const statistics_1 = __importDefault(require("../core/statistics"));
const tokenManager_1 = require("../core/auth/tokenManager");
const validation_1 = __importDefault(require("../core/validation"));
const log_1 = __importDefault(require("./log"));
const vault_1 = __importDefault(require("./vault"));
const dumpGenerator_1 = __importDefault(require("./dumpGenerator"));
const asyncStore_1 = __importDefault(require("../util/asyncStore"));
const mutex_1 = require("../util/mutex");
const kerror_1 = __importDefault(require("../kerror"));
const internalIndexHandler_1 = __importDefault(require("./internalIndexHandler"));
const cacheEngine_1 = __importDefault(require("../core/cache/cacheEngine"));
const storageEngine_1 = __importDefault(require("../core/storage/storageEngine"));
const security_1 = __importDefault(require("../core/security"));
const realtime_1 = __importDefault(require("../core/realtime"));
const cluster_1 = __importDefault(require("../cluster"));
const package_json_1 = require("../../package.json");
const BACKEND_IMPORT_KEY = 'backend:init:import';
let _kuzzle = null;
Reflect.defineProperty(global, 'kuzzle', {
    configurable: true,
    enumerable: false,
    get() {
        if (_kuzzle === null) {
            throw new Error('Kuzzle instance not found. Did you try to use a live-only feature before starting your application?');
        }
        return _kuzzle;
    },
    set(value) {
        if (_kuzzle !== null) {
            throw new Error('Cannot build a Kuzzle instance: another one already exists');
        }
        _kuzzle = value;
    },
});
class Kuzzle extends kuzzleEventEmitter_1.default {
    constructor(config) {
        super(config.plugins.common.maxConcurrentPipes, config.plugins.common.pipesBufferSize);
        this._state = kuzzleStateEnum_1.default.STARTING;
        global.kuzzle = this;
        this._state = kuzzleStateEnum_1.default.STARTING;
        this.config = config;
        this.log = new log_1.default();
        this.rootPath = path_1.default.resolve(path_1.default.join(__dirname, '../..'));
        this.internalIndex = new internalIndexHandler_1.default();
        this.pluginsManager = new pluginsManager_1.default();
        this.tokenManager = new tokenManager_1.TokenManager();
        this.passport = new passportWrapper_1.default();
        this.funnel = new funnel_1.default();
        this.router = new router_1.default();
        this.statistics = new statistics_1.default();
        this.entryPoint = new entryPoint_1.default();
        this.validation = new validation_1.default();
        this.dumpGenerator = new dumpGenerator_1.default();
        this.vault = null;
        this.asyncStore = new asyncStore_1.default();
        this.version = package_json_1.version;
        this.importTypes = {
            fixtures: this.importFixtures.bind(this),
            mappings: this.importMappings.bind(this),
            permissions: this.importPermissions.bind(this),
            userMappings: this.importUserMappings.bind(this),
        };
    }
    /**
     * Initializes all the needed components of Kuzzle.
     *
     * @param {Application} - Application instance
     * @param {Object} - Additional options (import, installations, plugins, secretsFile, support, vaultKey)
     *
     * @this {Kuzzle}
     */
    async start(application, options = { import: {} }) {
        this.registerSignalHandlers();
        try {
            this.log.info(`[ℹ] Starting Kuzzle ${this.version} ...`);
            await this.pipe('kuzzle:state:start');
            // Koncorde realtime engine
            this.koncorde = new koncorde_1.Koncorde({
                maxConditions: this.config.limits.subscriptionConditionsCount,
                regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2',
                seed: this.config.internal.hash.seed
            });
            await (new cacheEngine_1.default()).init();
            await (new storageEngine_1.default()).init();
            await (new realtime_1.default()).init();
            await this.internalIndex.init();
            await (new security_1.default()).init();
            this.id = await (new cluster_1.default()).init();
            // Secret used to generate JWTs
            this.secret = await this.internalIndex.getSecret();
            this.vault = vault_1.default.load(options.vaultKey, options.secretsFile);
            await this.validation.init();
            await this.tokenManager.init();
            await this.funnel.init();
            this.statistics.init();
            await this.validation.curateSpecification();
            // must be initialized before plugins to allow API requests from plugins
            // before opening connections to external users
            await this.entryPoint.init();
            this.pluginsManager.application = application;
            await this.pluginsManager.init(options.plugins);
            this.log.info(`[✔] Successfully loaded ${this.pluginsManager.plugins.length} plugins: ${this.pluginsManager.plugins.map(p => p.name).join(', ')}`);
            // Authentification plugins must be loaded before users import to avoid
            // credentials related error which would prevent Kuzzle from starting
            await this.import(options.import, options.support);
            await this.ask('core:security:verify');
            this.router.init();
            this.log.info('[✔] Core components loaded');
            await this.install(options.installations);
            // @deprecated
            await this.pipe('kuzzle:start');
            await this.pipe('kuzzle:state:live');
            await this.entryPoint.startListening();
            await this.pipe('kuzzle:state:ready');
            this.log.info(`[✔] Kuzzle ${this.version} is ready (node name: ${this.id})`);
            // @deprecated
            this.emit('core:kuzzleStart', 'Kuzzle is ready to accept requests');
            this._state = kuzzleStateEnum_1.default.RUNNING;
        }
        catch (error) {
            this.log.error(`[X] Cannot start Kuzzle ${this.version}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Gracefully exits after processing remaining requests
     *
     * @returns {Promise}
     */
    async shutdown() {
        this._state = kuzzleStateEnum_1.default.SHUTTING_DOWN;
        this.log.info('Initiating shutdown...');
        await this.pipe('kuzzle:shutdown');
        // @deprecated
        this.emit('core:shutdown');
        // Ask the network layer to stop accepting new request
        this.entryPoint.dispatch('shutdown');
        while (this.funnel.remainingRequests !== 0) {
            this.log.info(`[shutdown] Waiting: ${this.funnel.remainingRequests} remaining requests`);
            await bluebird_1.default.delay(1000);
        }
        this.log.info('Halted.');
        process.exit(0);
    }
    /**
     * Execute multiple handlers only once on any given environment
     *
     * @param {Array<{ id: string, handler: () => void, description?: string }>} installations - Array of unique methods to execute
     *
     * @returns {Promise<void>}
     */
    async install(installations) {
        if (!installations || !installations.length) {
            return;
        }
        const mutex = new mutex_1.Mutex('backend:installations');
        await mutex.lock();
        try {
            for (const installation of installations) {
                const isAlreadyInstalled = await this.ask('core:storage:private:document:exist', 'kuzzle', 'installations', installation.id);
                if (!isAlreadyInstalled) {
                    try {
                        await installation.handler();
                    }
                    catch (error) {
                        throw kerror_1.default.get('plugin', 'runtime', 'unexpected_installation_error', installation.id, error);
                    }
                    await this.ask('core:storage:private:document:create', 'kuzzle', 'installations', {
                        description: installation.description,
                        handler: installation.handler.toString(),
                        installedAt: Date.now()
                    }, { id: installation.id });
                    this.log.info(`[✔] Install code "${installation.id}" successfully executed`);
                }
            }
        }
        finally {
            await mutex.unlock();
        }
    }
    // For testing purpose
    async ask(...args) {
        return super.ask(...args);
    }
    // For testing purpose
    async emit(...args) {
        return super.emit(...args);
    }
    // For testing purpose
    async pipe(...args) {
        return super.pipe(...args);
    }
    async importUserMappings(config, status) {
        if (!status.isFirstCall) {
            return;
        }
        const toImport = config.toImport;
        if (!lodash_1.default.isEmpty(toImport.userMappings)) {
            await this.internalIndex.updateMapping('users', toImport.userMappings);
            await this.internalIndex.refreshCollection('users');
            this.log.info('[✔] User mappings import successful');
        }
    }
    async importMappings(config, status) {
        const toImport = config.toImport;
        const toSupport = config.toSupport;
        if (!lodash_1.default.isEmpty(toSupport.mappings) && !lodash_1.default.isEmpty(toImport.mappings)) {
            throw kerror_1.default.get('plugin', 'runtime', 'incompatible', '_support.mappings', 'import.mappings');
        }
        else if (!lodash_1.default.isEmpty(toSupport.mappings)) {
            await this.ask('core:storage:public:mappings:import', toSupport.mappings, {
                /**
                 * If it's the first time the mapping are loaded and another node is already importing the mapping into the database
                 * we just want to load the mapping in our own index cache and not in the database.
                 */
                indexCacheOnly: !status.isInitialized && !status.isLocked,
                propagate: false,
                rawMappings: true,
                refresh: true,
            });
            this.log.info('[✔] Mappings import successful');
        }
        else if (!lodash_1.default.isEmpty(toImport.mappings)) {
            await this.ask('core:storage:public:mappings:import', toImport.mappings, {
                /**
                 * If it's the first time the mapping are loaded and another node is already importing the mapping into the database
                 * we just want to load the mapping in our own index cache and not in the database.
                 */
                indexCacheOnly: !status.isInitialized && !status.isLocked,
                propagate: false,
                refresh: true,
            });
            this.log.info('[✔] Mappings import successful');
        }
    }
    async importFixtures(config, status) {
        if (!status.isFirstCall) {
            return;
        }
        const toSupport = config.toSupport;
        if (!lodash_1.default.isEmpty(toSupport.fixtures)) {
            await this.ask('core:storage:public:document:import', toSupport.fixtures);
            this.log.info('[✔] Fixtures import successful');
        }
    }
    async importPermissions(config, status) {
        if (!status.isFirstCall) {
            return;
        }
        const toImport = config.toImport;
        const toSupport = config.toSupport;
        const isPermissionsToImport = !(lodash_1.default.isEmpty(toImport.profiles)
            && lodash_1.default.isEmpty(toImport.roles)
            && lodash_1.default.isEmpty(toImport.users));
        const isPermissionsToSupport = toSupport.securities
            && !(lodash_1.default.isEmpty(toSupport.securities.profiles)
                && lodash_1.default.isEmpty(toSupport.securities.roles)
                && lodash_1.default.isEmpty(toSupport.securities.users));
        if (isPermissionsToSupport && isPermissionsToImport) {
            throw kerror_1.default.get('plugin', 'runtime', 'incompatible', '_support.securities', 'import profiles roles or users');
        }
        else if (isPermissionsToSupport) {
            await this.ask('core:security:load', toSupport.securities, {
                force: true,
                refresh: 'wait_for'
            });
            this.log.info('[✔] Securities import successful');
        }
        else if (isPermissionsToImport) {
            await this.ask('core:security:load', {
                profiles: toImport.profiles,
                roles: toImport.roles,
                users: toImport.users,
            }, {
                onExistingUsers: toImport.onExistingUsers,
                onExistingUsersWarning: true,
                refresh: 'wait_for',
            });
            this.log.info('[✔] Permissions import successful');
        }
    }
    /**
     * Check if every import has been done, if one of them is not finished yet, wait for it
     */
    async _waitForImportToFinish() {
        const importTypes = Object.keys(this.importTypes);
        while (importTypes.length) {
            // If the import is done, we pop it from the queue to check the next one
            if (await this.ask('core:cache:internal:get', `${BACKEND_IMPORT_KEY}:${importTypes[0]}`)) {
                importTypes.shift();
                continue;
            }
            await bluebird_1.default.delay(1000);
        }
    }
    /**
     * Load into the app several imports
     *
     * @param {Object} toImport - Contains `mappings`, `onExistingUsers`, `profiles`, `roles`, `userMappings`, `users`
     * @param {Object} toSupport - Contains `fixtures`, `mappings`, `securities` (`profiles`, `roles`, `users`)
     *
     * @returns {Promise<void>}
     */
    async import(toImport = {}, toSupport = {}) {
        const lockedMutex = [];
        try {
            for (const [type, importMethod] of Object.entries(this.importTypes)) {
                const mutex = new mutex_1.Mutex(`backend:import:${type}`, { timeout: 0 });
                const isInitialized = await this.ask('core:cache:internal:get', `${BACKEND_IMPORT_KEY}:${type}`);
                const isLocked = await mutex.lock();
                await importMethod({ toImport, toSupport }, {
                    isFirstCall: !isInitialized && isLocked,
                    isInitialized,
                    isLocked,
                });
                if (!isInitialized && isLocked) {
                    lockedMutex.push(mutex);
                    await this.ask('core:cache:internal:store', `${BACKEND_IMPORT_KEY}:${type}`, 1);
                }
            }
            this.log.info('[✔] Waiting for imports to be finished');
            await this._waitForImportToFinish();
            this.log.info('[✔] Import successful');
        }
        finally {
            await Promise.all(lockedMutex.map(mutex => mutex.unlock()));
        }
    }
    dump(suffix) {
        return this.dumpGenerator.dump(suffix);
    }
    hash(input) {
        let inString;
        switch (typeof input) {
            case 'string':
            case 'number':
            case 'boolean':
                inString = input;
                break;
            default:
                inString = (0, json_stable_stringify_1.default)(input);
        }
        return (0, murmurhash_native_1.murmurHash128)(Buffer.from(inString), 'hex', this.config.internal.hash.seed);
    }
    get state() {
        return this._state;
    }
    set state(value) {
        this._state = value;
        this.emit('kuzzle:state:change', value);
    }
    /**
     * Register handlers and do a kuzzle dump for:
     * - system signals
     * - unhandled-rejection
     * - uncaught-exception
     */
    registerSignalHandlers() {
        process.removeAllListeners('unhandledRejection');
        process.on('unhandledRejection', (reason, promise) => {
            if (reason !== undefined) {
                if (reason instanceof Error) {
                    this.log.error(`ERROR: unhandledRejection: ${reason.message}. Reason: ${reason.stack}`);
                }
                else {
                    this.log.error(`ERROR: unhandledRejection: ${reason}`);
                }
            }
            else {
                this.log.error(`ERROR: unhandledRejection: ${promise}`);
            }
            // Crashing on an unhandled rejection is a good idea during development
            // as it helps spotting code errors. And according to the warning messages,
            // this is what Node.js will do automatically in future versions anyway.
            if (global.NODE_ENV === 'development') {
                this.log.error('Kuzzle caught an unhandled rejected promise and will shutdown.');
                this.log.error('This behavior is only triggered if global.NODE_ENV is set to "development"');
                throw reason;
            }
        });
        process.removeAllListeners('uncaughtException');
        process.on('uncaughtException', err => {
            this.log.error(`ERROR: uncaughtException: ${err.message}\n${err.stack}`);
            this.dumpAndExit('uncaught-exception');
        });
        // abnormal termination signals => generate a core dump
        for (const signal of ['SIGQUIT', 'SIGABRT']) {
            process.removeAllListeners(signal);
            process.on(signal, () => {
                this.log.error(`ERROR: Caught signal: ${signal}`);
                this.dumpAndExit('signal-'.concat(signal.toLowerCase()));
            });
        }
        // signal SIGTRAP is used to generate a kuzzle dump without stopping it
        process.removeAllListeners('SIGTRAP');
        process.on('SIGTRAP', () => {
            this.log.error('Caught signal SIGTRAP => generating a core dump');
            this.dump('signal-sigtrap');
        });
        // gracefully exits on normal termination
        for (const signal of ['SIGINT', 'SIGTERM']) {
            process.removeAllListeners(signal);
            process.on(signal, () => {
                this.log.info(`Caught signal ${signal} => gracefully exit`);
                this.shutdown();
            });
        }
        segfault_handler_1.default.registerHandler();
    }
    async dumpAndExit(suffix) {
        if (this.config.dump.enabled) {
            try {
                await this.dump(suffix);
            }
            catch (error) {
                // this catch is just there to prevent unhandled rejections, there is
                // nothing to do with that error
            }
        }
        await this.shutdown();
    }
}
module.exports = Kuzzle;
//# sourceMappingURL=kuzzle.js.map