// Simplified onboarding model viewer that reliably works in both dev and production
export class OnboardingModelViewer {
    constructor() {
        this.viewers = new Map();
        this.loadedModels = new Map();
        this.animationIds = new Map();
        
        // Will be initialized in init() method
        this.THREE = null;
        this.GLTFLoader = null;
        this.DRACOLoader = null;
        this.MODEL_CONFIGURATIONS = null;
        this.loader = null;
        this.dracoLoader = null;
        this.isInitialized = false;
    }
    
    async init() {
        if (this.isInitialized) {
            return this;
        }

        // Simplified approach: Always use globals first, fallback to imports
        if (await this.tryGlobalVariables()) {
            this.isInitialized = true;
            this.initializeLoaders();
            return this;
        }

        // If globals not available, try dynamic imports (development mode)
        if (await this.tryDynamicImports()) {
            this.isInitialized = true;
            this.initializeLoaders();
            return this;
        }

        // Final fallback: wait for globals to be available
        await this.waitForGlobals();
        this.isInitialized = true;
        this.initializeLoaders();
        return this;
    }

    async tryGlobalVariables() {
        if (window.THREE && window.GLTFLoader && window.DRACOLoader && window.MODEL_CONFIGURATIONS) {
            this.THREE = window.THREE;
            this.GLTFLoader = window.GLTFLoader;
            this.DRACOLoader = window.DRACOLoader;
            this.MODEL_CONFIGURATIONS = window.MODEL_CONFIGURATIONS;
            return true;
        }
        return false;
    }

    async tryDynamicImports() {
        try {
            const [threeModule, gltfModule, dracoModule, configModule] = await Promise.all([
                import('three'),
                import('three/examples/jsm/loaders/GLTFLoader.js'),
                import('three/examples/jsm/loaders/DRACOLoader.js'),
                import('./model-configurations.js')
            ]);
            
            this.THREE = threeModule;
            this.GLTFLoader = gltfModule.GLTFLoader;
            this.DRACOLoader = dracoModule.DRACOLoader;
            this.MODEL_CONFIGURATIONS = configModule.MODEL_CONFIGURATIONS;
            return true;
        } catch (error) {
            return false;
        }
    }

    async waitForGlobals() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds max wait
            
            const checkGlobals = () => {
                attempts++;
                
                if (window.THREE && window.GLTFLoader && window.DRACOLoader && window.MODEL_CONFIGURATIONS) {
                    this.THREE = window.THREE;
                    this.GLTFLoader = window.GLTFLoader;
                    this.DRACOLoader = window.DRACOLoader;
                    this.MODEL_CONFIGURATIONS = window.MODEL_CONFIGURATIONS;
                    
                    // Log successful initialization
                    if (window.Sentry) {
                        window.Sentry.addBreadcrumb({
                            message: 'OnboardingModelViewer globals initialized successfully',
                            level: 'info',
                            category: 'initialization',
                            data: { attempts, method: 'waitForGlobals' }
                        });
                    }
                    
                    resolve();
                } else if (attempts >= maxAttempts) {
                    const error = new Error('Timeout waiting for Three.js and MODEL_CONFIGURATIONS');
                    
                    // Report timeout to Sentry
                    if (window.Sentry) {
                        window.Sentry.captureException(error, {
                            tags: { component: 'onboarding-model-viewer', timeout: 'true' },
                            extra: {
                                attempts,
                                availableGlobals: {
                                    THREE: !!window.THREE,
                                    GLTFLoader: !!window.GLTFLoader,
                                    DRACOLoader: !!window.DRACOLoader,
                                    MODEL_CONFIGURATIONS: !!window.MODEL_CONFIGURATIONS
                                }
                            }
                        });
                    }
                    
                    reject(error);
                } else {
                    setTimeout(checkGlobals, 100);
                }
            };
            
