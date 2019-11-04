---
code: false
type: page
title: Install Kuzzle
order: 1
---

# Installing Kuzzle

In this section we'll describe different ways of installing Kuzzle.

---

## Automated script

The easiest way to install Kuzzle is by using our installation script:

```bash
bash -c "$(curl https://get.kuzzle.io)"
```

---

## Docker

Before launching Kuzzle using Docker containers, ensure that your system meets the following requirements:

- **64-bit environment**
- **At least 1.4GB of memory**
- **Docker v1.10+**, see [instructions here](https://docs.docker.com/engine/installation)
- **Docker Compose v1.8+**, see [instructions here](https://docs.docker.com/compose/install)

::: info
Before starting the docker stack, you need to increase the maximum amount of virtual memory in order to run Elasticsearch, which is part of our stack (see why [here](https://www.elastic.co/guide/en/elasticsearch/reference/7.3/_maximum_map_count_check.html)):

```bash
sudo sysctl -w vm.max_map_count=262144
```

To make this configuration permanent, you need to update your `/etc/sysctl.conf` file:

```bash
echo "vm.max_map_count=262144" >> /etc/sysctl.conf
```

On MacOS, Docker is running inside a Linux VM, so you need to apply these settings to it instead of your own system.  
The following command lets you access the VM used by Docker:

```bash
screen ~/Library/Containers/com.docker.docker/Data/vms/0/tty
```
:::


To start a kuzzle-in-docker stack:

```bash
mkdir kuzzle-docker
cd kuzzle-docker
wget http://kuzzle.io/docker-compose.yml
docker-compose up
```

Your terminal should now be logging startup messages from the Kuzzle stack. After a few seconds, you should see the following message:

```bash
# kuzzle_1         | [✔] Kuzzle server ready
```

Your Kuzzle is now up and running. For a quick test, you can explore the main HTTP API endpoint by clicking this link [http://localhost:7512](http://localhost:7512) or by using cURL on the command line:

```bash
curl "http://localhost:7512?pretty"
```

---

## AWS Marketplace

::: info
To create a new Kuzzle stack on Amazon, you need a valid AWS account.
:::

In this guide, you'll learn where to find our AWS Marketplace AMI and how to use it. It's a good way to test Kuzzle in a cloud environment. In addition, we recommend that you use our [Kuzzle Admin Console](http://console.kuzzle.io), the easiest way to play with Kuzzle.

### Get the AMI

Our AMI is stored on AWS Marketplace. It's set up with:

- Ubuntu (**16.04**)
- Kuzzle (**v1**) with MQTT protocol support.
- Elasticsearch (**v5.4.1**).
- Redis (**v3.2.12**).

Go to the marketplace and type **kuzzle** in the search form.
Choose your Amazon EC2 instance type (the minimal requirement is a **t2-medium**).
Recover the public IP or the hostname provided by AWS before you proceed.
Check that Kuzzle is up and running with following HTTP request:

```sh
# Replace kuzzle with your instance hostname or IP
$ curl 'http://kuzzle:7512?pretty'
{
  "requestId": "9b07a095-7143-49a5-9079-a34e937fdf3e",
  "status": 200,
  "error": null,
  "controller": "server",
  "action": "info",
  "collection": null,
  "index": null,
  "volatile": null,
  "result": {
    # Exhaustive Kuzzle information
  }
}
```

You should see information about your Kuzzle Server.
If not, wait a few minutes and retry the request.

### Connect with default credentials

Open the [Kuzzle Admin Console](http://console.kuzzle.io) and fill the form with the address of your Kuzzle instance. There is a default admin user with **ec2-user** as username.
Associated password is your unique instance ID. You can get it from the EC2 AWS Console, it looks like this: **i-xxxxxxxxxxxxxxxxx**.

![Demo Admin Console First Connection](/demo_aws_console.gif)

---

## Manual Installation

In this section we will perform a manual installation of Kuzzle on a Linux distribution. We choose Linux because all Kuzzle components work natively on it.

::: info
By default, Kuzzle expects all the components to be running on localhost but you can [change](/core/2/guides/essentials/configuration)'ll be able to select which [Kuzzle](/core/2/guides/essentials/admin-console#connect-to-kuzzle) installation that you want to manage. this behavior.
:::

We will run Kuzzle using [pm2](http://pm2.keymetrics.io), a process management tool used to monitor Node.js applications.

### Supported operating systems

The following operating systems are actively supported (64-bit versions only):

- Ubuntu: 14.04+
- Debian: 7+

### Prerequisites

- [Elasticsearch](https://www.elastic.co/products/elasticsearch) version 7.4.x or higher
- [Redis](http://redis.io) version 5.x or higher
- [Node.js](https://nodejs.org/en/download/package-manager) version 10.x or higher
- [NPM](https://www.npmjs.com) version 6 or higher
- [Python](https://www.python.org) version 2.7 preferred
- [GDB](https://www.gnu.org/software/gdb) version 7.7 or higher
- a C++11 compatible compiler
- it's strongly advised that the system value for the maximum number of opened files (`ulimit -n` on most Unix systems) is set to a high value (i.e. 65535 is a good min. value)

::: info
The last three prerequisites can be fulfilled on Debian-based systems by installing packages : `build-essential`, `gdb` and `python`.
:::

---

### Get Kuzzle source code

Let's start by creating the `kuzzle` root folder:

```bash
mkdir -p ~/kuzzle
cd ~/kuzzle
```

Then clone the Kuzzle repository:

```bash
git clone https://github.com/kuzzleio/kuzzle.git
```

Now install Kuzzle packages using NPM. Make sure you have installed a `C++11 compatible compiler` or the packages will not build properly, causing problems during the installation process or when running.

```bash
# open the cloned kuzzle repo folder
cd kuzzle
# run npm install to download packages
npm install
```

The package installation can take a few minutes. Once it completes, install Kuzzle plugins by creating and running the following bash script:

```bash
#!/bin/bash

# init submodules to install defaults kuzzle plugins
git submodule init
git submodule update

# install dependencies for all enabled plugins
for PLUGIN in ./plugins/enabled/*; do
  if [ -d "${PLUGIN}" ]; then
    ( cd "${PLUGIN}" && npm install )
  fi
done
```

#### Configure Kuzzle components

Kuzzle uses Elasticsearch and Redis as a persistent and key-value store, respectively. If you are running these components on the same machine as your Kuzzle installation then no additional configuration is needed. If; however, you are running them on another host, you will need to create or update the `.kuzzlerc` file in your installation folder.

Please refer to the [configuration section](/core/2/guides/essentials/configuration) for more details.

### Setup PM2

Now that you have installed Kuzzle and loaded its plugins, lets install pm2. Run the following command to install pm2 using NPM as a global package so that it can be run from anywhere on your machine:

```bash
sudo npm install -g pm2
```

Now create a [pm2 configuration file](http://pm2.keymetrics.io/docs/usage/application-declaration#process-file) that sets the application and environment details. We will create the `KUZZLE_BACKEND_INSTALL_DIR` environment variable to store the location of our Kuzzle installation:

```bash
export KUZZLE_BACKEND_INSTALL_DIR="~/kuzzle/kuzzle"
```

Then create the pm2 configuration file:

```bash
echo "apps:
   - name: KuzzleServer
     script: ${KUZZLE_BACKEND_INSTALL_DIR}/bin/start-kuzzle-server
     env:
       NODE_ENV: production
  " > ~/kuzzle/pm2.conf.yml
```

Finally we are ready to run Kuzzle. Run the following commands:

```bash
pm2 start ~/kuzzle/pm2.conf.yml
```

You should then see the following display on your terminal:

```
[PM2][WARN] Applications KuzzleServer not running, starting...
[PM2] App [KuzzleServer] launched (1 instances)
┌───────────────┬────┬──────┬───────┬────────┬─────────┬────────┬─────┬───────────┬──────┬──────────┐
│ App name      │ id │ mode │ pid   │ status │ restart │ uptime │ cpu │ mem       │ user │ watching │
├───────────────┼────┼──────┼───────┼────────┼─────────┼────────┼─────┼───────────┼──────┼──────────┤
│ KuzzleServer │ 0  │ fork │ 27825 │ online │ 0       │ 0s     │ 49% │ 19.0 MB   │ root │ disabled │
└───────────────┴────┴──────┴───────┴────────┴─────────┴────────┴─────┴───────────┴──────┴──────────┘
```

Check the logs to make sure Kuzzle is running:

```bash
pm2 logs
```

You should see the following message (it may take a few seconds):

```bash
# kuzzle_1         | [✔] Kuzzle server ready
```

Kuzzle can now be reached at the following URL, using either HTTP or WebSocket: `http://localhost:7512/`

#### PM2 cheatsheet

Below is a list of useful commands to help you manage your Kuzzle installation running with pm2:

```bash
# Display Kuzzle logs:
pm2 logs

# Start, restart or stop Kuzzle:
pm2 "<start|stop|restart>" KuzzleServer

# Access the Kuzzle CLI
~/kuzzle/bin/kuzzle -h
```

::: success
Now that Kuzzle is up and running you can [install](/core/2/guides/essentials/admin-console) the <strong>Kuzzle Admin Console</strong>.
:::

### Troubleshooting

If you see the following message during the `NPM install` process then make sure you have installed a C++11 compatible compiler:

```
gyp ERR! build error
gyp ERR! stack Error: not found: make
gyp ERR! stack     at getNotFoundError (/usr/lib/node_modules/npm/node_modules/which/which.js:14:12)
gyp ERR! stack     at F (/usr/lib/node_modules/npm/node_modules/which/which.js:69:19)
gyp ERR! stack     at E (/usr/lib/node_modules/npm/node_modules/which/which.js:81:29)
gyp ERR! stack     at /usr/lib/node_modules/npm/node_modules/which/which.js:90:16
gyp ERR! stack     at /usr/lib/node_modules/npm/node_modules/which/node_modules/isexe/index.js:44:5
gyp ERR! stack     at /usr/lib/node_modules/npm/node_modules/which/node_modules/isexe/access.js:8:5
gyp ERR! stack     at FSReqWrap.oncomplete (fs.js:123:15)
gyp ERR! System Linux 4.2.0-27-generic
gyp ERR! command "/usr/bin/node" "/usr/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js" "rebuild"
gyp ERR! cwd /root/kuzzle/kuzzle/node_modules/boost-geospatial-index
gyp ERR! node -v v6.12.3
gyp ERR! node-gyp -v v3.4.0
gyp ERR! not ok
```

If you see the following message make sure that you have installed Elasticsearch and that it is accessible at 127.0.0.1:9200. If Elasticsearch is running on another server or port, configure `.kuzzlerc` accordingly:

```
Elasticsearch ERROR: 2018-01-12T13:36:34Z
  Error: Request error, retrying
  GET http://localhost:9200/ => connect ECONNREFUSED 127.0.0.1:9200
      at Log.error (/root/kuzzle/kuzzle/node_modules/elasticsearch/src/lib/log.js:225:56)
      at checkRespForFailure (/root/kuzzle/kuzzle/node_modules/elasticsearch/src/lib/transport.js:258:18)
      at HttpConnector.<anonymous> (/root/kuzzle/kuzzle/node_modules/elasticsearch/src/lib/connectors/http.js:157:7)
      at ClientRequest.bound (/root/kuzzle/kuzzle/node_modules/elasticsearch/node_modules/lodash/dist/lodash.js:729:21)
      at emitOne (events.js:96:13)
      at ClientRequest.emit (events.js:188:7)
      at Socket.socketErrorListener (_http_client.js:310:9)
      at emitOne (events.js:96:13)
      at Socket.emit (events.js:188:7)
      at emitErrorNT (net.js:1281:8)
      at _combinedTickCallback (internal/process/next_tick.js:80:11)
      at process._tickCallback (internal/process/next_tick.js:104:9)

Elasticsearch WARNING: 2018-01-12T13:36:34Z
  Unable to revive connection: http://localhost:9200/

Elasticsearch WARNING: 2018-01-12T13:36:34Z
  No living connections
```

If you see the following message and your Elasticsearch installation uses a security layer, configure the Elasticsearch client options in the `.kuzzlerc` file. For more information click [here](/core/2/guides/essentials/configuration).

```
[ℹ] Starting Kuzzle server
[x] [ERROR] Error: [security_exception] missing authentication token for REST request [/], with { header={ WWW-Authenticate="Basic realm=\"security\" charset=\"UTF-8\"" } }
    at respond (/root/kuzzle/kuzzle/node_modules/elasticsearch/src/lib/transport.js:307:15)
    at checkRespForFailure (/root/kuzzle/kuzzle/node_modules/elasticsearch/src/lib/transport.js:266:7)
    at HttpConnector.<anonymous> (/root/kuzzle/kuzzle/node_modules/elasticsearch/src/lib/connectors/http.js:159:7)
    at IncomingMessage.bound (/root/kuzzle/kuzzle/node_modules/elasticsearch/node_modules/lodash/dist/lodash.js:729:21)
    at emitNone (events.js:91:20)
    at IncomingMessage.emit (events.js:185:7)
    at endReadableNT (_stream_readable.js:974:12)
    at _combinedTickCallback (internal/process/next_tick.js:80:11)
    at process._tickCallback (internal/process/next_tick.js:104:9)
```

If you see the following message make sure that you have installed Redis and that it is accessible at 127.0.0.1:6379. If Redis is running on another server or port, configure `.kuzzlerc` accordingly:

```
[ℹ] Starting Kuzzle server
[x] [ERROR] Error: connect ECONNREFUSED 127.0.0.1:6379
    at Object.exports._errnoException (util.js:1020:11)
    at exports._exceptionWithHostPort (util.js:1043:20)
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1090:14)
```

If you see the following message when running `pm2 logs`, then make sure that your `pm2.conf.yml` file was created correctly.
To recreate that file:

- delete the current version from pm2: `pm2 delete KuzzleServer`
- follow the instructions above to recreate it

```
PM2        |     at onErrorNT (internal/child_process.js:376:16)
PM2        |     at _combinedTickCallback (internal/process/next_tick.js:80:11)
PM2        |     at process._tickDomainCallback (internal/process/next_tick.js:128:9)
PM2        | 2018-01-12 15:50:54: Starting execution sequence in -fork mode- for app name:KuzzleServer id:0
PM2        | 2018-01-12 15:50:54: App name:KuzzleServer id:0 online
PM2        | 2018-01-12 15:50:54: Error: spawn node ENOENT
PM2        |     at exports._errnoException (util.js:1020:11)
PM2        |     at Process.ChildProcess._handle.onexit (internal/child_process.js:197:32)
PM2        |     at onErrorNT (internal/child_process.js:376:16)
PM2        |     at _combinedTickCallback (internal/process/next_tick.js:80:11)
PM2        |     at process._tickDomainCallback (internal/process/next_tick.js:128:9)
```

---

## Where do we go from here?

Once your Kuzzle instance is up and running, dive even deeper to learn how to leverage its full capabilities:

- take a look at the [SDK Reference](/sdk)
- learn how to use [Koncorde](/core/2/guides/cookbooks/realtime-api) to create incredibly fine-grained and blazing-fast subscriptions
- follow our guide to learn how to [implement basic authentication](/core/2/guides/essentials/user-authentication#local-strategy).
- follow our guide to learn how to [implement manage users and setup fine-grained access control](/core/2/guides/essentials/security).
