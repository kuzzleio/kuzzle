---
code: false
type: page
order: 200
title: Elasticsearch 8 | Elasticsearch | Guide | Core
meta:
  - name: description
    content: Configure Kuzzle to use Elasticsearch 8
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, iot, backend, opensource,  API Controllers
---

# Elasticsearch 8

<SinceBadge version="2.30.0"/>


## Migrating production data from Elasticsearch 7 to 8

Is this section, we will see how to migrate a production environnement data from Elasticsearch 7.x to Elasticsearch 8.x

### Prerequisites

Before starting the migration process, ensure the following:
* __Backup your data__: Always backup your indices and cluster settings before starting the migration. Use the Snapshot and Restore feature for this.
* __Version Check__: Make sure your Elasticsearch 7.x is at the latest minor version. Elasticsearch supports migrating from the last minor version of the previous major version.

### Check Deprecation API

* Elasticsearch Deprecation API can be used to check for any features or settings in your current cluster that are deprecated or removed in the 8.x version. Address these issues before proceeding.
* Test in a **Non-Production Environment**
Conduct a dry run in a development environment to spot potential issues and estimate the duration the migration process might take.

### Migration Methods

Theire are 2 strategies to upgrade Elasticsearch in a production environment:
1. Re-indexing
	* Step 1: Create a new cluster running Elasticsearch 8.x.
	* Step 2: Take a snapshot of your data in the current 7.x cluster.
	* Step 3: Restore the snapshot into the new 8.x cluster.
1. Rolling Upgrade
	* Step 1: Disable Shard Allocation.
	* Step 2: Stop and upgrade a single Elasticsearch node.
	* Step 3: Enable Shard Allocation and allow the node to join the cluster and the cluster to re-balance.
	* Step 4: Repeat for each node in the cluster.

After you have migrated your data:
1. Post Upgrade Checks
	* Run the health and stats APIs to ensure the health of your newly upgraded cluster.
	* Update your clients and integrations to the latest version that's compatible with Elasticsearch 8.x, if not done already.
	* Monitor your cluster using the Monitoring API or third-party monitoring services.
1. Troubleshoot
	* If you encounter any issues during the migration process, take advantage of the Elasticsearch documentation, forums, and issue trackers for troubleshooting information and support.

> Note: Migration steps can vary depending on your setup and needs. Always refer to the official Elasticsearch documentation for the most accurate information, you can find it [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-upgrade.html).

Disclaimer: The above steps provide a general migration guide. Migrations can be complex and it's advised to always test these steps in a **non-production environment** before applying them to production.
