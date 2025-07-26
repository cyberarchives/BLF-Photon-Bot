const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cors = require('cors'); // Add this import

// Import PhotonBot class
const PhotonBot = require('./bot/PhotonBot'); // Adjust path as needed

const app = express();

// CORS configuration - Add this before other middleware
const corsOptions = {
  origin: '*', // Allow all origins for development. In production, specify your frontend domain
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Static file serving
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve panel.html at /panel
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

// Serve style.css at root
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

// In-memory storage for bot instances
const botInstances = new Map();

// Helper function to get bot instance
const getBotInstance = (botId) => {
  const bot = botInstances.get(botId);
  if (!bot) {
    throw new Error(`Bot with ID ${botId} not found`);
  }
  return bot;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeBots: botInstances.size
  });
});

// Create a new bot instance
app.post('/api/bots', async (req, res) => {
  try {
    const bot = new PhotonBot();
    
    // Configure bot settings
    if (req.body.showJoinMessageInChat !== undefined) {
      bot.showJoinMessageInChat = req.body.showJoinMessageInChat;
    }
    
    // Generate account for the bot
    const account = await bot.generateAccount();
    
    // Store bot instance
    botInstances.set(bot.botId, bot);
    
    res.status(201).json({
      botId: bot.botId,
      account: account,
      message: 'Bot created successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create bot',
      message: error.message
    });
  }
});

// Get all bot instances
app.get('/api/bots', (req, res) => {
  const bots = Array.from(botInstances.entries()).map(([botId, bot]) => ({
    botId,
    account: bot.account ? {
      username: bot.account.username
    } : null,
    isInGame: bot.isInGame,
    isInRoom: bot.isInRoom,
    gameRoomName: bot.gameRoomName,
    playerCount: bot.players.length,
    showJoinMessageInChat: bot.showJoinMessageInChat
  }));
  
  res.json({
    bots,
    totalCount: bots.length
  });
});

// Get specific bot details
app.get('/api/bots/:botId', (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    
    res.json({
      botId: bot.botId,
      account: bot.account ? {
        username: bot.account.username
      } : null,
      isInGame: bot.isInGame,
      isInRoom: bot.isInRoom,
      gameRoomName: bot.gameRoomName,
      playerCount: bot.players.length,
      showJoinMessageInChat: bot.showJoinMessageInChat,
      serverAddress: bot.serverAddress,
      lastActorNr: bot.lastActorNr
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Join a room with a specific bot
app.post('/api/bots/:botId/join-room', async (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    const { roomName } = req.body;
    
    if (!roomName || roomName.trim() === '') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'roomName is required'
      });
    }
    
    if (bot.isInRoom) {
      return res.status(400).json({
        error: 'Bot already in room',
        message: `Bot is already in room: ${bot.gameRoomName}`
      });
    }
    
    // Start joining room (this is async)
    bot.joinRoom(roomName).catch(error => {
      console.error(`Bot ${bot.botId} failed to join room:`, error);
    });
    
    res.json({
      message: `Bot ${bot.botId} is joining room: ${roomName}`,
      botId: bot.botId,
      roomName: roomName
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Spawn the bot in
app.post('/api/bots/:botId/spawn', async (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);

    if (bot.isInRoom) {
      bot.spawnPlayer();
    }
    
    res.json({
      message: `Bot ${bot.botId} was spawned in successfully!`,
      botId: bot.botId
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Get all players from a specific bot
app.get('/api/bots/:botId/players', (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    const players = bot.getAllPlayers();
    
    res.json({
      botId: bot.botId,
      roomName: bot.gameRoomName,
      players: players,
      playerCount: players.length,
      isInGame: bot.isInGame
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Get all players from all bots
app.get('/api/players', (req, res) => {
  const allPlayers = [];
  
  for (const [botId, bot] of botInstances.entries()) {
    const players = bot.getAllPlayers();
    allPlayers.push({
      botId,
      roomName: bot.gameRoomName,
      players: players,
      playerCount: players.length,
      isInGame: bot.isInGame
    });
  }
  
  res.json({
    bots: allPlayers,
    totalBots: allPlayers.length,
    totalPlayers: allPlayers.reduce((sum, bot) => sum + bot.playerCount, 0)
  });
});

// Delete a bot instance
app.delete('/api/bots/:botId', (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    
    // Clean up connections
    if (bot.lobbySocket) {
      bot.lobbySocket.close();
    }
    if (bot.gameSocket) {
      bot.gameSocket.close();
    }
    
    // Remove from storage
    botInstances.delete(req.params.botId);
    
    res.json({
      message: `Bot ${req.params.botId} deleted successfully`,
      botId: req.params.botId
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Update bot settings
app.patch('/api/bots/:botId', (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    
    if (req.body.showJoinMessageInChat !== undefined) {
      bot.showJoinMessageInChat = req.body.showJoinMessageInChat;
    }
    
    res.json({
      message: 'Bot settings updated successfully',
      botId: bot.botId,
      settings: {
        showJoinMessageInChat: bot.showJoinMessageInChat
      }
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Get bot status/statistics
app.get('/api/bots/:botId/status', (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    
    res.json({
      botId: bot.botId,
      status: {
        isInGame: bot.isInGame,
        isInRoom: bot.isInRoom,
        alreadyJoined: bot.alreadyJoined,
        gameRoomName: bot.gameRoomName,
        serverAddress: bot.serverAddress,
        lastActorNr: bot.lastActorNr,
        playerCount: bot.players.length,
        uptime: Date.now() - bot._startTime.getTime(),
        serverTime: bot.serverTime()
      }
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Leave current room (disconnect bot)
app.post('/api/bots/:botId/leave-room', (req, res) => {
  try {
    const bot = getBotInstance(req.params.botId);
    
    if (!bot.isInRoom && !bot.isInGame) {
      return res.status(400).json({
        error: 'Bot not in room',
        message: 'Bot is not currently in any room'
      });
    }
    
    if (bot.gameSocket) {
      bot.leaveRoom();
    }
    
    // Reset bot state
    bot.isInGame = false;
    bot.isInRoom = false;
    bot.alreadyJoined = false;
    bot.gameRoomName = "";
    bot.serverAddress = "";
    bot.players = [];
    
    res.json({
      message: `Bot ${bot.botId} left the room successfully`,
      botId: bot.botId
    });
  } catch (error) {
    res.status(404).json({
      error: 'Bot not found',
      message: error.message
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down gracefully`);
  
  // Close all bot connections
  for (const [botId, bot] of botInstances.entries()) {
    try {
      if (bot.lobbySocket) bot.lobbySocket.close();
      if (bot.gameSocket) bot.gameSocket.close();
    } catch (err) {
      console.error(`Error closing bot ${botId}:`, err);
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = () => {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  
  app.listen(port, host, () => {
    console.log(`PhotonBot API Server is running on http://${host}:${port}`);
    console.log('Available endpoints:');
    console.log('  POST /api/bots - Create new bot');
    console.log('  GET /api/bots - Get all bots');
    console.log('  GET /api/bots/:botId - Get specific bot');
    console.log('  POST /api/bots/:botId/join-room - Join room');
    console.log('  GET /api/bots/:botId/players - Get bot players');
    console.log('  GET /api/players - Get all players from all bots');
    console.log('  DELETE /api/bots/:botId - Delete bot');
  });
};

start();