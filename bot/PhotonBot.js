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
const crypto = require("crypto");
const PhotonClient = require("./PhotonClient");
const Account = require("./Account");
const fs = require('fs');

class PhotonBot {
  constructor() {
    this.botId = this.generateRandomID();
    this.players = [];
    this.photonClient = undefined;
    this.lastActorNr = 1;
    this.showJoinMessageInChat = true;
    
    // Socket connections
    this.lobbySocket = undefined;
    this.authSent = false;
    this.gameSocket = undefined;
    
    // Authentication
    this.authToken = "";
    this.account = null;
    
    // State tracking
    this.isInGame = false;
    this.isInRoom = false;
    this.alreadyJoined = false;
    
    // Timing
    this._startTime = new Date();
    this._lastPing = new Date(0);
    this._serverTickOffset = 0;
    
    // Game info
    this.gameRoomName = "";
    this.serverAddress = "";
    this.previousActorList = [];
  }

  /**
   * Generates a random hexadecimal ID with a maximum of 16 characters.
   * @returns {string} A random hex ID string.
   */
  generateRandomID() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Hashes input using SHA512
   * @param {string} input - The input to hash
   * @returns {Promise<string>} The hashed string
   */
  async hashSHA512(input) {
    return crypto.createHash('sha512').update(input, 'utf8').digest('hex');
  }

  useRandomAccount() {
    try {
      const data = fs.readFileSync('accounts.txt', 'utf8');
      const lines = data.trim().split('\n');
      
      const accounts = lines.map(line => {
        const [username, password] = line.split(' | ');
        return { username: username.trim(), password: password.trim() };
      });

      const randomIndex = Math.floor(Math.random() * accounts.length);
      return accounts[randomIndex];
    } catch (error) {
      console.error('Error reading accounts.txt:', error);
      return null;
    }
  }

  /**
   * Generates a new account for the bot
   * @returns {Promise<Object>} Account details { username, password }
   */
  async generateAccount() {
    let account = this.useRandomAccount();
    const username = account.username;
    const rawPassword = account.password;

    this.account = {
      username: username,
      password: rawPassword,
      hashedPassword: await this.hashSHA512(rawPassword)
    };
    
    return {
      username: this.account.username,
      password: rawPassword
    };
  }

  /**
   * Gets authentication code from the server
   * @returns {Promise<string>} Auth code
   */
  async getAuthCode() {
    if (!this.account) {
      throw new Error("No account generated. Call generateAccount() first.");
    }

    const response = await fetch(
      "https://server.blayzegames.com/OnlineAccountSystem/get_multiplayer_auth_code.php?requiredForMobile=543756367",
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9,ja;q=0.8",
          "content-type": "application/x-www-form-urlencoded",
          priority: "u=1, i",
          "sec-ch-ua": '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          Referer: "https://bullet-force-multiplayer.game-files.crazygames.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: `password=${this.account.hashedPassword}&username=${this.account.username}&username=${this.account.username}&password=${this.account.hashedPassword}`,
        method: "POST",
      }
    );

