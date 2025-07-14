export class PlayerRegistration {
    constructor(onComplete) {
        this.onComplete = onComplete;
        this.registrationElement = null;
        this.isVisible = false;
        this.createRegistrationForm();
    }

    createRegistrationForm() {
        this.registrationElement = document.createElement('div');
        this.registrationElement.id = 'player-registration';
        this.registrationElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            z-index: 10000;
            font-family: 'Arial', sans-serif;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        `;

        this.registrationElement.innerHTML = `
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                padding: clamp(20px, 4vw, 30px);
                border-radius: clamp(15px, 3vw, 20px);
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                max-width: min(400px, 95vw);
                width: 95%;
                text-align: center;
                border: 2px solid rgba(255, 107, 53, 0.3);
                backdrop-filter: blur(10px);
                max-height: 90vh;
                overflow-y: auto;
            ">
                <h2 style="
                    color: white;
                    margin-bottom: clamp(15px, 3vw, 20px);
                    font-size: clamp(20px, 5vw, 24px);
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
                    line-height: 1.2;
                "><i class="ti ti-run"></i> Infrastructure Runner</h2>
                
                <p style="
                    color: #e0e0e0;
                    margin-bottom: clamp(20px, 4vw, 25px);
                    font-size: clamp(12px, 3.5vw, 14px);
                    line-height: 1.4;
                ">Enter your details to join the leaderboard!</p>

                <form id="registration-form">
                    <div style="margin-bottom: clamp(12px, 3vw, 15px);">
                        <input 
                            type="text" 
                            id="player-name" 
                            placeholder="Your Name" 
                            required
                            style="
                                width: 100%;
                                padding: clamp(10px, 3vw, 12px);
                                border: none;
                                border-radius: clamp(6px, 2vw, 8px);
                                font-size: clamp(14px, 4vw, 16px);
                                background: rgba(255,255,255,0.9);
                                box-sizing: border-box;
                                transition: all 0.3s ease;
                                border: 2px solid transparent;
                            "
                            onfocus="this.style.borderColor='#FF6B35'; this.style.background='rgba(255,255,255,0.95)'"
                            onblur="this.style.borderColor='transparent'; this.style.background='rgba(255,255,255,0.9)'"
                        />
                    </div>

                    <div style="margin-bottom: clamp(12px, 3vw, 15px);">
                        <input 
                            type="email" 
                            id="player-email" 
                            placeholder="Your Email" 
                            required
                            style="
                                width: 100%;
                                padding: clamp(10px, 3vw, 12px);
                                border: none;
                                border-radius: clamp(6px, 2vw, 8px);
                                font-size: clamp(14px, 4vw, 16px);
                                background: rgba(255,255,255,0.9);
                                box-sizing: border-box;
                                transition: all 0.3s ease;
                                border: 2px solid transparent;
                            "
                            onfocus="this.style.borderColor='#FF6B35'; this.style.background='rgba(255,255,255,0.95)'"
                            onblur="this.style.borderColor='transparent'; this.style.background='rgba(255,255,255,0.9)'"
                        />
                    </div>

                    <div style="margin-bottom: clamp(20px, 4vw, 25px);">
                        <input 
                            type="text" 
                            id="organization-name" 
                            placeholder="Organization Name" 
                            required
                            style="
                                width: 100%;
                                padding: clamp(10px, 3vw, 12px);
                                border: none;
                                border-radius: clamp(6px, 2vw, 8px);
                                font-size: clamp(14px, 4vw, 16px);
                                background: rgba(255,255,255,0.9);
                                box-sizing: border-box;
                                transition: all 0.3s ease;
                                border: 2px solid transparent;
                            "
                            onfocus="this.style.borderColor='#FF6B35'; this.style.background='rgba(255,255,255,0.95)'"
                            onblur="this.style.borderColor='transparent'; this.style.background='rgba(255,255,255,0.9)'"
                        />
                    </div>

                    <button 
                        type="submit"
                        style="
                            width: 100%;
                            padding: clamp(12px, 3.5vw, 14px);
                            background: linear-gradient(45deg, #FF6B35, #FFD700);
                            border: none;
                            border-radius: clamp(6px, 2vw, 8px);
                            color: white;
                            font-size: clamp(14px, 4.5vw, 18px);
                            font-weight: bold;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                            min-height: 44px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255, 107, 53, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.3)'"
                        ontouchstart="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 20px rgba(255, 107, 53, 0.4)'"
                        ontouchend="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.3)'"
                    >
                        <i class="ti ti-play"></i> Start Playing
                    </button>
                </form>

                <div style="
                    margin-top: clamp(12px, 3vw, 15px);
                    font-size: clamp(10px, 3vw, 12px);
                    color: #b0b0b0;
                    line-height: 1.4;
                    padding: clamp(8px, 2vw, 10px);
                    background: rgba(255,255,255,0.05);
                    border-radius: clamp(4px, 1vw, 6px);
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <i class="ti ti-shield-check" style="font-size: 1em; margin-right: 4px; color: #4CAF50;"></i>
                    Your information will be used for the leaderboard only
                </div>
            </div>
        `;

        document.body.appendChild(this.registrationElement);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const form = document.getElementById('registration-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Auto-focus first input when shown
        this.registrationElement.addEventListener('transitionend', () => {
            if (this.isVisible) {
                document.getElementById('player-name').focus();
            }
        });
    }

    handleSubmit() {
        const playerName = document.getElementById('player-name').value.trim();
        const email = document.getElementById('player-email').value.trim();
        const organizationName = document.getElementById('organization-name').value.trim();

        if (!playerName || !email || !organizationName) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        // Store in localStorage for future sessions
        localStorage.setItem('playerData', JSON.stringify({
            playerName,
            email,
            organizationName
        }));

        this.hide();
        
        if (this.onComplete) {
            this.onComplete(playerName, email, organizationName);
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showError(message) {
        // Remove existing error message
        const existingError = document.querySelector('.registration-error');
        if (existingError) {
            existingError.remove();
        }

        // Create new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'registration-error';
        errorDiv.style.cssText = `
            color: #ff4444;
            background: rgba(255, 68, 68, 0.1);
            padding: 8px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 14px;
            border: 1px solid rgba(255, 68, 68, 0.3);
        `;
        errorDiv.textContent = message;

        const form = document.getElementById('registration-form');
        form.appendChild(errorDiv);

        // Remove error after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    show() {
        // Check if player data is already stored
        const storedData = localStorage.getItem('playerData');
        if (storedData) {
            const { playerName, email, organizationName } = JSON.parse(storedData);
            
            // Auto-fill the form
            document.getElementById('player-name').value = playerName;
            document.getElementById('player-email').value = email;
            document.getElementById('organization-name').value = organizationName;
        }

        this.registrationElement.style.display = 'block';
        // Trigger transition
        setTimeout(() => {
            this.registrationElement.style.opacity = '1';
            this.registrationElement.style.visibility = 'visible';
        }, 10);
        this.isVisible = true;
        
        // Focus on first input
        setTimeout(() => {
            document.getElementById('player-name').focus();
        }, 100);
    }

    hide() {
        this.registrationElement.style.opacity = '0';
        this.registrationElement.style.visibility = 'hidden';
        setTimeout(() => {
            this.registrationElement.style.display = 'none';
        }, 300);
        this.isVisible = false;
    }

    destroy() {
        if (this.registrationElement && this.registrationElement.parentNode) {
            this.registrationElement.remove();
        }
    }

    // Static method to get stored player data
    static getStoredPlayerData() {
        const stored = localStorage.getItem('playerData');
        return stored ? JSON.parse(stored) : null;
    }

    // Static method to clear stored player data
    static clearStoredPlayerData() {
        localStorage.removeItem('playerData');
    }
}