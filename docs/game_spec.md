Simple mmo game.

Client-server.

Initially server has a 1000x1000 tile map.

Player creation screen
    - enter name
    - chose class for now warrior or mage

Players can walk around the map.

Mage can shoot fireball that is visible for all players.

Players are only send updates on game state in their visibility range.

Server probably could be nodejs.

Client is javascript based. Connects through websocket.