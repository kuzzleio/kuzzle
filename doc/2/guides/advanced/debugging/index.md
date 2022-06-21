---
code: false
type: page
title: Debugging
description: Debug Kuzzle
order: 100
---

## Introduction

Kuzzle gives the possibility to debug a Kuzzle instance using the [Debug Controller](/core/2/api/controllers/debug) actions.

The Debug Controller gives you the ability to execute methods and listen to events produced by the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8) or [Debug Modules](#debug-modules).

It's easier and safer to use the [Debug Controller](/core/2/api/controllers/debug) to debug Kuzzle remotely than exposing the debugger port using `node --inspect` since the [Debug Controller](/core/2/api/controllers/debug) is limited by the authentication mechanism of Kuzzle making it impossible to use if you don't have the proper rights to use it.
Whereas when launching Kuzzle with `node --inspect` you need to setup some Port Forwarding from your host machine to your local machine to be able to debug Kuzzle remotely, and you need to be sure that no one can access your instance using the Debug Port exposed.

:::warn
By default access to the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8) through the [Debug Controller](/core/2/api/controllers/debug) is disabled, to use the methods of the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8) you need to enable it in the [kuzzlerc file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample)
by setting `security.debug.native_debug_protocol` to `true` and rebooting your instance.

[Debug Modules](#debug-modules) are still accessible when `security.debug.native_debug_protocol` is disabled.
:::

## Debug Modules

Debug Modules are modules of Kuzzle that are exposed through the [Debug Controller](/core/2/api/controllers/debug) actions and allows you to better understand what is happening on your instance and helps you debug your instance live.

Debug Modules are not related to the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8) and perfectly safe to use. They do not expose the debugger directly, whereas the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8) could be used to execute code remotely which is why access to the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8) is disabled by default. It should only be enabled when you need to take memory snapshot, use breakpoint, the cpu profiler, etc...

## Debug Kuzzle remotely using the Debug Controller and the Chrome Inspector

### Prerequisites

To be able to debug Kuzzle remotely using the Chrome Inspector tool you need:

- A user allowed to access to all [Debug Controller](/core/2/api/controllers/debug)'s actions. See the [Permissions](/core/2/main-concepts/permissions) page on how to setup the proper permissions.
- To set the config `security.debug.native_debug_protocol` to `true`, to allow the [Debug Controller](/core/2/api/controllers/debug) to execute actions from the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8), then restart your application. 
- [Kourou](https://github.com/kuzzleio/kourou), the Kuzzle CLI, installed. You can install it using `npm install -g kourou`.
- The [Chrome Browser](https://www.google.com/intl/en_en/chrome/) installed.

### How to Debug

#### Step 1 - Setup proxy server

To debug Kuzzle remotely using the Chrome Inspector, you need to open a proxy server that will connected to Kuzzle to translate commands sent by the Chrome Inspector with the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8)'s format into actions of the [Debug Controller](/core/2/api/controllers/debug).
**Don't worry this is very easy to do**, you just have to use Kourou to perform this:

```bash
kourou app:debug-proxy --host <Kuzzle Host> --port <Kuzzle Port> --username <username> --password <user password>
```

This will open a proxy server that will connects to your Kuzzle instance using the given username and password and will do the translation automatically.

:::warn
Remember that the user must be allowed to use all the actions of [Debug Controller](/core/2/api/controllers/debug) and you need to set the config option `security.debug.native_debug_protocol` to `true`, to allow the [Debug Controller](/core/2/api/controllers/debug) to execute actions from the [Chrome Devtools Protocol](https://chromedevtools.github.io/devtools-protocol/v8).
:::

Once the proxy server has started and is successfully connected to your Kuzzle instance, you will will see a message like this in your terminal:
```bash
[ℹ] Connecting to ws://<host>:<port> ...
[ℹ] Connected to Kuzzle node: knode-lackadaisical-archimedes-79903
[✔] Listening on port 9222, forwarding to Kuzzle at <host>:<port>
[ℹ] Showing to Chrome Debugger as "Kuzzle Debugger - <host>:<port>"
[ℹ] Waiting for Chrome Debugger to connect...
```

```bash
[✔] Listening on port 9222, forwarding to Kuzzle at <host>:<port>
```
You can see here that the proxy server is listening on port `9222`. This will be needed for the next step.

#### Step 2 - Configure Chrome Inspector

The proxy server is correctly running, you now need to open the Chrome Inspector to debug your instance. To do so, open the url `chrome://inspect` in the [Chrome Browser](https://www.google.com/intl/en_en/chrome/).
This will show you the Chrome debugger interface which will be used to debug the Kuzzle instance.

To allow the Chrome Inspector to see our proxy server exposed by the command `kourou app:debug-proxy`,
you need to add `localhost:9222` to the list of targets the Chrome Inspector can see and debug.

:::info
Here we are using the port `9222` but keep in mind that this port can be any other number. You need to change it accordingly on what port the proxy server is listening to, see end of [Step 1 - Setup proxy server](#step-1---setup-server-proxy)

The host will always be localhost since it's the IP of the proxy server that is running on your local machine.
:::

**1 -** Click on the `Configure` button, a dialog will appear where you can enter the IP and Port of your local proxy server.
![Image Configure Chrome Inspector Step 1](./config_step_1.png)

**2 -** Enter your local target, here `localhost:9222`
**3 -** Confirm
![Image Configure Chrome Inspector Step 2](./config_step_2.png)

**If everything worked so far, you should see a new Remote Target called** `Kuzzle Debugger - <Instance Host>:<Instance Port>`.

![Image Configure Chrome Inspector Step 3](./config_step_3.png)

**4 -** You can now click on `inspect` and you're done.

#### Step 3 - Debugging

You can now fully use the Chrome Inspector to debug you instance.

#### Step 4 - After Debugging

:::warn
Don't forget to set the `security.debug.native_debug_protocol` configuration setting back to `false` once you're done debugging to increase the security of your instance. Doing so, if one of your admin users with access to the [Debug Controller](/core/2/api/controllers/debug) gets compromised, it won't harm your application.
:::