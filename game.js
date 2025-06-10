// Game variables
let scene, camera, renderer;
let player;
let gameSpeed = 0.1;
let playerLane = 1; // 0: left, 1: center, 2: right
let lanes = [-2, 0, 2]; // Lane x-positions
let isJumping = false;
let playerVelocityY = 0;
let gravity = -0.02; // Balanced gravity for controlled descent
let score = 0;
let obstacles = [];
let buildings = [];
let collectables = [];
let gameActive = true;
let scoreElement, gameOverElement;
let blueprints = 0;
let waterDrops = 0;
let energyCells = 0;
let isInvincible = false;
let invincibilityTimer = 0;
let ground; // Make ground accessible globally

// Power-up variables
let isFlying = false;
let flyingTimer = 0;
let hasSolarBoost = false;
let solarBoostTimer = 0;
let hasWindPower = false;
let windPowerTimer = 0;
let hasWaterSlide = false;
let waterSlideTimer = 0;
let canDoubleJump = false;
let hasDoubleJumped = false;
let activePowerUps = []; // Track active power-ups for UI
let powerUpElements = [];
let waterSlideObjects = [];
let lastObstacleType = '';
let lastObstacleZ = 0;

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 2;
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // UI Elements
    createUI();

    // Setup game elements
    setupLighting();
    createPlayer();
    createEnvironment();
    setupEventListeners();

    // Start spawning
    spawnObstacle();
    spawnBuildings();
    spawnCollectable();

    // Start animation
    animate();
}

function createUI() {
    scoreElement = document.createElement('div');
    scoreElement.style.position = 'absolute';
    scoreElement.style.top = '10px';
    scoreElement.style.left = '10px';
    scoreElement.style.color = 'white';
    scoreElement.style.fontFamily = 'Arial, sans-serif';
    scoreElement.style.fontSize = '24px';
    document.body.appendChild(scoreElement);

    gameOverElement = document.createElement('div');
    gameOverElement.style.position = 'absolute';
    gameOverElement.style.top = '50%';
    gameOverElement.style.left = '50%';
    gameOverElement.style.transform = 'translate(-50%, -50%)';
    gameOverElement.style.color = 'red';
    gameOverElement.style.fontFamily = 'Arial, sans-serif';
    gameOverElement.style.fontSize = '48px';
    gameOverElement.style.display = 'none'; // Hidden by default
    gameOverElement.innerHTML = 'GAME OVER<br>Press R to Restart';
    document.body.appendChild(gameOverElement);
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
}

function createPlayer() {
    const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    player = new THREE.Mesh(geometry, material);
    player.position.set(0, 0.5, 0);
    player.castShadow = true;
    scene.add(player);
}

