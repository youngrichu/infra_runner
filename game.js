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

let lastObstacleType = '';
let lastObstacleZ = 0;

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
    // const obstacleMesh = new THREE.Mesh(obstacle.geometry, material); // This line is redundant

    const obstacleMesh = new THREE.Mesh(obstacle.geometry, material); // Corrected: use obstacle.geometry
    const laneIndex = Math.floor(Math.random() * 3);
    obstacleMesh.position.set(lanes[laneIndex], obstacle.yPos, player.position.z - 50); // Corrected: use obstacle.yPos
    obstacleMesh.castShadow = true;
    scene.add(obstacleMesh);
    obstacles.push({ mesh: obstacleMesh, type: type });
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
    const types = ['blueprint', 'waterDrop', 'energyCell', 'hardHat']; // Added hardHat
    const type = types[Math.floor(Math.random() * types.length)];
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
        case 'hardHat': // Hard Hat Power-up
            geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4); // Placeholder shape
            color = 0xaaaaaa; // Grey
            break;
    }
    material = new THREE.MeshStandardMaterial({ color: color });
    const collectableMesh = new THREE.Mesh(geometry, material);
    collectableMesh.position.copy(spawnPosition);
    // Make collectibles float a bit higher if they are above certain types of obstacles
    // This requires knowing the obstacle type at spawnPosition, which is complex with current setup.
    // For now, we ensure they don't spawn *inside* obstacles.
    // A simpler approach for floating: slightly increase Y if an obstacle is very close on XZ plane.
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
    if (!isJumping) {
        isJumping = true;
        playerVelocityY = 0.35; // Increased initial velocity to clear obstacles
    }
}

function updatePlayerPosition() {
    const targetX = lanes[playerLane];
    player.position.x += (targetX - player.position.x) * 0.25; // Increased multiplier for snappier lane switching

    if (isJumping) {
        player.position.y += playerVelocityY;
        playerVelocityY += gravity;
        if (player.position.y <= 0.5) {
            player.position.y = 0.5;
            isJumping = false;
            playerVelocityY = 0;
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

    if (!isInvincible) {
        for (let i = 0; i < obstacles.length; i++) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacles[i].mesh);
            if (playerBox.intersectsBox(obstacleBox)) {
                console.log('Collision detected with obstacle:', obstacles[i].type);
                console.log('Player position:', player.position);
                console.log('Obstacle position:', obstacles[i].mesh.position);
                gameOver();
                return; // Exit after first collision
            }
        }
    }

    // Check collectable collisions
    for (let i = collectables.length - 1; i >= 0; i--) {
        const collectableBox = new THREE.Box3().setFromObject(collectables[i].mesh);
        if (playerBox.intersectsBox(collectableBox)) {
            collectItem(collectables[i].type, i);
        }
    }
}

function collectItem(type, index) {
    scene.remove(collectables[index].mesh);
    collectables.splice(index, 1);

    switch (type) {
        case 'blueprint':
            blueprints++;
            score += 50;
            // createBuilding(player.position.x, player.position.z + 2, true); // Removed infrastructure trail
            break;
        case 'waterDrop':
            waterDrops++;
            score += 20;
            // createBuilding(player.position.x, player.position.z + 3, true); // Removed infrastructure trail
            break;
        case 'energyCell':
            energyCells++;
            score += 30;
            // Could trigger a temporary power-up effect here
            break;
        case 'hardHat':
            score += 100; // Bonus for power-up
            activateInvincibility(5000); // Invincible for 5 seconds (5000ms)
            break;
    }
    updateScoreDisplay();
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

function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        updatePlayerPosition();
        updateObjects();
        checkCollisions();

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
        
        gameSpeed += 0.00001;
        score += 0.1; // Continuous score for running
        updateScoreDisplay();

        if (isInvincible) {
            invincibilityTimer -= 1000 / 60; // Assuming 60 FPS, decrement timer
            if (invincibilityTimer <= 0) {
                deactivateInvincibility();
            }
        }
    }

    renderer.render(scene, camera);
}

// Initialize the game
init();