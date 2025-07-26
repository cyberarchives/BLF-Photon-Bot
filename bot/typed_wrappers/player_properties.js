const { DataType } = require('../protocol_reader/constants');
const { SizedInt } = require('../protocol_reader/types/SizedInt');
const { ProtocolArray } = require('../protocol_reader/types/Array');
const deepEqual = require('deep-equal');

class PlayerProperties {
  constructor() {
    this.name = null;
    this.rank = null;
    this.teamNumber = null;
    this.unlockedWeapons = null;
    this.killStreak = null;
    this.perks = null;
    this.model = null;
    this.characterCamo = null;
  }

  static initial() {
    const props = new PlayerProperties();
    props.name = "Player";
    props.rank = 1;
    props.teamNumber = 10;
    props.unlockedWeapons = [0x14200, 0];
    props.killStreak = 0;
    props.perks = Buffer.alloc(8);
    props.model = 1;
    props.characterCamo = 0;
    return props;
  }

  static fromMap(map) {
    const props = new PlayerProperties();
    props.characterCamo = map['characterCamo']?.value;
    props.unlockedWeapons = map['unlockedweapons']?.data?.map(d => d.value);
    props.rank = map['rank']?.value;
    props.killStreak = map['killstreak']?.value;
    props.perks = map['perks'];
    props.teamNumber = map['teamNumber']?.value;
    props.name = map[new SizedInt(255, 1)];
    props.model = map['model']?.value;
    return props;
  }

  toMap() {
    const map = {};
    map['characterCamo'] = new SizedInt(this.characterCamo, 1);
    map['unlockedweapons'] = new ProtocolArray(DataType.Integer, this.unlockedWeapons?.map(w => new SizedInt(w, 4)) || []);
    map['rank'] = new SizedInt(this.rank, 1);
    map['killstreak'] = new SizedInt(this.killStreak, 1);
    map['perks'] = this.perks;
    map['teamNumber'] = new SizedInt(this.teamNumber, 1);
    map['model'] = new SizedInt(this.model, 1);
    map[new SizedInt(255, 1)] = this.name;
    return map;
  }

  hashCode() {
    return [this.name, this.rank, this.teamNumber]
      .reduce((acc, val) => acc ^ (val?.toString().split('').reduce((a, b) => a.charCodeAt(0) + b.charCodeAt(0), 0) || 0), 0);
  }

  equals(other) {
    if (this === other) return true;
    if (!(other instanceof PlayerProperties)) return false;
    return this.name === other.name &&
      this.rank === other.rank &&
      this.teamNumber === other.teamNumber &&
      deepEqual(this.unlockedWeapons, other.unlockedWeapons) &&
      this.killStreak === other.killStreak &&
      deepEqual(this.perks, other.perks) &&
      this.model === other.model &&
      this.characterCamo === other.characterCamo;
  }
}

module.exports = { PlayerProperties }; // sex