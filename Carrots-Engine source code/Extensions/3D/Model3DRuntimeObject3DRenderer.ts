namespace gdjs {
  type FloatPoint3D = [float, float, float];

  const epsilon = 1 / (1 << 16);

  type Model3DMaterialProfile = {
    roughness: number;
    metalness: number;
    envMapIntensity: number;
  };

  const getModel3DMaterialProfile = (
    materialType: gdjs.Model3DRuntimeObject.MaterialType
  ): Model3DMaterialProfile => {
    switch (materialType) {
      case gdjs.Model3DRuntimeObject.MaterialType.Matte:
        return { roughness: 0.94, metalness: 0.01, envMapIntensity: 0.85 };
      case gdjs.Model3DRuntimeObject.MaterialType.Standard:
        return { roughness: 0.56, metalness: 0.08, envMapIntensity: 1.05 };
      case gdjs.Model3DRuntimeObject.MaterialType.Glossy:
        return { roughness: 0.2, metalness: 0.16, envMapIntensity: 1.25 };
      case gdjs.Model3DRuntimeObject.MaterialType.Metallic:
        return { roughness: 0.24, metalness: 0.9, envMapIntensity: 1.35 };
      case gdjs.Model3DRuntimeObject.MaterialType.StandardWithoutMetalness:
      default:
        return { roughness: 0.78, metalness: 0, envMapIntensity: 1 };
    }
  };

  const applyModel3DMaterialProfile = (
    material: THREE.Material,
    profile: Model3DMaterialProfile
  ) => {
    const standardMaterial = material as THREE.MeshStandardMaterial;
    if (!('roughness' in standardMaterial) || !('metalness' in standardMaterial)) {
      return;
    }

    standardMaterial.roughness = profile.roughness;
    standardMaterial.metalness = profile.metalness;
    standardMaterial.envMapIntensity = profile.envMapIntensity;
    standardMaterial.needsUpdate = true;
  };

  const applyMaterialProfileToMesh = (
    node: THREE.Object3D,
    profile: Model3DMaterialProfile
  ) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      for (let index = 0; index < mesh.material.length; index++) {
        const clonedMaterial = mesh.material[index].clone();
        applyModel3DMaterialProfile(clonedMaterial, profile);
        mesh.material[index] = clonedMaterial;
      }
    } else {
      const clonedMaterial = mesh.material.clone();
      applyModel3DMaterialProfile(clonedMaterial, profile);
      mesh.material = clonedMaterial;
    }
  };

  const traverseToApplyMaterialProfileFromMeshes = (
    node: THREE.Object3D,
    profile: Model3DMaterialProfile
  ) => node.traverse(child => applyMaterialProfileToMesh(child, profile));

  const convertToBasicMaterial = (
    material: THREE.Material
  ): THREE.MeshBasicMaterial => {
    const basicMaterial = new THREE.MeshBasicMaterial();
    basicMaterial.name = material.name;
    //@ts-ignore
    if (material.color) {
      //@ts-ignore
      basicMaterial.color = material.color;
    }
    //@ts-ignore
    if (material.map) {
      //@ts-ignore
      basicMaterial.map = material.map;
    }
    return basicMaterial;
  };

  const setBasicMaterialTo = (node: THREE.Object3D): void => {
    const mesh = node as THREE.Mesh;
    if (!mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      for (let index = 0; index < mesh.material.length; index++) {
        mesh.material[index] = convertToBasicMaterial(mesh.material[index]);
      }
    } else {
      mesh.material = convertToBasicMaterial(mesh.material);
    }
  };

  const traverseToSetBasicMaterialFromMeshes = (node: THREE.Object3D) =>
    node.traverse(setBasicMaterialTo);

  type Model3DIKTargetMode = 'bone' | 'position';

  type Model3DIKChainDefinition = {
    name: string;
    enabled: boolean;
    effectorBoneName: string;
    targetMode: Model3DIKTargetMode;
    targetBoneName: string;
    targetPosition: FloatPoint3D;
    linkBoneNames: string[];
    iterationCount: number;
    blendFactor: number;
    minAngle: number;
    maxAngle: number;
    targetTolerance: number;
    linkConstraintsByBoneName: Map<string, Model3DIKLinkConstraintDefinition>;
  };

  type Model3DIKChainSettings = {
    name: string;
    enabled: boolean;
    effectorBoneName: string;
    targetMode: Model3DIKTargetMode;
    targetBoneName: string;
    targetPosition: FloatPoint3D;
    linkBoneNames: string[];
    iterationCount: number;
    blendFactor: number;
    minAngle: number;
    maxAngle: number;
    targetTolerance: number;
  };

  type Model3DIKLinkConstraintDefinition = {
    minEulerDegrees: FloatPoint3D;
    maxEulerDegrees: FloatPoint3D;
  };

  type Model3DIKResolvedChain = {
    definition: Model3DIKChainDefinition;
    effectorBone: THREE.Bone;
    targetBone: THREE.Bone | null;
    linkBones: THREE.Bone[];
    linkConstraints: Array<Model3DIKLinkConstraintDefinition | null>;
    targetToleranceSquared: number;
  };

  type Model3DIKGizmoVisual = {
    targetHandle: THREE.Mesh;
    chainLine: THREE.Line;
    chainLinePositions: Float32Array;
  };

  type Model3DIKQuaternion = [number, number, number, number];

  type Model3DIKBonePose = {
    position: FloatPoint3D;
    quaternion: Model3DIKQuaternion;
    scale: FloatPoint3D;
  };

  type Model3DIKPoseSnapshot = {
    bonesByName: Map<string, Model3DIKBonePose>;
  };

  const clampNumber = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

  class Model3DRuntimeObject3DRenderer extends gdjs.RuntimeObject3DRenderer {
    private _model3DRuntimeObject: gdjs.Model3DRuntimeObject;
    /**
     * The 3D model stretched in a 1x1x1 cube.
     */
    private _threeObject: THREE.Object3D;
    private _originalModel: THREE_ADDONS.GLTF;
    private _animationMixer: THREE.AnimationMixer;
    private _action: THREE.AnimationAction | null;
    private _ikChains: Map<string, Model3DIKChainDefinition>;
    private _resolvedIKChains: Map<string, Model3DIKResolvedChain>;
    private _bonesByName: Map<string, THREE.Bone>;
    private _ikPoses: Map<string, Model3DIKPoseSnapshot>;

    private _ikScratchTargetPosition = new THREE.Vector3();
    private _ikScratchLinkPosition = new THREE.Vector3();
    private _ikScratchEffectorPosition = new THREE.Vector3();
    private _ikScratchToEffector = new THREE.Vector3();
    private _ikScratchToTarget = new THREE.Vector3();
    private _ikScratchRotationAxis = new THREE.Vector3();
    private _ikScratchLinkWorldQuaternion = new THREE.Quaternion();
    private _ikScratchLinkWorldQuaternionInverse = new THREE.Quaternion();
    private _ikScratchDeltaQuaternion = new THREE.Quaternion();
    private _ikScratchEuler = new THREE.Euler(0, 0, 0, 'XYZ');
    private _ikGizmosEnabled = false;
    private _ikGizmoGroup: THREE.Group | null = null;
    private _ikGizmoVisuals = new Map<string, Model3DIKGizmoVisual>();
    private _ikGizmoRaycaster = new THREE.Raycaster();
    private _ikGizmoNormalizedPointer = new THREE.Vector2();
    private _ikGizmoCameraPosition = new THREE.Vector3();
    private _ikGizmoCameraDirection = new THREE.Vector3();
    private _ikGizmoPointerWorldPosition = new THREE.Vector3();
    private _ikGizmoDragPlane = new THREE.Plane();
    private _ikGizmoDragOffset = new THREE.Vector3();
    private _ikGizmoScratchTargetWorldPosition = new THREE.Vector3();
    private _ikGizmoScratchLocalPosition = new THREE.Vector3();
    private _ikGizmoWasMousePressed = false;
    private _ikGizmoDraggedChainName: string | null = null;
    private _ikGizmoAttachedLayerRenderer:
      | {
          add3DRendererObject: (object: THREE.Object3D) => void;
          remove3DRendererObject: (object: THREE.Object3D) => void;
        }
      | null = null;

    /**
     * The model origin evaluated according to the object configuration.
     *
     * Coordinates are between 0 and 1.
     */
    private _modelOriginPoint: FloatPoint3D;

    constructor(
      runtimeObject: gdjs.Model3DRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      // GLB files with skeleton must not have any transformation to work properly.
      const originalModel = instanceContainer
        .getGame()
        .getModel3DManager()
        .getModel(runtimeObject._modelResourceName);
      // _updateModel will actually add a clone of the model.
      const model = new THREE.Group();

      // Create a group to transform the object according to
      // position, angle and dimensions.
      const group = new THREE.Group();
      group.rotation.order = 'ZYX';
      group.add(model);
      super(runtimeObject, instanceContainer, group);

      this._model3DRuntimeObject = runtimeObject;
      this._threeObject = model;
      this._originalModel = originalModel;
      this._modelOriginPoint = [0, 0, 0];

      this.updateSize();
      this.updatePosition();
      this.updateRotation();

      this._animationMixer = new THREE.AnimationMixer(model);
      this._action = null;
      this._ikChains = new Map();
      this._resolvedIKChains = new Map();
      this._bonesByName = new Map();
      this._ikPoses = new Map();
    }

    updateAnimation(timeDelta: float) {
      this._animationMixer.update(timeDelta);
      this._updateIKGizmoInteraction();
      this._updateIK();
      this._updateIKGizmoVisuals();
    }

    updatePosition() {
      const originPoint = this.getOriginPoint();
      const centerPoint = this.getCenterPoint();
      this.get3DRendererObject().position.set(
        this._object.getX() -
          this._object.getWidth() * (originPoint[0] - centerPoint[0]),
        this._object.getY() -
          this._object.getHeight() * (originPoint[1] - centerPoint[1]),
        this._object.getZ() -
          this._object.getDepth() * (originPoint[2] - centerPoint[2])
      );
    }

    getOriginPoint() {
      return this._model3DRuntimeObject._originPoint || this._modelOriginPoint;
    }

    getCenterPoint() {
      return this._model3DRuntimeObject._centerPoint || this._modelOriginPoint;
    }

    /**
     * Transform `threeObject` to fit in a 1x1x1 cube.
     *
     * When the object change of size, rotation or position,
     * the transformation is done on the parent of `threeObject`.
     *
     * This function doesn't mutate anything outside of `threeObject`.
     */
    stretchModelIntoUnitaryCube(
      threeObject: THREE.Object3D,
      rotationX: float,
      rotationY: float,
      rotationZ: float
    ): THREE.Box3 {
      // These formulas are also used in:
      // - Model3DEditor.modelSize
      // - Model3DRendered2DInstance
      threeObject.rotation.set(
        gdjs.toRad(rotationX),
        gdjs.toRad(rotationY),
        gdjs.toRad(rotationZ)
      );
      threeObject.updateMatrixWorld(true);
      const boundingBox = new THREE.Box3().setFromObject(threeObject);

      const shouldKeepModelOrigin = !this._model3DRuntimeObject._originPoint;
      if (shouldKeepModelOrigin) {
        // Keep the origin as part of the model.
        // For instance, a model can be 1 face of a cube and we want to keep the
        // inside as part of the object even if it's just void.
        // It also avoids to have the origin outside of the object box.
        boundingBox.expandByPoint(new THREE.Vector3(0, 0, 0));
      }
      const modelWidth = boundingBox.max.x - boundingBox.min.x;
      const modelHeight = boundingBox.max.y - boundingBox.min.y;
      const modelDepth = boundingBox.max.z - boundingBox.min.z;

      // Center the model.
      const centerPoint = this._model3DRuntimeObject._centerPoint;
      if (centerPoint) {
        threeObject.position.set(
          -(boundingBox.min.x + modelWidth * centerPoint[0]),
          // The model is flipped on Y axis.
          -(boundingBox.min.y + modelHeight * (1 - centerPoint[1])),
          -(boundingBox.min.z + modelDepth * centerPoint[2])
        );
      }

      // Rotate the model.
      threeObject.scale.set(1, 1, 1);
      threeObject.rotation.set(
        gdjs.toRad(rotationX),
        gdjs.toRad(rotationY),
        gdjs.toRad(rotationZ)
      );

      // Stretch the model in a 1x1x1 cube.
      const scaleX = modelWidth < epsilon ? 1 : 1 / modelWidth;
      const scaleY = modelHeight < epsilon ? 1 : 1 / modelHeight;
      const scaleZ = modelDepth < epsilon ? 1 : 1 / modelDepth;

      const scaleMatrix = new THREE.Matrix4();
      // Flip on Y because the Y axis is on the opposite side of direct basis.
      // It avoids models to be like a mirror refection.
      scaleMatrix.makeScale(scaleX, -scaleY, scaleZ);
      threeObject.updateMatrix();
      threeObject.applyMatrix4(scaleMatrix);

      return boundingBox;
    }

    private _updateDefaultTransformation(
      threeObject: THREE.Object3D,
      rotationX: float,
      rotationY: float,
      rotationZ: float,
      originalWidth: float,
      originalHeight: float,
      originalDepth: float,
      keepAspectRatio: boolean
    ) {
      const boundingBox = this.stretchModelIntoUnitaryCube(
        threeObject,
        rotationX,
        rotationY,
        rotationZ
      );
      const modelWidth = boundingBox.max.x - boundingBox.min.x;
      const modelHeight = boundingBox.max.y - boundingBox.min.y;
      const modelDepth = boundingBox.max.z - boundingBox.min.z;

      this._modelOriginPoint[0] =
        modelWidth < epsilon ? 0 : -boundingBox.min.x / modelWidth;
      this._modelOriginPoint[1] =
        modelHeight < epsilon ? 0 : -boundingBox.min.y / modelHeight;
      this._modelOriginPoint[2] =
        modelDepth < epsilon ? 0 : -boundingBox.min.z / modelDepth;

      // The model is flipped on Y axis.
      this._modelOriginPoint[1] = 1 - this._modelOriginPoint[1];

      if (keepAspectRatio) {
        // Reduce the object dimensions to keep aspect ratio.
        const widthRatio =
          modelWidth < epsilon
            ? Number.POSITIVE_INFINITY
            : originalWidth / modelWidth;
        const heightRatio =
          modelHeight < epsilon
            ? Number.POSITIVE_INFINITY
            : originalHeight / modelHeight;
        const depthRatio =
          modelDepth < epsilon
            ? Number.POSITIVE_INFINITY
            : originalDepth / modelDepth;
        let scaleRatio = Math.min(widthRatio, heightRatio, depthRatio);
        if (!Number.isFinite(scaleRatio)) {
          scaleRatio = 1;
        }

        this._object._setOriginalWidth(scaleRatio * modelWidth);
        this._object._setOriginalHeight(scaleRatio * modelHeight);
        this._object._setOriginalDepth(scaleRatio * modelDepth);
      } else {
        this._object._setOriginalWidth(originalWidth);
        this._object._setOriginalHeight(originalHeight);
        this._object._setOriginalDepth(originalDepth);
      }
    }

    /**
     * `_updateModel` should always be called after this method.
     * Ideally, use `Model3DRuntimeObject#_reloadModel` instead.
     */
    _reloadModel(
      runtimeObject: Model3DRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      this._originalModel = instanceContainer
        .getGame()
        .getModel3DManager()
        .getModel(runtimeObject._modelResourceName);
    }

    _updateModel(
      rotationX: float,
      rotationY: float,
      rotationZ: float,
      originalWidth: float,
      originalHeight: float,
      originalDepth: float,
      keepAspectRatio: boolean
    ) {
      // Start from the original model because:
      // - _replaceMaterials is destructive
      // - _updateDefaultTransformation may need to work with meshes in local space

      // This group hold the rotation defined by properties.
      const threeObject = new THREE.Group();
      threeObject.rotation.order = 'ZYX';
      const root = THREE_ADDONS.SkeletonUtils.clone(this._originalModel.scene);
      threeObject.add(root);

      this._replaceMaterials(threeObject);

      this._updateDefaultTransformation(
        threeObject,
        rotationX,
        rotationY,
        rotationZ,
        originalWidth,
        originalHeight,
        originalDepth,
        keepAspectRatio
      );

      // Replace the 3D object.
      this.get3DRendererObject().remove(this._threeObject);
      this.get3DRendererObject().add(threeObject);
      this._threeObject = threeObject;
      this.updatePosition();
      this._updateShadow();
      this._rebuildIKChainCache();

      // Start the current animation on the new 3D object.
      this._animationMixer = new THREE.AnimationMixer(root);
      const isAnimationPaused = this._model3DRuntimeObject.isAnimationPaused();
      this._model3DRuntimeObject.setAnimationIndex(
        this._model3DRuntimeObject.getAnimationIndex()
      );
      if (isAnimationPaused) {
        this.pauseAnimation();
      }
    }

    /**
     * Replace materials to better work with lights (or no light).
     */
    private _replaceMaterials(threeObject: THREE.Object3D) {
      if (
        this._model3DRuntimeObject._materialType ===
        gdjs.Model3DRuntimeObject.MaterialType.KeepOriginal
      ) {
        return;
      }

      if (
        this._model3DRuntimeObject._materialType ===
        gdjs.Model3DRuntimeObject.MaterialType.Basic
      ) {
        traverseToSetBasicMaterialFromMeshes(threeObject);
        return;
      }

      const profile = getModel3DMaterialProfile(
        this._model3DRuntimeObject._materialType
      );
      traverseToApplyMaterialProfileFromMeshes(threeObject, profile);
    }

    configureIKChain(
      chainName: string,
      effectorBoneName: string,
      targetBoneName: string,
      linkBoneNames: string[],
      iterationCount: number,
      blendFactor: number,
      minAngle: number,
      maxAngle: number
    ): boolean {
      const normalizedChainName = chainName.trim();
      const normalizedEffectorBoneName = effectorBoneName.trim();
      const normalizedTargetBoneName = targetBoneName.trim();
      let normalizedLinkBoneNames = linkBoneNames
        .map((linkBoneName) => linkBoneName.trim())
        .filter((linkBoneName) => !!linkBoneName);

      if (
        normalizedEffectorBoneName &&
        normalizedLinkBoneNames.length === 0 &&
        this._bonesByName.size > 0
      ) {
        normalizedLinkBoneNames = this._buildDefaultIKLinkBoneNames(
          normalizedEffectorBoneName
        );
      }

      if (
        !normalizedChainName ||
        !normalizedEffectorBoneName ||
        normalizedLinkBoneNames.length === 0
      ) {
        return false;
      }

      const previousChain = this._ikChains.get(normalizedChainName);
      let minAngleDegrees = Number.isFinite(minAngle) ? Math.max(0, minAngle) : 0;
      let maxAngleDegrees = Number.isFinite(maxAngle) ? Math.max(0, maxAngle) : 0;
      if (maxAngleDegrees > 0 && minAngleDegrees > maxAngleDegrees) {
        const temp = minAngleDegrees;
        minAngleDegrees = maxAngleDegrees;
        maxAngleDegrees = temp;
      }

      const chain: Model3DIKChainDefinition = {
        name: normalizedChainName,
        enabled: previousChain ? previousChain.enabled : true,
        effectorBoneName: normalizedEffectorBoneName,
        targetMode: normalizedTargetBoneName ? 'bone' : 'position',
        targetBoneName: normalizedTargetBoneName,
        targetPosition: previousChain
          ? previousChain.targetPosition
          : [this._object.getX(), this._object.getY(), this._object.getZ()],
        linkBoneNames: normalizedLinkBoneNames,
        iterationCount: this._sanitizeIKIterationCount(iterationCount),
        blendFactor: this._sanitizeIKBlendFactor(blendFactor),
        minAngle: minAngleDegrees,
        maxAngle: maxAngleDegrees,
        targetTolerance: previousChain
          ? previousChain.targetTolerance
          : this._sanitizeIKTargetTolerance(0.002),
        linkConstraintsByBoneName: new Map(
          previousChain ? previousChain.linkConstraintsByBoneName : undefined
        ),
      };
      this._ikChains.set(normalizedChainName, chain);
      this._resolveIKChains();
      return true;
    }

    setIKTargetPosition(
      chainName: string,
      targetX: float,
      targetY: float,
      targetZ: float
    ): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }

      chain.targetMode = 'position';
      chain.targetBoneName = '';
      chain.targetPosition = [targetX, targetY, targetZ];
      this._resolveIKChains();
      return true;
    }

    setIKTargetBone(chainName: string, targetBoneName: string): boolean {
      const chain = this._ikChains.get(chainName.trim());
      const normalizedTargetBoneName = targetBoneName.trim();
      if (!chain || !normalizedTargetBoneName) {
        return false;
      }

      chain.targetMode = 'bone';
      chain.targetBoneName = normalizedTargetBoneName;
      this._resolveIKChains();
      return true;
    }

    setIKEnabled(chainName: string, enabled: boolean): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }
      chain.enabled = enabled;
      return true;
    }

    setIKIterationCount(chainName: string, iterationCount: number): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }
      chain.iterationCount = this._sanitizeIKIterationCount(iterationCount);
      return true;
    }

    setIKBlendFactor(chainName: string, blendFactor: number): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }
      chain.blendFactor = this._sanitizeIKBlendFactor(blendFactor);
      return true;
    }

    setIKAngleLimits(
      chainName: string,
      minAngleDegrees: number,
      maxAngleDegrees: number
    ): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }
      let normalizedMinAngle = Number.isFinite(minAngleDegrees)
        ? Math.max(0, minAngleDegrees)
        : 0;
      let normalizedMaxAngle = Number.isFinite(maxAngleDegrees)
        ? Math.max(0, maxAngleDegrees)
        : 0;
      if (normalizedMaxAngle > 0 && normalizedMinAngle > normalizedMaxAngle) {
        const temp = normalizedMinAngle;
        normalizedMinAngle = normalizedMaxAngle;
        normalizedMaxAngle = temp;
      }
      chain.minAngle = normalizedMinAngle;
      chain.maxAngle = normalizedMaxAngle;
      return true;
    }

    setIKTargetTolerance(chainName: string, tolerance: number): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }

      chain.targetTolerance = this._sanitizeIKTargetTolerance(tolerance);
      return true;
    }

    setIKGizmosEnabled(enabled: boolean): void {
      this._ikGizmosEnabled = enabled;
      if (!enabled) {
        this._ikGizmoDraggedChainName = null;
      }
      this._syncIKGizmoVisualsWithResolvedChains();
    }

    areIKGizmosEnabled(): boolean {
      return this._ikGizmosEnabled;
    }

    setIKLinkAngleLimits(
      chainName: string,
      linkBoneName: string,
      minAngleXDegrees: number,
      maxAngleXDegrees: number,
      minAngleYDegrees: number,
      maxAngleYDegrees: number,
      minAngleZDegrees: number,
      maxAngleZDegrees: number
    ): boolean {
      const chain = this._ikChains.get(chainName.trim());
      const normalizedLinkBoneName = linkBoneName.trim();
      if (!chain || !normalizedLinkBoneName) {
        return false;
      }

      const [minX, maxX] = this._sanitizeIKAngleConstraintRange(
        minAngleXDegrees,
        maxAngleXDegrees
      );
      const [minY, maxY] = this._sanitizeIKAngleConstraintRange(
        minAngleYDegrees,
        maxAngleYDegrees
      );
      const [minZ, maxZ] = this._sanitizeIKAngleConstraintRange(
        minAngleZDegrees,
        maxAngleZDegrees
      );

      chain.linkConstraintsByBoneName.set(normalizedLinkBoneName, {
        minEulerDegrees: [minX, minY, minZ],
        maxEulerDegrees: [maxX, maxY, maxZ],
      });
      this._resolveIKChains();
      return true;
    }

    clearIKLinkAngleLimits(chainName: string, linkBoneName: string): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }

      const normalizedLinkBoneName = linkBoneName.trim();
      if (!normalizedLinkBoneName) {
        return false;
      }

      const hasDeleted = chain.linkConstraintsByBoneName.delete(
        normalizedLinkBoneName
      );
      if (hasDeleted) {
        this._resolveIKChains();
      }
      return hasDeleted;
    }

    clearIKLinkConstraints(chainName: string): boolean {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return false;
      }
      if (chain.linkConstraintsByBoneName.size === 0) {
        return false;
      }
      chain.linkConstraintsByBoneName.clear();
      this._resolveIKChains();
      return true;
    }

    removeIKChain(chainName: string): void {
      const normalizedChainName = chainName.trim();
      this._ikChains.delete(normalizedChainName);
      this._resolvedIKChains.delete(normalizedChainName);
      this._syncIKGizmoVisualsWithResolvedChains();
    }

    clearIKChains(): void {
      this._ikChains.clear();
      this._resolvedIKChains.clear();
      this._syncIKGizmoVisualsWithResolvedChains();
    }

    hasIKChain(chainName: string): boolean {
      return this._ikChains.has(chainName.trim());
    }

    getIKChainCount(): number {
      return this._ikChains.size;
    }

    getIKChainNames(): string[] {
      return Array.from(this._ikChains.keys());
    }

    getIKChainSettings(chainName: string): Model3DIKChainSettings | null {
      const chain = this._ikChains.get(chainName.trim());
      if (!chain) {
        return null;
      }

      const [targetX, targetY, targetZ] = chain.targetPosition;
      return {
        name: chain.name,
        enabled: chain.enabled,
        effectorBoneName: chain.effectorBoneName,
        targetMode: chain.targetMode,
        targetBoneName: chain.targetBoneName,
        targetPosition: [targetX, targetY, targetZ],
        linkBoneNames: chain.linkBoneNames.slice(),
        iterationCount: chain.iterationCount,
        blendFactor: chain.blendFactor,
        minAngle: chain.minAngle,
        maxAngle: chain.maxAngle,
        targetTolerance: chain.targetTolerance,
      };
    }

    getIKBoneNames(): string[] {
      return Array.from(this._bonesByName.keys());
    }

    saveIKPose(poseName: string): boolean {
      const normalizedPoseName = poseName.trim();
      if (!normalizedPoseName || this._bonesByName.size === 0) {
        return false;
      }

      const bonesByName = new Map<string, Model3DIKBonePose>();
      for (const [boneName, bone] of this._bonesByName.entries()) {
        bonesByName.set(boneName, {
          position: [bone.position.x, bone.position.y, bone.position.z],
          quaternion: [
            bone.quaternion.x,
            bone.quaternion.y,
            bone.quaternion.z,
            bone.quaternion.w,
          ],
          scale: [bone.scale.x, bone.scale.y, bone.scale.z],
        });
      }

      this._ikPoses.set(normalizedPoseName, { bonesByName });
      return true;
    }

    applyIKPose(poseName: string): boolean {
      const pose = this._ikPoses.get(poseName.trim());
      if (!pose) {
        return false;
      }

      let hasAppliedBone = false;
      for (const [boneName, bonePose] of pose.bonesByName.entries()) {
        const bone = this._bonesByName.get(boneName);
        if (!bone) {
          continue;
        }

        bone.position.set(
          bonePose.position[0],
          bonePose.position[1],
          bonePose.position[2]
        );
        bone.quaternion.set(
          bonePose.quaternion[0],
          bonePose.quaternion[1],
          bonePose.quaternion[2],
          bonePose.quaternion[3]
        );
        bone.scale.set(bonePose.scale[0], bonePose.scale[1], bonePose.scale[2]);
        bone.updateMatrix();
        hasAppliedBone = true;
      }

      if (!hasAppliedBone) {
        return false;
      }

      this._threeObject.updateMatrixWorld(true);
      return true;
    }

    removeIKPose(poseName: string): boolean {
      return this._ikPoses.delete(poseName.trim());
    }

    clearIKPoses(): void {
      this._ikPoses.clear();
    }

    hasIKPose(poseName: string): boolean {
      return this._ikPoses.has(poseName.trim());
    }

    getIKPoseCount(): number {
      return this._ikPoses.size;
    }

    pinIKTargetToCurrentEffector(chainName: string): boolean {
      const resolvedChain = this._resolvedIKChains.get(chainName.trim());
      if (!resolvedChain) {
        return false;
      }

      this._threeObject.updateMatrixWorld(true);
      resolvedChain.effectorBone.getWorldPosition(this._ikScratchEffectorPosition);
      resolvedChain.definition.targetMode = 'position';
      resolvedChain.definition.targetBoneName = '';
      resolvedChain.definition.targetPosition = [
        this._ikScratchEffectorPosition.x,
        -this._ikScratchEffectorPosition.y,
        this._ikScratchEffectorPosition.z,
      ];
      this._resolveIKChains();
      return true;
    }

    pinAllIKTargetsToCurrentEffectors(): number {
      if (this._resolvedIKChains.size === 0) {
        return 0;
      }

      this._threeObject.updateMatrixWorld(true);
      let pinnedChainCount = 0;
      for (const resolvedChain of this._resolvedIKChains.values()) {
        resolvedChain.effectorBone.getWorldPosition(this._ikScratchEffectorPosition);
        resolvedChain.definition.targetMode = 'position';
        resolvedChain.definition.targetBoneName = '';
        resolvedChain.definition.targetPosition = [
          this._ikScratchEffectorPosition.x,
          -this._ikScratchEffectorPosition.y,
          this._ikScratchEffectorPosition.z,
        ];
        pinnedChainCount++;
      }

      if (pinnedChainCount > 0) {
        this._resolveIKChains();
      }
      return pinnedChainCount;
    }

    exportIKPosesToJSON(): string {
      const serializedPoses = Array.from(this._ikPoses.entries()).map(
        ([poseName, pose]) => ({
          name: poseName,
          bones: Array.from(pose.bonesByName.entries()).map(
            ([boneName, bonePose]) => ({
              name: boneName,
              position: [
                bonePose.position[0],
                bonePose.position[1],
                bonePose.position[2],
              ] as FloatPoint3D,
              quaternion: [
                bonePose.quaternion[0],
                bonePose.quaternion[1],
                bonePose.quaternion[2],
                bonePose.quaternion[3],
              ] as Model3DIKQuaternion,
              scale: [bonePose.scale[0], bonePose.scale[1], bonePose.scale[2]] as
                FloatPoint3D,
            })
          ),
        })
      );

      return JSON.stringify({
        version: 1,
        poses: serializedPoses,
      });
    }

    importIKPosesFromJSON(posesJSON: string, clearExisting: boolean): boolean {
      if (!posesJSON) {
        return false;
      }

      let parsedPayload: unknown = null;
      try {
        parsedPayload = JSON.parse(posesJSON);
      } catch (_error) {
        return false;
      }

      if (!this._isObjectRecord(parsedPayload)) {
        return false;
      }

      const serializedPoses = parsedPayload.poses;
      if (!Array.isArray(serializedPoses)) {
        return false;
      }

      if (clearExisting) {
        this._ikPoses.clear();
      }

      let importedPoseCount = 0;
      for (const serializedPose of serializedPoses) {
        if (!this._isObjectRecord(serializedPose)) {
          continue;
        }

        const rawPoseName = serializedPose.name;
        const rawBones = serializedPose.bones;
        if (typeof rawPoseName !== 'string' || !Array.isArray(rawBones)) {
          continue;
        }

        const normalizedPoseName = rawPoseName.trim();
        if (!normalizedPoseName) {
          continue;
        }

        const bonesByName = new Map<string, Model3DIKBonePose>();
        for (const rawBone of rawBones) {
          if (!this._isObjectRecord(rawBone)) {
            continue;
          }

          const rawBoneName = rawBone.name;
          if (typeof rawBoneName !== 'string') {
            continue;
          }

          const normalizedBoneName = rawBoneName.trim();
          if (!normalizedBoneName) {
            continue;
          }

          const position = this._parseIKPoseVector3(rawBone.position);
          const quaternion = this._parseIKPoseQuaternion(rawBone.quaternion);
          const scale = this._parseIKPoseVector3(rawBone.scale);
          if (!position || !quaternion || !scale) {
            continue;
          }

          bonesByName.set(normalizedBoneName, {
            position,
            quaternion,
            scale,
          });
        }

        if (bonesByName.size === 0) {
          continue;
        }

        this._ikPoses.set(normalizedPoseName, { bonesByName });
        importedPoseCount++;
      }

      return importedPoseCount > 0;
    }

    private _isObjectRecord(value: unknown): value is Record<string, unknown> {
      return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    private _parseIKPoseVector3(value: unknown): FloatPoint3D | null {
      if (!Array.isArray(value) || value.length !== 3) {
        return null;
      }

      const x = Number(value[0]);
      const y = Number(value[1]);
      const z = Number(value[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
      }

      return [x, y, z];
    }

    private _parseIKPoseQuaternion(value: unknown): Model3DIKQuaternion | null {
      if (!Array.isArray(value) || value.length !== 4) {
        return null;
      }

      const x = Number(value[0]);
      const y = Number(value[1]);
      const z = Number(value[2]);
      const w = Number(value[3]);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z) ||
        !Number.isFinite(w)
      ) {
        return null;
      }

      const quaternionLength = Math.hypot(x, y, z, w);
      if (!Number.isFinite(quaternionLength) || quaternionLength < epsilon) {
        return null;
      }

      return [
        x / quaternionLength,
        y / quaternionLength,
        z / quaternionLength,
        w / quaternionLength,
      ];
    }

    private _sanitizeIKIterationCount(iterationCount: number): number {
      if (!Number.isFinite(iterationCount)) {
        return 8;
      }
      return clampNumber(Math.round(iterationCount), 1, 32);
    }

    private _sanitizeIKBlendFactor(blendFactor: number): number {
      if (!Number.isFinite(blendFactor)) {
        return 1;
      }
      return clampNumber(blendFactor, 0, 1);
    }

    private _sanitizeIKTargetTolerance(tolerance: number): number {
      if (!Number.isFinite(tolerance)) {
        return 0.002;
      }
      return clampNumber(tolerance, 0.00005, 1);
    }

    private _sanitizeIKAngleConstraintRange(
      minAngleDegrees: number,
      maxAngleDegrees: number
    ): [number, number] {
      let normalizedMinAngle = Number.isFinite(minAngleDegrees)
        ? clampNumber(minAngleDegrees, -180, 180)
        : -180;
      let normalizedMaxAngle = Number.isFinite(maxAngleDegrees)
        ? clampNumber(maxAngleDegrees, -180, 180)
        : 180;
      if (normalizedMinAngle > normalizedMaxAngle) {
        const temp = normalizedMinAngle;
        normalizedMinAngle = normalizedMaxAngle;
        normalizedMaxAngle = temp;
      }
      return [normalizedMinAngle, normalizedMaxAngle];
    }

    private _isAncestorBone(
      ancestorBone: THREE.Bone,
      childBone: THREE.Object3D
    ): boolean {
      let currentParent = childBone.parent;
      while (currentParent) {
        if (currentParent === ancestorBone) {
          return true;
        }
        currentParent = currentParent.parent;
      }
      return false;
    }

    private _isValidIKHierarchy(
      effectorBone: THREE.Bone,
      linkBones: THREE.Bone[]
    ): boolean {
      if (linkBones.length === 0) {
        return false;
      }

      if (!this._isAncestorBone(linkBones[0], effectorBone)) {
        return false;
      }

      for (let linkIndex = 1; linkIndex < linkBones.length; linkIndex++) {
        const childLinkBone = linkBones[linkIndex - 1];
        const parentLinkBone = linkBones[linkIndex];
        if (!this._isAncestorBone(parentLinkBone, childLinkBone)) {
          return false;
        }
      }

      return true;
    }

    private _buildDefaultIKLinkBoneNames(effectorBoneName: string): string[] {
      const effectorBone = this._bonesByName.get(effectorBoneName);
      if (!effectorBone) {
        return [];
      }

      const linkBoneNames: string[] = [];
      let currentParent: THREE.Object3D | null = effectorBone.parent;
      while (currentParent) {
        const maybeBone = currentParent as any;
        if (!maybeBone || !maybeBone.isBone) {
          break;
        }

        const parentBone = currentParent as THREE.Bone;
        linkBoneNames.push(parentBone.name);
        currentParent = parentBone.parent;
      }

      return linkBoneNames;
    }

    private _rebuildIKChainCache(): void {
      this._bonesByName.clear();
      this._threeObject.traverse((child) => {
        const maybeBone = child as any;
        if (maybeBone && maybeBone.isBone) {
          const bone = child as THREE.Bone;
          this._bonesByName.set(bone.name, bone);
        }
      });
      this._resolveIKChains();
    }

    private _resolveIKChains(): void {
      this._resolvedIKChains.clear();
      for (const chain of this._ikChains.values()) {
        const effectorBone = this._bonesByName.get(chain.effectorBoneName);
        if (!effectorBone) continue;

        const seenLinkBoneNames = new Set<string>();
        const linkBones = chain.linkBoneNames
          .filter((linkBoneName) => {
            if (seenLinkBoneNames.has(linkBoneName)) {
              return false;
            }
            seenLinkBoneNames.add(linkBoneName);
            return true;
          })
          .map((linkBoneName) => this._bonesByName.get(linkBoneName))
          .filter((linkBone): linkBone is THREE.Bone => !!linkBone);
        if (linkBones.length === 0) continue;
        if (!this._isValidIKHierarchy(effectorBone, linkBones)) continue;

        const targetBone =
          chain.targetMode === 'bone'
            ? this._bonesByName.get(chain.targetBoneName) || null
            : null;

        const linkConstraints = linkBones.map((linkBone) => {
          return chain.linkConstraintsByBoneName.get(linkBone.name) || null;
        });

        this._resolvedIKChains.set(chain.name, {
          definition: chain,
          effectorBone,
          targetBone,
          linkBones,
          linkConstraints,
          targetToleranceSquared: chain.targetTolerance * chain.targetTolerance,
        });
      }
      this._syncIKGizmoVisualsWithResolvedChains();
    }

    private _updateIK(): void {
      if (this._resolvedIKChains.size === 0) return;

      this._threeObject.updateMatrixWorld(true);
      for (const resolvedChain of this._resolvedIKChains.values()) {
        const { definition } = resolvedChain;
        if (!definition.enabled) continue;

        if (definition.targetMode === 'bone' && !resolvedChain.targetBone) {
          continue;
        }

        const targetPosition = this._ikScratchTargetPosition;
        if (definition.targetMode === 'bone' && resolvedChain.targetBone) {
          resolvedChain.targetBone.getWorldPosition(targetPosition);
        } else {
          const [targetX, targetY, targetZ] = definition.targetPosition;
          targetPosition.set(targetX, -targetY, targetZ);
        }

        this._solveIKChain(resolvedChain, targetPosition);
      }
    }

    private _solveIKChain(
      resolvedChain: Model3DIKResolvedChain,
      targetPosition: THREE.Vector3
    ): void {
      const { definition } = resolvedChain;
      const minAngle = gdjs.toRad(definition.minAngle);
      const maxAngle =
        definition.maxAngle > 0 ? gdjs.toRad(definition.maxAngle) : Math.PI;

      for (
        let iterationIndex = 0;
        iterationIndex < definition.iterationCount;
        iterationIndex++
      ) {
        let hasRotatedBone = false;
        for (
          let linkIndex = 0;
          linkIndex < resolvedChain.linkBones.length;
          linkIndex++
        ) {
          const linkBone = resolvedChain.linkBones[linkIndex];
          const linkConstraint = resolvedChain.linkConstraints[linkIndex];
          linkBone.getWorldPosition(this._ikScratchLinkPosition);
          resolvedChain.effectorBone.getWorldPosition(
            this._ikScratchEffectorPosition
          );

          this._ikScratchToEffector
            .copy(this._ikScratchEffectorPosition)
            .sub(this._ikScratchLinkPosition);
          this._ikScratchToTarget
            .copy(targetPosition)
            .sub(this._ikScratchLinkPosition);

          if (
            this._ikScratchToEffector.lengthSq() < epsilon ||
            this._ikScratchToTarget.lengthSq() < epsilon
          ) {
            continue;
          }

          this._ikScratchToEffector.normalize();
          this._ikScratchToTarget.normalize();

          const dot = clampNumber(
            this._ikScratchToEffector.dot(this._ikScratchToTarget),
            -1,
            1
          );
          let angle = Math.acos(dot);
          if (!Number.isFinite(angle) || angle < 1e-5) {
            continue;
          }

          if (minAngle > 0 && angle < minAngle) {
            angle = minAngle;
          }
          if (maxAngle > 0 && angle > maxAngle) {
            angle = maxAngle;
          }
          angle *= definition.blendFactor;
          if (angle < 1e-6) {
            continue;
          }

          this._ikScratchRotationAxis.crossVectors(
            this._ikScratchToEffector,
            this._ikScratchToTarget
          );
          if (this._ikScratchRotationAxis.lengthSq() < epsilon) {
            continue;
          }
          this._ikScratchRotationAxis.normalize();

          linkBone.getWorldQuaternion(this._ikScratchLinkWorldQuaternion);
          this._ikScratchLinkWorldQuaternionInverse
            .copy(this._ikScratchLinkWorldQuaternion)
            .invert();
          this._ikScratchRotationAxis.applyQuaternion(
            this._ikScratchLinkWorldQuaternionInverse
          );

          this._ikScratchDeltaQuaternion.setFromAxisAngle(
            this._ikScratchRotationAxis,
            angle
          );
          linkBone.quaternion.multiply(this._ikScratchDeltaQuaternion);

          if (linkConstraint) {
            this._ikScratchEuler.setFromQuaternion(linkBone.quaternion, 'XYZ');
            this._ikScratchEuler.x = clampNumber(
              this._ikScratchEuler.x,
              gdjs.toRad(linkConstraint.minEulerDegrees[0]),
              gdjs.toRad(linkConstraint.maxEulerDegrees[0])
            );
            this._ikScratchEuler.y = clampNumber(
              this._ikScratchEuler.y,
              gdjs.toRad(linkConstraint.minEulerDegrees[1]),
              gdjs.toRad(linkConstraint.maxEulerDegrees[1])
            );
            this._ikScratchEuler.z = clampNumber(
              this._ikScratchEuler.z,
              gdjs.toRad(linkConstraint.minEulerDegrees[2]),
              gdjs.toRad(linkConstraint.maxEulerDegrees[2])
            );
            linkBone.quaternion.setFromEuler(this._ikScratchEuler);
          }

          linkBone.updateMatrixWorld(true);
          hasRotatedBone = true;
        }

        resolvedChain.effectorBone.getWorldPosition(this._ikScratchEffectorPosition);
        if (
          this._ikScratchEffectorPosition.distanceToSquared(targetPosition) <
          resolvedChain.targetToleranceSquared
        ) {
          break;
        }
        if (!hasRotatedBone) {
          break;
        }
      }
    }

    private _getIKGizmoLayerContext():
      | {
          layerRenderer: {
            add3DRendererObject: (object: THREE.Object3D) => void;
            remove3DRendererObject: (object: THREE.Object3D) => void;
            getThreeCamera: () => THREE.Camera | null;
            getThreeGroup: () => THREE.Group | null;
          };
          threeCamera: THREE.Camera | null;
          threeGroup: THREE.Group | null;
        }
      | null {
      const runtimeLayerRenderer = this._object
        .getRuntimeScene()
        .getLayer(this._object.getLayer())
        .getRenderer() as {
        add3DRendererObject?: (object: THREE.Object3D) => void;
        remove3DRendererObject?: (object: THREE.Object3D) => void;
        getThreeCamera?: () => THREE.Camera | null;
        getThreeGroup?: () => THREE.Group | null;
      };
      if (
        !runtimeLayerRenderer ||
        typeof runtimeLayerRenderer.add3DRendererObject !== 'function' ||
        typeof runtimeLayerRenderer.remove3DRendererObject !== 'function' ||
        typeof runtimeLayerRenderer.getThreeCamera !== 'function' ||
        typeof runtimeLayerRenderer.getThreeGroup !== 'function'
      ) {
        return null;
      }

      return {
        layerRenderer: runtimeLayerRenderer as {
          add3DRendererObject: (object: THREE.Object3D) => void;
          remove3DRendererObject: (object: THREE.Object3D) => void;
          getThreeCamera: () => THREE.Camera | null;
          getThreeGroup: () => THREE.Group | null;
        },
        threeCamera: runtimeLayerRenderer.getThreeCamera(),
        threeGroup: runtimeLayerRenderer.getThreeGroup(),
      };
    }

    private _ensureIKGizmoLayerAttachment(): boolean {
      if (!this._ikGizmoGroup) {
        this._ikGizmoGroup = new THREE.Group();
        this._ikGizmoGroup.rotation.order = 'ZYX';
        this._ikGizmoGroup.name = 'GDJS.Model3D.IKGizmos';
      }

      const context = this._getIKGizmoLayerContext();
      if (!context || !context.threeGroup) {
        return false;
      }

      if (
        this._ikGizmoAttachedLayerRenderer &&
        this._ikGizmoAttachedLayerRenderer !== context.layerRenderer
      ) {
        this._ikGizmoAttachedLayerRenderer.remove3DRendererObject(
          this._ikGizmoGroup
        );
      }

      if (this._ikGizmoGroup.parent !== context.threeGroup) {
        context.layerRenderer.add3DRendererObject(this._ikGizmoGroup);
      }
      this._ikGizmoAttachedLayerRenderer = context.layerRenderer;
      return true;
    }

    private _disposeIKGizmoVisual(visual: Model3DIKGizmoVisual): void {
      visual.targetHandle.removeFromParent();
      visual.targetHandle.geometry.dispose();
      const targetHandleMaterials = Array.isArray(visual.targetHandle.material)
        ? visual.targetHandle.material
        : [visual.targetHandle.material];
      for (const targetHandleMaterial of targetHandleMaterials) {
        targetHandleMaterial.dispose();
      }

      visual.chainLine.removeFromParent();
      visual.chainLine.geometry.dispose();
      const chainLineMaterials = Array.isArray(visual.chainLine.material)
        ? visual.chainLine.material
        : [visual.chainLine.material];
      for (const chainLineMaterial of chainLineMaterials) {
        chainLineMaterial.dispose();
      }
    }

    private _disposeIKGizmos(): void {
      this._ikGizmoDraggedChainName = null;
      this._ikGizmoWasMousePressed = false;
      for (const visual of this._ikGizmoVisuals.values()) {
        this._disposeIKGizmoVisual(visual);
      }
      this._ikGizmoVisuals.clear();

      if (this._ikGizmoGroup) {
        if (this._ikGizmoAttachedLayerRenderer) {
          this._ikGizmoAttachedLayerRenderer.remove3DRendererObject(
            this._ikGizmoGroup
          );
        }
        this._ikGizmoGroup.removeFromParent();
      }
      this._ikGizmoGroup = null;
      this._ikGizmoAttachedLayerRenderer = null;
    }

    private _createIKGizmoVisual(
      chainName: string,
      resolvedChain: Model3DIKResolvedChain
    ): Model3DIKGizmoVisual {
      const targetHandle = new THREE.Mesh(
        new THREE.SphereGeometry(1, 18, 18),
        new THREE.MeshBasicMaterial({
          color: '#4ca3ff',
          transparent: true,
          opacity: 0.95,
          depthTest: false,
          depthWrite: false,
        })
      );
      targetHandle.renderOrder = 9999;
      (targetHandle as any).gdjsIKChainName = chainName;

      const chainPointCount = resolvedChain.linkBones.length + 1;
      const chainLinePositions = new Float32Array(chainPointCount * 3);
      const chainLineGeometry = new THREE.BufferGeometry();
      chainLineGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(chainLinePositions, 3)
      );
      const chainLine = new THREE.Line(
        chainLineGeometry,
        new THREE.LineBasicMaterial({
          color: '#ff5a5a',
          transparent: true,
          opacity: 0.9,
          depthTest: false,
          depthWrite: false,
        })
      );
      chainLine.renderOrder = 9998;

      return {
        targetHandle,
        chainLine,
        chainLinePositions,
      };
    }

    private _syncIKGizmoVisualsWithResolvedChains(): void {
      if (!this._ikGizmosEnabled || this._resolvedIKChains.size === 0) {
        this._disposeIKGizmos();
        return;
      }

      if (!this._ensureIKGizmoLayerAttachment() || !this._ikGizmoGroup) {
        return;
      }

      for (const [chainName, visual] of this._ikGizmoVisuals.entries()) {
        if (this._resolvedIKChains.has(chainName)) {
          continue;
        }
        this._disposeIKGizmoVisual(visual);
        this._ikGizmoVisuals.delete(chainName);
      }

      for (const [chainName, resolvedChain] of this._resolvedIKChains.entries()) {
        if (this._ikGizmoVisuals.has(chainName)) {
          continue;
        }
        const visual = this._createIKGizmoVisual(chainName, resolvedChain);
        this._ikGizmoGroup.add(visual.chainLine);
        this._ikGizmoGroup.add(visual.targetHandle);
        this._ikGizmoVisuals.set(chainName, visual);
      }

      this._ikGizmoGroup.visible = this._ikGizmoVisuals.size > 0;
    }

    private _getChainTargetLocalPosition(
      resolvedChain: Model3DIKResolvedChain,
      outLocalPosition: THREE.Vector3
    ): THREE.Vector3 {
      const { definition, targetBone } = resolvedChain;
      if (definition.targetMode === 'bone' && targetBone) {
        targetBone.getWorldPosition(this._ikGizmoScratchTargetWorldPosition);
        if (this._ikGizmoGroup && this._ikGizmoGroup.parent) {
          outLocalPosition
            .copy(this._ikGizmoScratchTargetWorldPosition);
          this._ikGizmoGroup.parent.worldToLocal(outLocalPosition);
          return outLocalPosition;
        }
      }

      const [targetX, targetY, targetZ] = definition.targetPosition;
      outLocalPosition.set(targetX, targetY, targetZ);
      return outLocalPosition;
    }

    private _updateIKGizmoVisuals(): void {
      if (
        !this._ikGizmosEnabled ||
        this._resolvedIKChains.size === 0 ||
        !this._ikGizmoGroup ||
        this._ikGizmoVisuals.size === 0 ||
        !this._ensureIKGizmoLayerAttachment()
      ) {
        return;
      }

      const context = this._getIKGizmoLayerContext();
      const threeCamera = context ? context.threeCamera : null;
      if (threeCamera) {
        threeCamera.getWorldPosition(this._ikGizmoCameraPosition);
      }

      for (const [chainName, resolvedChain] of this._resolvedIKChains.entries()) {
        const visual = this._ikGizmoVisuals.get(chainName);
        if (!visual) {
          continue;
        }

        const targetLocalPosition = this._getChainTargetLocalPosition(
          resolvedChain,
          this._ikGizmoScratchLocalPosition
        );
        visual.targetHandle.position.copy(targetLocalPosition);

        const targetHandleMaterial = visual.targetHandle
          .material as THREE.MeshBasicMaterial;
        targetHandleMaterial.color.set(
          this._ikGizmoDraggedChainName === chainName ? '#ffd166' : '#4ca3ff'
        );
        targetHandleMaterial.needsUpdate = true;

        if (threeCamera) {
          const targetWorldPosition = this._ikGizmoPointerWorldPosition;
          targetWorldPosition.copy(targetLocalPosition);
          this._ikGizmoGroup.parent?.localToWorld(targetWorldPosition);
          const distanceToCamera = targetWorldPosition.distanceTo(
            this._ikGizmoCameraPosition
          );
          const handleScale = clampNumber(distanceToCamera * 0.02, 2, 35);
          visual.targetHandle.scale.set(handleScale, handleScale, handleScale);
        }

        let positionOffset = 0;
        for (
          let linkIndex = resolvedChain.linkBones.length - 1;
          linkIndex >= 0;
          linkIndex--
        ) {
          const linkBone = resolvedChain.linkBones[linkIndex];
          linkBone.getWorldPosition(this._ikGizmoScratchTargetWorldPosition);
          if (this._ikGizmoGroup.parent) {
            this._ikGizmoGroup.parent.worldToLocal(
              this._ikGizmoScratchTargetWorldPosition
            );
          }
          visual.chainLinePositions[positionOffset++] =
            this._ikGizmoScratchTargetWorldPosition.x;
          visual.chainLinePositions[positionOffset++] =
            this._ikGizmoScratchTargetWorldPosition.y;
          visual.chainLinePositions[positionOffset++] =
            this._ikGizmoScratchTargetWorldPosition.z;
        }

        resolvedChain.effectorBone.getWorldPosition(
          this._ikGizmoScratchTargetWorldPosition
        );
        if (this._ikGizmoGroup.parent) {
          this._ikGizmoGroup.parent.worldToLocal(
            this._ikGizmoScratchTargetWorldPosition
          );
        }
        visual.chainLinePositions[positionOffset++] =
          this._ikGizmoScratchTargetWorldPosition.x;
        visual.chainLinePositions[positionOffset++] =
          this._ikGizmoScratchTargetWorldPosition.y;
        visual.chainLinePositions[positionOffset++] =
          this._ikGizmoScratchTargetWorldPosition.z;

        const linePositionAttribute = visual.chainLine.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        linePositionAttribute.needsUpdate = true;
      }
    }

    private _updateIKGizmoInteraction(): void {
      if (
        !this._ikGizmosEnabled ||
        this._resolvedIKChains.size === 0 ||
        this._ikGizmoVisuals.size === 0
      ) {
        this._ikGizmoDraggedChainName = null;
        this._ikGizmoWasMousePressed = false;
        return;
      }

      const context = this._getIKGizmoLayerContext();
      if (!context || !context.threeCamera || !this._ensureIKGizmoLayerAttachment()) {
        this._ikGizmoDraggedChainName = null;
        this._ikGizmoWasMousePressed = false;
        return;
      }

      const runtimeGame = this._object.getInstanceContainer().getGame();
      const inputManager = runtimeGame.getInputManager();
      const isMousePressed = inputManager.isMouseButtonPressed(
        gdjs.InputManager.MOUSE_LEFT_BUTTON
      );
      const hasMouseJustPressed = isMousePressed && !this._ikGizmoWasMousePressed;

      if (!isMousePressed) {
        this._ikGizmoDraggedChainName = null;
      }

      if (hasMouseJustPressed && inputManager.isMouseInsideCanvas()) {
        this._ikGizmoNormalizedPointer.set(
          (inputManager.getCursorX() / runtimeGame.getGameResolutionWidth()) * 2 -
            1,
          -(inputManager.getCursorY() / runtimeGame.getGameResolutionHeight()) * 2 +
            1
        );
        this._ikGizmoRaycaster.setFromCamera(
          this._ikGizmoNormalizedPointer,
          context.threeCamera
        );
        const targetHandles = Array.from(this._ikGizmoVisuals.values()).map(
          (visual) => visual.targetHandle
        );
        const intersects = this._ikGizmoRaycaster.intersectObjects(
          targetHandles,
          false
        );
        const firstIntersect = intersects[0];
        if (firstIntersect) {
          const chainName = (firstIntersect.object as any).gdjsIKChainName as
            | string
            | undefined;
          if (chainName && this._resolvedIKChains.has(chainName)) {
            this._ikGizmoDraggedChainName = chainName;
            const resolvedChain = this._resolvedIKChains.get(chainName);
            if (resolvedChain) {
              resolvedChain.definition.targetMode = 'position';
              resolvedChain.definition.targetBoneName = '';
              context.threeCamera.getWorldDirection(this._ikGizmoCameraDirection);
              this._ikGizmoDragPlane.setFromNormalAndCoplanarPoint(
                this._ikGizmoCameraDirection,
                firstIntersect.point
              );
              if (
                this._ikGizmoRaycaster.ray.intersectPlane(
                  this._ikGizmoDragPlane,
                  this._ikGizmoPointerWorldPosition
                )
              ) {
                this._ikGizmoDragOffset
                  .copy(firstIntersect.point)
                  .sub(this._ikGizmoPointerWorldPosition);
              } else {
                this._ikGizmoDragOffset.set(0, 0, 0);
              }
            }
          }
        }
      }

      if (isMousePressed && this._ikGizmoDraggedChainName) {
        const draggedResolvedChain = this._resolvedIKChains.get(
          this._ikGizmoDraggedChainName
        );
        if (draggedResolvedChain) {
          this._ikGizmoNormalizedPointer.set(
            (inputManager.getCursorX() / runtimeGame.getGameResolutionWidth()) *
              2 -
              1,
            -(inputManager.getCursorY() / runtimeGame.getGameResolutionHeight()) *
              2 +
              1
          );
          this._ikGizmoRaycaster.setFromCamera(
            this._ikGizmoNormalizedPointer,
            context.threeCamera
          );
          if (
            this._ikGizmoRaycaster.ray.intersectPlane(
              this._ikGizmoDragPlane,
              this._ikGizmoPointerWorldPosition
            )
          ) {
            this._ikGizmoPointerWorldPosition.add(this._ikGizmoDragOffset);
            draggedResolvedChain.definition.targetPosition = [
              this._ikGizmoPointerWorldPosition.x,
              -this._ikGizmoPointerWorldPosition.y,
              this._ikGizmoPointerWorldPosition.z,
            ];
          }
        } else {
          this._ikGizmoDraggedChainName = null;
        }
      }

      this._ikGizmoWasMousePressed = isMousePressed;
    }

    onDestroy(): void {
      this._disposeIKGizmos();
    }

    getAnimationCount() {
      return this._originalModel.animations.length;
    }

    getAnimationName(animationIndex: integer) {
      return this._originalModel.animations[animationIndex].name;
    }

    _updateShadow() {
      this._threeObject.traverse((child) => {
        child.castShadow = this._model3DRuntimeObject._isCastingShadow;
        child.receiveShadow = this._model3DRuntimeObject._isReceivingShadow;
      });
    }

    /**
     * Return true if animation has ended.
     * The animation had ended if:
     * - it's not configured as a loop;
     * - the current frame is the last frame;
     * - the last frame has been displayed long enough.
     */
    hasAnimationEnded(): boolean {
      if (!this._action) {
        return true;
      }
      return !this._action.isRunning();
    }

    animationPaused() {
      if (!this._action) {
        return;
      }
      return this._action.paused;
    }

    pauseAnimation() {
      if (!this._action) {
        return;
      }
      this._action.paused = true;
    }

    resumeAnimation() {
      if (!this._action) {
        return;
      }
      this._action.paused = false;
    }

    playAnimation(
      animationName: string,
      shouldLoop: boolean,
      ignoreCrossFade: boolean = false
    ) {
      const clip = THREE.AnimationClip.findByName(
        this._originalModel.animations,
        animationName
      );
      if (!clip) {
        console.error(
          `The GLB file: ${this._model3DRuntimeObject._modelResourceName} doesn't have any animation named: ${animationName}`
        );
        return;
      }
      const previousAction = this._action;
      this._action = this._animationMixer.clipAction(clip);
      // Reset the animation and play it from the start.
      // `clipAction` always gives back the same action for a given animation
      // and its likely to be in a finished or at least started state.
      this._action.reset();
      this._action.setLoop(
        shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce,
        Number.POSITIVE_INFINITY
      );
      this._action.clampWhenFinished = true;
      this._action.timeScale =
        this._model3DRuntimeObject.getAnimationSpeedScale();

      if (
        previousAction &&
        previousAction !== this._action &&
        !ignoreCrossFade
      ) {
        this._action.crossFadeFrom(
          previousAction,
          this._model3DRuntimeObject._crossfadeDuration,
          false
        );
      }
      this._action.play();
      // Make sure the first frame is displayed.
      this._animationMixer.update(0);
    }

    getAnimationElapsedTime(): float {
      return this._action ? this._action.time : 0;
    }

    setAnimationElapsedTime(time: float): void {
      if (this._action) {
        this._action.time = time;
      }
    }

    setAnimationTimeScale(timeScale: float): void {
      if (this._action) {
        this._action.timeScale = timeScale;
      }
    }

    getAnimationDuration(animationName: string): float {
      const clip = THREE.AnimationClip.findByName(
        this._originalModel.animations,
        animationName
      );
      return clip ? clip.duration : 0;
    }
  }

  /** @category Renderers > 3D Model */
  export const Model3DRuntimeObjectRenderer = Model3DRuntimeObject3DRenderer;
  /** @category Renderers > 3D Model */
  export type Model3DRuntimeObjectRenderer = Model3DRuntimeObject3DRenderer;
}
