// Generated Model Configurations with Performance Optimizations
export const MODEL_CONFIGURATIONS = {
    // ✅ WORKING COLLECTABLES
    "waterDrop": {
        "path": "/assets/models/collectables/Bucket.glb",
        "scale": [0.010, 0.010, 0.010], // Increased from 0.007 - bucket was too small
        "originalSize": { "x": "56.540", "y": "45.044", "z": "51.333" },
        "targetSize": { "x": "0.400", "y": "0.400", "z": "0.400" },
        "fallback": "sphere", // SphereGeometry(0.2, 16, 16)
        "priority": "high"
    },
    
    "aerialStar": {
        "path": "/assets/models/collectables/Star.glb",
        "scale": [0.003, 0.003, 0.003], // Optimized scale from analysis
        "originalSize": { "x": "49.115", "y": "203.513", "z": "193.552" },
        "targetSize": { "x": "0.600", "y": "0.600", "z": "0.600" },
        "fallback": "octahedron", // OctahedronGeometry(0.3, 0)
        "priority": "low",
        "useModelLoading": false // Disabled - use fallback octahedron geometry
    },
    
    // ✅ DRACO COLLECTABLES (now working with DracoLoader)
    "blueprint": {
        "path": "/assets/models/collectables/blue_print.glb",
        "scale": [0.800, 0.800, 0.800], // Much larger - blueprint was too small
        "fallback": "box", // BoxGeometry(0.3, 0.3, 0.05)
        "priority": "medium",
        "usesDraco": true // Draco compressed model
    },
    
    "energyCell": {
        "path": "/assets/models/collectables/energy-cell.glb", 
        "scale": [0.350, 0.350, 0.350], // Increased from 0.201 - was too small
        "fallback": "cylinder", // CylinderGeometry(0.15, 0.15, 0.4, 32)
        "priority": "medium",
        "usesDraco": true // Draco compressed model
    },
    
    // ✅ WORKING POWER-UPS
    "solarPower": {
        "path": "/assets/models/power-ups/Solar_Panel_Ground.glb",
        "scale": [0.350, 0.350, 0.350], // Reduced from 0.400 - still a tiny bit too big
        "originalSize": { "x": "1.289", "y": "1.096", "z": "1.667" },
        "targetSize": { "x": "0.500", "y": "0.100", "z": "0.500" },
        "fallback": "circle", // CircleGeometry(0.25, 16)
        "priority": "high"
    },
    
    "windPower": {
        "path": "/assets/models/power-ups/Boots.glb",
        "scale": [0.600, 0.600, 0.600], // Increased from 0.421 - boots were too small
        "originalSize": { "x": "0.950", "y": "0.587", "z": "0.709" },
        "targetSize": { "x": "0.400", "y": "0.400", "z": "0.400" },
        "fallback": "sphere", // SphereGeometry(0.2, 16, 16) with particles
        "priority": "high"
    },
    
    "waterPipeline": {
        "path": "/assets/models/power-ups/FireHydrant.glb",
        "scale": [0.800, 0.800, 0.800], // Much larger - fire hydrant was too small
        "originalSize": { "x": "0.515", "y": "0.772", "z": "0.399" },
        "targetSize": { "x": "0.400", "y": "0.400", "z": "0.100" },
        "fallback": "torus", // TorusGeometry(0.2, 0.05, 16, 16)
        "priority": "high"
    },
    
    // ✅ DRACO POWER-UPS (now working with DracoLoader)
    "hardHat": {
        "path": "/assets/models/power-ups/hard_hat.glb",
        "scale": [0.002, 0.002, 0.002], // Increased from 0.001 - hard hat was too small
        "fallback": "cone", // ConeGeometry(0.2, 0.4, 32)
        "priority": "high",
        "usesDraco": true // Draco compressed model
    },
    
    "helicopter": {
        "path": "/assets/models/power-ups/Jet-Pack.glb",
        "scale": [0.300, 0.300, 0.300], // Increased from 0.150 - jet pack was too small
        "fallback": "custom", // Custom helicopter mesh with rotor
        "priority": "high",
        "usesDraco": true // Draco compressed model
    },
    
    // ✅ WORKING OBSTACLES
    "pothole": {
        "path": "/assets/models/obstacles/Floor Hole.glb",
        "scale": [0.833, 0.833, 0.833], // Good size
        "originalSize": { "x": "1.200", "y": "0.204", "z": "1.200" },
        "targetSize": { "x": "1.000", "y": "0.200", "z": "1.000" },
        "fallback": "cylinder", // CylinderGeometry(0.5, 0.5, 0.1, 32)
        "priority": "high"
    },
    
    "constructionBarrier": {
        "path": "/assets/models/obstacles/Plastic_Barrier.glb",
        "scale": [0.898, 0.898, 0.898], // Good size
        "originalSize": { "x": "1.035", "y": "0.600", "z": "0.334" },
        "targetSize": { "x": "1.500", "y": "1.000", "z": "0.300" },
        "fallback": "box", // BoxGeometry(1.5, 1, 0.3)
        "priority": "high"
    },
    
    "cone": {
        "path": "/assets/models/obstacles/Cone.glb",
        "scale": [0.886, 0.886, 0.886], // Good size
        "originalSize": { "x": "0.600", "y": "0.903", "z": "0.600" },
        "targetSize": { "x": "0.600", "y": "0.800", "z": "0.600" },
        "fallback": "cone", // ConeGeometry(0.3, 0.8, 32)
        "priority": "high"
    },
    
    // ✅ FIXED OVERSIZED MODEL (now properly scaled)
    "rubble": {
        "path": "/assets/models/obstacles/Cinder_block.glb",
        "scale": [0.000002, 0.000002, 0.000002], // Optimized scale from analysis (rounded)
        "originalSize": { "x": "367058.375", "y": "206465.234", "z": "211940.000" },
        "targetSize": { "x": "0.800", "y": "0.400", "z": "0.800" },
        "fallback": "box", // BoxGeometry(0.8, 0.4, 0.8)
        "priority": "medium",
        "useModelLoading": true, // Now enabled with proper scale
        "note": "Model was extremely oversized - now using optimized tiny scale"
    }
};