    return await response.text();
  }

  /**
   * Gets all players currently tracked by the bot
   * @returns {Array} Array of player objects
   */
  getAllPlayers() {
    return this.players;
  }

  /**
   * Generates a UUID
   * @returns {string} UUID string
   */
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Gets a random region
   * @returns {string} Region code
   */
  getRandomRegion() {
    const regions = ['ca', 'eu', 'sa', 'as'];
    const randomIndex = Math.floor(Math.random() * regions.length);
    return regions[randomIndex];
  }

  /**
   * Bot logging function
   * @param {...any} args - Arguments to log
   */
  botLog(...args) {
    console.log(`[PhotonBot ${this.botId}]:`, ...args);
  }

  /**
   * Gets current tick count
   * @returns {number} Tick count
   */
  _tickCount() {
    return Date.now() - this._startTime.getTime();
  }

  /**
   * Gets server time
   * @returns {number} Server time
   */
  serverTime() {
    return this._tickCount() + this._serverTickOffset;
  }

  /**
   * Sends ping packet
   * @param {WebSocket} socket - Socket to send ping on
   */
  sendPing(socket) {
    const pingRequest = PhotonPacketBuilder.createRequest(1).addParam(
      1,
      PhotonPacketBuilder.types.integer(this._tickCount())
    );
    const pingBuffer = pingRequest.toBuffer();
    socket.send(pingBuffer);
  }

  /**
   * Starts ping loop
   * @param {WebSocket} socket - Socket to ping on
   */
  pingLoop(socket) {
    setInterval(() => {
      const pingRequest = PhotonPacketBuilder.createRequest(
        InternalOperationCode.Ping
      ).addParam(1, PhotonPacketBuilder.types.integer(89));
      const pingBuffer = pingRequest.toBuffer();
      socket.send(pingBuffer);
    }, 2000);

    setInterval(() => {
      this.sendCraftedPacket(socket);
    }, 5000);
  }

  /**
   * Sends authentication parameters
   */
  sendAuthParams() {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.Authenticate)
      .addParam(220, PhotonPacketBuilder.types.string("1.104.5_HC_1.105"))
      .addParam(224, PhotonPacketBuilder.types.string("8c2cad3e-2e3f-4941-9044-b390ff2c4956"))
      .addParam(210, PhotonPacketBuilder.types.string("eu/*"))
      .addParam(225, PhotonPacketBuilder.types.string(this.generateUUID()));

    const bufferData = packet.toBuffer();
    this.lobbySocket.send(bufferData);
  }

  /**
   * Sends game authentication
   * @param {string} token - Auth token
   */
  sendGameAuth(token) {
    this.botLog("Sending Game Auth ->", token);
    const packet = PhotonPacketBuilder.createRequest(OperationCode.Authenticate)
      .addParam(221, PhotonPacketBuilder.types.string(token));
    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);
    this.authSent = true;
  }

  /**
   * Sends join lobby packet
   * @param {WebSocket} socket - Socket to send on
   */
  sendJoinLobby(socket) {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.JoinLobby);
    const bufferData = packet.toBuffer();
    socket.send(bufferData);
  }

  /**
   * Filters rooms to show only those with ID format
   * @param {Array} roomKeys - Array of room keys
   * @returns {Array} Filtered room keys
   */
  filterRoomsWithIdOnly(roomKeys) {
    return roomKeys.filter((key) => /\(#\d{4,6}\)/.test(key));
  }

  /**
   * Cleans username by removing color tags and brackets
   * @param {string} rawName - Raw username
   * @returns {string} Cleaned username
   */
  cleanUsername(rawName) {
    let cleaned = rawName
      .replaceAll(/<color=#[A-Fa-f0-9]{6}>/g, "")
      .replaceAll("</color>", "");
    cleaned = cleaned.replaceAll(/^\[[^\]]+\]/g, "");
    return cleaned.trim();
  }

  /**
   * Gets random binary value (0 or 1)
   * @returns {number} 0 or 1
   */
  getRandomBinary() {
    return Math.random() < 0.5 ? 0 : 1;
  }

  /**
   * Converts base64 to Uint8Array
   * @param {string} base64 - Base64 string
   * @returns {Uint8Array} Converted array
   */
  base64toUint8Array(base64) {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
      bytes[index] = binaryString.charCodeAt(index);
    }
    return bytes;
  }

  generateClanTag() {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const length = Math.floor(Math.random() * 4) + 1; // 1 to 4 chars
      let tag = '';

      for (let i = 0; i < length; i++) {
        tag += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      return `[${tag}]`;
    }

  /**
   * Sends join room with properties packet
   * @param {string} roomName - Room name to join
   */
  sendJoinRoomWithProperties(roomName) {
    const packet = PhotonPacketBuilder.createRequest(226);
    packet.addParam(255, PhotonPacketBuilder.types.string(roomName));

    const perksArray = new Uint8Array(8);
    perksArray[0] = 1;
    perksArray[1] = 9;
    perksArray[2] = 14;
    perksArray[3] = 2;
    perksArray[4] = 22;

    const hashtable249 = PhotonPacketBuilder.types.hashTable([
      [PhotonPacketBuilder.types.string("platform"), PhotonPacketBuilder.types.string("MeowEngine Bot Panel")],
      [PhotonPacketBuilder.types.string("teamNumber"), PhotonPacketBuilder.types.byte(this.getRandomBinary())],
      [PhotonPacketBuilder.types.string("rank"), PhotonPacketBuilder.types.byte(Math.floor(Math.random() * 200) + 1)],
      [PhotonPacketBuilder.types.string("killstreak"), PhotonPacketBuilder.types.byte(15)],
      [PhotonPacketBuilder.types.string("characterCamo"), PhotonPacketBuilder.types.byte(0)],
      [PhotonPacketBuilder.types.string("bulletTracerColor"), PhotonPacketBuilder.types.byte(1)],
      [PhotonPacketBuilder.types.string("glovesCamo"), PhotonPacketBuilder.types.byte(16)],
      [PhotonPacketBuilder.types.string("unlockedweapons"), PhotonPacketBuilder.types.array(0x69, [
        PhotonPacketBuilder.types.integer(0),
        PhotonPacketBuilder.types.integer(0),
        PhotonPacketBuilder.types.integer(0),
      ])],
      [PhotonPacketBuilder.types.string("current_kills_in_killstreak"), PhotonPacketBuilder.types.integer(0)],
      [PhotonPacketBuilder.types.string("kd"), PhotonPacketBuilder.types.float(8.511835098266602)],
      [PhotonPacketBuilder.types.string("perks"), PhotonPacketBuilder.types.byteArray(perksArray)],
      [PhotonPacketBuilder.types.string("current_vehicle_view_id"), PhotonPacketBuilder.types.integer(4294967295)],
      [PhotonPacketBuilder.types.string("up_to_date_version"), PhotonPacketBuilder.types.string("1.104.5_HC")],
      [PhotonPacketBuilder.types.string("throwable_type"), PhotonPacketBuilder.types.integer(12)],
      [PhotonPacketBuilder.types.string("throwable_amount"), PhotonPacketBuilder.types.integer(3)],
      [PhotonPacketBuilder.types.string("nextCreateRoomPass"), PhotonPacketBuilder.types.string("")],
      [PhotonPacketBuilder.types.byte(255), PhotonPacketBuilder.types.string(`${this.generateClanTag()} ${this.account.username}`)],
    ]);
    
    packet.addParam(249, hashtable249);
    packet.addParam(250, PhotonPacketBuilder.types.boolean(true));

    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);
  }

  /**
   * Sends join notification
   */
  sendJoinNotify() {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.RaiseEvent)
      .addParam(244, PhotonPacketBuilder.types.byte(252))
      .addParam(245, PhotonPacketBuilder.types.hashTable([
        [PhotonPacketBuilder.types.byte(250), PhotonPacketBuilder.types.boolean(true)],
        [PhotonPacketBuilder.types.byte(251), PhotonPacketBuilder.types.string(`${this.generateClanTag()} ${this.account.username}`)],
        [PhotonPacketBuilder.types.byte(254), PhotonPacketBuilder.types.byte(292)],
      ]))
      .addParam(246, PhotonPacketBuilder.types.byte(1));

    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);
  }

  // Idk why this doesn't work
  spawnPlayer() {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.RaiseEvent)
      .addParam(244, PhotonPacketBuilder.types.byte(200))
      .addParam(245, PhotonPacketBuilder.types.hashTable([
        [PhotonPacketBuilder.types.byte(0), PhotonPacketBuilder.types.integer(parseInt(this.lastActorNr.toString() + "001"))],
        [PhotonPacketBuilder.types.byte(2), PhotonPacketBuilder.types.integer(this.serverTime())],
        [PhotonPacketBuilder.types.byte(5), PhotonPacketBuilder.types.integer(87)],
        [PhotonPacketBuilder.types.byte(4), PhotonPacketBuilder.types.vector3(55.17207336425781, 0.09000000357627869, 62.27178955078125)],
      ]))
      .addParam(246, PhotonPacketBuilder.types.byte(1));

    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);
  }

  /**
   * Sends auth token
   * @param {string} token - Auth token
   */
  sendAuthToken(token) {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.RaiseEvent)
      .addParam(244, PhotonPacketBuilder.types.byte(200))
      .addParam(245, PhotonPacketBuilder.types.hashTable([
        [PhotonPacketBuilder.types.byte(0), PhotonPacketBuilder.types.integer(parseInt(this.lastActorNr.toString() + "001"))],
        [PhotonPacketBuilder.types.byte(2), PhotonPacketBuilder.types.integer(this.serverTime())],
        [PhotonPacketBuilder.types.byte(4), PhotonPacketBuilder.types.objectArray([PhotonPacketBuilder.types.string(token)])],
        [PhotonPacketBuilder.types.byte(5), PhotonPacketBuilder.types.byte(88)],
      ]))
      .addParam(246, PhotonPacketBuilder.types.byte(1));

    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);
  }

  /**
   * Sends unknown packet (keeping original name from source)
   */
  idkWhatPacketThisIs() {
    this.gameSocket.send(
      this.base64toUint8Array("8wL8AAP7aAABYv9zAA5bXVBDLU5leHRUb1lvdf5pAAAAI/pvAQ==").buffer
    );
  }

  /**
   * Sends player body packet to show bot in game
   */
  sendPlayerBodyPacket() {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.RaiseEvent)
      .addParam(244, PhotonPacketBuilder.types.byte(202))
      .addParam(245, PhotonPacketBuilder.types.hashTable([
        [PhotonPacketBuilder.types.byte(0), PhotonPacketBuilder.types.string("PlayerBody")],
        [PhotonPacketBuilder.types.byte(6), PhotonPacketBuilder.types.integer(this.serverTime())],
        [PhotonPacketBuilder.types.byte(7), PhotonPacketBuilder.types.integer(parseInt(this.lastActorNr.toString() + "001"))],
      ]));

    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);

    const packet2 = PhotonPacketBuilder.createRequest(OperationCode.RaiseEvent)
      .addParam(244, PhotonPacketBuilder.types.byte(252))
      .addParam(250, PhotonPacketBuilder.types.boolean(true))
      .addParam(251, PhotonPacketBuilder.types.string("MeowEngine Bot Panel"))
      .addParam(245, PhotonPacketBuilder.types.integer(292));

    const bufferData2 = packet2.toBuffer();
    this.gameSocket.send(bufferData2);
  }

  // Craft the packet from your JSON structure
  sendCraftedPacket(socket) {
    const packet = PhotonPacketBuilder.createRequest(253) // op_code from your JSON
      .addParam(244, PhotonPacketBuilder.types.byte(200))
      .addParam(245, PhotonPacketBuilder.types.hashTable([
        [PhotonPacketBuilder.types.byte(0), PhotonPacketBuilder.types.integer(2)],
        [PhotonPacketBuilder.types.byte(2), PhotonPacketBuilder.types.integer(2853182596)],
        [PhotonPacketBuilder.types.byte(5), PhotonPacketBuilder.types.byte(73)],
      ]));

    const bufferData = packet.toBuffer();
    socket.send(bufferData);
  }

  // Leave room packet
  sendLeaveRoomPacket() {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.Leave)
      .addParam(245, PhotonPacketBuilder.types.boolean(true)); // willComeBack parameter

    const bufferData = packet.toBuffer();
    this.gameSocket.send(bufferData);
  }

  leaveRoom() {
    this.sendLeaveRoomPacket();
  }

  /**
   * Sets up lobby socket event handlers
   */
  setupLobbySocket() {
    this.lobbySocket.onopen = () => {
      this.botLog("Connected to LobbyServer!");
      this.sendPing(this.lobbySocket);
    };

    this.lobbySocket.onmessage = (evt) => {
      const uint8Array = new Uint8Array(evt.data);
      let protocol = new ProtocolReader(uint8Array.buffer);
      let packet = protocol.readPacket();

      if (packet.code == PacketType.InitResponse) {
        this.botLog("InitResponse received!");
        this.sendAuthParams();
      }

      if (packet.code == OperationCode.Authenticate) {
        if (packet.params["222"]) {
          const rooms = this.filterRoomsWithIdOnly(Object.keys(packet.params['222']));

          if (this.isInRoom) return;
          
          if (this.gameRoomName) {
            // Join specific room if set
            this.isInRoom = true;
            setTimeout(() => {
              this.botLog("Joining room:", this.gameRoomName);
              this.joinRoomFromLobby(this.gameRoomName);
            }, 1000);
          }
        }

        if (this.authToken == "") {
          this.botLog("AuthResponse received!");
          this.botLog("AuthToken", packet.params["221"]);
          this.botLog("UserId", packet.params["225"]);
          this.authToken = packet.params["221"];
        }

        this.sendJoinLobby(this.lobbySocket);
      }

      if (packet.code == EventCode.AppStats) {
        if (packet.debugMessage == "Game does not exists") {
          this.botLog("Game does not exist, exiting...");
          return;
        }
        
        if (this.serverAddress == "") {
          if (packet.params["230"]) {
            this.serverAddress = packet.params["230"];
            this.botLog("Server address:", this.serverAddress);
            this.botLog("Received join room response!");
            this.connectToGameServer();
          }
        }
      }
    };
  }

  /**
   * Sets up game socket event handlers
   */
  setupGameSocket() {
    this.gameSocket.onclose = (event) => {
      this.botLog("Game connection closed:", event.code, event.reason);
    };

    this.gameSocket.onopen = () => {
      this.lobbySocket.close();
      this._startTime = new Date();
      this._lastPing = new Date(0);
      this._serverTickOffset = 0;

      this.botLog("Connected to Game Server!");
      this.botLog("Joining room", this.gameRoomName);

      this.sendPing(this.gameSocket);
      this.pingLoop(this.gameSocket);
    };

    this.gameSocket.onmessage = async (evt) => {
      const uint8Array = new Uint8Array(evt.data);
      let protocol = new ProtocolReader(uint8Array.buffer);
      let packet = protocol.readPacket();

      if (packet.code == OperationCode.JoinGame && packet.params["249"]) {
        if (this.isInGame) return;
        this.isInGame = true;

        for (const [key, value] of Object.entries(packet.params["249"])) {
          if (!key.startsWith("int32")) continue;

          let actorNr = key.split(" ")[1];
          actorNr = parseInt(actorNr);

          const name = this.cleanUsername(value["int8 255"] ?? "Unknown");
          let rank = parseInt(value.rank?.value ?? 0);
          const kd = value.kd?.value ?? 0;
          let team = parseInt(value.teamNumber?.value ?? 0);
          let kills = parseInt(value.current_kills_in_killstreak?.value ?? 0);
          const platform = value.platform ?? "Unknown";

          const usrEntry = {};
          usrEntry[actorNr] = { name, actorNr, rank, kd, team, kills, platform };
          this.players.push(usrEntry);
        }

        this.botLog("Players:", this.players);
      }

      if (packet.code == PacketType.InitResponse) {
        this.sendGameAuth(this.authToken);
      }

      if (packet.code == OperationCode.Authenticate) {
        this.botLog("Received game auth");
        this.sendJoinRoomWithProperties(this.gameRoomName);
        this.idkWhatPacketThisIs();
      }

      if (packet.code == 255 && packet.params['249'] && packet.params["254"]) {
        let authCode = await this.getAuthCode();
        this.botLog("Using AuthCode:", authCode);
        this.lastActorNr = packet.params["254"].toString().split("int32 ")[1];
        this.botLog(`Received actorNr: ${this.lastActorNr}`);
        
        this.sendJoinNotify();
        this.sendAuthToken(authCode);

        if (this.alreadyJoined) return;
        
        if (this.showJoinMessageInChat) {
          this.sendPlayerBodyPacket();
        }

        this.alreadyJoined = true;
      }
    };
  }

  /**
   * Connects to game server
   */
  connectToGameServer() {
    this.gameSocket = new WebSocket(this.serverAddress, "GpBinaryV16");
    this.photonClient = new PhotonClient(this.gameSocket);
    this.setupGameSocket();
  }

  /**
   * Sends join room packet to lobby
   * @param {string} roomName - Room name to join
   */
  joinRoomFromLobby(roomName) {
    const packet = PhotonPacketBuilder.createRequest(OperationCode.JoinGame)
      .addParam(255, PhotonPacketBuilder.types.string(roomName));
    const bufferData = packet.toBuffer();
    this.lobbySocket.send(bufferData);
  }

  /**
   * Main method to join a room
   * @param {string} roomName - Name of the room to join
   * @returns {Promise<void>}
   */
  async joinRoom(roomName) {
    if (!this.account) {
      await this.generateAccount();
    }

    this.gameRoomName = roomName;
    this.lastActorNr += 1;

    // Create lobby socket connection
    this.lobbySocket = new WebSocket(
      `wss://game-ca-1.blayzegames.com:2053/?libversion=4.1.6.10&sid=30&app=`,
      "GpBinaryV16"
    );

    this.setupLobbySocket();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 30000);

      const originalOnMessage = this.gameSocket?.onmessage;
      if (this.gameSocket) {
        this.gameSocket.onmessage = (evt) => {
          if (originalOnMessage) originalOnMessage(evt);
          if (this.alreadyJoined) {
            clearTimeout(timeout);
            resolve();
          }
        };
      }
    });
  }
}

module.exports = PhotonBot;