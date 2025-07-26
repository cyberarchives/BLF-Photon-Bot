const { DataType } = require('../protocol_reader/constants');
const { SizedInt } = require('../protocol_reader/types/SizedInt');
const { SizedFloat } = require('../protocol_reader/types/SizedFloat');
const { ProtocolArray } = require('../protocol_reader/types/Array');
const { BasicGameInfo } = require('./basic_game_info');
const deepEqual = require('deep-equal');

class GameProperties extends BasicGameInfo {
  constructor() {
    super();
    this.bannedWeaponMessage = null;
    this.gunGamePreset = null;
    this.hostId = null;
    this.field249 = null;
    this.field250 = null;
    this.field254 = null;
    this.matchCountdownTime = null;
    this.matchStarted = null;
    this.maxPing = null;
    this.roundStarted = null;
    this.scoreLimit = null;
    this.timeScale = null;
  }

  static initial() {
    const props = new GameProperties();
    props.field253 = true;
    props.field254 = false;
    props.field250 = ['roomName', 'mapName', 'modeName', 'password', 'dedicated', 'switchingmap', 'allowedweapons', 'eventcode', 'averagerank'];
    props.roomName = "My Room Name";
    props.mapName = "Urban";
    props.modeName = "Conquest";
    props.password = "";
    props.roundStarted = false;
    props.maxPing = 700;
    props.timeScale = 1;
    props.dedicated = false;
    props.scoreLimit = 200;
    props.gunGamePreset = 0;
    props.matchCountdownTime = 0;
    props.matchStarted = false;
    props.switchingMap = false;
    props.allowedWeapons = [-1, -1];
    props.bannedWeaponMessage = "This message should never appear!";
    props.eventCode = 0;
    props.averageRank = 1;
    props.maxPlayerCount = 10;
    props.field249 = true;
    return props;
  }

  static fromMap(map) {
    const props = new GameProperties();
    Object.assign(props, BasicGameInfo.fromMap(map));
    props.bannedWeaponMessage = map['bannedweaponmessage'];
    props.gunGamePreset = map['gunGamePreset']?.value;
    props.hostId = map[new SizedInt(248, 1)]?.value;
    props.field249 = map[new SizedInt(249, 1)];
    props.field250 = map[new SizedInt(250, 1)]?.data;
    props.field254 = map[new SizedInt(254, 1)];
    props.matchCountdownTime = map['matchCountdownTime']?.value;
    props.matchStarted = map['matchStarted'];
    props.maxPing = map['maxPing']?.value;
    props.roundStarted = map['roundStarted'];
    props.scoreLimit = map['scorelimit']?.value;
    props.timeScale = map['timeScale']?.value;
    return props;
  }

  toMap() {
    const map = super.toMap();
    map['bannedweaponmessage'] = this.bannedWeaponMessage;
    map['gunGamePreset'] = new SizedInt(this.gunGamePreset, 4);
    if (this.hostId != null) map[new SizedInt(248, 1)] = new SizedInt(this.hostId, 4);
    map[new SizedInt(249, 1)] = this.field249;
    map[new SizedInt(250, 1)] = new ProtocolArray(DataType.String, this.field250 || []);
    map[new SizedInt(254, 1)] = this.field254;
    map['matchCountdownTime'] = new SizedFloat(this.matchCountdownTime, 4);
    map['matchStarted'] = this.matchStarted;
    map['maxPing'] = new SizedInt(this.maxPing, 2);
    map['roundStarted'] = this.roundStarted;
    map['scorelimit'] = new SizedInt(this.scoreLimit, 4);
    map['timeScale'] = new SizedFloat(this.timeScale, 4);
    return map;
  }

  equals(other) {
    if (this === other) return true;
    if (!(other instanceof GameProperties)) return false;
    return super.equals(other) &&
      this.bannedWeaponMessage === other.bannedWeaponMessage &&
      this.gunGamePreset === other.gunGamePreset &&
      this.hostId === other.hostId &&
      this.field249 === other.field249 &&
      deepEqual(this.field250, other.field250) &&
      this.field254 === other.field254 &&
      this.matchCountdownTime === other.matchCountdownTime &&
      this.matchStarted === other.matchStarted &&
      this.maxPing === other.maxPing &&
      this.roundStarted === other.roundStarted &&
      this.scoreLimit === other.scoreLimit &&
      this.timeScale === other.timeScale;
  }
}

module.exports = { GameProperties };