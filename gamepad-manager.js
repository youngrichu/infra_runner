// Modern Gamepad Manager for Cross-Platform Controller Support
// Supports Xbox, PlayStation, Nintendo Switch Pro, and generic controllers

export class GamepadManager {
    constructor() {
        this.gamepads = new Map();
        this.connectedGamepads = new Set();
        this.inputState = new Map();
        this.previousInputState = new Map();
        
        // Input configuration
        this.deadzone = 0.15;
        this.triggerThreshold = 0.1;
        
        // Button mappings for different controller types
        this.buttonMappings = {
            // Standard Gamepad mapping (most controllers)
            standard: {
                // Face buttons
                0: 'jump',           // A/Cross
                1: 'action',         // B/Circle  
                2: 'special',        // X/Square
                3: 'menu',           // Y/Triangle
                
                // Shoulder buttons
                4: 'powerUp1',       // LB/L1
                5: 'powerUp2',       // RB/R1
                6: 'restart',        // LT/L2 (trigger)
                7: 'pause',          // RT/R2 (trigger)
                
                // Special buttons
                8: 'select',         // Select/Share/Minus
                9: 'start',          // Start/Options/Plus
                10: 'leftStick',     // Left stick click
                11: 'rightStick',    // Right stick click
                
                // D-pad
                12: 'dpadUp',
                13: 'dpadDown', 
                14: 'dpadLeft',
                15: 'dpadRight',
                
                // Home/Guide button (if available)
                16: 'home'
            },
            
            // Xbox controller specific mapping
            xbox: {
                0: 'jump',
                1: 'action',
                2: 'special',
                3: 'menu',
                4: 'powerUp1',
                5: 'powerUp2',
                8: 'select',
                9: 'start',
                12: 'dpadUp',
                13: 'dpadDown',
                14: 'dpadLeft',
                15: 'dpadRight'
            },
            
            // PlayStation controller mapping
            playstation: {
                0: 'jump',      // Cross
                1: 'action',    // Circle
                2: 'special',   // Square
                3: 'menu',      // Triangle
                4: 'powerUp1',  // L1
                5: 'powerUp2',  // R1
                8: 'select',    // Share
                9: 'start',     // Options
                12: 'dpadUp',
                13: 'dpadDown',
                14: 'dpadLeft',
                15: 'dpadRight'
            }
        };
        
        // Axis mappings (analog sticks and triggers)
        this.axisMappings = {
            0: 'leftStickX',     // Left stick horizontal
            1: 'leftStickY',     // Left stick vertical
            2: 'rightStickX',    // Right stick horizontal
            3: 'rightStickY',    // Right stick vertical
            // Note: Some controllers use axes 2,3 for triggers instead
        };
        
        // Game command mappings
        this.commandMappings = {
            jump: ['jump', 'dpadUp'],
            moveLeft: ['dpadLeft'],
            moveRight: ['dpadRight'],
            restart: ['restart', 'select'],
            pause: ['start', 'menu'],
            action: ['action', 'special']
        };
        
        // Controller type detection patterns
        this.controllerPatterns = {
            xbox: /xbox|xinput|microsoft/i,
            playstation: /playstation|ps[3-5]|dualshock|dualsense/i,
            nintendo: /nintendo|pro controller|joy-con/i,
            generic: /.*/ // Fallback
        };
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Polling setup
        this.isPolling = false;
        this.pollInterval = 16; // ~60fps polling
        
        console.log('🎮 Gamepad Manager initialized');
    }
    
