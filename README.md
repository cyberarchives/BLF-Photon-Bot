# Bullet Force Bots - Open Source Release

## Overview
This repository contains bot implementations for the mobile game **Bullet Force**, originally developed for the PhotonPUN (Protocol16) networking system. These bots are now being released as open source due to significant changes in the game's infrastructure.

## Why I'm Releasing These Bots

### Game Infrastructure Changes
Bullet Force has undergone a major networking overhaul, migrating from **PhotonPUN (Protocol16)** to **Fishnet Networking**. This fundamental change means:

- The existing bot implementations are no longer compatible with the current game version
- The Protocol16-based communication system these bots were built for is obsolete
- Significant rewriting would be required to adapt to the new networking stack

### Personal Development Journey
After spending considerable time developing and refining these bots, I've decided to move on to other projects and games. Rather than letting this work sit unused, I believe the community can benefit from:

- Learning from the implementation approaches used
- Understanding game networking concepts through practical examples
- Building upon this foundation for educational purposes

## Project Structure

The codebase includes several key components:

- **PhotonUtils** - Core utilities for Photon networking integration
- **protocol_reader** - Protocol parsing and message handling
- **typed_wrappers** - Type-safe wrappers for game data structures
- **Account.js** - User account management functionality
- **PhotonBot.js** - Main bot implementation using PhotonPUN
- **PhotonClient.js** - Client connection and communication handling
- **protocol_reader.js** - JavaScript implementation of protocol parsing
- **ProxyAgent.js** - Network proxy functionality for bot operations
- **t.js** - Utility functions and helpers

## Technical Background

These bots were designed to work with Bullet Force's original networking architecture:
- **PhotonPUN**: Unity's real-time multiplayer networking solution
- **Protocol16**: Photon's binary protocol for efficient data transmission
- **Real-time synchronization**: Player movements, actions, and game state updates

## Important Disclaimers

⚠️ **Educational Purpose Only**: This code is released for educational and research purposes. Users should respect game terms of service and fair play principles.

⚠️ **Outdated Implementation**: This code targets the legacy PhotonPUN version of Bullet Force and will not work with current game versions using Fishnet Networking.

⚠️ **No Support**: As I've moved on from this project, no ongoing support or updates will be provided.

## Learning Opportunities

This codebase demonstrates:
- Real-time game networking concepts
- Protocol parsing and message handling
- Client-server communication patterns
- Game state synchronization techniques
- JavaScript/Node.js networking implementations

## License

This project is released under [insert your preferred license]. Feel free to learn from, modify, and build upon this work while respecting the educational nature of this release.

## Final Notes

Game development and reverse engineering are valuable learning experiences. While these specific implementations are no longer viable for their original purpose, the concepts and techniques demonstrated here remain relevant for understanding multiplayer game networking.

If you're interested in similar projects or have questions about game networking concepts, feel free to explore the code and learn from the approaches used.

---

*Last updated: May 2025*
*Original development period: 2025*
