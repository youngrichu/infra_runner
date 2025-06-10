// Game Constants
export const GAME_CONFIG = {
    INITIAL_SPEED: 0.1,
    SPEED_INCREMENT: 0.00001,
    GRAVITY: -0.02,
    INITIAL_JUMP_VELOCITY: 0.35,
    DOUBLE_JUMP_VELOCITY: 0.3,
    GROUND_HEIGHT: 0.5,
    CAMERA_FOLLOW_SPEED: 0.1,
    LANE_SWITCH_SPEED: 0.25
};

export const LANES = {
    POSITIONS: [-2, 0, 2],
    COUNT: 3,
    LEFT: 0,
    CENTER: 1,
    RIGHT: 2
};

export const COLORS = {
    PLAYER: {
        DEFAULT: 0xff0000,
        INVINCIBLE: 0x00ff00,
        FLYING: 0x888888,
        SOLAR_BOOST: 0xffff00,
        WIND_POWER: 0xaaffaa,
        WATER_SLIDE: 0x00aaff
    },
    OBSTACLES: {
        POTHOLE: 0x333333,
        CONSTRUCTION_BARRIER: 0xff4444,
        CONE: 0xff8800,
        RUBBLE: 0x808080
    },
    COLLECTABLES: {
        BLUEPRINT: 0x0000ff,
        WATER_DROP: 0x00ffff,
        ENERGY_CELL: 0xffff00,
        HARD_HAT: 0xffa500,
        HELICOPTER: 0x444444,
        SOLAR_POWER: 0xffff00,
        WIND_POWER: 0xaaffaa,
        WATER_PIPELINE: 0x0088ff,
        AERIAL_STAR: 0xffdd00
    },
    ENVIRONMENT: {
        SKY: 0x87CEEB,
        ROAD_BASE: '#404040',
        ROAD_TEXTURE: '#505050',
        ROAD_MARKINGS: '#808080'
    }
};

export const SPAWN_CONFIG = {
    OBSTACLE_MIN_DISTANCE: 15,
    BUILDING_INTERVAL: { MIN: 1000, MAX: 3000 },
    COLLECTABLE_INTERVAL: { MIN: 1000, MAX: 3000 },
    OBSTACLE_INTERVAL: { MIN: 1000, MAX: 3000 },
    AERIAL_SPAWN_CHANCE: 0.02
};

export const POWER_UP_DURATIONS = {
    INVINCIBILITY: 5000,      // 5 seconds
    HELICOPTER: 10000,        // 10 seconds
    SOLAR_BOOST: 8000,        // 8 seconds
    WIND_POWER: 15000,        // 15 seconds
    WATER_SLIDE: 12000        // 12 seconds
};

export const SCORING = {
    OBSTACLE_PASSED: 10,
    BLUEPRINT: 50,
    WATER_DROP: 20,
    ENERGY_CELL: 30,
    POWER_UP: 100,
    AERIAL_STAR: 150,
    BASE_RATE: 0.1,
    SOLAR_BOOST_RATE: 0.2
};

export const PHYSICS = {
    MAGNET_RADIUS: 5,
    MAGNET_PULL_SPEED: 0.2,
    FLYING_HEIGHT: 3.0,
    COLLISION_SHRINK: 0.1
};

export const OBSTACLE_TYPES = {
    'pothole': {
        geometry: () => new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32),
        color: COLORS.OBSTACLES.POTHOLE,
        yPos: 0.05,
        description: 'Road damage that needs repair'
    },
    'constructionBarrier': {
        geometry: () => new THREE.BoxGeometry(1.5, 1, 0.3),
        color: COLORS.OBSTACLES.CONSTRUCTION_BARRIER,
        yPos: 0.5,
        description: 'Construction zone barrier'
    },
    'cone': {
        geometry: () => new THREE.ConeGeometry(0.3, 0.8, 32),
        color: COLORS.OBSTACLES.CONE,
        yPos: 0.4,
        description: 'Traffic cone marking road work'
    },
    'rubble': {
        geometry: () => new THREE.BoxGeometry(0.8, 0.4, 0.8),
        color: COLORS.OBSTACLES.RUBBLE,
        yPos: 0.2,
        description: 'Construction debris'
    }
};

export const COLLECTABLE_SPAWN_WEIGHTS = {
    REGULAR: ['blueprint', 'waterDrop', 'energyCell'],
    POWER_UPS: ['hardHat', 'helicopter', 'solarPower', 'windPower', 'waterPipeline'],
    REGULAR_WEIGHT: 2,
    POWER_UP_WEIGHT: 2
};