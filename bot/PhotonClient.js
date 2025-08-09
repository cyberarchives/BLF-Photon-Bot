const WebSocket = require("ws");
const ProtocolReader = require("./protocol_reader/ProtocolReader");
const {
  PacketType,
  OperationCode,
  InternalOperationCode,
  EventCode,
  ParameterCode,
} = require("./protocol_reader/constants");
const PhotonPacketBuilder = require("./PhotonUtils/PhotonPacketBuilder");

const EventCaching = {
    DoNotCache: 0,
    MergeCache: 1,
    ReplaceCache: 2,
    RemoveCache: 3,
    AddToRoomCache: 4,
    AddToRoomCacheGlobal: 5,
    RemoveFromRoomCache: 6,
    RemoveFromRoomCacheForActorsLeft: 7,
    SliceIncreaseIndex: 10,
    SliceSetIndex: 11,
    SlicePurgeIndex: 12,
    SlicePurgeUpToIndex: 13
};

const ReceiverGroup = {
    Others: 0,
    All: 1,
    MasterClient: 2
};

class RaiseEventOptions {
    constructor() {
        this.CachingOption = EventCaching.DoNotCache;
        this.TargetActors = null;
        this.InterestGroup = 0;
        this.Receivers = ReceiverGroup.Others;
        this.Flags = {
            HttpForward: false,
            WebhookFlags: 0
        };
        this.CacheSliceIndex = 0;
    }
}

class SendOptions {
    constructor() {
        this.Reliability = true;
        this.Channel = 0;
        this.Encrypt = false;
    }
}

class PhotonClient {
    constructor(socket) {
        this.opParameters = new Map();
        this.socket = socket;
    }

    /**
     * Raises an event to be sent to other clients or cached for new clients
     * @param {number} eventCode - Identifies the type of event
     * @param {Object} customEventContent - The custom content/data to be sent with the event
     * @param {RaiseEventOptions} raiseEventOptions - Options that control the behavior of the event
     * @param {SendOptions} sendOptions - Options for the send operation
     * @returns {boolean} True if operation was sent successfully
     */
    OpRaiseEvent(eventCode, customEventContent, raiseEventOptions, sendOptions) {
        // Clear the parameters map for reuse
        this.opParameters.clear();

        if (raiseEventOptions) {
            // Handle caching options
            if (raiseEventOptions.CachingOption !== EventCaching.DoNotCache) {
                this.opParameters.set(ParameterCode.Cache, PhotonPacketBuilder.types.byte(raiseEventOptions.CachingOption));
            }

            // Handle different caching cases
            switch (raiseEventOptions.CachingOption) {
                case EventCaching.SliceSetIndex:
                case EventCaching.SlicePurgeIndex:
                case EventCaching.SlicePurgeUpToIndex:
                    // In the original code, there's a commented section about CacheSliceIndex
                    // and then immediately returns with SendOperation call
                    return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);

                case EventCaching.SliceIncreaseIndex:
                case EventCaching.RemoveFromRoomCacheForActorsLeft:
                    return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);

                case EventCaching.RemoveFromRoomCache:
                    if (raiseEventOptions.TargetActors) {
                        this.opParameters.set(ParameterCode.ActorList,
                            PhotonPacketBuilder.types.integerArray(raiseEventOptions.TargetActors));
                    }
                    break;

                default:
                    if (raiseEventOptions.TargetActors) {
                        this.opParameters.set(ParameterCode.ActorList,
                            PhotonPacketBuilder.types.integerArray(raiseEventOptions.TargetActors));
                    }
                    else if (raiseEventOptions.InterestGroup !== 0) {
                        this.opParameters.set(ParameterCode.Group,
                            PhotonPacketBuilder.types.byte(raiseEventOptions.InterestGroup));
                    }
                    else if (raiseEventOptions.Receivers !== ReceiverGroup.Others) {
                        this.opParameters.set(ParameterCode.ReceiverGroup,
                            PhotonPacketBuilder.types.byte(raiseEventOptions.Receivers));
                    }

                    if (raiseEventOptions.Flags.HttpForward) {
                        this.opParameters.set(ParameterCode.EventForward,
                            PhotonPacketBuilder.types.byte(raiseEventOptions.Flags.WebhookFlags));
                    }
                    break;
            }
        }

        // Add event code parameter
        this.opParameters.set(ParameterCode.Code, PhotonPacketBuilder.types.byte(eventCode));

        // Add custom event content if provided
        if (customEventContent !== null && customEventContent !== undefined) {
            // Here we would need to determine the proper type based on the customEventContent
            // For simplicity, we'll use a generic approach
            this.opParameters.set(ParameterCode.Data, this.convertToPhotonType(customEventContent));
        }

        // Send the operation
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
    }

    /**
 * Converts JavaScript values to proper Photon types
 * @param {*} value - Value to convert
 * @returns {Object} - Photon type object
 */
