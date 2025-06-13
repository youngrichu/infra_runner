import * as THREE from 'three';

// Game Constants
export const GAME_CONFIG = {
    INITIAL_SPEED: 0.13,
    SPEED_INCREMENT: 0.000050,
    GRAVITY: -0.02,
    INITIAL_JUMP_VELOCITY: 0.35,
    DOUBLE_JUMP_VELOCITY: 0.3,
    GROUND_HEIGHT: 0.5,
    PLAYER_VISUAL_OFFSET: -0.35, // Offset to align GLB model visual center with collision box
    CAMERA_FOLLOW_SPEED: 0.1,
    LANE_SWITCH_SPEED: 0.25,
    DEBUG_COLLISIONS: false // Set to true to visualize player collision box
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
        AERIAL_STAR: 0xffdd00,
        SOLAR_ORB: 0xffcc33 // New: Solar energy collectible
    },
    ENVIRONMENT: {
        SKY_WARM: 0xFFDAB9, // PeachPuff for a warmer sky
        SKY: 0x87CEEB,
        ROAD_BASE: '#404040',
        ROAD_TEXTURE: '#505050',
        ROAD_MARKINGS: '#808080',
        TREE_TRUNK: 0x8B4513, // Brown
        TREE_FOLIAGE: 0x228B22, // Forest Green
        PAVEMENT: 0xAAAAAA,  // Light gray for pavement/concrete
        GREENERY: 0x90EE90,   // LightGreen
        CONSTRUCTION_GROUND: 0xD2B48C // Tan (for dirt/sand)
    },
    BUILDINGS: {
        INFRASTRUCTURE: 0x0000ff, // Existing blue for infrastructure
        COMMERCIAL_HIGHRISE: [0xCCCCCC, 0xD3D3D3, 0xC0C0C0], // Shades of gray/silver
        RESIDENTIAL_MIDRISE: [0xF5F5DC, 0xFFE4B5, 0xDEB887], // Beige, Moccasin, BurlyWood (earthy tones)
        UNDER_CONSTRUCTION: [0xA9A9A9, 0xCD853F, 0x8B4513] // DarkGray, Peru, SaddleBrown (concrete, wood, dirt)
    }
};

export const SPAWN_CONFIG = {
    OBSTACLE_MIN_DISTANCE: 12,
    OBSTACLE_SAFE_DISTANCE_MULTIPLIER: 1.5, // Increase minimum distance at high speeds
    BUILDING_INTERVAL: { MIN: 2000, MAX: 5000 }, // Reduced for more frequent clusters
    BUILDING_OFFSET_FROM_ROAD: 8, // Increased offset for wider side areas
    BUILDING_SPAWN_DISTANCE_AHEAD: 120, // How far ahead of the player buildings start spawning
    BUILDING_CLUSTER_SIZE: { MIN: 2, MAX: 5 }, // Number of buildings per cluster
    BUILDING_CLUSTER_SPREAD: 10, // Max random offset for buildings within a cluster
    STREET_DECORATION_INTERVAL: { MIN: 1000, MAX: 3000 }, // Interval for spawning street decorations
    STREET_DECORATION_CHANCE: 0.7, // Chance to spawn a street decoration in an interval
    STREET_DECORATION_OFFSET: 1.5, // How far from the edge of the lanes decorations spawn
    SIDE_AREA_LENGTH: 20, // Length of each side area segment
    SIDE_AREA_WIDTH: 25,  // Width of each side area segment (extending from road edge)
    SIDE_AREA_SPAWN_TRIGGER_OFFSET: 150, // When player is this far from last spawned side area, spawn new one
    SIDE_AREA_DESPAWN_OFFSET: 20, // When side area is this far behind camera, despawn it
    COLLECTABLE_INTERVAL: { MIN: 2000, MAX: 5000 },
    OBSTACLE_INTERVAL: { MIN: 1800, MAX: 3500 }, // Base interval, used if dynamic interval is disabled or as a starting point
    AERIAL_SPAWN_CHANCE: 0.02,
    SOLAR_ORB_SPAWN_CHANCE: 0.03, // Slightly higher chance than aerial stars
    OBSTACLE_DYNAMIC_INTERVAL: {
        ENABLED: true,
        MIN_CLAMP: 700,       // Absolute minimum spawn interval (ms)
        MAX_CLAMP_MIN_OFFSET: 300, // Ensures MAX_CLAMP is always at least MIN_CLAMP + this offset
        // How much the interval (both min and max of the range) decreases per unit of game speed.
        // e.g., if gameSpeed is 0.2 and sensitivity is 5000, reduction is 0.2 * 5000 = 1000ms.
        SPEED_SENSITIVITY: 6000 
    }
};

export const POWER_UP_DURATIONS = {
    INVINCIBILITY: 5000,      // 5 seconds
    HELICOPTER: 10000,        // 10 seconds
    SOLAR_BOOST: 8000,        // 8 seconds
    WIND_POWER: 15000,        // 15 seconds
    WATER_SLIDE: 12000        // 12 seconds
};

export const SCORING = {
    OBSTACLE_PASSED: 15,
    BLUEPRINT: 50,
    WATER_DROP: 20,
    ENERGY_CELL: 30,
    POWER_UP: 100,
    AERIAL_STAR: 150,
    SOLAR_ORB: 120, // New: Slightly less than aerial stars since they're easier to get
    BASE_RATE: 0.15,
    SOLAR_BOOST_RATE: 0.2
};

export const PHYSICS = {
    MAGNET_RADIUS: 5,
    MAGNET_PULL_SPEED: 0.2,
    FLYING_HEIGHT: 1.0, // Character flies around Y=1.0 based on console logs
    COLLISION_SHRINK: 0.1, // General shrink for X and Z axes
    COLLISION_SHRINK_Y: 0.0, // Specific shrink for Y axis (bottom of the player) - Set to 0 to minimize lifting
    
    // High-speed collision detection settings
    HIGH_SPEED_THRESHOLD: 0.15, // Speed at which to use enhanced collision detection
    COLLECTABLE_EXPANSION_BASE: 0.3, // Base expansion for collectable collection radius
    COLLECTABLE_SPEED_EXPANSION: 2, // How much collection radius grows with speed
    MAGNET_EXPANSION_BONUS: 0.5, // Additional expansion when magnet effect is active
    SAFE_SPAWN_DISTANCE_BASE: 3, // Base safe distance for spawning objects
    SAFE_SPAWN_DISTANCE_SPEED_MULTIPLIER: 10, // Distance multiplier based on speed
    MAX_COLLISION_BOX_EXPANSION: 1.2 // Maximum factor for collision box expansion
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
    REGULAR_WEIGHT: 6, // Reduced from 15 to make power-ups more frequent
    POWER_UP_WEIGHT: 1
};