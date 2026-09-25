Feature: Cluster

  Scenario: Synchronization events
    When I successfully execute the action "tests":"getSyncedHello"
    Then The result should be '"Hello, World"'
    When I successfully execute the action "tests":"syncHello" with args:
    | name | "Foo" |
    And I successfully execute the action "tests":"getSyncedHello"
    Then The result should be '"Hello, Foo"'
    # Execute multiple times to hit each node
    And I successfully execute the action "tests":"getSyncedHello"
    Then The result should be '"Hello, Foo"'
    And I successfully execute the action "tests":"getSyncedHello"
    Then The result should be '"Hello, Foo"'
    # Make sure to reset to make this test reentrant
    Then I successfully execute the action "tests":"syncHello" with args:
    | name | "World" |

  @cluster
  Scenario: Target each node of the cluster
    Given I target "node1"
    Then I successfully execute the action "server":"now"
    Given I target "node2"
    Then I successfully execute the action "server":"now"
    Given I target "node3"
    Then I successfully execute the action "server":"now"
