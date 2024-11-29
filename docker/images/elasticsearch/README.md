# Elasticsearch

This container is built from [Elasticsearch official 7.17 image](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/docker.html) with a few modifications:

- All xpack plugins are disabled by default
- `jvm.options` file is modified to remove the jvm heap size settings, thus allowing to set them with `ES_JAVA_OPTS` environment variable (default to 512m).
- The GeoIP downloader is disabled by default
