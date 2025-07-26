const { SizedInt } = require('../protocol_reader/types/SizedInt');
const { BasicGameInfo } = require('./basic_game_info');

class ListedGameInfo extends BasicGameInfo {
  constructor() {
    super();
    this.playerCount = null;
  }

  static fromMap(map) {
    const info = new ListedGameInfo();
    Object.assign(info, BasicGameInfo.fromMap(map));
    info.playerCount = map[new SizedInt(252, 1)]?.value;
    return info;
  }

  toMap() {
    const map = super.toMap();
    map[new SizedInt(252, 1)] = new SizedInt(this.playerCount, 1);
    return map;
  }

  toString() {
    return `Match ${this.roomName} (${this.modeName}) on ${this.mapName}, ${this.playerCount}/${this.maxPlayerCount} players`;
  }

  hashCode() {
    return super.hashCode() ^ (this.playerCount || 0);
  }

  equals(other) {
    if (this === other) return true;
    if (!(other instanceof ListedGameInfo)) return false;
    return super.equals(other) && this.playerCount === other.playerCount;
  }
}

module.exports = { ListedGameInfo };