function createEnvironment() {
    // Create a canvas for the road texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    // Fill background
    context.fillStyle = '#404040';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Add some road texture details
    context.fillStyle = '#505050';
    for(let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        context.fillRect(x, y, 4, 4);
    }

    // Create lines for road markings
    context.fillStyle = '#808080';
    context.fillRect(canvas.width/2 - 2, 0, 4, canvas.height);

    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(2, 200);

    const groundGeometry = new THREE.PlaneGeometry(10, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: roadTexture,
        side: THREE.DoubleSide
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

function createBuilding(x, z, isInfrastructure = false) {
    const height = isInfrastructure ? Math.random() * 1 + 0.5 : Math.random() * 5 + 3;
    const width = isInfrastructure ? 0.3 : 2;
    const depth = isInfrastructure ? 2 : 2; // Reduced infrastructure depth
    const color = isInfrastructure ? 0x0000ff : Math.random() * 0xffffff;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const building = new THREE.Mesh(geometry, material);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    if (!isInfrastructure) {
        buildings.push(building);
    }
    return building; // Return for potential tracking
}

function spawnBuildings() {
    if (!gameActive) return;
    const z = player.position.z - 100;
    createBuilding(lanes[0] - 3, z);
    createBuilding(lanes[2] + 3, z);
    setTimeout(spawnBuildings, Math.random() * 2000 + 1000); // Randomize spawn time
}

function createObstacle() {
    // Define obstacle types with their specific properties
    const obstacleTypes = {
        'pothole': {
            geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32),
            color: 0x333333,
            yPos: 0.05,
            description: 'Road damage that needs repair'
        },
        'constructionBarrier': {
            geometry: new THREE.BoxGeometry(1.5, 1, 0.3),
            color: 0xff4444,
            yPos: 0.5,
            description: 'Construction zone barrier'
        },
        'cone': {
            geometry: new THREE.ConeGeometry(0.3, 0.8, 32),
            color: 0xff8800,
            yPos: 0.4,
            description: 'Traffic cone marking road work'
        },
        'rubble': {
            geometry: new THREE.BoxGeometry(0.8, 0.4, 0.8),
            color: 0x808080,
            yPos: 0.2,
            description: 'Construction debris'
        }
    };

    // Filter out the last used obstacle type to prevent repetition
    const availableTypes = Object.keys(obstacleTypes).filter(type => type !== lastObstacleType);
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const obstacle = obstacleTypes[type];

    const material = new THREE.MeshStandardMaterial({ color: obstacle.color });
    const obstacleMesh = new THREE.Mesh(obstacle.geometry, material);
    const laneIndex = Math.floor(Math.random() * 3);
    obstacleMesh.position.set(lanes[laneIndex], obstacle.yPos, player.position.z - 50);
    obstacleMesh.castShadow = true;
    scene.add(obstacleMesh);
    obstacles.push({ mesh: obstacleMesh, type: type });
    lastObstacleType = type;
}

function spawnObstacle() {
    if (gameActive) {
        // Ensure minimum distance between obstacles
        const minDistance = 15; // Minimum distance between obstacles
        const currentZ = player.position.z - 50;
        
        if (Math.abs(currentZ - lastObstacleZ) >= minDistance) {
            createObstacle();
            lastObstacleZ = currentZ;
            // Increase spawn interval for better gameplay
            setTimeout(spawnObstacle, Math.random() * 2000 + 1000);
        } else {
            // Check again soon if minimum distance not met
            setTimeout(spawnObstacle, 500);
        }
    }
}

function createCollectable() {
    // Include all regular collectibles and power-ups
    const types = [
        // Regular collectibles
        'blueprint', 'waterDrop', 'energyCell', 
        // Power-ups (with lower spawn probability)
        'hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'
    ];
    
    // Weighted random selection - power-ups are rarer
    let typePool = [];
    // Add regular collectibles with higher frequency
    for (let i = 0; i < 2; i++) { // Reduced from 3 to 2 to increase power-up chance
        typePool = typePool.concat(['blueprint', 'waterDrop', 'energyCell']);
    }
    // Add power-ups with increased frequency (add each power-up twice)
    typePool = typePool.concat(['hardHat', 'hardHat', 'helicopter', 'helicopter', 'solarPower', 'solarPower', 'windPower', 'windPower', 'waterPipeline', 'waterPipeline']);
    
    const type = typePool[Math.floor(Math.random() * typePool.length)];
    let geometry, material, color;

    let spawnPosition;
    let positionClear = false;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loop

    while (!positionClear && attempts < maxAttempts) {
        const laneIndex = Math.floor(Math.random() * 3);
        const zPos = player.position.z - 60 - (Math.random() * 20); // Add some z variation
        spawnPosition = new THREE.Vector3(lanes[laneIndex], 0.7, zPos);

        positionClear = true; // Assume clear until an obstacle is found
        for (const obstacle of obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);
            // Check if the spawn position (with a small buffer) intersects with an obstacle
            const collectiblePreviewBox = new THREE.Box3(
                new THREE.Vector3(spawnPosition.x - 0.5, spawnPosition.y - 0.5, spawnPosition.z - 0.5),
                new THREE.Vector3(spawnPosition.x + 0.5, spawnPosition.y + 0.5, spawnPosition.z + 0.5)
            );
            if (collectiblePreviewBox.intersectsBox(obstacleBox)) {
                positionClear = false;
                break;
            }
        }
        attempts++;
    }

    if (!positionClear) {
        console.log("Could not find a clear spot for collectible after", maxAttempts, "attempts. Skipping spawn.");
        return; // Skip spawning if no clear spot is found
    }

    switch (type) {
        // Regular collectibles
        case 'blueprint':
            geometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
            color = 0x0000ff; // Blue
            break;
        case 'waterDrop':
            geometry = new THREE.SphereGeometry(0.2, 16, 16);
            color = 0x00ffff; // Cyan
            break;
        case 'energyCell':
            geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 32);
            color = 0xffff00; // Yellow
            break;
            
        // Power-ups
        case 'hardHat': // Hard Hat Shield (temporary invincibility)
            geometry = new THREE.ConeGeometry(0.2, 0.4, 32);
            color = 0xffa500; // Orange
            break;
        case 'helicopter': // Helicopter Ride (flying)
            geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
            const rotorGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.1);
            material = new THREE.MeshStandardMaterial({ color: 0x444444 }); // Dark grey
            const collectableMesh = new THREE.Mesh(geometry, material);
            const rotor = new THREE.Mesh(rotorGeometry, material);
            rotor.position.y = 0.1;
            collectableMesh.add(rotor);
            collectableMesh.position.copy(spawnPosition);
            collectableMesh.castShadow = true;
            scene.add(collectableMesh);
            collectables.push({ mesh: collectableMesh, type: type });
            return; // Skip the rest of the function since we've already created the mesh
        case 'solarPower': // Solar Power Boost (speed + magnet)
            geometry = new THREE.CircleGeometry(0.25, 16);
            color = 0xffff00; // Bright yellow
            material = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });
            const solarMesh = new THREE.Mesh(geometry, material);
            solarMesh.rotation.x = -Math.PI / 2; // Lay flat
            solarMesh.position.copy(spawnPosition);
            solarMesh.castShadow = true;
            scene.add(solarMesh);
            collectables.push({ mesh: solarMesh, type: type });
            return;
        case 'windPower': // Wind Power (double jump)
            geometry = new THREE.SphereGeometry(0.2, 16, 16);
            color = 0xaaffaa; // Light green
            material = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: 0.7 });
            const windMesh = new THREE.Mesh(geometry, material);
            // Add some wind-like particles or effects
            const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const particleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            for (let i = 0; i < 5; i++) {
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.position.set(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                );
                windMesh.add(particle);
            }
            windMesh.position.copy(spawnPosition);
            windMesh.castShadow = true;
            scene.add(windMesh);
            collectables.push({ mesh: windMesh, type: type });
            return;
        case 'waterPipeline': // Water Pipeline (safe path)
            geometry = new THREE.TorusGeometry(0.2, 0.05, 16, 16);
            color = 0x0088ff; // Blue
            break;
    }
    
    material = new THREE.MeshStandardMaterial({ color: color });
    const collectableMesh = new THREE.Mesh(geometry, material);
    collectableMesh.position.copy(spawnPosition);
    
    // Make collectibles float a bit higher if they are above certain types of obstacles
    let yOffset = 0;
    for (const obstacle of obstacles) {
        if (Math.abs(obstacle.mesh.position.x - spawnPosition.x) < 1 && 
            Math.abs(obstacle.mesh.position.z - spawnPosition.z) < 1 &&
            obstacle.mesh.position.y > 0.1) { // Check if it's not a flat pothole
            yOffset = obstacle.mesh.geometry.parameters.height ? obstacle.mesh.geometry.parameters.height + 0.2 : 0.5; // Float above obstacle
            break;
        }
    }
    collectableMesh.position.y += yOffset;

    collectableMesh.castShadow = true;
    scene.add(collectableMesh);
    collectables.push({ mesh: collectableMesh, type: type });
}