// Helper function to get configuration for a model type
export function getModelConfig(modelType) {
    return MODEL_CONFIGURATIONS[modelType] || null;
}

// Helper function to check if model should use GLB loading
export function shouldLoadModel(modelType) {
    const config = MODEL_CONFIGURATIONS[modelType];
    return config && config.useModelLoading !== false;
}

// Priority loading order (load these first for better user experience)
export const PRIORITY_LOADING_ORDER = [
    'pothole',           // Most common obstacle
    'cone',              // Most common obstacle  
    'constructionBarrier', // Common obstacle
    'rubble',            // Common obstacle (now fixed and enabled)
    'waterDrop',         // Common collectable (bucket)
    'blueprint',         // Now working with Draco
    'energyCell',        // Now working with Draco
    'hardHat',           // Now working with Draco
    'helicopter',        // Now working with Draco
    'windPower',         // Popular power-up (boots)
    'waterPipeline',     // Popular power-up (fire hydrant)
    'solarPower',        // Power-up (solar panel)
    'aerialStar'         // Special collectable (star)
];

// Models to skip entirely (use fallbacks only)
export const SKIP_MODEL_LOADING = [
    // All models now supported with proper scaling and Draco support
];

// Performance settings
export const MODEL_PERFORMANCE_SETTINGS = {
    // Batch size for loading models (don't overwhelm the GPU)
    batchSize: 3,
    
    // Delay between batch loads (ms)
    batchDelay: 500,
    
    // Maximum time to wait for a model to load (ms)
    loadTimeout: 5000,
    
    // Enable object pooling for model instances
    enablePooling: true,
    
    // Maximum number of model instances to keep in memory
    maxPoolSize: 20
};

export default MODEL_CONFIGURATIONS;