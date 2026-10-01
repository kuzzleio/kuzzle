Feature: Collection write locks

  # A lock taken on one node must reject writes on every node, while reads keep
  # being served — the core primitive the mapping-migration plugin relies on.
  @mappings @cluster @collectionLock
  Scenario: A collection locked on one node rejects writes on every node
    Given I target "node1"
    And I successfully execute the action "document":"create" with args:
      | index      | "nyc-open-data"         |
      | collection | "yellow-taxi"           |
      | _id        | "before-lock"           |
      | body       | { "city": "Tbilisi" }   |
      | refresh    | "wait_for"              |
    When I successfully execute the action "tests":"lockCollection" with args:
      | index      | "nyc-open-data" |
      | collection | "yellow-taxi"   |
    Then I should receive a result matching:
      | owner  | "functional-tests" |
      | reason | "functional tests" |
    # The other nodes learn about the lock through cluster sync
    And I wait 500 milliseconds
    Given I target "node2"
    When I execute the action "document":"create" with args:
      | index      | "nyc-open-data"       |
      | collection | "yellow-taxi"         |
      | body       | { "city": "Kutaisi" } |
    Then I should receive an error matching:
      | id      | "services.storage.collection_locked"                                                                                                   |
      | status  | 503                                                                                                                                    |
      | message | "The collection \"nyc-open-data\":\"yellow-taxi\" is locked by \"functional-tests\" (functional tests): write actions are rejected until it is unlocked." |
    When I execute the action "collection":"truncate" with args:
      | index      | "nyc-open-data" |
      | collection | "yellow-taxi"   |
    Then I got an error with id "services.storage.collection_locked"
    When I successfully execute the action "document":"get" with args:
      | index      | "nyc-open-data" |
      | collection | "yellow-taxi"   |
      | _id        | "before-lock"   |
    Then I should receive a result matching:
      | _source | { "city": "Tbilisi" } |
    Given I target "node3"
    When I execute the action "index":"delete" with args:
      | index | "nyc-open-data" |
    Then I got an error with id "services.storage.collection_locked"
    When I execute the action "tests":"unlockCollection" with args:
      | index      | "nyc-open-data" |
      | collection | "yellow-taxi"   |
      | owner      | "someone-else"  |
    Then I got an error with id "services.storage.collection_locked"
    When I successfully execute the action "tests":"unlockCollection" with args:
      | index      | "nyc-open-data" |
      | collection | "yellow-taxi"   |
    Then The result should be "true"
    And I wait 500 milliseconds
    Given I target "node2"
    Then I successfully execute the action "document":"create" with args:
      | index      | "nyc-open-data"       |
      | collection | "yellow-taxi"         |
      | body       | { "city": "Kutaisi" } |

  # An indice built beside a collection (a mapping migration's target) must
  # not be turned into a collection by the startup alias repair.
  @mappings @es8
  Scenario: The alias repair leaves an unmanaged indice alone
    Given I successfully execute the action "tests":"createUnmanagedIndice" with args:
      | index      | "nyc-open-data"         |
      | collection | "yellow-taxi-migration" |
    # Runs the alias repair the way a node start does, on every node
    When I successfully execute the action "admin":"refreshIndexCache"
    Then I should not see the collection "nyc-open-data":"yellow-taxi-migration"
    And I should see the collection "nyc-open-data":"yellow-taxi"
    And I successfully execute the action "index":"stats"
    Then I successfully execute the action "tests":"deleteUnmanagedIndice" with args:
      | index      | "nyc-open-data"         |
      | collection | "yellow-taxi-migration" |
