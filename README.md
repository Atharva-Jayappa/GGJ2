# 🕵️‍♀️ Protocol: UNMASK

> **A Social Co-op Heist Game | Global Game Jam USC**



**Protocol: UNMASK** is a massive multiplayer party game played with smartphones. Players take on the role of cyberpunk operatives who must physically find their squadmates in a crowd, sync their devices, and execute a high-stakes digital heist together.

Built with **React**, **Socket.io**, and **Device Motion API**, the game bridges the digital and physical worlds, requiring players to communicate verbally and coordinate physically to win.

---

## 🎮 Gameplay Loop

The game is controlled by a central **Game Master (GM)** screen (projected on a wall/TV) while 4-50+ players join via their smartphones.

### Phase 1: Identity Registration (Lobby)
* **The Mask:** Players join the lobby and draw a unique "face mask" on their phone canvas.
* **The Tell:** Players answer a randomly generated prompt (e.g., *"My secret talent is..."*).
* **Result:** This creates a digital dossier for every player.

### Phase 2: Network Formation (The Chain)
* **Target Acquisition:** Upon game start, players are sorted into squads (Circular Linked Lists).
* **The Hunt:** Your phone shows you a drawing and a "tell" of *another* player in the room. You must physically find them.
* **The Link:** Once found, you "scan" them (hold-to-confirm interaction). This forms a verified chain of trust, physically grouping the squad together.

### Phase 3: The Heist (Mini-Games)
Once the squad is linked, they must complete synchronized mini-games to hack the mainframe:
1. **Signal Jammer (Logic):** A logic puzzle where every player receives a *different* clue (e.g., *"The symbol is not red"*). Players must communicate verbally to deduce the correct symbol.
2. **The Tumbler (Physical Sync):** Utilizing the **DeviceOrientation API** (gyroscope), players must tilt their phones to find a hidden "sweet spot" angle. The catch? **ALL** squad members must hold their sweet spot simultaneously for 3 seconds to crack the vault.
3. **The Getaway (Code Cracking):** Each player receives a fragment of the extraction code (e.g., Player A gets 'A', Player B gets '3'). They must combine their intel to input the final code.

---

## 🛠️ Tech Stack

### Frontend (Client)
* **Framework:** React 19 + Vite (TypeScript)
* **State Management:** Zustand (for lightweight, transient game state)
* **Styling:** TailwindCSS + Framer Motion (for complex animations and transitions)
* **Canvas:** HTML5 Canvas API (for the drawing feature)
* **Sensors:** DeviceOrientation API (for the Tumbler mini-game)

### Backend (Server)
* **Runtime:** Node.js (Express)
* **Real-time:** Socket.io (Bi-directional event-based communication)
* **Architecture:**
  * **GameManager:** Central orchestrator handling phase transitions and global state.
  * **Squad:** Class handling circular linked list logic and mini-game validation per group.
* **Deployment:** Capable of handling 50+ concurrent connections with low latency.

---

## 📂 Project Structure

```bash
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/game # Player views (Lobby, Scanner, Tumbler, etc.)
│   │   ├── components/gm   # Game Master dashboard views
│   │   ├── store/          # Zustand state store
│   │   └── hooks/          # Custom hooks (useSocket)
│   └── vite.config.ts      # Vite proxy config
│
└── server/                 # Node.js Backend
    ├── src/
    │   ├── GameManager.js  # Main game loop logic
    │   ├── Squad.js        # Squad & Linked List logic
    │   └── index.js        # Socket.io entry point
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* npm or yarn
* Two devices (Laptop for GM view, Phone for Player view) connected to the same Wi-Fi.

### Installation

Clone the repo:
```bash
git clone https://github.com/your-username/ggj2-protocol-unmask.git
cd ggj2-protocol-unmask
```

Setup Server:
```bash
cd server
npm install
npm run dev
# Server starts on http://localhost:3001
```

Setup Client:
```bash
cd ../client
npm install
npm run dev
# Client starts on http://localhost:5001
```

### How to Test Locally
* Open http://localhost:5001/central-command in one browser tab (Game Master View).
* Open http://localhost:5001 in a new window (incognito recommended) to simulate Player 1.
* Open more incognito windows to simulate Player 2, 3, 4.
* On the GM View, click **"Start Chain"** once enough players have joined.

---

## 💡 Key Technical Features

### 🔄 Circular Linked List Squads
The backend organizes players into squads using a circular linked list structure. Player A targets Player B, B targets C, and C targets A. The server validates "scans" to ensure the physical loop is closed before unlocking the heist phase.

### 📱 Gyroscope Synchronization (Tumbler.tsx)
We use the browser's DeviceOrientationEvent to track the phone's physical beta/gamma rotation.

```ts
// Simplified logic from Tumbler.tsx
const handleOrientation = (event: DeviceOrientationEvent) => {
  const angle = ((event.gamma * 2) + (event.beta * 0.5) + 180) % 360;
  // Check if angle matches the server-assigned "sweet spot"
  const isSweet = Math.abs(angle - sweetSpotAngle) < tolerance;
  socket.emit('tumbler_state', { atSweetSpot: isSweet });
};
```

The server monitors these streams and only triggers success when  
`connectedPlayers === playersAtSweetSpot` for a continuous 3-second window.

### 🎨 Cyberpunk UI System
Custom CSS animations simulate CRT scanlines, screen shake, and "glitch" effects using pure CSS and Framer Motion, creating an immersive hacker aesthetic without heavy asset loads.

---

**Protocol: UNMASK** was created in 48 hours for Global Game Jam.  

