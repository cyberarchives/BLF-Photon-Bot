const { ListedGameInfo } = require('./listed_game_info');

class GameListItem extends ListedGameInfo {
  constructor() {
    super();
    this.roomId = null;
  }

  static fromMap(roomId, map) {
    const item = new GameListItem();
    item.roomId = roomId;
    Object.assign(item, ListedGameInfo.fromMap(map));
    return item;
  }
}

module.exports = { GameListItem };