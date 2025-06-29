import * as THREE from 'three';
import { PHYSICS } from './constants.js';

/**
 * Collision utilities for high-speed collision detection
 * Implements continuous collision detection to prevent tunneling at high game speeds
 */

export class CollisionUtils {
    /**
     * Performs swept collision detection between a moving player and static object
     * This prevents tunneling when objects move fast between frames
     * 
     * @param {THREE.Box3} currentPlayerBox - Player's current collision box
     * @param {THREE.Vector3} playerPrevPos - Player's position in the previous frame
     * @param {THREE.Box3} objectBox - Static object's collision box
     * @param {number} gameSpeed - Current game speed for predictive checking
     * @returns {boolean} - True if collision detected
     */
    static checkSweptCollision(currentPlayerBox, playerPrevPos, objectBox, gameSpeed = 0) {
        // Method 1: Check current position (standard collision)
        if (currentPlayerBox.intersectsBox(objectBox)) {
            return true;
        }

        // Determine if we're in a lane change
        const currentPlayerCenter = new THREE.Vector3();
        currentPlayerBox.getCenter(currentPlayerCenter);
        const xMovement = Math.abs(currentPlayerCenter.x - playerPrevPos.x);
        const isLaneChange = xMovement > 0.05;

        // Method 2: Check if object is in the movement path
        // Create an expanded box that covers the player's movement path
        
        // Create a swept volume that covers the path from previous to current position
        const sweptBox = new THREE.Box3();
        const playerSize = new THREE.Vector3();
        currentPlayerBox.getSize(playerSize);
        
        // During lane changes, reduce the width of the swept box
        if (isLaneChange) {
            playerSize.x *= 0.6; // Make the swept volume 40% narrower during lane changes
        }
        
        // Expand the box to cover movement path
        const minX = Math.min(playerPrevPos.x, currentPlayerCenter.x) - playerSize.x / 2;
        const maxX = Math.max(playerPrevPos.x, currentPlayerCenter.x) + playerSize.x / 2;
        const minY = Math.min(playerPrevPos.y, currentPlayerCenter.y) - playerSize.y / 2;
        const maxY = Math.max(playerPrevPos.y, currentPlayerCenter.y) + playerSize.y / 2;
        const minZ = Math.min(playerPrevPos.z, currentPlayerCenter.z) - playerSize.z / 2;
        const maxZ = Math.max(playerPrevPos.z, currentPlayerCenter.z) + playerSize.z / 2;
        
        sweptBox.min.set(minX, minY, minZ);
        sweptBox.max.set(maxX, maxY, maxZ);
        
        if (sweptBox.intersectsBox(objectBox)) {
            return true;
        }

        // Method 3: Predictive collision (check next frame position)
        // This catches fast-moving objects that might collide in the next frame
        if (gameSpeed > PHYSICS.HIGH_SPEED_THRESHOLD * 1.3) { // Only use predictive collision at very high speeds
            const predictedPlayerBox = currentPlayerBox.clone();
            // Predict where player will be next frame (objects move toward player)
            predictedPlayerBox.translate(new THREE.Vector3(0, 0, gameSpeed * 1.5));
            
            if (predictedPlayerBox.intersectsBox(objectBox)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Enhanced collision detection for collectibles with magnetic effect
     * Provides a larger collection radius for better gameplay feel
     * 
     * @param {THREE.Box3} playerBox - Player's collision box
     * @param {THREE.Box3} collectableBox - Collectable's collision box
     * @param {number} gameSpeed - Current game speed
     * @param {boolean} hasMagnetEffect - Whether player has magnet power-up active
     * @returns {boolean} - True if collision/collection detected
     */
    static checkCollectableCollision(playerBox, collectableBox, gameSpeed = 0, hasMagnetEffect = false) {
        // Standard collision check
        if (playerBox.intersectsBox(collectableBox)) {
            return true;
        }

        // Expanded collection radius for high-speed gameplay
        const expandedPlayerBox = playerBox.clone();
        let expansionFactor = PHYSICS.COLLECTABLE_EXPANSION_BASE;
        
        // Increase collection radius at high speeds
        if (gameSpeed > PHYSICS.HIGH_SPEED_THRESHOLD) {
            expansionFactor += (gameSpeed - PHYSICS.HIGH_SPEED_THRESHOLD) * PHYSICS.COLLECTABLE_SPEED_EXPANSION;
        }
        
        // Magnet effect provides even larger collection radius
        if (hasMagnetEffect) {
            expansionFactor += PHYSICS.MAGNET_EXPANSION_BONUS;
        }
        
        expandedPlayerBox.expandByScalar(expansionFactor);
        
        return expandedPlayerBox.intersectsBox(collectableBox);
    }

    /**
     * Check if an object is within a safe distance to avoid collision issues
     * Used for preventing spawning too close to the player at high speeds
     * 
     * @param {THREE.Vector3} playerPos - Player's current position
     * @param {THREE.Vector3} objectPos - Object's position
     * @param {number} gameSpeed - Current game speed
     * @returns {boolean} - True if object is at safe distance
     */
    static isSafeDistance(playerPos, objectPos, gameSpeed) {
        const distance = playerPos.distanceTo(objectPos);
        const minSafeDistance = PHYSICS.SAFE_SPAWN_DISTANCE_BASE + (gameSpeed * PHYSICS.SAFE_SPAWN_DISTANCE_SPEED_MULTIPLIER);
        return distance >= minSafeDistance;
    }

    /**
     * Calculate optimal collision box size based on game speed
     * Slightly larger boxes at high speeds for better collision detection
     * 
     * @param {THREE.Vector3} baseSize - Original collision box size
     * @param {number} gameSpeed - Current game speed
     * @returns {THREE.Vector3} - Adjusted collision box size
     */
    static getSpeedAdjustedCollisionSize(baseSize, gameSpeed) {
        const speedFactor = Math.min(gameSpeed / (PHYSICS.HIGH_SPEED_THRESHOLD * 2), PHYSICS.MAX_COLLISION_BOX_EXPANSION);
        const adjustment = 1 + (speedFactor * 0.1); // Up to 10% larger
        
        return baseSize.clone().multiplyScalar(adjustment);
    }
}

/**
 * Position tracker for storing previous frame positions
 * Used by collision detection system to track movement paths
 */
export class PositionTracker {
    constructor() {
        this.previousPositions = new Map();
    }

    /**
     * Update the tracked position for an object
     * @param {string} objectId - Unique identifier for the object
     * @param {THREE.Vector3} currentPosition - Current position of the object
     */
    updatePosition(objectId, currentPosition) {
        this.previousPositions.set(objectId, currentPosition.clone());
    }

    /**
     * Get the previous position for an object
     * @param {string} objectId - Unique identifier for the object
     * @returns {THREE.Vector3|null} - Previous position or null if not tracked
     */
    getPreviousPosition(objectId) {
        return this.previousPositions.get(objectId) || null;
    }

    /**
     * Clear tracking for an object (when object is destroyed)
     * @param {string} objectId - Unique identifier for the object
     */
    clearPosition(objectId) {
        this.previousPositions.delete(objectId);
    }

    /**
     * Clear all tracked positions (for game reset)
     */
    clearAll() {
        this.previousPositions.clear();
    }
}