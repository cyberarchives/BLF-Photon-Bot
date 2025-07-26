const { DataType } = require('../protocol_reader/constants');
const { SizedInt } = require('../protocol_reader/types/SizedInt');
const { ProtocolArray } = require('../protocol_reader/types/Array');
const deepEqual = require('deep-equal');

class BasicGameInfo {
  constructor() {
    this.roomName = null;
    this.password = null;
    this.modeName = null;
    this.mapName = null;
    this._field255 = null;
    this.averageRank = null;
    this.allowedWeapons = null;
    this.switchingMap = null;
    this.dedicated = null;
    this.eventCode = null;
    this.field253 = null;
  }

  get maxPlayerCount() {
    return this._field255 + 1;
  }

  set maxPlayerCount(val) {
    this._field255 = val - 1;
  }

  static fromMap(map) {
    const info = new BasicGameInfo();
    info.field253 = map[new SizedInt(253, 1)];
    info.modeName = map['modeName'];
    info.averageRank = map['averagerank']?.value;
    info.switchingMap = map['switchingmap'];
    info.roomName = map['roomName'];
    info.allowedWeapons = map['allowedweapons']?.data?.map(d => d.value);
    info.eventCode = map['eventcode']?.value;
    info.dedicated = map['dedicated'];
    info.password = map['password'];
    info.mapName = map['mapName'];
    info._field255 = map[new SizedInt(255, 1)]?.value;
    return info;
  }

  toMap() {
    const map = {};
    map[new SizedInt(253, 1)] = this.field253;
    map['modeName'] = this.modeName;
    map['averagerank'] = new SizedInt(this.averageRank, 4);
    map['switchingmap'] = this.switchingMap;
    map['roomName'] = this.roomName;
    map['allowedweapons'] = new ProtocolArray(DataType.Integer, this.allowedWeapons?.map(i => new SizedInt(i, 4)) || []);
    map['eventcode'] = new SizedInt(this.eventCode, 4);
    map['dedicated'] = this.dedicated;
    map['password'] = this.password;
    map['mapName'] = this.mapName;
    map[new SizedInt(255, 1)] = new SizedInt(this._field255, 1);
    return map;
  }

  toString() {
    return `Match ${this.roomName} (${this.modeName}) on ${this.mapName}, max ${this.maxPlayerCount} players`;
  }

  hashCode() {
    // Simple hash combining properties (not exact match to Dart, but functional)
    return [this.roomName, this.password, this.modeName, this.mapName, this.maxPlayerCount]
      .reduce((acc, val) => acc ^ (val?.toString().split('').reduce((a, b) => a.charCodeAt(0) + b.charCodeAt(0), 0) || 0), 0);
  }

  equals(other) {
    if (this === other) return true;
    if (!(other instanceof BasicGameInfo)) return false;
    return this.roomName === other.roomName &&
      this.password === other.password &&
      this.modeName === other.modeName &&
      this.mapName === other.mapName &&
      this._field255 === other._field255 &&
      this.averageRank === other.averageRank &&
      deepEqual(this.allowedWeapons, other.allowedWeapons) &&
      this.switchingMap === other.switchingMap &&
      this.dedicated === other.dedicated &&
      this.eventCode === other.eventCode &&
      this.field253 === other.field253;
  }
}

module.exports = { BasicGameInfo };