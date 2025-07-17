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
        
        
        // Store event listener references for proper cleanup
        this.eventListeners = {
            keydown: (event) => this.onKeyDown(event),
            keyup: (event) => this.onKeyUp(event),
            resize: () => this.onWindowResize(),
            documentClick: null
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', this.eventListeners.keydown);
        document.addEventListener('keyup', this.eventListeners.keyup);
        window.addEventListener('resize', this.eventListeners.resize, false);
        
        // Add universal restart support
        this.setupUniversalRestart();
    }

    onKeyDown(event) {
        // Don't process any input if disabled
        if (!this.enabled) return;
        
        // Don't interfere with form inputs
        if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
            return;
        }
        
        // Check global flag for player registration
        if (window.playerRegistrationActive) {
            return;
        }
        
        // Check if player registration form is visible
        const registrationForm = document.getElementById('player-registration');
        if (registrationForm && registrationForm.style.display !== 'none' && registrationForm.style.opacity !== '0') {
            return;
        }
        
        // Only process game controls if game is active
        if (!this.gameController.isGameActive()) return;
        
        // Prevent default behavior for game keys only during gameplay
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) {
            event.preventDefault();
        }
        

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
        
        // Don't interfere with form inputs
        if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
            return;
        }
        
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
        
        // Add fallback for production builds - retry if controls don't appear
        setTimeout(() => {
            if (!document.querySelector('.mobile-gamepad-container')) {
                this.createMobileUI();
            }
        }, 1000);
    }

    createMobileUI() {
        // Prevent creating duplicate mobile UI
        if (document.querySelector('.mobile-gamepad-container')) {
            return;
        }
        
        // Enhanced mobile detection for production builds
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                         'ontouchstart' in window || 
                         navigator.maxTouchPoints > 0 ||
                         window.innerWidth <= 768;
        
        // More flexible desktop detection - don't block mobile UI if uncertain
        const isDesktop = window.innerWidth > 1024 && 
                         !('ontouchstart' in window) && 
                         navigator.maxTouchPoints === 0;
        
        // Only skip mobile UI if we're certain it's desktop
        if (!isMobile && isDesktop) return;

        // Create main gamepad container
        const gamepadContainer = document.createElement('div');
        gamepadContainer.className = 'mobile-gamepad-container';
        Object.assign(gamepadContainer.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            height: '180px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 100%)',
            zIndex: '1000',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            gap: '20px'
        });

        // Mobile-specific debouncing (separate from desktop keyboard state)
        this.mobileButtons = {
            left: false,
            right: false,
            jump: false
        };

        // Create left arrow button with mobile-only debouncing
        const leftButton = this.createMobileButton('◀', () => {
            if (!this.mobileButtons.left) {
                this.mobileButtons.left = true;
                this.player.moveLeft();
                // Reset mobile button state after delay
                setTimeout(() => {
                    this.mobileButtons.left = false;
                }, 200);
            }
        });
        
        // Create jump button (larger and centered)
        const jumpButton = this.createMobileButton('▲', () => {
            if (!this.mobileButtons.jump) {
                this.mobileButtons.jump = true;
                this.player.jump();
                // Reset mobile button state after delay
                setTimeout(() => {
                    this.mobileButtons.jump = false;
                }, 200);
            }
        });
        jumpButton.className = 'mobile-gamepad-button mobile-gamepad-jump-button';
        Object.assign(jumpButton.style, {
            background: 'linear-gradient(145deg, #FF9800 0%, #F57C00 100%)',
            width: '90px',
            height: '90px',
            fontSize: '36px',
            boxShadow: '0 10px 20px rgba(255, 152, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2)'
        });
        
        // Create right arrow button with mobile-only debouncing
        const rightButton = this.createMobileButton('▶', () => {
            if (!this.mobileButtons.right) {
                this.mobileButtons.right = true;
                this.player.moveRight();
                // Reset mobile button state after delay
                setTimeout(() => {
                    this.mobileButtons.right = false;
                }, 200);
            }
        });

        // Add buttons to container
        gamepadContainer.appendChild(leftButton);
        gamepadContainer.appendChild(jumpButton);
        gamepadContainer.appendChild(rightButton);
        
        document.body.appendChild(gamepadContainer);
        
        // Add mobile-specific CSS only once
        this.addMobileGamepadStyles();
        
        // Prevent scrolling and improve mobile experience
        gamepadContainer.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: false });
        
        gamepadContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
        
        // Add visual feedback when gamepad is active
        gamepadContainer.addEventListener('touchstart', () => {
            document.body.style.background = 'rgba(0, 0, 0, 0.95)';
        });
        
        gamepadContainer.addEventListener('touchend', () => {
            document.body.style.background = '';
        });
    }

    createMobileButton(text, action) {
        const button = document.createElement('button');
        button.innerHTML = text;
        
        // Enhanced mobile button styling with better colors
        Object.assign(button.style, {
            width: '70px',
            height: '70px',
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#fff',
            background: 'linear-gradient(145deg, #4CAF50 0%, #45a049 100%)',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '50%',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden',
            pointerEvents: 'auto'
        });
        
        // Add subtle inner glow effect
        const innerGlow = document.createElement('div');
        Object.assign(innerGlow.style, {
            position: 'absolute',
            top: '2px',
            left: '2px',
            right: '2px',
            bottom: '2px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
            pointerEvents: 'none'
        });
        button.appendChild(innerGlow);
        
        // Add ripple effect container
        const rippleContainer = document.createElement('div');
        Object.assign(rippleContainer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            borderRadius: '50%',
            overflow: 'hidden',
            pointerEvents: 'none'
        });
        button.appendChild(rippleContainer);
        
        // Move text to front
        const textSpan = document.createElement('span');
        textSpan.innerHTML = text;
        textSpan.style.position = 'relative';
        textSpan.style.zIndex = '10';
        button.innerHTML = '';
        button.appendChild(textSpan);
        button.appendChild(innerGlow);
        button.appendChild(rippleContainer);
        
        // Create ripple effect
        const createRipple = (e) => {
            const ripple = document.createElement('div');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            
            Object.assign(ripple.style, {
                position: 'absolute',
                width: size + 'px',
                height: size + 'px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.3)',
                transform: 'scale(0)',
                animation: 'ripple 0.6s ease-out',
                left: '50%',
                top: '50%',
                marginLeft: -size/2 + 'px',
                marginTop: -size/2 + 'px'
            });
            
            rippleContainer.appendChild(ripple);
            
            // Remove ripple after animation
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        };
        
        
        button.className = 'mobile-gamepad-button';
        
        // Enhanced touch events with haptic feedback
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Enhanced pressed state
            Object.assign(button.style, {
                background: 'linear-gradient(145deg, #45a049 0%, #4CAF50 100%)',
                transform: 'scale(0.95)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.2)'
            });
            
            // Create ripple effect
            createRipple(e);
            
            // Haptic feedback for supported devices
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            // Execute action
            action();
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // Reset to normal state
            Object.assign(button.style, {
                background: 'linear-gradient(145deg, #4CAF50 0%, #45a049 100%)',
                transform: 'scale(1)',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2)'
            });
        });
        
        // Enhanced mouse events for desktop testing
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            Object.assign(button.style, {
                background: 'linear-gradient(145deg, #45a049 0%, #4CAF50 100%)',
                transform: 'scale(0.95)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.2)'
            });
            
            createRipple(e);
            action();
        });
        
        button.addEventListener('mouseup', (e) => {
            e.preventDefault();
            
            Object.assign(button.style, {
                background: 'linear-gradient(145deg, #4CAF50 0%, #45a049 100%)',
                transform: 'scale(1)',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2)'
            });
        });
        
        // Add hover effect for desktop
        button.addEventListener('mouseenter', () => {
            if (!button.matches(':active')) {
                button.style.transform = 'scale(1.05)';
                button.style.boxShadow = '0 12px 20px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.matches(':active')) {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2)';
            }
        });

        return button;
    }

    addMobileGamepadStyles() {
        // Add CSS only for mobile gamepad (never on desktop)
        if (!document.querySelector('#mobile-gamepad-styles')) {
            const style = document.createElement('style');
            style.id = 'mobile-gamepad-styles';
            style.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
                
                @keyframes buttonPress {
                    0% { transform: scale(1); }
                    50% { transform: scale(0.95); }
                    100% { transform: scale(1); }
                }
                
                .mobile-gamepad-button:active {
                    animation: buttonPress 0.15s ease;
                }
                
                /* Responsive design for different screen sizes */
                @media (max-width: 480px) {
                    .mobile-gamepad-container {
                        height: 140px !important;
                        padding: 15px !important;
                        gap: 15px !important;
                    }
                    
                    .mobile-gamepad-button {
                        width: 60px !important;
                        height: 60px !important;
                        font-size: 24px !important;
                    }
                    
                    .mobile-gamepad-jump-button {
                        width: 75px !important;
                        height: 75px !important;
                        font-size: 28px !important;
                    }
                }
                
                @media (max-width: 320px) {
                    .mobile-gamepad-container {
                        height: 120px !important;
                        padding: 10px !important;
                        gap: 10px !important;
                    }
                    
                    .mobile-gamepad-button {
                        width: 50px !important;
                        height: 50px !important;
                        font-size: 20px !important;
                    }
                    
                    .mobile-gamepad-jump-button {
                        width: 65px !important;
                        height: 65px !important;
                        font-size: 24px !important;
                    }
                }
                
                @media (orientation: landscape) and (max-height: 600px) {
                    .mobile-gamepad-container {
                        height: 100px !important;
                        padding: 10px !important;
                        gap: 15px !important;
                    }
                    
                    .mobile-gamepad-button {
                        width: 55px !important;
                        height: 55px !important;
                        font-size: 22px !important;
                    }
                    
                    .mobile-gamepad-jump-button {
                        width: 70px !important;
                        height: 70px !important;
                        font-size: 26px !important;
                    }
                }
                
                /* Prevent scrolling on mobile when interacting with gamepad */
                .mobile-gamepad-active {
                    overflow: hidden !important;
                    position: fixed !important;
                    width: 100% !important;
                    height: 100% !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupUniversalRestart() {
        // Store the document click listener reference for cleanup
        this.eventListeners.documentClick = (event) => {
            // Don't handle clicks during player registration
            if (window.playerRegistrationActive) {
                return;
            }
            
            if (!this.gameController.isGameActive()) {
                // Check if clicking on interactive elements that should NOT restart the game
                const isInteractiveElement = this.isInteractiveElement(event.target);
                
                // Only restart if clicking on non-interactive areas
                const gameOverElement = this.gameController.uiManager?.gameOverElement;
                const canvas = this.gameController.renderer?.domElement;
                
                if (!isInteractiveElement && canvas && event.target === canvas) {
                    // Only allow restart when clicking directly on the canvas (background)
                    event.preventDefault();
                    this.gameController.restartGame();
                }
            }
        };
        
        // Touch/click restart - but exclude interactive elements
        document.addEventListener('click', this.eventListeners.documentClick);
        
        // Remove touch restart for mobile - rely only on restart button
        // This prevents conflicts with tab interactions on mobile
        
        // Gamepad restart support
        this.setupGamepadRestart();
    }
    
    isInteractiveElement(element) {
        if (!element) return false;
        
        // Check if the element or any parent is an interactive element
        const interactiveSelectors = [
            'button',
            'input',
            'select',
            'textarea',
            'a',
            '[role="button"]',
            '[role="tab"]',
            '[tabindex]',
            '.tab-header',
            '.view-btn',
            '.primary-button',
            '.restart-button',
            '.search-input',
            '.filter-option',
            '.leaderboard-entry'
        ];
        
        // Check if current element matches
        for (const selector of interactiveSelectors) {
            if (element.matches && element.matches(selector)) {
                return true;
            }
        }
        
        // Check if any parent element matches
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            for (const selector of interactiveSelectors) {
                if (parent.matches && parent.matches(selector)) {
                    return true;
                }
            }
            parent = parent.parentElement;
        }
        
        return false;
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

    // Cleanup method to remove all event listeners and prevent accumulation
    destroy() {
        // Remove document and window event listeners
        if (this.eventListeners.keydown) {
            document.removeEventListener('keydown', this.eventListeners.keydown);
        }
        if (this.eventListeners.keyup) {
            document.removeEventListener('keyup', this.eventListeners.keyup);
        }
        if (this.eventListeners.resize) {
            window.removeEventListener('resize', this.eventListeners.resize, false);
        }
        if (this.eventListeners.documentClick) {
            document.removeEventListener('click', this.eventListeners.documentClick);
        }
        
        // Clear event listener references
        this.eventListeners = {
            keydown: null,
            keyup: null,
            resize: null,
            documentClick: null
        };
        
        // Reset key states
        this.keys = {
            left: false,
            right: false,
            jump: false
        };
        
        // Reset mobile button states if they exist
        if (this.mobileButtons) {
            this.mobileButtons = {
                left: false,
                right: false,
                jump: false
            };
        }
        
        // Disable input processing
        this.enabled = false;
    }
}