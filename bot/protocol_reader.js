const { Quaternion } = require('./protocol_reader/types/Quaternion');

module.exports = {
    ProtocolReader: require('./protocol_reader/ProtocolReader'),
    ProtocolWriter: require('./protocol_reader/ProtocolWriter'),
    constants: require('./protocol_reader/constants'),
    ProtocolArray: require('./protocol_reader/types/Array').ProtocolArray,
    CustomData: require('./protocol_reader/types/CustomData').CustomData,
    SizedFloat: require('./protocol_reader/types/SizedFloat').SizedFloat,
    SizedInt: require('./protocol_reader/types/SizedInt').SizedInt,
    Vector3: require('./protocol_reader/types/Vector3').Vector3,
    Quaternion: require('./protocol_reader/types/Quaternion').Quaternion,
    packets: require('./protocol_reader/types/packets'),
  };