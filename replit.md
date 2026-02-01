# Protocol: UNMASK

A multiplayer social deduction party game built with React and Socket.io, designed for hackathons with 100+ concurrent players.

## Overview

Protocol: UNMASK is a real-time multiplayer party game where players create identities, form teams, and complete heist objectives together. The game uses WebSocket connections for real-time communication between players and a game master (Central Command) view.

## Project Architecture

```
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── gm/        # Game Master views
│   │   │   ├── game/      # Player game views
│   │   │   └── ui/        # Reusable UI components
│   │   ├── store/         # Zustand state management
│   │   └── hooks/         # Custom React hooks
│   ├── vite.config.ts     # Vite configuration (port 5000)
│   └── package.json       # Client dependencies
├── server/                # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── index.js       # Server entry point (port 3001)
│   │   ├── GameManager.js # Game state management
│   │   └── Squad.js       # Squad/team logic
│   └── package.json       # Server dependencies
└── replit.md              # This file
```

## Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Socket.io-client
- **Backend**: Node.js, Express 5, Socket.io (optimized for 100+ connections)
- **State Management**: Zustand

## Running the Application

Two workflows run concurrently:
1. **Backend Server**: `cd server && npm run dev` (port 3001)
2. **Frontend**: `cd client && npm run dev` (port 5000, exposed to users)

The frontend proxies Socket.io requests to the backend server.

## Game Phases

1. **Start**: Intro screen with Protocol: UNMASK branding
2. **Tutorial**: Optional YouTube briefing video for newcomers
3. **Lobby**: Players join and register identities (QR code + drawing + tell)
4. **Chain**: Players find their assigned targets using drawings and descriptions
5. **Heist**: Team minigames (Signal Jammer, Tumbler Lock)
6. **Getaway**: Final escape phase
7. **Complete**: Game results

## Game Features

- Intro screen with tutorial toggle for new players
- Configurable team sizes (2-10 players) with server-side validation
- Player identity registration with drawing canvas and prompts
- Real-time multiplayer with WebSocket connections (100+ players)
- Circular chain-building where each player finds their target
- Multiple minigames (Signal Jammer, Tumbler Lock, Getaway)
- Game Master (Central Command) view with live player count and drawing mosaic

## Routes

- `/` - Player game view
- `/central-command` - Game Master control panel

## Recent Changes (Feb 2026)

- Added intro screen with INITIATE and BRIEFING buttons
- Implemented configurable team size (2-10) with increment/decrement controls
- Added server-side validation for team size divisibility before starting chain phase
- Updated Squad.js to enforce exact team sizes (no overflow)
- Integrated YouTube tutorial briefing modal
- Optimized Socket.io for 100+ concurrent players
- **Fixed team isolation**: Each team now operates independently
  - Squad advance only affects the player's own squad
  - Tumbler and fragment assignments are per-squad, not global
  - START HEIST button requires ALL team members to confirm scans
  - WaitingView shows scanned target's prompt and image
  - Real-time progress tracking (X/Y teammates ready)
  - Global state properly cleared on game reset
