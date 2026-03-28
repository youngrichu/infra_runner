export class InputManager {
    constructor(player, gameController) {
        this.player = player;
        this.gameController = gameController;
        this.keys = {
            left: false,
            right: false,
            jump: false,
            slide: false
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
                    // Prevent jumping while flying
                    if (this.gameController.powerUpManager && this.gameController.powerUpManager.getFlyingStatus()) {
                        break;
                    }
                    this.keys.jump = true;
                    this.player.jump();
                }
                break;
            case 'ArrowDown':
            case 'KeyS':
                if (!this.keys.slide) {
                    // Prevent sliding while flying
                    if (this.gameController.powerUpManager && this.gameController.powerUpManager.getFlyingStatus()) {
                        break;
                    }
                    this.keys.slide = true;
                    this.player.slide();
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
            case 'ArrowDown':
            case 'KeyS':
                this.keys.slide = false;
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
        if (document.querySelector('.mobile-swipe-container')) {
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

        // Create main swipe container
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'mobile-swipe-container';
        Object.assign(swipeContainer.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            zIndex: '999',
            pointerEvents: 'auto',
            background: 'transparent'
        });

        // Mobile-specific debouncing (separate from desktop keyboard state)
        this.mobileButtons = {
            left: false,
            right: false,
            jump: false,
            slide: false
        };

        // Setup swipe gesture detection
        this.setupSwipeGestures(swipeContainer);
        
        document.body.appendChild(swipeContainer);
        
        // Add mobile-specific CSS only once
        this.addMobileSwipeStyles();
        
        // Add body class to prevent pull-to-refresh when mobile controls are active
        document.body.classList.add('mobile-swipe-active');
        
        // Monitor game state to manage scroll prevention
        this.setupGameStateMonitoring();
    }

    setupGameStateMonitoring() {
        // Flag to control monitoring loop
        this.isMonitoringGameState = true;
        
        // Monitor game state to enable/disable scroll prevention
        const monitorGameState = () => {
            if (!this.isMonitoringGameState) {
                return; // Stop monitoring if flag is false
            }
            
            if (this.gameController && this.gameController.isGameActive) {
                if (this.gameController.isGameActive()) {
                    // Game is active - ensure scroll prevention is enabled
                    document.body.classList.add('mobile-swipe-active');
                } else {
                    // Game is inactive - allow normal scrolling
                    document.body.classList.remove('mobile-swipe-active');
                }
            }
            
            // Continue monitoring only if still needed
            if (this.isMonitoringGameState) {
                this.gameStateMonitorId = requestAnimationFrame(monitorGameState);
            }
        };
        
        // Start monitoring
        this.gameStateMonitorId = requestAnimationFrame(monitorGameState);
    }

    setupSwipeGestures(container) {
        // Swipe detection variables
        let fingerDownPos = { x: 0, y: 0 };
        let fingerUpPos = { x: 0, y: 0 };
        const SWIPE_THRESHOLD = 50; // Minimum distance for swipe detection
        const TOP_EDGE_THRESHOLD = 50; // Prevent swipes starting near top edge
        const detectSwipeAfterRelease = false; // Detect during movement for responsiveness

        // Helper functions for swipe detection
        const getVerticalMoveValue = () => {
            return Math.abs(fingerDownPos.y - fingerUpPos.y);
        };

        const getHorizontalMoveValue = () => {
            return Math.abs(fingerDownPos.x - fingerUpPos.x);
        };

        const checkSwipe = () => {
            const verticalMove = getVerticalMoveValue();
            const horizontalMove = getHorizontalMoveValue();

            // Check for vertical swipes (up/down)
            if (verticalMove > SWIPE_THRESHOLD && verticalMove > horizontalMove) {
                // Prevent swipe down if it started near the top edge (to avoid browser refresh)
                const isSwipeDown = fingerDownPos.y - fingerUpPos.y > 0;
                const startedNearTop = fingerUpPos.y < TOP_EDGE_THRESHOLD;
                
                if (isSwipeDown && startedNearTop) {
                    // Ignore swipe down that started near top edge
                    return;
                }
                
                if (isSwipeDown) {
                    // Swipe down - Slide
                    this.onSwipeDown();
                } else {
                    // Swipe up - Jump
                    this.onSwipeUp();
                }
                fingerUpPos = { ...fingerDownPos };
            }
            // Check for horizontal swipes (left/right)
            else if (horizontalMove > SWIPE_THRESHOLD && horizontalMove > verticalMove) {
                if (fingerDownPos.x - fingerUpPos.x > 0) {
                    // Swipe right
                    this.onSwipeRight();
                } else {
                    // Swipe left
                    this.onSwipeLeft();
                }
                fingerUpPos = { ...fingerDownPos };
            }
        };

        // Store touch event handlers for cleanup
        this.eventListeners.touchstart = (e) => {
            const touch = e.touches[0];
            fingerUpPos = { x: touch.clientX, y: touch.clientY };
            fingerDownPos = { x: touch.clientX, y: touch.clientY };
            
            // Prevent default behavior to avoid browser gestures
            e.preventDefault();
        };

        this.eventListeners.touchmove = (e) => {
            if (!detectSwipeAfterRelease) {
                const touch = e.touches[0];
                fingerDownPos = { x: touch.clientX, y: touch.clientY };
                checkSwipe();
            }
            
            // Prevent default to stop browser pull-to-refresh and scrolling
            e.preventDefault();
        };

        this.eventListeners.touchend = (e) => {
            if (detectSwipeAfterRelease) {
                checkSwipe();
            }
            
            // Prevent default to avoid any delayed browser gestures
            e.preventDefault();
        };

        // Store mouse event handlers for cleanup
        let isMouseDown = false;
        
        this.eventListeners.mousedown = (e) => {
            isMouseDown = true;
            fingerUpPos = { x: e.clientX, y: e.clientY };
            fingerDownPos = { x: e.clientX, y: e.clientY };
        };

        this.eventListeners.mousemove = (e) => {
            if (isMouseDown && !detectSwipeAfterRelease) {
                fingerDownPos = { x: e.clientX, y: e.clientY };
                checkSwipe();
            }
        };

        this.eventListeners.mouseup = (e) => {
            if (isMouseDown) {
                isMouseDown = false;
                if (detectSwipeAfterRelease) {
                    checkSwipe();
                }
            }
        };

        // Add event listeners to container
        container.addEventListener('touchstart', this.eventListeners.touchstart, { passive: false });
        container.addEventListener('touchmove', this.eventListeners.touchmove, { passive: false });
        container.addEventListener('touchend', this.eventListeners.touchend, { passive: false });
        container.addEventListener('mousedown', this.eventListeners.mousedown);
        container.addEventListener('mousemove', this.eventListeners.mousemove);
        container.addEventListener('mouseup', this.eventListeners.mouseup);
        
        // Store container reference for cleanup
        this.swipeContainer = container;
    }

    // Swipe callback functions
    onSwipeUp() {
        if (this.gameController.isGameActive()) {
            // Prevent jumping while flying
            if (this.gameController.powerUpManager && this.gameController.powerUpManager.getFlyingStatus()) {
                return;
            }
            
            // Allow jump if:
            // 1. Not currently debounced, OR
            // 2. Player can double jump and is already jumping (for wind power)
            const canJump = !this.mobileButtons.jump || 
                           (this.player.canDoubleJump && this.player.isJumping && !this.player.hasDoubleJumped);
            
            if (canJump) {
                this.mobileButtons.jump = true;
                this.player.jump();
                
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                setTimeout(() => {
                    this.mobileButtons.jump = false;
                }, 300);
            }
        }
    }

    onSwipeDown() {
        if (!this.mobileButtons.slide && this.gameController.isGameActive()) {
            // Prevent sliding while flying
            if (this.gameController.powerUpManager && this.gameController.powerUpManager.getFlyingStatus()) {
                return;
            }
            
            this.mobileButtons.slide = true;
            this.player.slide();
            
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            setTimeout(() => {
                this.mobileButtons.slide = false;
            }, 300);
        }
    }

    onSwipeLeft() {
        if (!this.mobileButtons.left && this.gameController.isGameActive()) {
            this.mobileButtons.left = true;
            this.player.moveLeft();
            
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
            
            setTimeout(() => {
                this.mobileButtons.left = false;
            }, 200);
        }
    }

    onSwipeRight() {
        if (!this.mobileButtons.right && this.gameController.isGameActive()) {
            this.mobileButtons.right = true;
            this.player.moveRight();
            
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
            
            setTimeout(() => {
                this.mobileButtons.right = false;
            }, 200);
        }
    }



    addMobileSwipeStyles() {
        // Add CSS only for mobile swipe controls (never on desktop)
        if (!document.querySelector('#mobile-swipe-styles')) {
            const style = document.createElement('style');
            style.id = 'mobile-swipe-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .mobile-swipe-container {
                    touch-action: none;
                    overscroll-behavior: none;
                    -webkit-overscroll-behavior: none;
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    -khtml-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                /* Additional body styles to prevent pull-to-refresh */
                body.mobile-swipe-active {
                    touch-action: none;
                    overscroll-behavior: none;
                    -webkit-overscroll-behavior: none;
                    overflow: hidden;
                    position: fixed;
                    width: 100%;
                    height: 100%;
                }
                
                /* Responsive design for mobile swipe container */
                @media (max-width: 480px) {
                    .mobile-swipe-container {
                        touch-action: none;
                        overscroll-behavior: none;
                    }
                }
                
                @media (max-width: 320px) {
                    .mobile-swipe-container {
                        touch-action: none;
                        overscroll-behavior: none;
                    }
                }
                
                /* Prevent scrolling on mobile when swiping */
                .mobile-swipe-active {
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
        // Store original gameOver method for cleanup
        if (this.gameController.gameOver && !this.originalGameOver) {
            this.originalGameOver = this.gameController.gameOver.bind(this.gameController);
        }
        
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
                this.gamepadRestartId = requestAnimationFrame(checkGamepadRestart);
            }
        };
        
        // Override gameOver method to start gamepad checking
        if (this.originalGameOver) {
            this.gameController.gameOver = () => {
                this.originalGameOver();
                setTimeout(() => {
                    this.gamepadRestartId = requestAnimationFrame(checkGamepadRestart);
                }, 100); // Small delay to avoid immediate restart
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
            jump: false,
            slide: false
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
        
        // Remove swipe gesture event listeners from container
        if (this.swipeContainer) {
            if (this.eventListeners.touchstart) {
                this.swipeContainer.removeEventListener('touchstart', this.eventListeners.touchstart);
            }
            if (this.eventListeners.touchmove) {
                this.swipeContainer.removeEventListener('touchmove', this.eventListeners.touchmove);
            }
            if (this.eventListeners.touchend) {
                this.swipeContainer.removeEventListener('touchend', this.eventListeners.touchend);
            }
            if (this.eventListeners.mousedown) {
                this.swipeContainer.removeEventListener('mousedown', this.eventListeners.mousedown);
            }
            if (this.eventListeners.mousemove) {
                this.swipeContainer.removeEventListener('mousemove', this.eventListeners.mousemove);
            }
            if (this.eventListeners.mouseup) {
                this.swipeContainer.removeEventListener('mouseup', this.eventListeners.mouseup);
            }
        }
        
        // Remove mobile UI elements
        const mobileContainer = document.querySelector('.mobile-swipe-container');
        if (mobileContainer) {
            mobileContainer.remove();
        }
        
        // Remove mobile styles
        const mobileStyles = document.querySelector('#mobile-swipe-styles');
        if (mobileStyles) {
            mobileStyles.remove();
        }
        
        // Clear event listener references
        this.eventListeners = {
            keydown: null,
            keyup: null,
            resize: null,
            documentClick: null,
            touchstart: null,
            touchmove: null,
            touchend: null,
            mousedown: null,
            mousemove: null,
            mouseup: null
        };
        
        // Clear container reference
        this.swipeContainer = null;
        
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
        
        // Stop game state monitoring
        this.isMonitoringGameState = false;
        if (this.gameStateMonitorId) {
            cancelAnimationFrame(this.gameStateMonitorId);
            this.gameStateMonitorId = null;
        }
        
        // Stop gamepad restart monitoring
        if (this.gamepadRestartId) {
            cancelAnimationFrame(this.gamepadRestartId);
            this.gamepadRestartId = null;
        }
        
        // Restore original gameOver method
        if (this.originalGameOver && this.gameController) {
            this.gameController.gameOver = this.originalGameOver;
            this.originalGameOver = null;
        }
        
        // Remove mobile swipe body class if it exists
        document.body.classList.remove('mobile-swipe-active');
        
        // Disable input processing
        this.enabled = false;
    }
}