convertToPhotonType(value) {
    if (value === null || value === undefined) {
        return PhotonPacketBuilder.types.null();
    }

    switch (typeof value) {
        case 'string':
            return PhotonPacketBuilder.types.string(value);
        case 'boolean':
            return PhotonPacketBuilder.types.boolean(value);
        case 'number':
            // Check if it's an integer or float
            if (Number.isInteger(value)) {
                return PhotonPacketBuilder.types.integer(value);
            } else {
                return PhotonPacketBuilder.types.float(value);
            }
        case 'object':
            if (Array.isArray(value)) {
                // Special case for integer arrays which need special handling
                // This is critical for compatibility with C# int[] expectation
                if (value.every(item => typeof item === 'number' && Number.isInteger(item))) {
                    return PhotonPacketBuilder.types.intArray(value); // Use intArray explicitly
                }

                // Determine array type (this is a simplified approach)
                if (value.length === 0) {
                    return PhotonPacketBuilder.types.objectArray([]);
                }

                const firstItemType = typeof value[0];
                if (firstItemType === 'string') {
                    return PhotonPacketBuilder.types.stringArray(value);
                } else {
                    // Convert each item in the array and return objectArray
                    const convertedItems = value.map(item => this.convertToPhotonType(item));
                    return PhotonPacketBuilder.types.objectArray(convertedItems);
                }
            } else {
                // For objects, create a hashtable
                const entries = Object.entries(value).map(([key, val]) => [
                    PhotonPacketBuilder.types.string(key),
                    this.convertToPhotonType(val)
                ]);
                return PhotonPacketBuilder.types.hashTable(entries);
            }
        default:
            // Default to string for any other types
            return PhotonPacketBuilder.types.string(String(value));
    }
}

    /**
     * Sends an operation to the server
     * @param {number} operationCode - The operation code
     * @param {Map} parameters - Map of parameters
     * @param {SendOptions} sendOptions - Options for sending
     * @returns {boolean} True if the operation was sent successfully
     */
    SendOperation(operationCode, parameters, sendOptions) {
        // Create a new request packet
        const packet = PhotonPacketBuilder.createRequest(operationCode);

        // Add all parameters from the map
        for (const [key, value] of parameters.entries()) {
            packet.addParam(key, value);
        }

        this.socket.send(packet.toBuffer());

        // Return true to indicate success (in real implementation, would check if send was successful)
        return true;
    }

    TransferOwnership(viewID, playerID) {
        // Clear the parameters map for reuse
        this.opParameters.clear();

        // Set event code
        this.opParameters.set(ParameterCode.Code, PhotonPacketBuilder.types.byte(210));

        // Set the data as a SPECIFIC integer array type
        // Use the direct type assignment rather than auto-conversion
        this.opParameters.set(ParameterCode.Data, {
            type: 110, // Integer array type
            data: [viewID, playerID]
        });

        // Set caching and receivers
        this.opParameters.set(ParameterCode.Cache, PhotonPacketBuilder.types.byte(EventCaching.AddToRoomCache));
        this.opParameters.set(ParameterCode.ReceiverGroup, PhotonPacketBuilder.types.byte(ReceiverGroup.All));

        // Create send options
        let sendOptions = new SendOptions();
        sendOptions.Reliability = true;

        // Send the operation
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
    }

    /**
 * Sends various protocol edge-case packets to test server robustness
 * @param {number} testType - Type of edge case to test (1-5)
 * @returns {boolean} True if operation was sent
 */
 sendEdgeCasePacket(testType = 1) {
    // Clear parameters
    this.opParameters = new Map();
    let sendOptions = new SendOptions();
    
    switch (testType) {
      case 1: 
        // Test: Extreme parameter counts
        // Some servers might have buffer allocation issues with many parameters
        for (let i = 0; i < 100; i++) {
          this.opParameters.set(i, PhotonPacketBuilder.types.integer(i));
        }
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
        
      case 2:
        // Test: Unexpected data format for view ID synchronization
        // Many games use ViewID for object synchronization and have optimized parsing paths
        this.opParameters.set(ParameterCode.Code, PhotonPacketBuilder.types.byte(210)); // Transfer Ownership
        this.opParameters.set(ParameterCode.Data, {
          // Invalid data type for this operation
          type: 110, 
          data: [NaN, Infinity] // Invalid numbers in integer array
        });
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
        
      case 3:
        // Test: Deeply nested hashtables that may exceed recursion limits
        let nestedData = PhotonPacketBuilder.types.hashTable([]);
        let current = nestedData;
        
        // Create a deeply nested structure (can cause stack overflow if parsing is recursive)
        for (let i = 0; i < 50; i++) {
          const newLevel = PhotonPacketBuilder.types.hashTable([]);
          current.data.push([
            PhotonPacketBuilder.types.byte(i),
            newLevel
          ]);
          current = newLevel;
        }
        
        this.opParameters.set(ParameterCode.Code, PhotonPacketBuilder.types.byte(200));
        this.opParameters.set(ParameterCode.Data, nestedData);
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
        
      case 4:
        // Test: Mixed event codes with unusual parameter combinations
        // Send event with contradictory caching options
        this.opParameters.set(ParameterCode.Code, PhotonPacketBuilder.types.byte(200));
        this.opParameters.set(ParameterCode.Cache, PhotonPacketBuilder.types.byte(EventCaching.RemoveFromRoomCache));
        this.opParameters.set(ParameterCode.ReceiverGroup, PhotonPacketBuilder.types.byte(ReceiverGroup.All));
        this.opParameters.set(ParameterCode.Group, PhotonPacketBuilder.types.byte(255)); // Invalid group
        this.opParameters.set(ParameterCode.EventForward, PhotonPacketBuilder.types.byte(1));
        this.opParameters.set(ParameterCode.CacheSliceIndex, PhotonPacketBuilder.types.integer(Number.MAX_SAFE_INTEGER));
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
        
      case 5:
        // Test: Unicode edge cases in strings
        // Some servers have issues with certain Unicode ranges, really stupid
        const problemChars = "\u0000\u001F\u007F\u0080\u009F\uD800\uDFFF\uFFFE\uFFFF";
        let largeString = problemChars;
        for (let i = 0; i < 10; i++) {
          largeString += largeString; // Exponentially grow the string, not sure why this works; but it does
        }
        
        this.opParameters.set(ParameterCode.Code, PhotonPacketBuilder.types.byte(200));
        this.opParameters.set(ParameterCode.Data, PhotonPacketBuilder.types.string(largeString));
        return this.SendOperation(OperationCode.RaiseEvent, this.opParameters, sendOptions);
    }
  }
}


module.exports = PhotonClient;
