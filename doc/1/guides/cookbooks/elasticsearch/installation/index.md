---
code: false
type: page
title: Installation
description: learn how to install elasticsearch from scratch
order: 100
---

# Installation

We want you to work with Elasticsearch while you are reading this cookbook,
to do so you will need [cURL](https://curl.haxx.se/download.html), a terminal (Linux, Mac, Cygwin...)
and, optionally, [docker](https://docs.docker.com/install/) to speed up the installation.

Alternatively you can simply trust the results we provide in the cookbook and skip the installation chapter.

---

## Launch Elasticsearch

Below we provide a way to get Elasticsearch running quickly using docker, but you can follow the official
[installation documentation](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/_installation.html) instead.

To launch Elasticsearch, run these commands:

```bash
sudo sysctl -w vm.max_map_count=262144
docker run -p 9200:9200 elasticsearch:5.4.1
```

This will run Elasticsearch in the terminal. To stop it, you can simply exit the terminal or press Ctrl-C.

The Elasticsearch instance will be accessible on port 9200 of the localhost.
If you installed Elasticsearch using another method, adapt the examples provided in this cookbook to your installation configuration.

If you get the following message in Elasticsearch logs during the docker image boot sequence:

```bash
ERROR: bootstrap checks failed max file descriptors [16384] for elasticsearch process is too low, increase to at least [65536]
```

Try to launch the container with these arguments:

```bash
docker run -p 9200:9200 --ulimit nofile=65536:65536 elasticsearch:5.4.1
```

---

## Confirm Elasticsearch is Running

To ensure that Elasticsearch is running, execute the following command:

```bash
curl -g -X GET "http://localhost:9200/"
```

You should receive a reply similar to the one below. Note that this cookbook assumes that your Elasticsearch `version.number` is above **5.0**:

```js
{
    "cluster_name": "elasticsearch",
    "cluster_uuid": "AyJUa63UTlqQgHV9I9UzXQ",
    "name": "kp9tiLV",
    "tagline": "You Know, for Search",
    "version": {
        "build_date": "2016-11-24T10:07:18.101Z",
        "build_hash": "f6b4951",
        "build_snapshot": false,
        "lucene_version": "6.2.1",
        "number": "5.0.2"
    }
}
```
