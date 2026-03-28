# Infrastructure Runner: Performance and Gameplay Optimization Guide

This guide provides a detailed analysis and actionable recommendations to improve the performance, visual quality, and gameplay of your Three.js game, with the goal of achieving a production-ready, "Subway Surfers"-like experience.

---

## 1. Critical Refactoring (Highest Impact)

These changes require significant effort but will yield the most substantial improvements in performance and code maintainability.

### 1.1. Unify the Player into a Single Animated Model

**Why:** Currently, you load separate GLB files for the player's `Running`, `Flying`, and `Stumble` states. Managing multiple meshes for a single character is inefficient, complex, and error-prone. It increases memory usage, complicates position syncing, and makes animation management difficult.

**How:**
1.  **Combine Animations:** Use a 3D modeling tool like Blender to combine all animations (`Running`, `Jump`, `Stumble Backwards`, `Flying`) into a single GLB file associated with a single player model.
2.  **Refactor `player.js`:**
    *   Load the single player model.
    *   Initialize one `AnimationMixer`.
    *   Store all animations (`gltf.animations`) in a map by name (e.g., `this.actions = {'running': clip1, 'jumping': clip2, ...}`).
    *   Create a `playAction(name)` method that gracefully cross-fades from the current animation to the new one using `AnimationAction.crossFadeTo()`. This will provide smooth transitions between states like running and jumping.
    *   This eliminates the need for multiple meshes (`flyingMesh`, `stumbleMesh`) and the complex logic to switch between them.

**Example `player.js` structure:**

```javascript
// In Player.js

async loadModel() {
    const gltf = await loader.loadAsync('assets/models/Player_All_Animations.glb');
    this.mesh = gltf.scene;
    this.scene.add(this.mesh);

    this.mixer = new THREE.AnimationMixer(this.mesh);
    this.actions = {};

    gltf.animations.forEach((clip) => {
        this.actions[clip.name] = this.mixer.clipAction(clip);
    });

    this.activeAction = this.actions['Running'];
    this.activeAction.play();
}

playAction(name) {
    if (this.activeAction.name === name) return;

    const newAction = this.actions[name];
    const oldAction = this.activeAction;

    newAction.reset();
    newAction.play();
    newAction.crossFadeFrom(oldAction, 0.3, true); // 0.3s fade duration

    this.activeAction = newAction;
}

// In update loop:
// this.mixer.update(deltaTime);

// When jumping:
// this.playAction('Jumping');
```

### 1.2. Optimize Environment Rendering with Instancing

**Why:** The environment is composed of many individual building models, each resulting in a separate draw call. This is the most significant performance bottleneck in the game.

**How:** Use `THREE.InstancedMesh` to render all instances of the same building model in a single draw call.

1.  **In `direct-model-environment.js`:**
    *   For each building type (e.g., `001.glb`), create one `InstancedMesh`.
    *   When you need to spawn a building, instead of cloning the mesh, you will calculate its position and orientation and set it in the `InstancedMesh` using `instancedMesh.setMatrixAt(index, matrix)`.
    *   You will need to manage the pool of available indices for instances.

**Example `direct-model-environment.js` structure:**

```javascript
// In DirectModelEnvironment.js

async loadModels() {
    // For each building file...
    const gltf = await this.gltfLoader.loadAsync(path);
    const sourceMesh = gltf.scene.children[0]; // Assuming one mesh per file

    // Create an InstancedMesh for this building type
    const instancedMesh = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, 200); // 200 max instances
    this.scene.add(instancedMesh);
    this.buildingTemplates[filename] = {
        mesh: instancedMesh,
        count: 0
    };
}

spawnSpecificBuilding(zPosition) {
    const template = this.buildingTemplates[buildingKey];
    if (template.count >= template.mesh.count) return; // Pool is full

    const matrix = new THREE.Matrix4();
    // Set position, rotation, scale on the matrix
    matrix.setPosition(x, y, z);

    template.mesh.setMatrixAt(template.count, matrix);
    template.mesh.instanceMatrix.needsUpdate = true;
    template.count++;
}
```
This same technique should be applied to trees and any other frequently repeated decoration.

---

## 2. Performance Enhancements (High Impact)

### 2.1. Use a Package Manager and Bundler

**Why:** Loading Three.js from a CDN via an import map is good for prototyping but not for production. A build step gives you dependency management, code minification, and tree-shaking (removing unused code), which reduces the final bundle size.

**How:**
1.  **Setup:** Initialize a `package.json` (`npm init -y`).
2.  **Install Dependencies:** `npm install three`.
3.  **Use a Bundler:** Use Vite or Webpack. Vite is recommended for its speed and simplicity.
    *   `npm install --save-dev vite`
    *   Create a `vite.config.js` file.
    *   Change your `index.html` script tag to `<script type="module" src="/game.js"></script>`.
    *   Run `npx vite` to start the dev server and `npx vite build` for a production build.

