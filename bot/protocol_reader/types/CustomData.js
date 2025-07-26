const { DataType } = require('../constants');
const Serializable = require('./Serializable');
const ProtocolWriter = require('../ProtocolWriter');

class CustomData extends Serializable {
  constructor() {
    super();
  }

  static read(reader) {
    const typeCode = reader.readUint8();
    const len = reader.readUint16();
    const data = reader.read(len);
    const tempReader = new (require('../ProtocolReader'))(data);

    switch (typeCode) {
      case 86: // Vector3.TypeCode
        const { Vector3 } = require('./Vector3');
        return Vector3.read(tempReader);
      case 81: // Quaternion.TypeCode
        const { Quaternion } = require('./Quaternion');
        return Quaternion.read(tempReader);
      default:
        const { UnimplementedCustomData } = require('./UnimplementedCustomData');
        return new UnimplementedCustomData(typeCode, data);
    }
  }

  writeType(writer) {
    writer.writeUint8(DataType.Custom);
  }

  writeValue(writer) {
    writer.writeUint8(this.typeCode);
    const data = this.getBytes();
    writer.writeUint16(data.length);
    writer.write(data);
  }

  write(writer) {
    throw new Error('write must be implemented');
  }

  getBytes() {
    const writer = new ProtocolWriter();
    this.write(writer);
    return writer.toBytes();
  }

  toString() {
    return `CustomData ${this.typeCode} ${this.getBytes().toString('hex')}`;
  }
}

module.exports = { CustomData };