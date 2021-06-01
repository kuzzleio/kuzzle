Feature: User Controller

  # user:create ================================================================

  @security
  Scenario: Create a new user
    Given I successfully execute the action "user":"create" with args:
      | _id  | "alyx"                                       |
      | body | { "content": { "profileIds": ["default"] } } |
    Then I should receive a result matching:
      | _id                | "alyx"      |
      | _source.profileIds | ["default"] |

  # user:createRestricted ======================================================

  # user:createFirstAdmin ======================================================

  @firstAdmin
  Scenario: Create first admin
    Given I update the role "default" with:
      | document | { "delete": true, "get": true } |
      | auth     | { "login": true }               |
    When I successfully execute the action "user":"createFirstAdmin" with args:
      | _id  | "first-admin"                                                                                        |
      | body | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
    Then I should receive a result matching:
      | _source | { "profileIds": ["admin"] } |
    And I'm logged in Kuzzle as user "first-admin" with password "password"

  @firstAdmin
  Scenario: Create first admin then reset anonymous and default roles
    Given I update the role "default" with:
      | document | { "delete": true, "get": true } |
      | auth     | { "login": true }               |
    When I successfully execute the action "user":"createFirstAdmin" with args:
      | _id   | "first-admin"                                                                                        |
      | body  | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
      | reset | true                                                                                                 |
    Then I should receive a result matching:
      | _source | { "profileIds": ["admin"] } |
    And I'm logged in Kuzzle as user "first-admin" with password "password"
    # Test of roles reset
    And The role "default" should match the default one

  # user:get ===================================================================

  # user:mGet ==================================================================

  @security
  Scenario: Get multiple users
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds | ["default"] |
    When I successfully execute the action "user":"mGet" with args:
      | ids | "test-user,test-user2" |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    When I successfully execute the action "user":"mGet" with args:
      | body | {"ids": ["test-user", "test-user2"] } |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |

  # user:search ================================================================

  @security
  Scenario: Search users
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds | ["admin"] |
    When I successfully execute the action "user":"search" with args:
      | body | {"query": {"terms": {"_id": ["test-user", "test-user2"]} } } |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    And I should receive a result matching:
      | total | 2 |
    When I successfully execute the action "user":"search" with args:
      | body | {"query": {"terms": {"_id": ["test-user", "test-user2"]} } } |
      | from | 2                                                            |
      | size | 10                                                           |
    Then I should receive a empty "hits" array
    And I should receive a result matching:
      | total | 2 |

  @security
  Scenario: Search users with koncorde filters
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds | ["admin"] |
    When I successfully execute the action "user":"search" with args:
      | body | { "query": { "ids": { "values": ["test-user", "test-user2"] } } } |
      | lang | "koncorde"                                                        |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    And I should receive a result matching:
      | total | 2 |

  # user:scroll ================================================================

  # user:update ================================================================

  # user:replace ===============================================================

  # user:delete ================================================================

  # user:mDelete ===============================================================

  # user:mappings ==============================================================

  # user:updateMappings ========================================================

  # user:rights ================================================================

  # user:checkRights ===========================================================

  @security
  Scenario: Check if logged user can execute provided API request
    Given I "update" a role "default" with the following API rights:
      | auth     | { "actions": { "login": true, "checkRights": true } } |
      | document | { "actions": { "create": false, "update": true } }    |
    When I successfully execute the action "user":"checkRights" with args:
      | userId | "default-user"                                   |
      | body   | { "controller": "document", "action": "create" } |
    Then I should receive a result matching:
      | allowed | false |
    When I successfully execute the action "user":"checkRights" with args:
      | userId | "default-user"                                   |
      | body   | { "controller": "document", "action": "update" } |
    Then I should receive a result matching:
      | allowed | true |

  # user:strategies ============================================================

  @security
  Scenario: Get user strategies
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    When I successfully execute the action "user":"strategies" with args:
      | _id | "test-user" |
    Then I should receive a "strategies" array matching:
      | "local" |
    When I successfully execute the action "user":"strategies" with args:
      | _id | "-1" |
    Then I should receive a empty "strategies" array
    When I execute the action "user":"strategies" with args:
      | _id | "fake-user-id" |
    Then I should receive an error matching:
      | id | "security.user.not_found" |

  # user:revokeTokens ==========================================================

  # user:refresh ===============================================================

  @security
  Scenario: Refresh user collection
    Given I successfully execute the action "user":"create" with args:
      | _id     | "aschen"                                     |
      | refresh | false                                        |
      | body    | { "content": { "profileIds": ["default"] } } |
    # Refresh success on known collection
    When I successfully execute the action "user":"refresh"
    Then I successfully execute the action "user":"search" with args:
      | body | { "sort": "_id" } |
    And I should receive a "hits" array of objects matching:
      | _id            |
      | "aschen"       |
      | "default-user" |
      | "test-admin"   |
