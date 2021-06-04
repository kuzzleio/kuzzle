Feature: User Controller

  # user:create ================================================================

  @security
  Scenario: Create a new user
    Given I successfully execute the action "user":"create" with args:
      | _id                | "alyx"                                       |
      | body               | { "content": { "profileIds": ["default"] } } |
    Then I should receive a result matching:
      | _id                | "alyx"                                       |
      | _source.profileIds | ["default"]                                  |

  # user:createRestricted ======================================================

  @security
  Scenario: Create a new restricted user without permissions
    Given I execute the action "user":"createRestricted" with args:
      | _id                | "alyx"                                       |
      | body               | { "content": { "profileIds": ["admin"] } }   |
    Then I got an error with id "api.assert.forbidden_argument"

  Scenario: Create a new restricted user successfuly
    When I successfully execute the action "user":"createRestricted" with args:
      | _id                | "alyx"                                       |
      | body               | { "content": { "name": "toto" } } |
    Then I should receive a result matching:
      | _id                | "alyx"                                       |
      | _source.profileIds | ["default"]                                  |
      | _source.name | "toto"                                  |

  # user:createFirstAdmin ======================================================

  @firstAdmin
  Scenario: Create first admin
    Given I update the role "default" with:
      | document | { "delete": true, "get": true } |
      | auth     | { "login": true }               |
    When I successfully execute the action "user":"createFirstAdmin" with args:
      | _id      | "first-admin"                   |
      | body     | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
    Then I should receive a result matching:
      | _source  | { "profileIds": ["admin"] }     |
    And I'm logged in Kuzzle as user "first-admin" with password "password"

  @firstAdmin
  Scenario: Create first admin then reset anonymous and default roles
    Given I update the role "default" with:
      | document | { "delete": true, "get": true } |
      | auth     | { "login": true }               |
    When I successfully execute the action "user":"createFirstAdmin" with args:
      | _id      | "first-admin"                   |
      | body     | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
      | reset    | true                            |
    Then I should receive a result matching:
      | _source  | { "profileIds": ["admin"] }     |
    And I'm logged in Kuzzle as user "first-admin" with password "password"
    # Test of roles reset
    And The role "default" should match the default one

  # user:get ===================================================================

  @security
  Scenario: Get a user
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    When I successfully execute the action "user":"get" with args:
      | _id        | "test-user" |
    Then I should receive a result matching:
      | _id        | "test-user" |

  # user:mGet ==================================================================

  @security
  Scenario: Get multiple users
    Given I create a user "test-user" with content:
      | profileIds   | ["default"]            |
    And I create a user "test-user2" with content:
      | profileIds   | ["default"]            |
    When I successfully execute the action "user":"mGet" with args:
      | ids          | "test-user,test-user2" |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    When I successfully execute the action "user":"mGet" with args:
      | body         | {"ids": ["test-user", "test-user2"] } |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |

  # user:search ================================================================

  @security
  Scenario: Search users
    Given I create a user "test-user" with content:
      | profileIds   | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds   | ["admin"]   |
    When I successfully execute the action "user":"search" with args:
      | body         | {"query": {"terms": {"_id": ["test-user", "test-user2"]} } } |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    And I should receive a result matching:
      | total        | 2           |
    When I successfully execute the action "user":"search" with args:
      | body         | {"query": {"terms": {"_id": ["test-user", "test-user2"]} } } |
      | from         | 2           |
      | size         | 10          |
    Then I should receive a empty "hits" array
    And I should receive a result matching:
      | total        | 2           |

  @security
  Scenario: Search users with koncorde filters
    Given I create a user "test-user" with content:
      | profileIds   | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds   | ["admin"]   |
    When I successfully execute the action "user":"search" with args:
      | body         | { "query": { "ids": { "values": ["test-user", "test-user2"] } } } |
      | lang         | "koncorde"  |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    And I should receive a result matching:
      | total        | 2           |

  # user:scroll ================================================================

  @security
  Scenario: Search users with scroll
    When I successfully execute the action "user":"search" with args:
      | body       | {}          |
      | scroll     | "30s"       |
      | size       | 1           |
    Then I should receive a result matching:
      | total      | 2           |
    And I should receive a "hits" array containing 1 elements
    When I successfully scroll to the next page of users
    Then I should receive a "hits" array containing 1 elements
    When I scroll to the next page of users
    Then I got an error with id "services.storage.unknown_scroll_id"

  # user:update ================================================================

  @security
  Scenario: Update user
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
      | name       | "foo"       |
    When I successfully execute the action "user":"update" with args:
      | _id       | "test-user"       |
      | body       | { name: "bar" }       |
    Then I should receive a result matching:
      | _id        | "test-user" |
      | _source.name    | "bar"          |
    And The content of user "test-user" should match:
      | name       | "bar"       |

  # user:replace ===============================================================

  @security
  Scenario: Replace user
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
      | name       | "foo"       |
    When I successfully execute the action "user":"replace" with args:
      | _id       | "test-user"       |
      | body      | { profileIds: ["default"], age: 42 }       |
    Then I should receive a result matching:
      | _id        | "test-user" |
      | _source    | { profileIds: ["default"], age: 42 }          |
    And The content of user "test-user" should match:
      | profileIds | ["default"] |
      | age        | 42          |
    And The content of user "test-user" should not match:
      | name       | "foo"       |

  # user:delete ================================================================

  @security
  Scenario: Delete user
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds | ["default"] |
    When I successfully execute the action "user":"delete" with args:
      | _id        | "test-user" |
    Then I should receive a result matching:
      | _id        | "test-user" |
    And The user "test-user" should not exists
    But The user "test-user2" exists

  # user:mDelete ===============================================================

  @security
  Scenario: Delete multiple users
    Given I create a user "test-user" with content:
      | profileIds   | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds   | ["default"] |
    And I create a user "test-user3" with content:
      | profileIds   | ["default"] |
    When I successfully execute the action "user":"mDelete" with args:
      | body          | { ids: ["test-user", "test-user2"] } |
    Then I should receive a array matching:
      | "test-user"  |
      | "test-user2" |
    And The user "test-user" should not exists
    And The user "test-user2" should not exists
    But The user "test-user3" exists

  # user : mappings & updateMappings ===========================================

  @security
  Scenario: Get user mappings and update them
    When I successfully execute the action "user":"mappings"
    Then The property "mapping" of the result should match:
      | profileIds | { type: 'keyword' } |
    When I successfully execute the action "user":"updateMappings" with args:
      | body | { properties: { name: { type: 'keyword' } } }       |
    And I successfully execute the action "user":"mappings"
    Then The property "mapping" of the result should match:
      | profileIds    | { type: 'keyword'}                                                    |
      | name | { type: 'keyword' } |

  # user:rights ================================================================

  @security
  Scenario: Get user rights
    Given I create a user "test-user" with content:
      | profileIds | ["default"]    |
    When I successfully execute the action "user":"rights" with args:
      | _id        | "test-user"    |
    Then I should receive a "hits" array of objects matching:
      | action | collection | controller | index | value |
      | "*"    | "*"     |  "*" | "*" | "allowed" |

  # user:checkRights ===========================================================

  @security
  Scenario: Check if logged user can execute provided API request
    Given I "update" a role "default" with the following API rights:
      | auth     | { "actions": { "login": true, "checkRights": true } } |
      | document | { "actions": { "create": false, "update": true } }    |
    When I successfully execute the action "user":"checkRights" with args:
      | userId   | "default-user"                                        |
      | body     | { "controller": "document", "action": "create" }      |
    Then I should receive a result matching:
      | allowed  | false                                                 |
    When I successfully execute the action "user":"checkRights" with args:
      | userId   | "default-user"                                        |
      | body     | { "controller": "document", "action": "update" }      |
    Then I should receive a result matching:
      | allowed  | true                                                  |

  # user:strategies ============================================================

  @security
  Scenario: Get user strategies
    Given I create a user "test-user" with content:
      | profileIds | ["default"]               |
    When I successfully execute the action "user":"strategies" with args:
      | _id        | "test-user"               |
    Then I should receive a "strategies" array matching:
      | "local"    |
    When I successfully execute the action "user":"strategies" with args:
      | _id        | "-1"                      |
    Then I should receive a empty "strategies" array
    When I execute the action "user":"strategies" with args:
      | _id        | "fake-user-id"            |
    Then I should receive an error matching:
      | id         | "security.user.not_found" |

  # user:revokeTokens ==========================================================

  @security
  Scenario: Revoke all tokens of a user
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    And I'm logged in Kuzzle as user "test-user" with password "password"
    When I successfully execute the action "user":"revokeTokens" with args:
      | _id        | "test-user" |
    And I execute the action "server":"now"
    Then I got an error with id "security.token.invalid"

  # user:refresh ===============================================================

  @security
  Scenario: Refresh user collection
    Given I successfully execute the action "user":"create" with args:
      | _id            | "toto"                                     |
      | refresh        | false                                        |
      | body           | { "content": { "profileIds": ["default"] } } |
    # Refresh success on known collection
    When I successfully execute the action "user":"refresh"
    Then I successfully execute the action "user":"search" with args:
      | body           | { "sort": "_id" }                            |
    And I should receive a "hits" array of objects matching:
      | _id            |
      | "default-user" |
      | "test-admin"   |
      | "toto"       |