### 2.2. Optimize Shadow Casting

**Why:** Shadows are computationally expensive. Not every object needs to cast a shadow.

**How:**
*   **Player:** `player.mesh.castShadow = true;` (Correct)
*   **Obstacles:** `obstacle.mesh.castShadow = true;` (Correct, as they are gameplay-relevant)
*   **Buildings & Scenery:** `building.castShadow = false;` (Correctly implemented). Ensure trees and other decorations also have shadows disabled or use a very cheap form of shadow (like a plane with a shadow texture under them).
*   **Light Frustum:** In `setupLighting`, tighten the `directionalLight.shadow.camera` bounds (`left`, `right`, `top`, `bottom`) to be as small as possible while still covering the visible gameplay area. This increases shadow resolution and performance.

### 2.3. Share Geometries and Materials

**Why:** Creating new geometries and materials (`new THREE.BoxGeometry()`, `material.clone()`) in the game loop or for every object instance consumes significant memory.

**How:**
*   **Obstacles:** In `ObstacleManager`, create one geometry and one material for each obstacle type *once* during initialization. When creating an obstacle, reuse them: `new THREE.Mesh(this.boxGeometry, this.boxMaterial)`.
*   **Collectibles:** Apply the same principle to `CollectableManager`.

---

## 3. Gameplay & "Feel" Improvements

### 3.1. Rework the Stumble Mechanic

**Why:** In *Subway Surfers*, stumbling is a penalty, not an immediate game over. It resets your score multiplier and briefly slows you down, making you vulnerable. Your current implementation triggers a game over after the animation.

**How:**
1.  **In `Game.js` `checkCollisions`:**
    *   When a collision occurs, instead of setting a game over callback, put the player in a "stumbling" state for a short duration (e.g., 1-2 seconds).
    *   In this state, the player is invincible.
    *   Briefly reduce `gameSpeed`.
    *   If the player hits another obstacle *while* stumbling, then it's game over.
2.  **In `Player.js`:**
    *   Use the unified animation system to play the "stumble" animation.
    *   After the stumble duration, transition back to the "running" animation and restore normal game speed.

### 3.2. Improve Player Lane Switching

**Why:** The current movement is linear (`position.x += ...`). A smoother, eased movement feels more polished and responsive.

**How:** Use a tweening library or a simple easing function.

**Example with easing (no library needed):**

```javascript
// In Player.js updatePosition()
const targetX = LANES.POSITIONS[this.lane];
const currentX = this.mesh.position.x;
const distance = targetX - currentX;

// If very close, snap to position to prevent endless easing
if (Math.abs(distance) < 0.01) {
    this.mesh.position.x = targetX;
} else {
    // Ease out function
    this.mesh.position.x += distance * 0.2; // Adjust 0.2 for different feel
}
```

### 3.3. Implement Collectible Magnet Effect

**Why:** The solar power-up is intended to have a magnet effect, but the `applyMagnetEffect` method is missing from `CollectableManager`.

**How:**
1.  **In `CollectableManager.js`, add the method:**
    ```javascript
    applyMagnetEffect(playerPosition, radius, pullSpeed) {
        this.collectables.forEach(item => {
            const distance = item.mesh.position.distanceTo(playerPosition);
            if (distance < radius) {
                const direction = playerPosition.clone().sub(item.mesh.position).normalize();
                item.mesh.position.add(direction.multiplyScalar(pullSpeed));
            }
        });
    }
    ```
2.  **In `game.js`, ensure it's called in the update loop when the power-up is active.** (This is already correctly set up).

---

## 4. Visual & Rendering Quality

### 4.1. Enhance Scene Lighting

**Why:** The current lighting is functional but can be improved for better atmosphere.

**How:**
*   Replace `AmbientLight` with `HemisphereLight`. It provides more natural-looking ambient light by having different colors for the sky and the ground.
    ```javascript
    // In setupLighting()
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.7); // Sky, Ground, Intensity
    this.scene.add(hemisphereLight);
    ```
*   Adjust the `DirectionalLight` color to be a warmer, more sun-like color (e.g., `#FFDDBB`).

### 4.2. Add Post-Processing

**Why:** Post-processing effects can dramatically improve the game's visual appeal.

**How:**
1.  **Setup:** Use `EffectComposer` and `RenderPass`.
2.  **Bloom:** Add `UnrealBloomPass` to make bright objects like collectibles and power-ups glow. This adds a high-quality, vibrant feel.
    ```javascript
    // In Game.js after renderer setup
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0; // Adjust these values
    bloomPass.strength = 0.6;
    bloomPass.radius = 0;
    this.composer.addPass(bloomPass);

    // In animate() loop, replace renderer.render() with:
    // this.composer.render();
    ```

---
By following this guide, you can systematically refactor and enhance your game, turning your solid prototype into a polished, performant, and engaging experience.