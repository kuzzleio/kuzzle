Feature: WebSocket

  # WebSocket ===========================================================
  @websocket
  Scenario: Check reponse message from Kuzzle with a specific payload
    Given I open a new local websocket connection
    When I send the message '{"p":1}' to Kuzzle through websocket
    And I wait to receive a websocket response from Kuzzle
    Then I should receive a response message from Kuzzle through websocket matching:
      |  p  |  2  |
