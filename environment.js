import { LANES, COLORS, SPAWN_CONFIG } from './constants.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.buildings = [];
        this.gameController = null; // Will be set by game.js
        
        this.setupScene();
        this.setupLighting();
        this.createGround();
    }

    setGameController(gameController) {
        this.gameController = gameController;
    }

    setupScene() {
        this.scene.background = new THREE.Color(COLORS.ENVIRONMENT.SKY);
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    createGround() {
        // Create a canvas for the road texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');

        // Fill background
        context.fillStyle = COLORS.ENVIRONMENT.ROAD_BASE;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add some road texture details
        context.fillStyle = COLORS.ENVIRONMENT.ROAD_TEXTURE;
        for(let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            context.fillRect(x, y, 4, 4);
        }

        // Create lines for road markings
        context.fillStyle = COLORS.ENVIRONMENT.ROAD_MARKINGS;
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
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    createBuilding(x, z, isInfrastructure = false) {
        const height = isInfrastructure ? Math.random() * 1 + 0.5 : Math.random() * 5 + 3;
        const width = isInfrastructure ? 0.3 : 2;
        const depth = isInfrastructure ? 2 : 2;
        const color = isInfrastructure ? 0x0000ff : Math.random() * 0xffffff;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);
        
        if (!isInfrastructure) {
            this.buildings.push(building);
        }
        return building;
    }

    startSpawning() {
        this.spawnBuildings();
    }

    spawnBuildings() {
        if (!this.gameController || !this.gameController.isGameActive()) {
            return;
        }
        
        const playerZ = this.gameController.getPlayerPosition().z;
        const z = playerZ - 100;
        this.createBuilding(LANES.POSITIONS[LANES.LEFT] - 3, z);
        this.createBuilding(LANES.POSITIONS[LANES.RIGHT] + 3, z);
        
        setTimeout(() => {
            this.spawnBuildings(); // Recursive call without parameters
        }, Math.random() * SPAWN_CONFIG.BUILDING_INTERVAL.MAX + SPAWN_CONFIG.BUILDING_INTERVAL.MIN);
    }

    updateBuildings(gameSpeed, cameraZ) {
        for (let i = this.buildings.length - 1; i >= 0; i--) {
            this.buildings[i].position.z += gameSpeed;
            if (this.buildings[i].position.z > cameraZ + 10) {
                this.scene.remove(this.buildings[i]);
                this.buildings.splice(i, 1);
            }
        }
    }

    updateGround(cameraZ) {
        if (this.ground) {
            this.ground.position.z = cameraZ - (this.ground.geometry.parameters.height / 2) + 50;
        }
    }

    reset() {
        // Clear all buildings
        this.buildings.forEach(building => this.scene.remove(building));
        this.buildings = [];
    }

    getGround() {
        return this.ground;
    }
}