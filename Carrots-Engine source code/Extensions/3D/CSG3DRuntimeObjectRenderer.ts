namespace gdjs {
  /**
   * Renderer for CSG3DRuntimeObject.
   * Handles Three.js mesh creation, CSG operations, face orientation,
   * material setup, and geometry optimization.
   * @category Objects > 3D CSG
   */
  export class CSG3DRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _object: CSG3DRuntimeObject;
    private _threeObject: THREE.Mesh;
    private _material: THREE.Material;
    private _originalGeometry: THREE.BufferGeometry;
    private _bakedGeometry: THREE.BufferGeometry | null = null;
    private _isBaked: boolean = false;
    private _texture: THREE.Texture | null = null;
    private _loader: THREE.TextureLoader;
    private _instanceContainer: gdjs.RuntimeInstanceContainer;

    // CSG worker state
    private _csgWorker: Worker | null = null;
    private _pendingCSG: boolean = false;

    constructor(
      object: CSG3DRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      super(object, instanceContainer);
      this._object = object;
      this._instanceContainer = instanceContainer;
      this._loader = new THREE.TextureLoader();

      // Create initial material
      this._material = this._createMaterial();

      // Create initial geometry based on shape
      this._originalGeometry = this._createGeometry();

      // Create the Three.js mesh
      this._threeObject = new THREE.Mesh(this._originalGeometry, this._material);
      this._threeObject.castShadow = object._isCastingShadow;
      this._threeObject.receiveShadow = object._isReceivingShadow;

      // Apply face orientation
      this._applyFaceOrientation();

      // Add to the group
      this._threeGroup.add(this._threeObject);
    }

    // ============================================================
    // GEOMETRY CREATION
    // ============================================================

    /**
     * Creates the base geometry based on the object's shape type.
     */
    private _createGeometry(): THREE.BufferGeometry {
      const shape = this._object.getShape();
      const width = this._object.getWidth();
      const height = this._object.getHeight();
      const depth = this._object.getDepth();

      let geometry: THREE.BufferGeometry;

      switch (shape) {
        case 'Box':
          geometry = new THREE.BoxGeometry(width, height, depth);
          break;

        case 'Sphere':
          geometry = new THREE.SphereGeometry(
            this._object.getRadius(),
            this._object.getRadialSegments(),
            this._object.getHeightSegments(),
            this._object.getPhiStart(),
            this._object.getPhiLength(),
            this._object.getThetaStart(),
            this._object.getThetaLength()
          );
          break;

        case 'Cylinder':
          geometry = new THREE.CylinderGeometry(
            this._object.getRadius(),
            this._object.getRadius(),
            height,
            this._object.getRadialSegments(),
            this._object.getHeightSegments(),
            this._object.isOpenEnded(),
            this._object.getThetaStart(),
            this._object.getThetaLength()
          );
          break;

        case 'Cone':
          geometry = new THREE.ConeGeometry(
            this._object.getRadius(),
            height,
            this._object.getRadialSegments(),
            this._object.getHeightSegments(),
            this._object.isOpenEnded(),
            this._object.getThetaStart(),
            this._object.getThetaLength()
          );
          break;

        case 'Torus':
          geometry = new THREE.TorusGeometry(
            this._object.getRadius(),
            this._object.getTube(),
            this._object.getRadialSegments(),
            this._object.getTubularSegments(),
            this._object.getArc()
          );
          break;

        case 'Capsule':
          geometry = new THREE.CapsuleGeometry(
            this._object.getRadius(),
            height - this._object.getRadius() * 2,
            this._object.getCapSegments(),
            this._object.getRadialSegments()
          );
          break;

        default:
          geometry = new THREE.BoxGeometry(width, height, depth);
      }

      // Apply room mode geometry modification if needed
      if (this._object.isRoomModeEnabled()) {
        geometry = this._createRoomGeometry(geometry);
      }

      // Apply optimizations
      geometry = this._optimizeGeometry(geometry);

      return geometry;
    }

    /**
     * Creates a room (hollow box) geometry by subtracting an inner box.
     * This is a simplified approach - for true CSG, use three-bvh-csg.
     */
    private _createRoomGeometry(
      originalGeometry: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      const width = this._object.getWidth();
      const height = this._object.getHeight();
      const depth = this._object.getDepth();
      const thickness = this._object.getWallThickness();

      // For a room, we create a box with inverted normals (hollow)
      // This is done by creating the outer box and using BackSide material
      // The actual "room" effect is achieved through face orientation

      // We keep the original geometry but will flip faces in _applyFaceOrientation
      return originalGeometry;
    }

    /**
     * Applies geometry optimizations: tangents, auto-smooth, merge vertices.
     */
    private _optimizeGeometry(
      geometry: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // Calculate tangents if enabled
      if (this._object.isCalculateTangentsEnabled()) {
        geometry.computeTangents();
      }

      // Auto-smooth normals
      if (this._object.isAutoSmoothEnabled()) {
        geometry = this._applyAutoSmooth(geometry);
      }

      // Merge vertices if enabled
      if (this._object.isMergeVerticesEnabled()) {
        // Note: In a real implementation, you'd use BufferGeometryUtils.mergeVertices
        // For now, we just compute vertex normals
        geometry.computeVertexNormals();
      } else {
        geometry.computeVertexNormals();
      }

      return geometry;
    }

    /**
     * Applies auto-smoothing based on the smoothing angle.
     */
    private _applyAutoSmooth(
      geometry: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      const angleRad = (this._object.getSmoothingAngle() * Math.PI) / 180;

      // Compute vertex normals with angle threshold
      geometry.computeVertexNormals();

      // In a full implementation, you'd use a proper smooth normal algorithm
      // that respects the smoothing angle. For now, standard computeVertexNormals
      // provides basic smoothing.

      return geometry;
    }

    // ============================================================
    // MATERIAL CREATION
    // ============================================================

    /**
     * Creates a Three.js material based on the object's material type.
     */
    private _createMaterial(): THREE.Material {
      const materialType = this._object.getMaterialType();
      const tint = this._object.getColor();
      const color = this._parseTint(tint);

      let material: THREE.Material;

      switch (materialType) {
        case gdjs.CSG3DRuntimeObject.MaterialType.Basic:
          material = new THREE.MeshBasicMaterial({
            color,
            side: this._getMaterialSide(),
            transparent: this._object.shouldUseTransparentTexture(),
          });
          break;

        case gdjs.CSG3DRuntimeObject.MaterialType.StandardWithoutMetalness:
          material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0,
            roughness: 0.5,
            side: this._getMaterialSide(),
            transparent: this._object.shouldUseTransparentTexture(),
          });
          break;

        case gdjs.CSG3DRuntimeObject.MaterialType.Matte:
          material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0,
            roughness: 1.0,
            side: this._getMaterialSide(),
            transparent: this._object.shouldUseTransparentTexture(),
          });
          break;

        case gdjs.CSG3DRuntimeObject.MaterialType.Glossy:
          material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.1,
            roughness: 0.1,
            side: this._getMaterialSide(),
            transparent: this._object.shouldUseTransparentTexture(),
          });
          break;

        case gdjs.CSG3DRuntimeObject.MaterialType.Metallic:
          material = new THREE.MeshStandardMaterial({
            color,
            metalness: 1.0,
            roughness: 0.2,
            side: this._getMaterialSide(),
            transparent: this._object.shouldUseTransparentTexture(),
          });
          break;

        case gdjs.CSG3DRuntimeObject.MaterialType.Standard:
        default:
          material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.3,
            roughness: 0.5,
            side: this._getMaterialSide(),
            transparent: this._object.shouldUseTransparentTexture(),
          });
          break;
      }

      // Load texture if specified
      const resourceName = this._object.getResourceName();
      if (resourceName) {
        this._loadTexture(resourceName, material as THREE.MeshStandardMaterial);
      }

      return material;
    }

    /**
     * Determines the material side based on face orientation.
     */
    private _getMaterialSide(): THREE.Side {
      const orientation = this._object.getFaceOrientation();

      switch (orientation) {
        case 'Inward':
          return THREE.BackSide;
        case 'DoubleSided':
          return THREE.DoubleSide;
        case 'Outward':
        default:
          return THREE.FrontSide;
      }
    }

    /**
     * Parses a GDevelop tint string ("R;G;B") into a Three.js Color.
     */
    private _parseTint(tint: string): THREE.Color {
      const parts = tint.split(';').map(Number);
      const r = parts[0] || 255;
      const g = parts[1] || 255;
      const b = parts[2] || 255;
      return new THREE.Color(r / 255, g / 255, b / 255);
    }

    /**
     * Loads a texture and applies it to the material.
     */
    private _loadTexture(
      resourceName: string,
      material: THREE.MeshStandardMaterial
    ): void {
      // Get the runtime game to access resources
      const runtimeGame = this._instanceContainer.getRuntimeScene().getGame();
      const resource = runtimeGame.getImageManager().getPIXITexture(resourceName);

      if (resource && resource.baseTexture) {
        const texture = new THREE.CanvasTexture(resource.baseTexture.resource.source);
        texture.wrapS = this._object.isResourceRepeatEnabled()
          ? THREE.RepeatWrapping
          : THREE.ClampToEdgeWrapping;
        texture.wrapT = this._object.isResourceRepeatEnabled()
          ? THREE.RepeatWrapping
          : THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;

        this._texture = texture;
        material.map = texture;
        material.needsUpdate = true;
      }
    }

    // ============================================================
    // FACE ORIENTATION (FlipFace)
    // ============================================================

    /**
     * Applies face orientation settings to the mesh.
     * This is the core of the FlipFace feature.
     */
    private _applyFaceOrientation(): void {
      const orientation = this._object.getFaceOrientation();

      if (orientation === 'Inward' || this._object.areFacesInward()) {
        // For inward-facing (room mode):
        // 1. Use BackSide material to render interior
        // 2. Optionally flip geometry normals
        this._flipGeometryNormals();
      }

      // Update material side
      if (this._material) {
        (this._material as THREE.MeshStandardMaterial).side = this._getMaterialSide();
        this._material.needsUpdate = true;
      }
    }

    /**
     * Flips the normals of the geometry to face inward.
     */
    private _flipGeometryNormals(): void {
      if (!this._threeObject || !this._threeObject.geometry) return;

      const geometry = this._threeObject.geometry;
      const normalAttribute = geometry.getAttribute('normal');

      if (normalAttribute) {
        for (let i = 0; i < normalAttribute.count; i++) {
          normalAttribute.setX(i, -normalAttribute.getX(i));
          normalAttribute.setY(i, -normalAttribute.getY(i));
          normalAttribute.setZ(i, -normalAttribute.getZ(i));
        }
        normalAttribute.needsUpdate = true;
      }

      // Also reverse winding order for proper culling
      const indexAttribute = geometry.getIndex();
      if (indexAttribute) {
        const indices = indexAttribute.array;
        for (let i = 0; i < indices.length; i += 3) {
          const temp = indices[i];
          indices[i] = indices[i + 2];
          indices[i + 2] = temp;
        }
        indexAttribute.needsUpdate = true;
      }
    }

    // ============================================================
    // CSG OPERATIONS
    // ============================================================

    /**
     * Updates the CSG combination with a target object.
     * This is the core CSG logic.
     */
    updateCSG(): void {
      if (this._object.getCSGMode() === 'Single') {
        // Revert to original geometry
        this._revertToOriginalGeometry();
        return;
      }

      const targetName = this._object.getTargetObjectName();
      if (!targetName) return;

      // Find the target object in the scene
      const runtimeScene = this._instanceContainer.getRuntimeScene();
      const targetObjects = runtimeScene.getObjects(targetName);

      if (targetObjects.length === 0) return;

      const targetObject = targetObjects[0];
      if (!(targetObject instanceof CSG3DRuntimeObject)) return;

      // Perform CSG operation
      this._performCSGOperation(targetObject);
    }

    /**
     * Performs the actual CSG operation.
     * In a production implementation, this would use three-bvh-csg.
     */
    private _performCSGOperation(targetObject: CSG3DRuntimeObject): void {
      const operation = this._object.getCSGOperation();

      // Get target renderer
      const targetRenderer = targetObject.getRenderer() as CSG3DRuntimeObjectRenderer;
      if (!targetRenderer) return;

      // Get geometries
      const thisGeometry = this._threeObject.geometry.clone();
      const targetGeometry = targetRenderer._threeObject.geometry.clone();

      // Apply world transforms
      thisGeometry.applyMatrix4(this._threeObject.matrixWorld);
      targetGeometry.applyMatrix4(targetRenderer._threeObject.matrixWorld);

      // Perform CSG operation
      // NOTE: In production, replace this with three-bvh-csg:
      // import { SUBTRACTION, INTERSECTION, ADDITION, Evaluator } from 'three-bvh-csg';
      // const evaluator = new Evaluator();
      // const result = evaluator.evaluate(thisMesh, targetMesh, SUBTRACTION);

      let resultGeometry: THREE.BufferGeometry;

      switch (operation) {
        case 'Union':
          resultGeometry = this._unionGeometries(thisGeometry, targetGeometry);
          break;
        case 'Subtract':
          resultGeometry = this._subtractGeometries(thisGeometry, targetGeometry);
          break;
        case 'Intersect':
          resultGeometry = this._intersectGeometries(thisGeometry, targetGeometry);
          break;
        default:
          resultGeometry = thisGeometry;
      }

      // Apply result
      this._threeObject.geometry.dispose();
      this._threeObject.geometry = resultGeometry;
      this._originalGeometry = resultGeometry.clone();

      // Re-optimize
      this._optimizeGeometry(this._threeObject.geometry);

      // Update face orientation
      this._applyFaceOrientation();
    }

    /**
     * Union of two geometries (simplified placeholder).
     * In production, use three-bvh-csg Evaluator.
     */
    private _unionGeometries(
      geoA: THREE.BufferGeometry,
      geoB: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // Placeholder: return a merged geometry
      // Real implementation uses three-bvh-csg
      return this._mergeGeometries([geoA, geoB]);
    }

    /**
     * Subtract geometry B from geometry A (simplified placeholder).
     */
    private _subtractGeometries(
      geoA: THREE.BufferGeometry,
      geoB: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // Placeholder: return geometry A
      // Real implementation uses three-bvh-csg SUBTRACTION
      return geoA;
    }

    /**
     * Intersection of two geometries (simplified placeholder).
     */
    private _intersectGeometries(
      geoA: THREE.BufferGeometry,
      geoB: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // Placeholder: return geometry A
      // Real implementation uses three-bvh-csg INTERSECTION
      return geoA;
    }

    /**
     * Merges multiple geometries into one.
     */
    private _mergeGeometries(
      geometries: THREE.BufferGeometry[]
    ): THREE.BufferGeometry {
      // In production, use BufferGeometryUtils.mergeGeometries
      // For now, return the first geometry as placeholder
      if (geometries.length === 0) {
        return new THREE.BufferGeometry();
      }
      return geometries[0];
    }

    /**
     * Reverts to the original (non-CSG) geometry.
     */
    private _revertToOriginalGeometry(): void {
      if (this._threeObject.geometry) {
        this._threeObject.geometry.dispose();
      }
      this._originalGeometry = this._createGeometry();
      this._threeObject.geometry = this._originalGeometry;
      this._applyFaceOrientation();
    }

    // ============================================================
    // BAKING
    // ============================================================

    /**
     * Bakes the current geometry into a static mesh.
     */
    bakeGeometry(): void {
      if (this._isBaked) return;

      // Clone current geometry as baked
      this._bakedGeometry = this._threeObject.geometry.clone();
      this._isBaked = true;

      // Store in object
      this._object.setBakedGeometry(this._bakedGeometry);

      // Optimize the baked geometry
      this._optimizeGeometry(this._bakedGeometry);
    }

    /**
     * Unbakes the geometry, restoring dynamic operations.
     */
    unbakeGeometry(): void {
      this._isBaked = false;
      this._bakedGeometry = null;
      this._object.setBakedGeometry(null);

      // Rebuild geometry
      this.updateShape();
    }

    // ============================================================
    // UPDATE METHODS (called from the runtime object)
    // ============================================================

    /**
     * Updates the shape geometry.
     */
    updateShape(): void {
      if (this._isBaked) return;

      const oldGeometry = this._threeObject.geometry;
      this._originalGeometry = this._createGeometry();
      this._threeObject.geometry = this._originalGeometry;
      oldGeometry.dispose();

      this._applyFaceOrientation();
    }

    /**
     * Updates face orientation (FlipFace).
     */
    updateFaceOrientation(): void {
      // Rebuild geometry with new orientation
      this.updateShape();
    }

    /**
     * Updates materials.
     */
    updateMaterials(): void {
      const oldMaterial = this._material;
      this._material = this._createMaterial();
      this._threeObject.material = this._material;

      if (oldMaterial) {
        oldMaterial.dispose();
      }
    }

    /**
     * Updates tint color.
     */
    updateTint(): void {
      const tint = this._object.getColor();
      const color = this._parseTint(tint);

      if (this._material instanceof THREE.MeshStandardMaterial) {
        this._material.color.copy(color);
        this._material.needsUpdate = true;
      } else if (this._material instanceof THREE.MeshBasicMaterial) {
        this._material.color.copy(color);
        this._material.needsUpdate = true;
      }
    }

    /**
     * Updates texture.
     */
    updateTexture(): void {
      const resourceName = this._object.getResourceName();

      if (this._material instanceof THREE.MeshStandardMaterial) {
        if (resourceName) {
          this._loadTexture(resourceName, this._material);
        } else {
          this._material.map = null;
          this._material.needsUpdate = true;
        }
      }
    }

    /**
     * Updates geometry optimization settings.
     */
    updateGeometry(): void {
      if (this._isBaked) return;
      this.updateShape();
    }

    /**
     * Updates shadow casting.
     */
    updateShadowCasting(): void {
      this._threeObject.castShadow = this._object._isCastingShadow;
    }

    /**
     * Updates shadow receiving.
     */
    updateShadowReceiving(): void {
      this._threeObject.receiveShadow = this._object._isReceivingShadow;
    }

    // ============================================================
    // LIFECYCLE
    // ============================================================

    /**
     * Called when the object is destroyed.
     */
    onDestroy(): void {
      if (this._threeObject.geometry) {
        this._threeObject.geometry.dispose();
      }
      if (this._material) {
        this._material.dispose();
      }
      if (this._texture) {
        this._texture.dispose();
      }
      if (this._bakedGeometry) {
        this._bakedGeometry.dispose();
      }
      if (this._csgWorker) {
        this._csgWorker.terminate();
      }
    }

    /**
     * Returns the Three.js object for the renderer.
     */
    getThreeObject(): THREE.Object3D {
      return this._threeObject;
    }
  }
}