    setupEventListeners() {
        window.addEventListener('gamepadconnected', (event) => {
            this.onGamepadConnected(event);
        });
        
        window.addEventListener('gamepaddisconnected', (event) => {
            this.onGamepadDisconnected(event);
        });
        
        // Start polling when first gamepad connects
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopPolling();
            } else if (this.connectedGamepads.size > 0) {
                this.startPolling();
            }
        });
    }
    
    onGamepadConnected(event) {
        const gamepad = event.gamepad;
        const controllerType = this.detectControllerType(gamepad.id);
        
        console.log(`🎮 Gamepad connected: ${gamepad.id}`);
        console.log(`🔍 Detected as: ${controllerType}`);
        console.log(`📊 Buttons: ${gamepad.buttons.length}, Axes: ${gamepad.axes.length}`);
        
        const gamepadInfo = {
            index: gamepad.index,
            id: gamepad.id,
            type: controllerType,
            buttonMapping: this.buttonMappings[controllerType] || this.buttonMappings.standard,
            lastUpdate: 0,
            vibrationSupported: 'vibrationActuator' in gamepad
        };
        
        this.gamepads.set(gamepad.index, gamepadInfo);
        this.connectedGamepads.add(gamepad.index);
        this.inputState.set(gamepad.index, new Map());
        this.previousInputState.set(gamepad.index, new Map());
        
        // Test vibration if supported
        this.testVibration(gamepad.index);
        
        // Start polling if not already active
        if (!this.isPolling) {
            this.startPolling();
        }
        
        // Notify game systems
        this.dispatchEvent('gamepadconnected', { gamepad: gamepadInfo });
    }
    
    onGamepadDisconnected(event) {
        const index = event.gamepad.index;
        console.log(`🎮 Gamepad disconnected: ${event.gamepad.id}`);
        
        this.gamepads.delete(index);
        this.connectedGamepads.delete(index);
        this.inputState.delete(index);
        this.previousInputState.delete(index);
        
        // Stop polling if no gamepads remain
        if (this.connectedGamepads.size === 0) {
            this.stopPolling();
        }
        
        this.dispatchEvent('gamepaddisconnected', { index });
    }
    
    detectControllerType(id) {
        const lowerId = id.toLowerCase();
        
        for (const [type, pattern] of Object.entries(this.controllerPatterns)) {
            if (pattern.test(lowerId)) {
                return type;
            }
        }
        
        return 'standard';
    }
    
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        console.log('🔄 Started gamepad polling');
        
        const poll = () => {
            if (!this.isPolling) return;
            
            this.updateGamepads();
            setTimeout(poll, this.pollInterval);
        };
        
        poll();
    }
    
    stopPolling() {
        this.isPolling = false;
        console.log('⏹️ Stopped gamepad polling');
    }
    
    updateGamepads() {
        const gamepads = navigator.getGamepads();
        
        for (const gamepadIndex of this.connectedGamepads) {
            const gamepad = gamepads[gamepadIndex];
            if (!gamepad) continue;
            
            const gamepadInfo = this.gamepads.get(gamepadIndex);
            const currentState = this.inputState.get(gamepadIndex);
            const previousState = this.previousInputState.get(gamepadIndex);
            
            // Store previous state
            previousState.clear();
            for (const [key, value] of currentState.entries()) {
                previousState.set(key, value);
            }
            
            // Update current state
            this.updateButtonStates(gamepad, gamepadInfo, currentState);
            this.updateAxisStates(gamepad, currentState);
            
            gamepadInfo.lastUpdate = Date.now();
        }
    }
    
    updateButtonStates(gamepad, gamepadInfo, currentState) {
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            const buttonName = gamepadInfo.buttonMapping[i];
            
            if (buttonName) {
                const isPressed = button.pressed;
                const value = button.value;
                
                currentState.set(buttonName, {
                    pressed: isPressed,
                    value: value,
                    touched: button.touched || false
                });
                
                // Handle trigger buttons (analog)
                if ((buttonName === 'restart' || buttonName === 'pause') && value > this.triggerThreshold) {
                    currentState.set(buttonName + 'Analog', value);
                }
            }
        }
    }
    
    updateAxisStates(gamepad, currentState) {
        for (let i = 0; i < gamepad.axes.length; i++) {
            const axisName = this.axisMappings[i];
            if (!axisName) continue;
            
            let value = gamepad.axes[i];
            
            // Apply deadzone
            if (Math.abs(value) < this.deadzone) {\n                value = 0;\n            }\n            \n            currentState.set(axisName, value);\n        }\n        \n        // Generate directional commands from analog sticks\n        this.generateDirectionalCommands(currentState);\n    }\n    \n    generateDirectionalCommands(currentState) {\n        const leftStickX = currentState.get('leftStickX') || 0;\n        const leftStickY = currentState.get('leftStickY') || 0;\n        \n        // Horizontal movement\n        if (leftStickX > 0.3) {\n            currentState.set('moveRight', { pressed: true, value: leftStickX });\n        } else {\n            currentState.set('moveRight', { pressed: false, value: 0 });\n        }\n        \n        if (leftStickX < -0.3) {\n            currentState.set('moveLeft', { pressed: true, value: Math.abs(leftStickX) });\n        } else {\n            currentState.set('moveLeft', { pressed: false, value: 0 });\n        }\n        \n        // Jump from stick up\n        if (leftStickY < -0.5) {\n            currentState.set('jumpStick', { pressed: true, value: Math.abs(leftStickY) });\n        } else {\n            currentState.set('jumpStick', { pressed: false, value: 0 });\n        }\n    }\n    \n    // Public API for game systems\n    getGameCommands() {\n        const commands = new Set();\n        \n        for (const gamepadIndex of this.connectedGamepads) {\n            const currentState = this.inputState.get(gamepadIndex);\n            const previousState = this.previousInputState.get(gamepadIndex);\n            \n            if (!currentState) continue;\n            \n            // Check each command mapping\n            for (const [command, buttons] of Object.entries(this.commandMappings)) {\n                for (const buttonName of buttons) {\n                    const current = currentState.get(buttonName);\n                    const previous = previousState.get(buttonName);\n                    \n                    if (current?.pressed) {\n                        commands.add(command);\n                        \n                        // Add 'pressed' suffix for just-pressed events\n                        if (!previous?.pressed) {\n                            commands.add(command + 'Pressed');\n                        }\n                    }\n                }\n            }\n            \n            // Add analog movement commands\n            if (currentState.get('moveLeft')?.pressed) {\n                commands.add('moveLeft');\n            }\n            if (currentState.get('moveRight')?.pressed) {\n                commands.add('moveRight');\n            }\n            if (currentState.get('jumpStick')?.pressed) {\n                commands.add('jump');\n            }\n        }\n        \n        return commands;\n    }\n    \n    isButtonPressed(buttonName, gamepadIndex = null) {\n        if (gamepadIndex !== null) {\n            const state = this.inputState.get(gamepadIndex);\n            return state?.get(buttonName)?.pressed || false;\n        }\n        \n        // Check all connected gamepads\n        for (const index of this.connectedGamepads) {\n            const state = this.inputState.get(index);\n            if (state?.get(buttonName)?.pressed) {\n                return true;\n            }\n        }\n        \n        return false;\n    }\n    \n    isButtonJustPressed(buttonName, gamepadIndex = null) {\n        const checkGamepad = (index) => {\n            const current = this.inputState.get(index)?.get(buttonName);\n            const previous = this.previousInputState.get(index)?.get(buttonName);\n            return current?.pressed && !previous?.pressed;\n        };\n        \n        if (gamepadIndex !== null) {\n            return checkGamepad(gamepadIndex);\n        }\n        \n        for (const index of this.connectedGamepads) {\n            if (checkGamepad(index)) return true;\n        }\n        \n        return false;\n    }\n    \n    getAxisValue(axisName, gamepadIndex = null) {\n        if (gamepadIndex !== null) {\n            return this.inputState.get(gamepadIndex)?.get(axisName) || 0;\n        }\n        \n        // Return the axis with the highest absolute value from any gamepad\n        let maxValue = 0;\n        for (const index of this.connectedGamepads) {\n            const value = this.inputState.get(index)?.get(axisName) || 0;\n            if (Math.abs(value) > Math.abs(maxValue)) {\n                maxValue = value;\n            }\n        }\n        \n        return maxValue;\n    }\n    \n    // Haptic feedback\n    async vibrate(gamepadIndex, { weak = 0, strong = 0, duration = 100 } = {}) {\n        const gamepadInfo = this.gamepads.get(gamepadIndex);\n        if (!gamepadInfo?.vibrationSupported) return false;\n        \n        const gamepads = navigator.getGamepads();\n        const gamepad = gamepads[gamepadIndex];\n        \n        if (!gamepad?.vibrationActuator) return false;\n        \n        try {\n            await gamepad.vibrationActuator.playEffect('dual-rumble', {\n                startDelay: 0,\n                duration: duration,\n                weakMagnitude: Math.max(0, Math.min(1, weak)),\n                strongMagnitude: Math.max(0, Math.min(1, strong))\n            });\n            return true;\n        } catch (error) {\n            console.warn('Vibration failed:', error);\n            return false;\n        }\n    }\n    \n    async testVibration(gamepadIndex) {\n        const success = await this.vibrate(gamepadIndex, {\n            weak: 0.3,\n            strong: 0.3,\n            duration: 200\n        });\n        \n        if (success) {\n            console.log(`🎮 Vibration test successful for gamepad ${gamepadIndex}`);\n        }\n    }\n    \n    // Game-specific vibration patterns\n    async vibrateOnCollision(gamepadIndex = null) {\n        const indices = gamepadIndex !== null ? [gamepadIndex] : Array.from(this.connectedGamepads);\n        \n        for (const index of indices) {\n            await this.vibrate(index, {\n                strong: 0.8,\n                weak: 0.4,\n                duration: 300\n            });\n        }\n    }\n    \n    async vibrateOnPowerUp(gamepadIndex = null) {\n        const indices = gamepadIndex !== null ? [gamepadIndex] : Array.from(this.connectedGamepads);\n        \n        for (const index of indices) {\n            await this.vibrate(index, {\n                weak: 0.6,\n                strong: 0.2,\n                duration: 150\n            });\n        }\n    }\n    \n    async vibrateOnJump(gamepadIndex = null) {\n        const indices = gamepadIndex !== null ? [gamepadIndex] : Array.from(this.connectedGamepads);\n        \n        for (const index of indices) {\n            await this.vibrate(index, {\n                weak: 0.2,\n                strong: 0.1,\n                duration: 100\n            });\n        }\n    }\n    \n    // Configuration\n    setDeadzone(value) {\n        this.deadzone = Math.max(0, Math.min(1, value));\n        console.log(`🎮 Deadzone set to: ${this.deadzone}`);\n    }\n    \n    setTriggerThreshold(value) {\n        this.triggerThreshold = Math.max(0, Math.min(1, value));\n        console.log(`🎮 Trigger threshold set to: ${this.triggerThreshold}`);\n    }\n    \n    // Status and debugging\n    getConnectedGamepads() {\n        return Array.from(this.connectedGamepads).map(index => {\n            const info = this.gamepads.get(index);\n            return {\n                index,\n                id: info.id,\n                type: info.type,\n                vibrationSupported: info.vibrationSupported,\n                lastUpdate: info.lastUpdate\n            };\n        });\n    }\n    \n    getDebugInfo() {\n        const debug = {\n            polling: this.isPolling,\n            connected: this.connectedGamepads.size,\n            gamepads: {}\n        };\n        \n        for (const index of this.connectedGamepads) {\n            const gamepadInfo = this.gamepads.get(index);\n            const currentState = this.inputState.get(index);\n            \n            debug.gamepads[index] = {\n                type: gamepadInfo.type,\n                id: gamepadInfo.id,\n                buttons: {},\n                axes: {}\n            };\n            \n            // Get pressed buttons\n            for (const [key, value] of currentState.entries()) {\n                if (key.includes('Stick') || key.includes('Analog')) {\n                    debug.gamepads[index].axes[key] = value;\n                } else if (value.pressed) {\n                    debug.gamepads[index].buttons[key] = value.value;\n                }\n            }\n        }\n        \n        return debug;\n    }\n    \n    // Event system for integration\n    dispatchEvent(type, detail) {\n        const event = new CustomEvent(`gamepad:${type}`, { detail });\n        window.dispatchEvent(event);\n    }\n    \n    // Cleanup\n    destroy() {\n        this.stopPolling();\n        this.gamepads.clear();\n        this.connectedGamepads.clear();\n        this.inputState.clear();\n        this.previousInputState.clear();\n        \n        console.log('🎮 Gamepad Manager destroyed');\n    }\n}\n\n// Gamepad Integration Helper for existing InputManager\nexport class GamepadInputIntegration {\n    constructor(inputManager) {\n        this.inputManager = inputManager;\n        this.gamepadManager = new GamepadManager();\n        this.enabled = true;\n        \n        // Setup integration\n        this.setupIntegration();\n    }\n    \n    setupIntegration() {\n        // Listen for gamepad events\n        window.addEventListener('gamepad:gamepadconnected', (event) => {\n            console.log('🎮 Gamepad integrated with InputManager');\n        });\n        \n        window.addEventListener('gamepad:gamepaddisconnected', (event) => {\n            console.log('🎮 Gamepad disconnected from InputManager');\n        });\n    }\n    \n    // Method to be called from InputManager.update()\n    updateGamepadInput() {\n        if (!this.enabled || !this.gamepadManager.connectedGamepads.size) {\n            return new Set();\n        }\n        \n        const commands = this.gamepadManager.getGameCommands();\n        \n        // Convert gamepad commands to InputManager format\n        const inputCommands = new Set();\n        \n        for (const command of commands) {\n            switch (command) {\n                case 'jump':\n                case 'jumpPressed':\n                    inputCommands.add('jump');\n                    if (command === 'jumpPressed') {\n                        this.gamepadManager.vibrateOnJump();\n                    }\n                    break;\n                case 'moveLeft':\n                    inputCommands.add('moveLeft');\n                    break;\n                case 'moveRight':\n                    inputCommands.add('moveRight');\n                    break;\n                case 'restart':\n                case 'restartPressed':\n                    inputCommands.add('restart');\n                    break;\n                case 'pause':\n                case 'pausePressed':\n                    inputCommands.add('pause');\n                    break;\n            }\n        }\n        \n        return inputCommands;\n    }\n    \n    // Game event handlers\n    onCollision() {\n        this.gamepadManager.vibrateOnCollision();\n    }\n    \n    onPowerUp() {\n        this.gamepadManager.vibrateOnPowerUp();\n    }\n    \n    onJump() {\n        this.gamepadManager.vibrateOnJump();\n    }\n    \n    setEnabled(enabled) {\n        this.enabled = enabled;\n        console.log(`🎮 Gamepad input ${enabled ? 'enabled' : 'disabled'}`);\n    }\n    \n    getStats() {\n        return {\n            enabled: this.enabled,\n            connected: this.gamepadManager.connectedGamepads.size,\n            gamepads: this.gamepadManager.getConnectedGamepads()\n        };\n    }\n}"