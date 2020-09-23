Feature: Realtime controller

  # realtime.subscribe =====================================================

  @realtime
  Scenario: Subscribe and unsubscribe to realtime notifications
    Given I subscribe to "test":"answer" notifications
    When I successfully execute the action "realtime":"publish" with args:
      | index      | "test"     |
      | collection | "question" |
      | body       | {}         |
    Then I should have receive "1" notifications for "test":"answer"
    # should not be subscribed anymore
    When I successfully execute the action "realtime":"publish" with args:
      | index      | "test"     |
      | collection | "question" |
      | body       | {}         |
    Then I should have receive "1" notifications for "test":"answer"