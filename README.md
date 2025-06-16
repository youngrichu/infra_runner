# Infrastructure Runner Game - Refactored

A 3D endless runner game built with Three.js, featuring infrastructure-themed obstacles and power-ups.

## 🎮 Game Features

- **Endless runner gameplay** with increasing difficulty
- **Power-up system** with 5 unique abilities
- **Infrastructure theme** with construction obstacles and collectibles
- **Responsive controls** with keyboard and optional mobile support
- **Score system** tracking blueprints, water drops, and energy cells

## 📁 Project Structure

```
infra-runner/
├── index.html              # Main HTML file
├── js/
│   ├── constants.js         # Game constants and configuration
│   ├── player.js           # Player character logic
│   ├── environment.js      # Scene, lighting, buildings, ground
│   ├── obstacles.js        # Obstacle spawning and management
│   ├── collectables.js     # Collectibles and power-up items
│   ├── powerups.js         # Power-up activation and effects
│   ├── ui.js              # User interface and scoring
│   ├── input.js           # Keyboard and mobile input handling
│   └── game.js            # Main game controller and loop
└── README.md              # This file
```

## 🚀 Setup Instructions

1. **Create the directory structure:**
   ```bash
   mkdir -p C:/Users/richu/Documents/Programming/infra-runner/js
   cd C:/Users/richu/Documents/Programming/infra-runner
   ```

2. **Save the files:**
   - Save each artifact as the corresponding file in the structure above
   - Make sure all `.js` files go in the `js/` folder
   - Save `index.html` in the root directory

3. **Serve the files:**
   Since the project uses ES6 modules, you need to serve it from a local server:
   
   **Option A: Using Python (if installed)**
   ```bash
   python -m http.server 8000
   ```
   
   **Option B: Using Node.js Live Server (if installed)**
   ```bash
   npx live-server
   ```
   
   **Option C: Using any local web server**
   - VS Code Live Server extension
   - XAMPP, WAMP, or similar

4. **Open in browser:**
   Navigate to `http://localhost:8000` (or whatever port your server uses)

## 🎮 How to Play

### Controls
- **Arrow Keys** or **WASD**: Move left/right and jump
- **Spacebar**: Jump (alternative)
- **R**: Restart game when game over

### Collectibles
- **🔵 Blueprints** (50 points): Essential construction plans
- **💧 Water Drops** (20 points): Water infrastructure components  
- **⚡ Energy Cells** (30 points): Power grid components
- **⭐ Aerial Stars** (150 points): Special high-altitude collectibles (only when flying)

### Power-ups
- **🛡️ Hard Hat Shield** (5s): Temporary invincibility
- **🚁 Helicopter Ride** (10s): Fly above obstacles and collect aerial stars
- **🌟 Solar Power Boost** (8s): Increased speed and magnetic collection
- **💨 Wind Power** (15s): Double jump ability
- **🚰 Water Pipeline** (12s): Safe path that clears obstacles

### Obstacles
- **Potholes**: Low road damage
- **Construction Barriers**: Medium height barriers
- **Traffic Cones**: Medium obstacles
- **Rubble**: Construction debris

## 🔧 Customization

### Adjusting Game Difficulty
Edit `constants.js`:
- `GAME_CONFIG.INITIAL_SPEED`: Starting game speed
- `GAME_CONFIG.SPEED_INCREMENT`: How fast the game accelerates
- `SPAWN_CONFIG.OBSTACLE_MIN_DISTANCE`: Minimum space between obstacles

### Changing Colors
Edit the `COLORS` object in `constants.js`:
- `PLAYER`: Player colors for different states
- `OBSTACLES`: Obstacle colors
- `COLLECTABLES`: Collectible colors
- `ENVIRONMENT`: Sky and road colors

### Power-up Durations
Edit `POWER_UP_DURATIONS` in `constants.js`:
- All durations are in milliseconds
- Adjust individual power-up times

### Scoring System
Edit `SCORING` in `constants.js`:
- Point values for different collectibles
- Score rates for normal and boosted play

## 🛠️ Architecture Benefits

### Modular Design
- **Easy debugging**: Each component is isolated
- **Maintainable**: Changes to one system don't affect others
- **Extensible**: Add new features without touching existing code
- **Testable**: Each module can be tested independently

### Component Responsibilities
- **Constants**: Centralized configuration
- **Player**: Character movement and physics
- **Environment**: World building and scene management
- **Obstacles**: Challenge generation and collision
- **Collectables**: Item spawning and collection logic
- **PowerUps**: Special ability system
- **UI**: User interface and feedback
- **Input**: Control handling and responsiveness
- **Game**: Coordination and main loop

## 🐛 Debugging Tips

1. **Console Logs**: Each module includes helpful console output
2. **Browser DevTools**: Use F12 to see any errors
3. **Module Issues**: Ensure all files are in correct directories
4. **Server Required**: Must serve from HTTP server, not file:// protocol

## 📱 Mobile Support

The game includes optional mobile controls. Touch controls are automatically enabled on mobile devices with virtual buttons for movement and jumping.

## 🚀 Future Enhancements

- Sound effects and background music
- Particle systems for enhanced visual effects
- Multiple environments/themes
- Leaderboard system
- Achievement system
- Level progression with different challenges

## 📄 License

This project is open source and available under the MIT License.