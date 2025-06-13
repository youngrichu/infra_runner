🔧 Fix high-speed collision detection & enhance solar power gameplay

## Critical Fixes
- **Fix collision tunneling at high speeds** - Prevents game-breaking issue at expo
  - Implement continuous collision detection with swept collision algorithm  
  - Add predictive collision for very high speeds (>0.2 units/frame)
  - Create position tracking system for movement path analysis
  - Enhanced collectable collection with speed-based radius expansion
  - Configurable collision parameters moved to constants

## Gameplay Enhancements  
- **Add solar orb collectibles** - Makes solar power actually rewarding
  - Create glowing energy orbs with light rays and pulsing animation
  - Spawn during solar boost (3% chance) similar to aerial stars system
  - Only collectable when solar boost active, auto-cleanup when ends
  - Worth 120 points each, providing immediate reward for power-up usage

## Technical Improvements
- New collision-utils.js with advanced collision detection utilities
- Enhanced obstacle and collectable collision systems
- Improved power-up cleanup and state management  
- Updated game instructions with new special collectibles

## Files Modified
- collision-utils.js (NEW) - Advanced collision detection system
- obstacles.js - Integrated swept collision detection
- collectables.js - Enhanced collision + new solar orb collectible
- powerups.js - Added solar orb cleanup on power-up end
- game.js - Solar orb spawning and scoring logic
- constants.js - New collision physics constants and solar orb config
- index.html - Updated instructions for new features
- project_status.md - Progress tracking

## Impact
- Overall completion: 35% → 45%
- Core mechanics: 80% → 85% 
- Collection systems: 70% → 80%
- Risk level: Medium → Low (critical collision issue resolved)

Ready for expo Day 1 visual improvements phase.