function spawnCollectable() {
    if (gameActive) {
        createCollectable();
        setTimeout(spawnCollectable, Math.random() * 2000 + 1000);
    }
}

function setupEventListeners() {
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowResize, false);
}

function onKeyDown(event) {
    if (event.code === 'KeyR' && !gameActive) {
        restartGame();
        return;
    }
    if (!gameActive) return;

    switch (event.code) {
        case 'ArrowLeft':
            moveLeft();
            break;
        case 'ArrowRight':
            moveRight();
            break;
        case 'Space':
        case 'ArrowUp':
            jump();
            break;
    }
}

function moveLeft() {
    if (playerLane > 0) {
        playerLane--;
    }
}

function moveRight() {
    if (playerLane < 2) {
        playerLane++;
    }
}

function jump() {
    // Regular jump if not jumping
    if (!isJumping) {
        isJumping = true;
        playerVelocityY = 0.35; // Increased initial velocity to clear obstacles
        hasDoubleJumped = false; // Reset double jump flag
    } 
    // Double jump if Wind Power is active and we haven't used double jump yet
    else if (canDoubleJump && !hasDoubleJumped) {
        playerVelocityY = 0.3; // Slightly less powerful than first jump
        hasDoubleJumped = true;
        // Visual effect for double jump
        createJumpEffect();
    }
}

