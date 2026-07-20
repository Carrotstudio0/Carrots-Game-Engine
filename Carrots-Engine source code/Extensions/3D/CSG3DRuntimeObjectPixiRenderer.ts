namespace gdjs {
  /**
   * Material profile for CSG3D shapes
   */
  type CSG3DMaterialProfile = {
    roughness: number;
    metalness: number;
    envMapIntensity: number;
  };

  const getCSG3DMaterialProfile = (
    materialType: gdjs.CSG3DRuntimeObject.MaterialType
  ): CSG3DMaterialProfile => {
    switch (materialType) {
      case gdjs.CSG3DRuntimeObject.MaterialType.Matte:
        return { roughness: 0.9, metalness: 0.02, envMapIntensity: 0.9 };
      case gdjs.CSG3DRuntimeObject.MaterialType.Standard:
        return { roughness: 0.5, metalness: 0.08, envMapIntensity: 1.1 };
      case gdjs.CSG3DRuntimeObject.MaterialType.Glossy:
        return { roughness: 0.14, metalness: 0.2, envMapIntensity: 1.35 };
      case gdjs.CSG3DRuntimeObject.MaterialType.Metallic:
        return { roughness: 0.16, metalness: 1, envMapIntensity: 1.6 };
      case gdjs.CSG3DRuntimeObject.MaterialType.StandardWithoutMetalness:
      default:
        return { roughness: 0.74, metalness: 0, envMapIntensity: 1 };
    }
  };

  const applyCSG3DMaterialProfile = (
    material: THREE.Material,
    materialType: gdjs.CSG3DRuntimeObject.MaterialType
  ) => {
    if (materialType === gdjs.CSG3DRuntimeObject.MaterialType.Basic) {
      return;
    }

    const standardMaterial = material as THREE.MeshStandardMaterial;
    if (!('roughness' in standardMaterial) || !('metalness' in standardMaterial)) {
      return;
    }

    const profile = getCSG3DMaterialProfile(materialType);
    standardMaterial.roughness = profile.roughness;
    standardMaterial.metalness = profile.metalness;
    standardMaterial.envMapIntensity = profile.envMapIntensity;
    standardMaterial.needsUpdate = true;
  };

  /**
   * Refreshes geometry lighting data: normals, tangents, auto-smooth.
   */
  const refreshCSGGeometryLightingData = (
    geometry: THREE.BufferGeometry,
    calculateTangents: boolean,
    autoSmooth: boolean,
    smoothingAngle: number
  ) => {
    geometry.deleteAttribute('normal');
    geometry.computeVertexNormals();
    geometry.userData.gdjsAutoSmooth = autoSmooth;
    geometry.userData.gdjsSmoothingAngle = Math.max(
      0,
      Math.min(180, smoothingAngle || 0)
    );
    if (calculateTangents) {
      const computeTangents = (geometry as any).computeTangents;
      if (
        computeTangents &&
        geometry.getIndex() &&
        geometry.getAttribute('position') &&
        geometry.getAttribute('normal') &&
        geometry.getAttribute('uv')
      ) {
        computeTangents.call(geometry);
      }
    } else {
      geometry.deleteAttribute('tangent');
    }

    const normal = geometry.getAttribute('normal');
    if (normal) {
      normal.needsUpdate = true;
    }
    const tangent = geometry.getAttribute('tangent');
    if (tangent) {
      tangent.needsUpdate = true;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };

  /**
   * Inverts geometry faces (winding order + normals) for inward-facing mode.
   */
  const invertCSGGeometryFaces = (
    geometry: THREE.BufferGeometry,
    inverted: boolean,
    calculateTangents: boolean,
    autoSmooth: boolean,
    smoothingAngle: number
  ) => {
    if (geometry.userData.gdjsFacesInward === inverted) return;

    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        index.setX(i + 1, c);
        index.setX(i + 2, b);
      }
      index.needsUpdate = true;
    } else {
      const position = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      for (let i = 0; position && i < position.count; i += 3) {
        const ax = position.getX(i + 1);
        const ay = position.getY(i + 1);
        const az = position.getZ(i + 1);
        position.setXYZ(
          i + 1,
          position.getX(i + 2),
          position.getY(i + 2),
          position.getZ(i + 2)
        );
        position.setXYZ(i + 2, ax, ay, az);
        if (uv) {
          const au = uv.getX(i + 1);
          const av = uv.getY(i + 1);
          uv.setXY(i + 1, uv.getX(i + 2), uv.getY(i + 2));
          uv.setXY(i + 2, au, av);
        }
      }
      if (position) {
        position.needsUpdate = true;
      }
      if (uv) {
        uv.needsUpdate = true;
      }
    }

    refreshCSGGeometryLightingData(
      geometry,
      calculateTangents,
      autoSmooth,
      smoothingAngle
    );
    geometry.userData.gdjsFacesInward = inverted;
  };

  /**
   * UV mapping for non-repeating textures (per-vertex mapping).
   */
  const noRepeatTextureVertexIndexToUvMapping = {
    0: [0, 0],
    1: [1, 0],
    2: [0, 1],
    3: [1, 1],
  };

  /**
   * Renderer for CSG3DRuntimeObject.
   * Handles Three.js mesh creation, CSG operations, face orientation,
   * material setup, UV mapping, and geometry optimization.
   * Fully compatible with GDevelop 3D runtime system.
   * @category Objects > 3D CSG
   */
  class CSG3DRuntimeObjectPixiRenderer extends gdjs.RuntimeObject3DRenderer {
    private _csg3DRuntimeObject: gdjs.CSG3DRuntimeObject;
    private _mesh: THREE.Mesh;
    private _material: THREE.Material;
    private _originalGeometry: THREE.BufferGeometry;
    private _bakedGeometry: THREE.BufferGeometry | null = null;
    private _isBaked: boolean = false;
    private _texture: THREE.Texture | null = null;

    constructor(
      runtimeObject: gdjs.CSG3DRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      const geometry = new THREE.BufferGeometry();
      const material = CSG3DRuntimeObjectPixiRenderer._createMaterial(
        runtimeObject
      );
      const mesh = new THREE.Mesh(geometry, material);

      super(runtimeObject, instanceContainer, mesh);
      this._mesh = mesh;
      this._csg3DRuntimeObject = runtimeObject;
      this._material = material;

      // Build initial geometry
      this._originalGeometry = this._createGeometry();
      this._mesh.geometry = this._originalGeometry;

      // Setup mesh properties
      mesh.receiveShadow = runtimeObject._isReceivingShadow;
      mesh.castShadow = runtimeObject._isCastingShadow;

      // Apply initial transforms
      this.updateSize();
      this.updatePosition();
      this.updateRotation();
      this.updateTint();
      this.updateFaceOrientation();
      this.updateTextureUvMapping();
    }

    // ============================================================
    // STATIC MATERIAL FACTORY
    // ============================================================

    /**
     * Creates a material based on the object's material type.
     */
    private static _createMaterial(
      runtimeObject: gdjs.CSG3DRuntimeObject
    ): THREE.Material {
      const materialType = runtimeObject.getMaterialType();
      const tint = runtimeObject.getColor();
      const normalizedTint = gdjs
        .rgbOrHexToRGBColor(tint)
        .map((component) => component / 255);
      const color = new THREE.Color(
        normalizedTint[0],
        normalizedTint[1],
        normalizedTint[2]
      );

      const resourceName = runtimeObject.getResourceName();
      const useTransparentTexture = runtimeObject.shouldUseTransparentTexture();

      if (materialType === gdjs.CSG3DRuntimeObject.MaterialType.Basic) {
        if (!resourceName) {
          return new THREE.MeshBasicMaterial({
            color,
            vertexColors: true,
          });
        }
        return runtimeObject
          .getInstanceContainer()
          .getGame()
          .getImageManager()
          .getThreeMaterial(resourceName, {
            useTransparentTexture,
            forceBasicMaterial: true,
            vertexColors: true,
          });
      }

      if (!resourceName) {
        const profile = getCSG3DMaterialProfile(materialType);
        return new THREE.MeshStandardMaterial({
          color,
          roughness: profile.roughness,
          metalness: profile.metalness,
          envMapIntensity: profile.envMapIntensity,
          vertexColors: true,
        });
      }

      const sharedMaterial = runtimeObject
        .getInstanceContainer()
        .getGame()
        .getImageManager()
        .getThreeMaterial(resourceName, {
          useTransparentTexture,
          forceBasicMaterial: false,
          vertexColors: true,
        });

      const material = sharedMaterial.clone();
      applyCSG3DMaterialProfile(material, materialType);
      return material;
    }

    // ============================================================
    // GEOMETRY CREATION
    // ============================================================

    /**
     * Creates the base geometry based on the object's shape type.
     */
    private _createGeometry(): THREE.BufferGeometry {
      const shape = this._csg3DRuntimeObject.getShape();
      const width = this._csg3DRuntimeObject.getWidth();
      const height = this._csg3DRuntimeObject.getHeight();
      const depth = this._csg3DRuntimeObject.getDepth();

      let geometry: THREE.BufferGeometry;

      switch (shape) {
        case 'Box':
          geometry = new THREE.BoxGeometry(1, 1, 1);
          break;

        case 'Sphere':
          geometry = new THREE.SphereGeometry(
            this._csg3DRuntimeObject.getRadius(),
            this._csg3DRuntimeObject.getRadialSegments(),
            this._csg3DRuntimeObject.getHeightSegments(),
            this._csg3DRuntimeObject.getPhiStart(),
            this._csg3DRuntimeObject.getPhiLength(),
            this._csg3DRuntimeObject.getThetaStart(),
            this._csg3DRuntimeObject.getThetaLength()
          );
          break;

        case 'Cylinder':
          geometry = new THREE.CylinderGeometry(
            this._csg3DRuntimeObject.getRadius(),
            this._csg3DRuntimeObject.getRadius(),
            height,
            this._csg3DRuntimeObject.getRadialSegments(),
            this._csg3DRuntimeObject.getHeightSegments(),
            this._csg3DRuntimeObject.isOpenEnded(),
            this._csg3DRuntimeObject.getThetaStart(),
            this._csg3DRuntimeObject.getThetaLength()
          );
          break;

        case 'Cone':
          geometry = new THREE.ConeGeometry(
            this._csg3DRuntimeObject.getRadius(),
            height,
            this._csg3DRuntimeObject.getRadialSegments(),
            this._csg3DRuntimeObject.getHeightSegments(),
            this._csg3DRuntimeObject.isOpenEnded(),
            this._csg3DRuntimeObject.getThetaStart(),
            this._csg3DRuntimeObject.getThetaLength()
          );
          break;

        case 'Torus':
          geometry = new THREE.TorusGeometry(
            this._csg3DRuntimeObject.getRadius(),
            this._csg3DRuntimeObject.getTube(),
            this._csg3DRuntimeObject.getRadialSegments(),
            this._csg3DRuntimeObject.getTubularSegments(),
            this._csg3DRuntimeObject.getArc()
          );
          break;

        case 'Capsule':
          geometry = new THREE.CapsuleGeometry(
            this._csg3DRuntimeObject.getRadius(),
            height - this._csg3DRuntimeObject.getRadius() * 2,
            this._csg3DRuntimeObject.getCapSegments(),
            this._csg3DRuntimeObject.getRadialSegments()
          );
          break;

        default:
          geometry = new THREE.BoxGeometry(1, 1, 1);
      }

      // Apply UV mapping for proper texture repeat
      this._setupGeometryUvMapping(geometry);

      // Apply optimizations
      this._optimizeGeometry(geometry);

      return geometry;
    }

    /**
     * Sets up UV mapping for the geometry to support texture repeat.
     */
    private _setupGeometryUvMapping(geometry: THREE.BufferGeometry): void {
      const pos = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      if (!pos || !uv) return;

      const shouldRepeatTexture = this._csg3DRuntimeObject.isResourceRepeatEnabled();
      if (!shouldRepeatTexture) return;

      const resourceName = this._csg3DRuntimeObject.getResourceName();
      if (!resourceName) return;

      const runtimeGame = this._csg3DRuntimeObject
        .getInstanceContainer()
        .getGame();
      const resource = runtimeGame.getImageManager().getPIXITexture(resourceName);
      if (!resource || !resource.baseTexture) return;

      const texWidth = resource.baseTexture.width || 1;
      const texHeight = resource.baseTexture.height || 1;
      const width = this._csg3DRuntimeObject.getWidth();
      const height = this._csg3DRuntimeObject.getHeight();
      const depth = this._csg3DRuntimeObject.getDepth();

      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);

        // Map UVs based on world position scaled by object size
        // This provides planar mapping for all shapes
        let u = (px + 0.5) * (width / texWidth);
        let v = (py + 0.5) * (height / texHeight);

        // For sphere/cylinder, use spherical-like mapping
        const shape = this._csg3DRuntimeObject.getShape();
        if (shape === 'Sphere' || shape === 'Cylinder' || shape === 'Cone') {
          const len = Math.sqrt(px * px + py * py + pz * pz) || 1;
          u = ((Math.atan2(px / len, pz / len) / (2 * Math.PI)) + 0.5) * (width / texWidth);
          v = ((py / len) + 0.5) * (height / texHeight);
        }

        uv.setXY(i, u, v);
      }
      uv.needsUpdate = true;
    }

    /**
     * Applies geometry optimizations: tangents, auto-smooth, merge vertices.
     */
    private _optimizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
      refreshCSGGeometryLightingData(
        geometry,
        this._csg3DRuntimeObject.isCalculateTangentsEnabled(),
        this._csg3DRuntimeObject.isAutoSmoothEnabled(),
        this._csg3DRuntimeObject.getSmoothingAngle()
      );
      return geometry;
    }

    // ============================================================
    // UPDATE METHODS (called from the runtime object)
    // ============================================================

    /**
     * Updates the shape geometry.
     */
    updateShape(): void {
      if (this._isBaked) return;

      const oldGeometry = this._mesh.geometry;
      this._originalGeometry = this._createGeometry();
      this._mesh.geometry = this._originalGeometry;

      if (oldGeometry && oldGeometry !== this._originalGeometry) {
        oldGeometry.dispose();
      }

      this.updateSize();
      this.updateTextureUvMapping();
      this.updateFaceOrientation();
      this.updateTint();
    }

    /**
     * Updates face orientation (FlipFace).
     */
    updateFaceOrientation(): void {
      invertCSGGeometryFaces(
        this._mesh.geometry,
        this._csg3DRuntimeObject.areFacesInward(),
        this._csg3DRuntimeObject.isCalculateTangentsEnabled(),
        this._csg3DRuntimeObject.isAutoSmoothEnabled(),
        this._csg3DRuntimeObject.getSmoothingAngle()
      );
    }

    /**
     * Updates materials.
     */
    updateMaterials(): void {
      const oldMaterial = this._material;
      this._material = CSG3DRuntimeObjectPixiRenderer._createMaterial(
        this._csg3DRuntimeObject
      );
      this._mesh.material = this._material;

      if (oldMaterial) {
        oldMaterial.dispose();
      }

      this.updateTextureUvMapping();
      this.updateTint();
    }

    /**
     * Updates tint color (vertex colors).
     */
    updateTint(): void {
      const tints: number[] = [];
      const normalizedTint = gdjs
        .rgbOrHexToRGBColor(this._csg3DRuntimeObject.getColor())
        .map((component) => component / 255);

      for (let i = 0; i < this._mesh.geometry.attributes.position.count; i++) {
        tints.push(...normalizedTint);
      }

      this._mesh.geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(tints), 3)
      );
    }

    /**
     * Updates texture and UV mapping.
     */
    updateTexture(): void {
      this.updateMaterials();
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
      this._mesh.castShadow = this._csg3DRuntimeObject._isCastingShadow;
    }

    /**
     * Updates shadow receiving.
     */
    updateShadowReceiving(): void {
      this._mesh.receiveShadow = this._csg3DRuntimeObject._isReceivingShadow;
    }

    /**
     * Updates the UV mapping for texture repeat.
     */
    updateTextureUvMapping(): void {
      const geometry = this._mesh.geometry;
      const pos = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      if (!pos || !uv) return;

      const shouldRepeatTexture = this._csg3DRuntimeObject.isResourceRepeatEnabled();
      const resourceName = this._csg3DRuntimeObject.getResourceName();

      if (!shouldRepeatTexture || !resourceName) {
        // Reset to default UVs for non-repeating
        for (let i = 0; i < pos.count; i++) {
          const mapping = noRepeatTextureVertexIndexToUvMapping[i % 4];
          if (mapping) {
            uv.setXY(i, mapping[0], mapping[1]);
          }
        }
        uv.needsUpdate = true;
        return;
      }

      // Get texture dimensions
      const runtimeGame = this._csg3DRuntimeObject
        .getInstanceContainer()
        .getGame();
      const resource = runtimeGame.getImageManager().getPIXITexture(resourceName);
      if (!resource || !resource.baseTexture) return;

      const texWidth = resource.baseTexture.width || 1;
      const texHeight = resource.baseTexture.height || 1;
      const width = this._csg3DRuntimeObject.getWidth();
      const height = this._csg3DRuntimeObject.getHeight();
      const depth = this._csg3DRuntimeObject.getDepth();

      const shape = this._csg3DRuntimeObject.getShape();

      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);

        let u: number, v: number;

        switch (shape) {
          case 'Box':
            // Planar mapping per face
            u = (px + 0.5) * (width / texWidth);
            v = (py + 0.5) * (height / texHeight);
            break;

          case 'Sphere':
          case 'Cylinder':
          case 'Cone': {
            const len = Math.sqrt(px * px + pz * pz) || 1;
            u = (Math.atan2(px, pz) / (2 * Math.PI) + 0.5) * (width / texWidth);
            v = ((py + 0.5) / 1.0) * (height / texHeight);
            break;
          }

          case 'Torus':
            u = (px + 0.5) * (width / texWidth);
            v = (pz + 0.5) * (depth / texHeight);
            break;

          case 'Capsule':
            u = (px + 0.5) * (width / texWidth);
            v = (py + 0.5) * (height / texHeight);
            break;

          default:
            u = (px + 0.5) * (width / texWidth);
            v = (py + 0.5) * (height / texHeight);
        }

        uv.setXY(i, u, v);
      }
      uv.needsUpdate = true;
    }

    // ============================================================
    // CSG OPERATIONS
    // ============================================================

    /**
     * Updates the CSG combination with a target object.
     */
    updateCSG(): void {
      if (this._csg3DRuntimeObject.getCSGMode() === 'Single') {
        this._revertToOriginalGeometry();
        return;
      }

      const targetName = this._csg3DRuntimeObject.getTargetObjectName();
      if (!targetName) return;

      const runtimeScene = this._csg3DRuntimeObject
        .getInstanceContainer()
        .getRuntimeScene();
      const targetObjects = runtimeScene.getObjects(targetName);

      if (targetObjects.length === 0) return;

      const targetObject = targetObjects[0];
      if (!(targetObject instanceof gdjs.CSG3DRuntimeObject)) return;

      this._performCSGOperation(targetObject);
    }

    /**
     * Performs the actual CSG operation.
     * NOTE: In production, integrate three-bvh-csg for real CSG.
     */
    private _performCSGOperation(targetObject: gdjs.CSG3DRuntimeObject): void {
      const operation = this._csg3DRuntimeObject.getCSGOperation();

      const targetRenderer = targetObject.getRenderer() as CSG3DRuntimeObjectPixiRenderer;
      if (!targetRenderer) return;

      const thisGeometry = this._mesh.geometry.clone();
      const targetGeometry = targetRenderer._mesh.geometry.clone();

      // Apply world transforms
      thisGeometry.applyMatrix4(this._mesh.matrixWorld);
      targetGeometry.applyMatrix4(targetRenderer._mesh.matrixWorld);

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
      const oldGeometry = this._mesh.geometry;
      this._mesh.geometry = resultGeometry;
      this._originalGeometry = resultGeometry.clone();

      if (oldGeometry && oldGeometry !== this._originalGeometry) {
        oldGeometry.dispose();
      }

      // Re-optimize and refresh
      this._optimizeGeometry(this._mesh.geometry);
      this.updateTextureUvMapping();
      this.updateFaceOrientation();
      this.updateTint();
    }

    private _unionGeometries(
      geoA: THREE.BufferGeometry,
      geoB: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // TODO: Replace with three-bvh-csg Evaluator
      return this._mergeGeometries([geoA, geoB]);
    }

    private _subtractGeometries(
      geoA: THREE.BufferGeometry,
      geoB: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // TODO: Replace with three-bvh-csg SUBTRACTION
      return geoA;
    }

    private _intersectGeometries(
      geoA: THREE.BufferGeometry,
      geoB: THREE.BufferGeometry
    ): THREE.BufferGeometry {
      // TODO: Replace with three-bvh-csg INTERSECTION
      return geoA;
    }

    private _mergeGeometries(
      geometries: THREE.BufferGeometry[]
    ): THREE.BufferGeometry {
      // TODO: Use BufferGeometryUtils.mergeGeometries in production
      if (geometries.length === 0) {
        return new THREE.BufferGeometry();
      }
      return geometries[0];
    }

    private _revertToOriginalGeometry(): void {
      const oldGeometry = this._mesh.geometry;
      this._originalGeometry = this._createGeometry();
      this._mesh.geometry = this._originalGeometry;

      if (oldGeometry && oldGeometry !== this._originalGeometry) {
        oldGeometry.dispose();
      }

      this.updateSize();
      this.updateTextureUvMapping();
      this.updateFaceOrientation();
      this.updateTint();
    }

    // ============================================================
    // BAKING
    // ============================================================

    /**
     * Bakes the current geometry into a static mesh.
     */
    bakeGeometry(): void {
      if (this._isBaked) return;

      this._bakedGeometry = this._mesh.geometry.clone();
      this._isBaked = true;
      this._csg3DRuntimeObject.setBakedGeometry(this._bakedGeometry);
      this._optimizeGeometry(this._bakedGeometry);
    }

    /**
     * Unbakes the geometry, restoring dynamic operations.
     */
    unbakeGeometry(): void {
      this._isBaked = false;
      this._bakedGeometry = null;
      this._csg3DRuntimeObject.setBakedGeometry(null);
      this.updateShape();
    }

    // ============================================================
    // SIZE UPDATE
    // ============================================================

    /**
     * Updates the mesh scale based on object dimensions.
     */
    updateSize(): void {
      super.updateSize();

      const width = this._csg3DRuntimeObject.getWidth();
      const height = this._csg3DRuntimeObject.getHeight();
      const depth = this._csg3DRuntimeObject.getDepth();

      // Scale the mesh to match object dimensions
      // Base geometries are created at unit scale (1,1,1) or with radius
      const shape = this._csg3DRuntimeObject.getShape();

      if (shape === 'Box') {
        this._mesh.scale.set(width, height, depth);
      } else if (shape === 'Sphere') {
        const radius = this._csg3DRuntimeObject.getRadius();
        const scale = radius > 0 ? width / (radius * 2) : 1;
        this._mesh.scale.set(scale, scale, scale);
      } else if (shape === 'Cylinder' || shape === 'Cone') {
        const radius = this._csg3DRuntimeObject.getRadius();
        const scaleX = radius > 0 ? width / (radius * 2) : 1;
        const scaleZ = radius > 0 ? depth / (radius * 2) : 1;
        this._mesh.scale.set(scaleX, height, scaleZ);
      } else if (shape === 'Torus') {
        const radius = this._csg3DRuntimeObject.getRadius();
        const scale = radius > 0 ? width / (radius * 2) : 1;
        this._mesh.scale.set(scale, scale, scale);
      } else if (shape === 'Capsule') {
        const radius = this._csg3DRuntimeObject.getRadius();
        const scaleX = radius > 0 ? width / (radius * 2) : 1;
        const scaleZ = radius > 0 ? depth / (radius * 2) : 1;
        this._mesh.scale.set(scaleX, height, scaleZ);
      } else {
        this._mesh.scale.set(width, height, depth);
      }
    }

    // ============================================================
    // LIFECYCLE
    // ============================================================

    /**
     * Called when the object is destroyed.
     */
    onDestroy(): void {
      if (this._mesh.geometry) {
        this._mesh.geometry.dispose();
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
    }

    /**
     * Returns the Three.js object for the renderer.
     */
    getThreeObject(): THREE.Object3D {
      return this._mesh;
    }
  }

  /** @category Renderers > 3D CSG */
  export const CSG3DRuntimeObjectRenderer = CSG3DRuntimeObjectPixiRenderer;
  /** @category Renderers > 3D CSG */
  export type CSG3DRuntimeObjectRenderer = CSG3DRuntimeObjectPixiRenderer;
}