            checkGlobals();
        });
    }
    
    initializeLoaders() {
        this.loader = new this.GLTFLoader();
        this.dracoLoader = new this.DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.loader.setDRACOLoader(this.dracoLoader);
    }
    
    async createModelViewer(containerId, modelKey, description) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.borderRadius = '8px';
        canvas.style.background = 'linear-gradient(135deg, #1a1a1a, #2a2a2a)';
        canvas.style.border = '1px solid #333';
        
        // Create scene
        const scene = new this.THREE.Scene();
        const camera = new this.THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        const renderer = new this.THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(120, 120);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;

        // Add lighting (matching main game lighting)
        const ambientLight = new this.THREE.AmbientLight(0xFFE5B4, 0.9);
        scene.add(ambientLight);
        
        const directionalLight = new this.THREE.DirectionalLight(0xFFFFE0, 1.2);
        directionalLight.position.set(2, 2, 2);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const fillLight = new this.THREE.DirectionalLight(0xFFE5B4, 0.4);
        fillLight.position.set(-2, 1, -1);
        scene.add(fillLight);
        
        const topLight = new this.THREE.DirectionalLight(0xFFFFE0, 0.6);
        topLight.position.set(0, 3, 0);
        scene.add(topLight);

        // Position camera for optimal viewing
        camera.position.set(0.5, 0.5, 2.5);
        camera.lookAt(0, 0, 0);

        // Load and add model with enhanced error handling
        let model;
        let usingFallback = false;
        try {
            // Add breadcrumb for model loading attempt
            if (window.Sentry) {
                window.Sentry.addBreadcrumb({
                    message: `Loading 3D model: ${modelKey}`,
                    level: 'info',
                    category: 'model-loading',
                    data: { modelKey, containerId }
                });
            }
            
            model = await this.loadModel(modelKey);
            
            // Add breadcrumb for successful model loading
            if (window.Sentry) {
                window.Sentry.addBreadcrumb({
                    message: `Successfully loaded 3D model: ${modelKey}`,
                    level: 'info',
                    category: 'model-loading',
                    data: { modelKey, containerId, success: true }
                });
            }
        } catch (error) {
            // Model loading failed, create fallback
            usingFallback = true;
            model = this.createFallbackModel(modelKey);
            
            // Report model loading failure to Sentry
            if (window.Sentry) {
                window.Sentry.captureException(error, {
                    tags: { 
                        component: 'onboarding-model-viewer',
                        modelKey: modelKey,
                        fallback: 'true'
                    },
                    extra: {
                        modelPath: this.MODEL_CONFIGURATIONS?.[modelKey]?.path,
                        containerDiv: containerId
                    }
                });
            }
            
            // Add visual indicator for fallback models
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(255, 152, 0, 0.8);
                color: white;
                font-size: 10px;
                padding: 2px 4px;
                border-radius: 3px;
                z-index: 100;
            `;
            indicator.textContent = 'Preview';
            container.style.position = 'relative';
            container.appendChild(indicator);
        }

        if (model) {
            scene.add(model);
            
            const box = new this.THREE.Box3().setFromObject(model);
            const center = box.getCenter(new this.THREE.Vector3());
            const size = box.getSize(new this.THREE.Vector3());
            
            model.position.set(-center.x, -center.y, -center.z);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.8;
            const scale = targetSize / maxDim;
            model.scale.multiplyScalar(scale);
            
            box.setFromObject(model);
            const newCenter = box.getCenter(new this.THREE.Vector3());
            model.position.set(-newCenter.x, -newCenter.y, -newCenter.z);
            model.position.y -= 0.1;
        }

        // Animation loop - simple rotation only
        let rotationSpeed = 0.01;
        const animate = () => {
            if (model) {
                model.rotation.y += rotationSpeed;
            }
            renderer.render(scene, camera);
            const animationId = requestAnimationFrame(animate);
            this.animationIds.set(containerId, animationId);
        };

        animate();

        // Store viewer data
        this.viewers.set(containerId, {
            scene,
            camera,
            renderer,
            model,
            canvas
        });

        // Replace container content
        container.innerHTML = `
            <div style="text-align: center;">
                <div style="margin-bottom: 8px;"></div>
                <div style="font-size: 12px; color: #ccc;">${description}</div>
            </div>
        `;
        container.children[0].children[0].appendChild(canvas);

        return canvas;
    }
    
    async loadModel(modelKey) {
        if (this.loadedModels.has(modelKey)) {
            return this.loadedModels.get(modelKey).clone();
        }

        const config = this.MODEL_CONFIGURATIONS?.[modelKey];
        if (!config) {
            throw new Error(`No configuration found for model: ${modelKey}`);
        }

        return new Promise((resolve, reject) => {
            // Add timeout for model loading
            const timeout = setTimeout(() => {
                reject(new Error(`Model loading timeout for ${modelKey}`));
            }, 10000); // 10 second timeout

            this.loader.load(
                config.path,
                (gltf) => {
                    clearTimeout(timeout);
                    
                    try {
                        const model = gltf.scene;
                        
                        if (config.scale) {
                            model.scale.set(...config.scale);
                        }
                        
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (child.material) {
                                    child.material = child.material.clone();
                                    child.material.metalness = 0.2;
                                    child.material.roughness = 0.6;
                                    
                                    if (child.material.color) {
                                        child.material.color.multiplyScalar(1.2);
                                    }
                                    
                                    child.material.emissive = new this.THREE.Color(0x222222);
                                    child.material.needsUpdate = true;
                                }
                            }
                        });
                        
                        this.loadedModels.set(modelKey, model);
                        resolve(model.clone());
                    } catch (processingError) {
                        reject(new Error(`Error processing model ${modelKey}: ${processingError.message}`));
                    }
                },
                (progress) => {
                    // Loading progress - can be used for debugging
                },
                (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`Failed to load model ${modelKey} from ${config.path}: ${error.message || error}`));
                }
            );
        });
    }
    
    createFallbackModel(modelKey) {
        const config = this.MODEL_CONFIGURATIONS?.[modelKey];
        let geometry;
        let color = 0x666666;

        // Enhanced fallback models with better visuals
        switch (config?.fallback) {
            case 'box':
                geometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.1);
                color = 0x4a90e2;
                break;
            case 'sphere':
                geometry = new this.THREE.SphereGeometry(0.3, 16, 16);
                color = 0x00bcd4;
                break;
            case 'cylinder':
                geometry = new this.THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
                color = 0xffc107;
                break;
            case 'cone':
                geometry = new this.THREE.ConeGeometry(0.25, 0.5, 16);
                color = 0xff9800;
                break;
            case 'circle':
                geometry = new this.THREE.CircleGeometry(0.35, 16);
                color = 0xffc107;
                break;
            case 'octahedron':
                geometry = new this.THREE.OctahedronGeometry(0.3, 0);
                color = 0xffeb3b;
                break;
            default:
                // Create a more recognizable fallback based on model type
                if (modelKey.includes('blueprint')) {
                    geometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.05);
                    color = 0x2196f3;
                } else if (modelKey.includes('water') || modelKey.includes('bucket')) {
                    geometry = new this.THREE.CylinderGeometry(0.2, 0.25, 0.4, 16);
                    color = 0x03a9f4;
                } else if (modelKey.includes('energy') || modelKey.includes('cell')) {
                    geometry = new this.THREE.CylinderGeometry(0.15, 0.15, 0.4, 8);
                    color = 0x4caf50;
                } else if (modelKey.includes('star')) {
                    geometry = new this.THREE.OctahedronGeometry(0.25, 0);
                    color = 0xffeb3b;
                } else {
                    geometry = new this.THREE.BoxGeometry(0.4, 0.4, 0.4);
                    color = 0x9e9e9e;
                }
                break;
        }

        // Enhanced material with better lighting response
        const material = new this.THREE.MeshLambertMaterial({ 
            color: color,
            emissive: new this.THREE.Color(color).multiplyScalar(0.1),
            transparent: false,
            opacity: 1.0
        });
        
        const mesh = new this.THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Add a subtle outline for better visibility
        const outlineGeometry = geometry.clone();
        const outlineMaterial = new this.THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            side: this.THREE.BackSide,
            transparent: true,
            opacity: 0.1
        });
        const outline = new this.THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.scale.multiplyScalar(1.05);
        
        const group = new this.THREE.Group();
        group.add(mesh);
        group.add(outline);
        
        return group;
    }
    
    cleanup() {
        // Cancel all animation frames first
        this.animationIds.forEach((id) => {
            cancelAnimationFrame(id);
        });
        this.animationIds.clear();

        // Properly dispose of all WebGL resources
        this.viewers.forEach((viewer, containerId) => {
            try {
                // Dispose of scene resources
                if (viewer.scene) {
                    viewer.scene.traverse((child) => {
                        if (child.geometry) {
                            child.geometry.dispose();
                        }
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(material => {
                                    if (material.map) material.map.dispose();
                                    if (material.normalMap) material.normalMap.dispose();
                                    if (material.roughnessMap) material.roughnessMap.dispose();
                                    if (material.metalnessMap) material.metalnessMap.dispose();
                                    material.dispose();
                                });
                            } else {
                                if (child.material.map) child.material.map.dispose();
                                if (child.material.normalMap) child.material.normalMap.dispose();
                                if (child.material.roughnessMap) child.material.roughnessMap.dispose();
                                if (child.material.metalnessMap) child.material.metalnessMap.dispose();
                                child.material.dispose();
                            }
                        }
                    });
                    
                    // Clear scene
                    while (viewer.scene.children.length > 0) {
                        viewer.scene.remove(viewer.scene.children[0]);
                    }
                }

                // Force WebGL context cleanup
                if (viewer.renderer) {
                    // Get WebGL context before disposing
                    const gl = viewer.renderer.getContext();
                    
                    // Dispose of renderer
                    viewer.renderer.dispose();
                    viewer.renderer.forceContextLoss();
                    
                    // Force garbage collection if available
                    if (viewer.renderer.domElement) {
                        viewer.renderer.domElement.remove();
                    }
                    
                    // Additional WebGL context cleanup
                    if (gl && gl.getExtension) {
                        const loseContext = gl.getExtension('WEBGL_lose_context');
                        if (loseContext) {
                            loseContext.loseContext();
                        }
                    }
                }

                // Remove canvas from DOM
                if (viewer.canvas && viewer.canvas.parentNode) {
                    viewer.canvas.parentNode.removeChild(viewer.canvas);
                }
            } catch (error) {
                console.warn(`Error cleaning up viewer ${containerId}:`, error);
            }
        });

        // Clear all viewer references
        this.viewers.clear();
        this.loadedModels.clear();

        // Clear loaders
        if (this.loader) {
            this.loader = null;
        }
        if (this.dracoLoader) {
            this.dracoLoader = null;
        }

        // Reset initialization state
        this.isInitialized = false;
    }
}