// Create a visual effect for double jump
function createJumpEffect() {
    const particleCount = 10;
    const particles = [];
    
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xaaffaa,
        transparent: true,
        opacity: 0.7
    });
    
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(player.position);
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.1,
                (Math.random() - 0.5) * 0.1
            ),
            life: 30 // frames of life
        };
        scene.add(particle);
        particles.push(particle);
    }
    
    // Set up a function to animate and remove particles
    function updateParticles() {
        let allDead = true;
        
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            particle.position.add(particle.userData.velocity);
            particle.userData.life--;
            
            // Fade out
            particle.material.opacity = particle.userData.life / 30 * 0.7;
            
            if (particle.userData.life <= 0) {
                scene.remove(particle);
                particles.splice(i, 1);
            } else {
                allDead = false;
            }
        }
        
        if (!allDead) {
            requestAnimationFrame(updateParticles);
        }
    }
    
    updateParticles();
}

function updatePlayerPosition() {
    const targetX = lanes[playerLane];
    player.position.x += (targetX - player.position.x) * 0.25; // Increased multiplier for snappier lane switching

    // Handle helicopter flying power-up
    if (isFlying) {
        // Maintain a high position while flying
        const flyHeight = 3.0;
        const prevY = player.position.y;
        player.position.y += (flyHeight - player.position.y) * 0.1;
        console.log(`Helicopter flying: Y from ${prevY.toFixed(2)} to ${player.position.y.toFixed(2)}, target: ${flyHeight}`);
        // No gravity affects the player while flying
    }
    // Handle normal jumping or falling
    else if (isJumping) {
        player.position.y += playerVelocityY;
        playerVelocityY += gravity;
        if (player.position.y <= 0.5) {
            player.position.y = 0.5;
            isJumping = false;
            playerVelocityY = 0;
            hasDoubleJumped = false; // Reset double jump when landing
        }
    }
    
    // If player is on water slide, gradually move to that lane
    if (hasWaterSlide && waterSlideObjects.length > 0) {
        // Find the lane of the water slide
        const slideSegment = waterSlideObjects[0];
        if (slideSegment) {
            // Find the closest lane to the slide
            let closestLane = 0;
            let minDistance = Math.abs(lanes[0] - slideSegment.position.x);
            
            for (let i = 1; i < lanes.length; i++) {
                const distance = Math.abs(lanes[i] - slideSegment.position.x);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestLane = i;
                }
            }
            
            // Gradually move player to that lane if not already there
            if (playerLane !== closestLane) {
                // Don't instantly change lane, just nudge player toward it
                const prevX = player.position.x;
                player.position.x += (lanes[closestLane] - player.position.x) * 0.05;
                console.log(`Water slide guiding: X from ${prevX.toFixed(2)} to ${player.position.x.toFixed(2)}, target lane: ${closestLane}`);
            }
        }
    }
}

