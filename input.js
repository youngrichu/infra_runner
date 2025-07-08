export class InputManager {
    constructor(player, gameController) {
        this.player = player;
        this.gameController = gameController;
        this.keys = {
            left: false,
            right: false,
            jump: false
        };
        this.enabled = true;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Add universal restart support
        this.setupUniversalRestart();
    }

    onKeyDown(event) {
        // Don't process any input if disabled
        if (!this.enabled) return;
        
        // Prevent default behavior for game keys
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyR'].includes(event.code)) {
            event.preventDefault();
        }

        // Handle restart
        if (event.code === 'KeyR' && !this.gameController.isGameActive()) {
            this.gameController.restartGame();
            return;
        }

        // Only process game controls if game is active
        if (!this.gameController.isGameActive()) return;

        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                if (!this.keys.left) {
                    this.keys.left = true;
                    this.player.moveLeft();
                }
                break;
            case 'ArrowRight':
            case 'KeyD':
                if (!this.keys.right) {
                    this.keys.right = true;
                    this.player.moveRight();
                }
                break;
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                if (!this.keys.jump) {
                    this.keys.jump = true;
                    this.player.jump();
                }
                break;
        }
    }

    onKeyUp(event) {
        // Don't process any input if disabled
        if (!this.enabled) return;
        
        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                this.keys.jump = false;
                break;
        }
    }

    onWindowResize() {
        this.gameController.handleWindowResize();
    }

    // Touch/Mobile support (optional)
    setupMobileControls() {
        // Create virtual buttons for mobile
        this.createMobileUI();
    }

    createMobileUI() {
        // Check if device is mobile
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (!isMobile) return;

        // Create control container
        const controlContainer = document.createElement('div');
        controlContainer.style.position = 'absolute';
        controlContainer.style.bottom = '20px';
        controlContainer.style.left = '50%';
        controlContainer.style.transform = 'translateX(-50%)';
        controlContainer.style.display = 'flex';
        controlContainer.style.gap = '10px';
        controlContainer.style.zIndex = '1000';

        // Create left button
        const leftButton = this.createMobileButton('◀', () => this.player.moveLeft());
        
        // Create jump button
        const jumpButton = this.createMobileButton('▲', () => this.player.jump());
        
        // Create right button
        const rightButton = this.createMobileButton('▶', () => this.player.moveRight());

        controlContainer.appendChild(leftButton);
        controlContainer.appendChild(jumpButton);
        controlContainer.appendChild(rightButton);
        document.body.appendChild(controlContainer);
    }

    createMobileButton(text, action) {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.style.width = '60px';
        button.style.height = '60px';
        button.style.fontSize = '24px';
        button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        button.style.border = '2px solid #333';
        button.style.borderRadius = '10px';
        button.style.cursor = 'pointer';
        button.style.userSelect = 'none';
        
        // Add touch events
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.backgroundColor = 'rgba(200, 200, 200, 0.8)';
            action();
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        });
        
        // Add mouse events for testing on desktop
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            button.style.backgroundColor = 'rgba(200, 200, 200, 0.8)';
            action();
        });
        
        button.addEventListener('mouseup', (e) => {
            e.preventDefault();
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        });

        return button;
    }

    setupUniversalRestart() {
        // Touch/click restart - listen for taps on game over screen
        document.addEventListener('click', (event) => {
            if (!this.gameController.isGameActive()) {
                // Check if clicking on game over element or canvas
                const gameOverElement = this.gameController.uiManager?.gameOverElement;
                const canvas = this.gameController.renderer?.domElement;
                
                if (gameOverElement && gameOverElement.style.display === 'block' && 
                    (event.target === gameOverElement || gameOverElement.contains(event.target) || event.target === canvas)) {
                    event.preventDefault();
                    this.gameController.restartGame();
                }
            }
        });
        
        // Touch restart for mobile
        document.addEventListener('touchend', (event) => {
            if (!this.gameController.isGameActive()) {
                const gameOverElement = this.gameController.uiManager?.gameOverElement;
                const canvas = this.gameController.renderer?.domElement;
                
                if (gameOverElement && gameOverElement.style.display === 'block') {
                    event.preventDefault();
                    this.gameController.restartGame();
                }
            }
        });
        
        // Gamepad restart support
        this.setupGamepadRestart();
    }
    
    setupGamepadRestart() {
        // Check for gamepad restart every frame when game is over
        const checkGamepadRestart = () => {
            if (!this.gameController.isGameActive()) {
                const gamepads = navigator.getGamepads();
                for (let i = 0; i < gamepads.length; i++) {
                    const gamepad = gamepads[i];
                    if (gamepad) {
                        // Check for common restart buttons: A, Start, Select, or any face button
                        if (gamepad.buttons[0]?.pressed ||  // A button (Xbox) / X button (PS)
                            gamepad.buttons[1]?.pressed ||  // B button (Xbox) / Circle button (PS)
                            gamepad.buttons[2]?.pressed ||  // X button (Xbox) / Square button (PS)
                            gamepad.buttons[3]?.pressed ||  // Y button (Xbox) / Triangle button (PS)
                            gamepad.buttons[9]?.pressed ||  // Start button
                            gamepad.buttons[8]?.pressed) {  // Select/Back button
                            this.gameController.restartGame();
                            return;
                        }
                    }
                }
            }
            
            // Continue checking if game is still over
            if (!this.gameController.isGameActive()) {
                requestAnimationFrame(checkGamepadRestart);
            }
        };
        
        // Start checking when game becomes inactive
        const originalGameOver = this.gameController.gameOver?.bind(this.gameController);
        if (originalGameOver) {
            this.gameController.gameOver = () => {
                originalGameOver();
                setTimeout(() => checkGamepadRestart(), 100); // Small delay to avoid immediate restart
            };
        }
    }

    // Get current input state
    getInputState() {
        return { ...this.keys };
    }

    // Reset input state
    reset() {
        this.keys = {
            left: false,
            right: false,
            jump: false
        };
    }
    
    // Enable/disable input processing
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
        // Reset any active keys when disabling
        this.reset();
    }
}