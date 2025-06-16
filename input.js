export class InputManager {
    constructor(player, gameController) {
        this.player = player;
        this.gameController = gameController;
        this.keys = {
            left: false,
            right: false,
            jump: false
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    onKeyDown(event) {
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
}