function checkCollisions() {
    // Create a collision box for the player that better matches the visual model
    const playerBox = new THREE.Box3().setFromObject(player);
    // Make collision box slightly smaller than visual model for better precision
    const shrinkAmount = 0.1;
    playerBox.min.x += shrinkAmount;
    playerBox.max.x -= shrinkAmount;
    playerBox.min.z += shrinkAmount;
    playerBox.max.z -= shrinkAmount;

    // Check obstacle collisions if not invincible
    if (!isInvincible) {
        let collisionDetected = false;
        
        for (let i = 0; i < obstacles.length; i++) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacles[i].mesh);
            
            // Check if player is on water slide and if this obstacle is in the same lane as the slide
            let isProtectedByWaterSlide = false;
            
            if (hasWaterSlide && waterSlideObjects.length > 0) {
                // Find the lane of the water slide
                const slideSegment = waterSlideObjects[0];
                if (slideSegment) {
                    // Check if obstacle is in same lane as water slide
                    const slideLaneX = slideSegment.position.x;
                    const obstacleLaneX = obstacles[i].mesh.position.x;
                    
                    // If obstacle is close to the slide lane and within the slide path length
                    if (Math.abs(slideLaneX - obstacleLaneX) < 0.5 && 
                        obstacles[i].mesh.position.z < player.position.z + 5 && 
                        obstacles[i].mesh.position.z > player.position.z - 50) {
                        isProtectedByWaterSlide = true;
                    }
                }
            }
            
            // Only check collision if not protected by water slide
            if (!isProtectedByWaterSlide && playerBox.intersectsBox(obstacleBox)) {
                console.log('Collision detected with obstacle:', obstacles[i].type);
                console.log('Player position:', player.position);
                console.log('Obstacle position:', obstacles[i].mesh.position);
                collisionDetected = true;
                break;
            }
        }
        
        if (collisionDetected) {
            gameOver();
            return; // Exit after collision
        }
    }

    // Check collectable collisions
    for (let i = collectables.length - 1; i >= 0; i--) {
        const collectableBox = new THREE.Box3().setFromObject(collectables[i].mesh);
        
        // Normal collision detection
        if (playerBox.intersectsBox(collectableBox)) {
            collectItem(collectables[i].type, i);
        }
        // Extended range for Solar Power Boost magnet effect (visual only, actual collection still requires collision)
        else if (hasSolarBoost) {
            const magnetRadius = 5; // Same as in animate function
            const distance = player.position.distanceTo(collectables[i].mesh.position);
            
            // If close enough, create a visual trail effect toward the player
            if (distance < magnetRadius) {
                // Visual effect for magnet pull could be added here
                // For example, particle trail from collectible to player
            }
        }
    }
}

function collectItem(type, index) {
    scene.remove(collectables[index].mesh);
    collectables.splice(index, 1);

    // Sound effect for collecting items (placeholder - would need to implement audio)
    // playSound('collect');
    
    console.log(`Collected item: ${type}`); // Add logging for all collected items

    switch (type) {
        // Regular collectibles
        case 'blueprint':
            blueprints++;
            score += 50;
            break;
        case 'waterDrop':
            waterDrops++;
            score += 20;
            break;
        case 'energyCell':
            energyCells++;
            score += 30;
            break;
        // Special aerial collectible
        case 'aerialStar':
            score += 150; // Higher score for aerial stars
            console.log('Collected aerial star! +150 points');
            break;
            
        // Power-ups
        case 'hardHat':
            score += 100; // Bonus for power-up
            activateInvincibility(5000); // Invincible for 5 seconds (5000ms)
            addPowerUpToUI('🛡️ Hard Hat Shield', 5);
            break;
        case 'helicopter':
            score += 100;
            activateHelicopter(10000); // Flying for 10 seconds (10000ms)
            addPowerUpToUI('🚁 Helicopter Ride', 10);
            break;
        case 'solarPower':
            score += 100;
            activateSolarPower(8000); // Speed boost + magnet for 8 seconds
            addPowerUpToUI('🌟 Solar Power Boost', 8);
            break;
        case 'windPower':
            score += 100;
            activateWindPower(15000); // Double jump for 15 seconds
            addPowerUpToUI('💨 Wind Power', 15);
            break;
        case 'waterPipeline':
            score += 100;
            activateWaterSlide(12000); // Water slide path for 12 seconds
            addPowerUpToUI('🚰 Water Pipeline', 12);
            break;
    }
    updateScoreDisplay();
}

// Power-up activation functions
function activateHelicopter(duration) {
    console.log("Activating Helicopter Ride with duration:", duration);
    isFlying = true;
    flyingTimer = duration;
    // Visual effect: make player float higher
    player.position.y = 3.0;
    // Change player appearance to indicate flying
    player.material.color.set(0x888888); // Grey like a helicopter
    console.log("Helicopter Ride ACTIVE! Player position:", player.position.y);
}

function deactivateHelicopter() {
    isFlying = false;
    // Gently return player to normal height by initiating a controlled fall
    isJumping = true;
    playerVelocityY = 0; // Start with zero velocity for a gentle fall
    // The updatePlayerPosition function will handle the descent with gravity
    player.material.color.set(0xff0000); // Revert player color
    console.log("Helicopter Ride DEACTIVATED! Player position:", player.position.y);
}

function activateSolarPower(duration) {
    hasSolarBoost = true;
    solarBoostTimer = duration;
    // Increase game speed temporarily
    gameSpeed *= 1.5;
    // Visual effect: make player glow
    player.material.color.set(0xffff00); // Yellow glow
    console.log("Solar Power Boost ACTIVE!");
}

