# Protocol: UNMASK

A multiplayer social deduction party game built with React and Socket.io.

## Overview

Protocol: UNMASK is a real-time multiplayer game where players create identities, form squads, and complete heist objectives together. The game uses WebSocket connections for real-time communication between players and a game master view.

## Project Architecture

```
├── client/                 # React + Vite frontend
│   ├── src/               # React source code
│   ├── vite.config.ts     # Vite configuration (port 5000)
│   └── package.json       # Client dependencies
├── server/                # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── index.js       # Server entry point (port 3001)
│   │   ├── GameManager.js # Game state management
│   │   └── Squad.js       # Squad logic
│   └── package.json       # Server dependencies
└── replit.md              # This file
```

## Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Socket.io-client
- **Backend**: Node.js, Express 5, Socket.io
- **State Management**: Zustand

## Running the Application

Two workflows run concurrently:
1. **Backend Server**: `cd server && npm run dev` (port 3001)
2. **Frontend**: `cd client && npm run dev` (port 5000, exposed to users)

The frontend proxies Socket.io requests to the backend server.

## Game Features

- Player identity registration with drawing canvas
- Real-time multiplayer with WebSocket connections
- Squad formation and activation
- Multiple minigames (Signal Jammer, Tumbler Lock, Getaway)
- Game Master view for controlling game phases
