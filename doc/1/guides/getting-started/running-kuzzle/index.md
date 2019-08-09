---
code: false
type: page
title: Running Kuzzle
description: Running Kuzzle
order: 100
---

# Running Kuzzle

This section learns you how to quickly get Kuzzle up and running using our installation script.

Open a terminal and run the following command:

```bash
bash -c "$(curl https://get.kuzzle.io)"
```

This command downloads and executes the installation script. The script checks the system for a set of prerequisites and installs missing ones, such as [Docker](https://www.docker.com). When the installation is complete, it will automatically run Kuzzle.

::: info
There are also more [alternative ways](/core/1/guides/essentials/installing-kuzzle) to install Kuzzle.
:::

This command downloads, installs and runs Kuzzle.

Use the `--no-run` option to prevent the script from running Kuzzle.

Once the installation process is complete, you will see the following message:

```bash
# Kuzzle is now running
```

Your Kuzzle is now running! To test it, you can explore the main HTTP API by clicking this [link](http://localhost:7512?pretty) or by using cURL on the command line:

```bash
curl "http://localhost:7512/?pretty"
```

If everything is working you should see a JSON document that contains a list of API endpoints.

::: success
Congratulations! You have completed the Kuzzle installation, it will now accept requests on `localhost:7512`:

- via **HTTP**
- via **Websocket**
  :::

::: info
Having trouble?

- Get in touch with us on [Gitter](https://gitter.im/kuzzleio/kuzzle)
- Try one of [these](/core/1/guides/essentials/installing-kuzzle) alternative installation methods
:::

#### Helper scripts for systemd

If you want to run Kuzzle automatically at startup there are a few scripts that help you do this with systemd.

If you want to run Kuzzle automatically at startup there are a few scripts in `$PWD/kuzzle/script/` that help you do this with systemd:

- Run the `add-kuzzle-boot-systemd.sh` as root to add a service inside /etc/systemd/system that will start Kuzzle on boot.
- Run the `remove-kuzzle-boot-systemd.sh` as root to remove the service so that Kuzzle won't start on boot.

#### What now?

Now that Kuzzle is up and running, you can start playing around with it:

- install and learn a [Kuzzle SDK](/sdk) to power-up one of your projects
- install [Kuzzle Admin Console](/core/1/guides/essentials/admin-console), a handy way to manage data and security in your Kuzzle installation
- explore the [Kuzzle API](/core/1/api) documentation
- install Kuzzle [without Docker](/core/1/guides/essentials/installing-kuzzle#manual-installation)