function deactivateSolarPower() {
    hasSolarBoost = false;
    // Return to normal speed
    gameSpeed /= 1.5;
    // Only revert color if no other power-ups are active
    if (!isInvincible && !isFlying && !hasWindPower && !hasWaterSlide) {
        player.material.color.set(0xff0000);
    }
    console.log("Solar Power Boost DEACTIVATED!");
}

function activateWindPower(duration) {
    hasWindPower = true;
    windPowerTimer = duration;
    canDoubleJump = true;
    hasDoubleJumped = false;
    // Visual effect: add wind particles around player
    player.material.color.set(0xaaffaa); // Light green
    console.log("Wind Power ACTIVE!");
}

function deactivateWindPower() {
    hasWindPower = false;
    canDoubleJump = false;
    // Only revert color if no other power-ups are active
    if (!isInvincible && !isFlying && !hasSolarBoost && !hasWaterSlide) {
        player.material.color.set(0xff0000);
    }
    console.log("Wind Power DEACTIVATED!");
}

function activateWaterSlide(duration) {
    console.log("Activating Water Pipeline with duration:", duration);
    hasWaterSlide = true;
    waterSlideTimer = duration;
    // Create water slide path
    createWaterSlidePath();
    // Visual effect: blue tint
    player.material.color.set(0x00aaff); // Blue
    console.log("Water Pipeline ACTIVE! Water slide objects created:", waterSlideObjects.length);
}

function deactivateWaterSlide() {
    hasWaterSlide = false;
    // Remove water slide path
    removeWaterSlidePath();
    // Only revert color if no other power-ups are active
    if (!isInvincible && !isFlying && !hasSolarBoost && !hasWindPower) {
        player.material.color.set(0xff0000);
    }
    console.log("Water Pipeline DEACTIVATED! Water slide objects remaining:", waterSlideObjects.length);
}

// Create a visual water slide path ahead of the player
function createWaterSlidePath() {
    // Remove any existing water slide
    removeWaterSlidePath();
    
    // Create a safe path ahead
    const slideLength = 50;
    const slideGeometry = new THREE.BoxGeometry(1, 0.1, 1);
    const slideMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff,
        transparent: true,
        opacity: 0.7
    });
    
    // Choose a random lane for the water slide
    const slideLane = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < slideLength; i++) {
        const slideSegment = new THREE.Mesh(slideGeometry, slideMaterial);
        slideSegment.position.set(
            lanes[slideLane],
            0.05, // Just above the ground
            player.position.z - 10 - i
        );
        scene.add(slideSegment);
        waterSlideObjects.push(slideSegment);
    }
}

function removeWaterSlidePath() {
    for (const obj of waterSlideObjects) {
        scene.remove(obj);
    }
    waterSlideObjects = [];
}

// Add power-up to UI display
function addPowerUpToUI(name, durationSeconds) {
    // Create a new power-up display element
    const powerUpElement = document.createElement('div');
    powerUpElement.style.position = 'absolute';
    powerUpElement.style.top = `${70 + powerUpElements.length * 30}px`;
    powerUpElement.style.left = '10px';
    powerUpElement.style.color = 'white';
    powerUpElement.style.fontFamily = 'Arial, sans-serif';
    powerUpElement.style.fontSize = '16px';
    powerUpElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    powerUpElement.style.padding = '5px';
    powerUpElement.style.borderRadius = '5px';
    powerUpElement.innerHTML = `${name}: ${durationSeconds}s`;
    document.body.appendChild(powerUpElement);
    
    // Add to active power-ups array
    const powerUp = {
        element: powerUpElement,
        name: name,
        duration: durationSeconds,
        startTime: Date.now()
    };
    powerUpElements.push(powerUp);
    activePowerUps.push(powerUp);
    
    // Set up timer to remove from UI when expired
    setTimeout(() => {
        if (powerUpElement.parentNode) {
            document.body.removeChild(powerUpElement);
        }
        powerUpElements = powerUpElements.filter(p => p !== powerUp);
        activePowerUps = activePowerUps.filter(p => p !== powerUp);
        // Reposition remaining power-ups
        powerUpElements.forEach((p, index) => {
            p.element.style.top = `${70 + index * 30}px`;
        });
    }, durationSeconds * 1000);
}

function activateInvincibility(duration) {
    isInvincible = true;
    invincibilityTimer = duration;
    player.material.color.set(0x00ff00); // Change player color to green when invincible
    console.log("Hard Hat Shield ACTIVE!");
}

function deactivateInvincibility() {
    isInvincible = false;
    player.material.color.set(0xff0000); // Revert player color
    console.log("Hard Hat Shield DEACTIVATED!");
}

function gameOver() {
    gameActive = false;
    gameOverElement.style.display = 'block';
    gameOverElement.innerHTML = `GAME OVER<br>Press R to Restart<br><br>Final Score: ${Math.floor(score)}<br>Blueprints: ${blueprints}<br>Water Drops: ${waterDrops}<br>Energy Cells: ${energyCells}`;
    console.log('Game Over! Final Score:', Math.floor(score));
    console.log(`Blueprints: ${blueprints}, Water Drops: ${waterDrops}, Energy Cells: ${energyCells}`);
}

function restartGame() {
    // Reset game state
    score = 0;
    blueprints = 0;
    waterDrops = 0;
    energyCells = 0;
    gameSpeed = 0.1;
    playerLane = 1;
    player.position.set(lanes[playerLane], 0.5, 0); // Player Z will be updated in animate
    camera.position.z = 5;
    gameActive = true;
    gameOverElement.style.display = 'none';
    
    // Reset player appearance
    player.material.color.set(0xff0000); // Red

    // Reset power-up states
    isInvincible = false;
    invincibilityTimer = 0;
    isFlying = false;
    flyingTimer = 0;
    hasSolarBoost = false;
    solarBoostTimer = 0;
    hasWindPower = false;
    windPowerTimer = 0;
    hasWaterSlide = false;
    waterSlideTimer = 0;
    canDoubleJump = false;
    hasDoubleJumped = false;
    
    // Clear power-up UI elements
    powerUpElements.forEach(p => {
        if (p.element && p.element.parentNode) {
            p.element.parentNode.removeChild(p.element);
        }
    });
    powerUpElements = [];
    activePowerUps = [];
    
    // Remove water slide objects
    removeWaterSlidePath();

    // Clear existing objects
    obstacles.forEach(o => scene.remove(o.mesh));
    obstacles = [];
    buildings.forEach(b => scene.remove(b));
    buildings = [];
    collectables.forEach(c => scene.remove(c.mesh));
    collectables = [];

    // Restart spawning
    spawnObstacle();
    spawnBuildings();
    spawnCollectable();
    updateScoreDisplay();
}

function updateScoreDisplay() {
    scoreElement.innerHTML = `Score: ${Math.floor(score)} | BP: ${blueprints} | WD: ${waterDrops} | EC: ${energyCells}`;
}

function updateObjects() {
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].mesh.position.z += gameSpeed;
        if (obstacles[i].mesh.position.z > camera.position.z + 5) {
            scene.remove(obstacles[i].mesh);
            obstacles.splice(i, 1);
            if(gameActive) score += 10; // Only score if game is active
        }
    }

    // Update buildings
    for (let i = buildings.length - 1; i >= 0; i--) {
        buildings[i].position.z += gameSpeed;
        if (buildings[i].position.z > camera.position.z + 10) {
            scene.remove(buildings[i]);
            buildings.splice(i, 1);
        }
    }

    // Update collectables
    for (let i = collectables.length - 1; i >= 0; i--) {
        collectables[i].mesh.position.z += gameSpeed;
        if (collectables[i].mesh.position.z > camera.position.z + 5) {
            scene.remove(collectables[i].mesh);
            collectables.splice(i, 1);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create special aerial collectibles that can only be collected while flying
function createAerialCollectable() {
    // Only spawn if player is flying
    if (!isFlying) return;
    
    // Create a special aerial collectable (star shape)
    const geometry = new THREE.OctahedronGeometry(0.3, 0); // Diamond/star-like shape
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffdd00, // Gold color
        emissive: 0xffaa00, // Slight glow
        metalness: 0.7,
        roughness: 0.3
    });
    
    const collectableMesh = new THREE.Mesh(geometry, material);
    
    // Position it ahead of the player at flying height
    const laneIndex = Math.floor(Math.random() * 3);
    collectableMesh.position.set(
        lanes[laneIndex],
        player.position.y + (Math.random() * 1 - 0.5), // Vary height slightly around player's flying height
        player.position.z - 30 - (Math.random() * 20) // Some distance ahead
    );
    
    // Add rotation animation
    collectableMesh.userData = {
        rotationSpeed: 0.05 + Math.random() * 0.05 // Random rotation speed
    };
    
    collectableMesh.castShadow = true;
    scene.add(collectableMesh);
    collectables.push({ mesh: collectableMesh, type: 'aerialStar' });
}

function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        updatePlayerPosition();
        updateObjects();
        checkCollisions();
        
        // Occasionally spawn aerial collectibles when flying
        if (isFlying && Math.random() < 0.02) { // 2% chance per frame
            createAerialCollectable();
        }
        
        // Rotate aerial stars
        for (const collectable of collectables) {
            if (collectable.type === 'aerialStar' && collectable.mesh.userData.rotationSpeed) {
                collectable.mesh.rotation.y += collectable.mesh.userData.rotationSpeed;
                collectable.mesh.rotation.x += collectable.mesh.userData.rotationSpeed * 0.5;
            }
        }

        // Smoothly update camera's x position to follow the player
        const cameraTargetX = player.position.x;
        camera.position.x += (cameraTargetX - camera.position.x) * 0.1; // Adjust smoothing factor as needed

        // Camera's Y position needs to follow player's Y position for jumps
        const cameraTargetY = player.position.y + 1.5; // Adjust Y offset for better view
        camera.position.y += (cameraTargetY - camera.position.y) * 0.1; // Smooth follow for Y

        camera.position.z -= gameSpeed;
        player.position.z = camera.position.z - 5; // Make player follow camera

        // Keep the ground plane centered under the camera
        if (ground) {
            ground.position.z = camera.position.z - (ground.geometry.parameters.height / 2) + 50; // Adjust so the road starts ahead
        }
        
        // Update water slide path position if active
        if (hasWaterSlide) {
            for (const obj of waterSlideObjects) {
                obj.position.z += gameSpeed;
            }
        }
        
        // Magnet effect for Solar Power Boost - attract nearby collectibles
        if (hasSolarBoost) {
            const magnetRadius = 5; // Range of magnet effect
            for (const collectable of collectables) {
                const distance = player.position.distanceTo(collectable.mesh.position);
                if (distance < magnetRadius) {
                    // Move collectible toward player
                    const direction = new THREE.Vector3().subVectors(player.position, collectable.mesh.position).normalize();
                    collectable.mesh.position.add(direction.multiplyScalar(0.2)); // Adjust speed as needed
                }
            }
        }
        
        // Update game speed and score
        gameSpeed += 0.00001;
        // Extra speed boost when Solar Power is active
        if (hasSolarBoost) {
            score += 0.2; // Double score rate with solar boost
        } else {
            score += 0.1; // Normal score rate
        }
        updateScoreDisplay();

        // Update power-up timers
        const frameTime = 1000 / 60; // Assuming 60 FPS
        
        // Hard Hat Shield (invincibility)
        if (isInvincible) {
            invincibilityTimer -= frameTime;
            if (invincibilityTimer <= 0) {
                deactivateInvincibility();
            }
        }
        
        // Helicopter Ride (flying)
        if (isFlying) {
            flyingTimer -= frameTime;
            if (flyingTimer <= 0) {
                deactivateHelicopter();
            }
        }
        
        // Solar Power Boost (speed + magnet)
        if (hasSolarBoost) {
            solarBoostTimer -= frameTime;
            if (solarBoostTimer <= 0) {
                deactivateSolarPower();
            }
        }
        
        // Wind Power (double jump)
        if (hasWindPower) {
            windPowerTimer -= frameTime;
            if (windPowerTimer <= 0) {
                deactivateWindPower();
            }
        }
        
        // Water Pipeline (safe path)
        if (hasWaterSlide) {
            waterSlideTimer -= frameTime;
            if (waterSlideTimer <= 0) {
                deactivateWaterSlide();
            }
        }
        
        // Update power-up UI timers
        for (const powerUp of activePowerUps) {
            const elapsed = (Date.now() - powerUp.startTime) / 1000;
            const remaining = Math.max(0, powerUp.duration - elapsed);
            if (powerUp.element) {
                powerUp.element.innerHTML = `${powerUp.name}: ${remaining.toFixed(1)}s`;
            }
        }
    }

    renderer.render(scene, camera);
}

// Initialize the game
init();