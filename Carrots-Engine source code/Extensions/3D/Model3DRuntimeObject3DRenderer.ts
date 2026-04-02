namespace gdjs {
  type FloatPoint3D = [float, float, float];
  type Model3DIKTargetMode = 'bone' | 'position';
  type Model3DBlendAnimationMotion = {
    source: string;
    loop: boolean;
    weight: number;
  };
  type Model3DIKLinkAngleLimits = {
    minAngleXDegrees: number;
    maxAngleXDegrees: number;
    minAngleYDegrees: number;
    maxAngleYDegrees: number;
    minAngleZDegrees: number;
    maxAngleZDegrees: number;
  };
  type Model3DIKChainSettings = {
    name: string;
    enabled: boolean;
    effectorBoneName: string;
    targetBoneName: string;
    targetMode: Model3DIKTargetMode;
    linkBoneNames: string[];
    iterationCount: number;
    blendFactor: number;
    minAngle: number;
    maxAngle: number;
    targetTolerance: number;
    targetPosition: FloatPoint3D;
    linkAngleLimits: Record<string, Model3DIKLinkAngleLimits>;
  };
  type Model3DIKPoseBoneData = {
    position: FloatPoint3D;
    quaternion: [float, float, float, float];
    scale: FloatPoint3D;
  };
  type Model3DIKPoseData = {
    bones: Record<string, Model3DIKPoseBoneData>;
  };

  const epsilon = 1 / (1 << 16);
  const defaultIKTargetPosition: FloatPoint3D = [0, 0, 0];

  const toFiniteNumber = (value: unknown, fallback: number): number => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const clampFloatPoint3D = (
    rawValue: unknown,
    fallback: FloatPoint3D = defaultIKTargetPosition
  ): FloatPoint3D => {
    if (!Array.isArray(rawValue) || rawValue.length < 3) {
      return [fallback[0], fallback[1], fallback[2]];
    }
    return [
      toFiniteNumber(rawValue[0], fallback[0]),
      toFiniteNumber(rawValue[1], fallback[1]),
      toFiniteNumber(rawValue[2], fallback[2]),
    ];
  };

  const cloneFloatPoint3D = (point: FloatPoint3D): FloatPoint3D => [
    point[0],
    point[1],
    point[2],
  ];

  const normalizeIKLinkAngleLimits = (
    rawValue: unknown
  ): Model3DIKLinkAngleLimits => {
    const rawLimits =
      rawValue && typeof rawValue === 'object' ? (rawValue as any) : {};
    return {
      minAngleXDegrees: toFiniteNumber(rawLimits.minAngleXDegrees, -180),
      maxAngleXDegrees: toFiniteNumber(rawLimits.maxAngleXDegrees, 180),
      minAngleYDegrees: toFiniteNumber(rawLimits.minAngleYDegrees, -180),
      maxAngleYDegrees: toFiniteNumber(rawLimits.maxAngleYDegrees, 180),
      minAngleZDegrees: toFiniteNumber(rawLimits.minAngleZDegrees, -180),
      maxAngleZDegrees: toFiniteNumber(rawLimits.maxAngleZDegrees, 180),
    };
  };

  const cloneIKLinkAngleLimits = (
    value: Model3DIKLinkAngleLimits
  ): Model3DIKLinkAngleLimits => ({
    minAngleXDegrees: value.minAngleXDegrees,
    maxAngleXDegrees: value.maxAngleXDegrees,
    minAngleYDegrees: value.minAngleYDegrees,
    maxAngleYDegrees: value.maxAngleYDegrees,
    minAngleZDegrees: value.minAngleZDegrees,
    maxAngleZDegrees: value.maxAngleZDegrees,
  });

  const mapRecord = <T, U>(
    record: Record<string, T>,
    mapper: (value: T, key: string) => U
  ): Record<string, U> => {
    const nextRecord: Record<string, U> = {};
    Object.keys(record).forEach((key) => {
      nextRecord[key] = mapper(record[key], key);
    });
    return nextRecord;
  };

  const cloneIKChainSettings = (
    chain: Model3DIKChainSettings
  ): Model3DIKChainSettings => ({
    name: chain.name,
    enabled: chain.enabled,
    effectorBoneName: chain.effectorBoneName,
    targetBoneName: chain.targetBoneName,
    targetMode: chain.targetMode,
    linkBoneNames: [...chain.linkBoneNames],
    iterationCount: chain.iterationCount,
    blendFactor: chain.blendFactor,
    minAngle: chain.minAngle,
    maxAngle: chain.maxAngle,
    targetTolerance: chain.targetTolerance,
    targetPosition: cloneFloatPoint3D(chain.targetPosition),
    linkAngleLimits: mapRecord(chain.linkAngleLimits, (limits) =>
      cloneIKLinkAngleLimits(limits)
    ),
  });

  const cloneIKPoseData = (pose: Model3DIKPoseData): Model3DIKPoseData => ({
    bones: mapRecord(pose.bones, (boneData) => ({
      position: cloneFloatPoint3D(boneData.position),
      quaternion: [
        boneData.quaternion[0],
        boneData.quaternion[1],
        boneData.quaternion[2],
        boneData.quaternion[3],
      ],
      scale: cloneFloatPoint3D(boneData.scale),
    })),
  });

  const removeMetalness = (material: THREE.Material): void => {
    //@ts-ignore
    if (material.metalness) {
      //@ts-ignore
      material.metalness = 0;
    }
  };

  const removeMetalnessFromMesh = (node: THREE.Object3D) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.material) {
      return;
    }
    if (Array.isArray(mesh.material)) {
      for (let index = 0; index < mesh.material.length; index++) {
        removeMetalness(mesh.material[index]);
      }
    } else {
      removeMetalness(mesh.material);
    }
  };

  const traverseToRemoveMetalnessFromMeshes = (node: THREE.Object3D) =>
    node.traverse(removeMetalnessFromMesh);

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

  class Model3DRuntimeObject3DRenderer extends gdjs.RuntimeObject3DRenderer {
    private _model3DRuntimeObject: gdjs.Model3DRuntimeObject;
    /**
     * The 3D model stretched in a 1x1x1 cube.
     */
    private _threeObject: THREE.Object3D;
    private _originalModel: THREE_ADDONS.GLTF;
    private _animationMixer: THREE.AnimationMixer;
    private _action: THREE.AnimationAction | null;
    private _blendActionsBySource = new Map<string, THREE.AnimationAction>();
    private _currentBlendMotions: Model3DBlendAnimationMotion[] = [];
    private _ikChains = new Map<string, Model3DIKChainSettings>();
    private _ikPoses = new Map<string, Model3DIKPoseData>();
    private _ikGizmosEnabled = false;

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
      // Models with skeleton must not have any transformation to work properly.
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
    }

    updateAnimation(timeDelta: float) {
      this._animationMixer.update(timeDelta);
      this._applyConfiguredIKChains();
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
      this._blendActionsBySource.clear();
      this._currentBlendMotions = [];

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
        gdjs.Model3DRuntimeObject.MaterialType.StandardWithoutMetalness
      ) {
        traverseToRemoveMetalnessFromMeshes(threeObject);
      } else if (
        this._model3DRuntimeObject._materialType ===
        gdjs.Model3DRuntimeObject.MaterialType.Basic
      ) {
        traverseToSetBasicMaterialFromMeshes(threeObject);
      }
    }

    getAnimationCount() {
      return this._originalModel.animations.length;
    }

    getAnimationName(animationIndex: integer) {
      return this._originalModel.animations[animationIndex].name;
    }

    private _forEachAnimationAction(
      callback: (action: THREE.AnimationAction) => void
    ): void {
      const visitedActions = new Set<THREE.AnimationAction>();
      if (this._action) {
        visitedActions.add(this._action);
        callback(this._action);
      }
      this._blendActionsBySource.forEach((action) => {
        if (visitedActions.has(action)) return;
        visitedActions.add(action);
        callback(action);
      });
    }

    private _getClipBySource(source: string): THREE.AnimationClip | null {
      return (
        THREE.AnimationClip.findByName(this._originalModel.animations, source) ||
        null
      );
    }

    private _getOrCreateAnimationAction(
      source: string,
      shouldLoop: boolean
    ): THREE.AnimationAction | null {
      const clip = this._getClipBySource(source);
      if (!clip) {
        console.error(
          `The 3D model file: ${this._model3DRuntimeObject._modelResourceName} doesn't have any animation named: ${source}`
        );
        return null;
      }

      const action = this._animationMixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(
        shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce,
        Number.POSITIVE_INFINITY
      );
      action.clampWhenFinished = true;
      action.timeScale = this._model3DRuntimeObject.getAnimationSpeedScale();
      return action;
    }

    private _normalizeBlendMotions(
      motions: Model3DBlendAnimationMotion[]
    ): Model3DBlendAnimationMotion[] {
      const validMotions = motions
        .filter(
          (motion) =>
            !!motion &&
            typeof motion.source === 'string' &&
            !!motion.source &&
            Number.isFinite(motion.weight) &&
            motion.weight > 0
        )
        .map((motion) => ({
          source: motion.source,
          loop: !!motion.loop,
          weight: Number(motion.weight),
        }));

      const totalWeight = validMotions.reduce(
        (sum, motion) => sum + motion.weight,
        0
      );
      if (totalWeight <= epsilon) {
        return [];
      }

      return validMotions.map((motion) => ({
        ...motion,
        weight: motion.weight / totalWeight,
      }));
    }

    private _stopInactiveBlendActions(
      activeSources: Set<string>,
      fadeOutDuration: number = 0
    ): void {
      this._blendActionsBySource.forEach((action, source) => {
        if (activeSources.has(source)) return;
        if (fadeOutDuration > 0) {
          action.fadeOut(fadeOutDuration);
        } else {
          action.stop();
        }
        action.enabled = false;
      });
    }

    private _setPrimaryBlendAction(
      motions: Model3DBlendAnimationMotion[]
    ): void {
      if (motions.length === 0) {
        this._action = null;
        return;
      }

      const primaryMotion = motions.reduce((bestMotion, motion) =>
        motion.weight > bestMotion.weight ? motion : bestMotion
      );
      this._action = this._blendActionsBySource.get(primaryMotion.source) || null;
    }

    private _getBoneByName(boneName: string): THREE.Bone | null {
      if (!boneName) {
        return null;
      }
      const candidate = this._threeObject.getObjectByName(boneName);
      return candidate && (candidate as any).isBone
        ? (candidate as THREE.Bone)
        : null;
    }

    private _getBoneNames(): string[] {
      const boneNames: string[] = [];
      this._threeObject.traverse((node) => {
        if ((node as any).isBone && node.name) {
          boneNames.push(node.name);
        }
      });
      boneNames.sort((left, right) => left.localeCompare(right));
      return boneNames;
    }

    private _getCurrentBoneWorldPosition(
      boneName: string
    ): FloatPoint3D | null {
      const bone = this._getBoneByName(boneName);
      if (!bone) {
        return null;
      }
      const worldPosition = new THREE.Vector3();
      bone.getWorldPosition(worldPosition);
      return [worldPosition.x, worldPosition.y, worldPosition.z];
    }

    private _buildIKChainSettings(
      chainName: string,
      overrides?: Partial<Model3DIKChainSettings>
    ): Model3DIKChainSettings {
      const existingChain = this._ikChains.get(chainName);
      const baseChain = existingChain
        ? cloneIKChainSettings(existingChain)
        : {
            name: chainName,
            enabled: true,
            effectorBoneName: '',
            targetBoneName: '',
            targetMode: 'position' as Model3DIKTargetMode,
            linkBoneNames: [],
            iterationCount: 12,
            blendFactor: 1,
            minAngle: -180,
            maxAngle: 180,
            targetTolerance: 0.001,
            targetPosition: cloneFloatPoint3D(defaultIKTargetPosition),
            linkAngleLimits: {},
          };

      if (!overrides) {
        return baseChain;
      }

      const nextChain: Model3DIKChainSettings = {
        ...baseChain,
        ...overrides,
        name: chainName,
        targetPosition:
          overrides.targetPosition !== undefined
            ? cloneFloatPoint3D(overrides.targetPosition)
            : cloneFloatPoint3D(baseChain.targetPosition),
        linkBoneNames:
          overrides.linkBoneNames !== undefined
            ? [...overrides.linkBoneNames]
            : [...baseChain.linkBoneNames],
        linkAngleLimits:
          overrides.linkAngleLimits !== undefined
            ? mapRecord(overrides.linkAngleLimits, (limits) =>
                cloneIKLinkAngleLimits(limits)
              )
            : mapRecord(baseChain.linkAngleLimits, (limits) =>
                cloneIKLinkAngleLimits(limits)
              ),
      };

      nextChain.iterationCount = THREE.MathUtils.clamp(
        Math.round(toFiniteNumber(nextChain.iterationCount, 12)),
        1,
        32
      );
      nextChain.blendFactor = THREE.MathUtils.clamp(
        toFiniteNumber(nextChain.blendFactor, 1),
        0,
        1
      );
      nextChain.minAngle = toFiniteNumber(nextChain.minAngle, -180);
      nextChain.maxAngle = toFiniteNumber(nextChain.maxAngle, 180);
      nextChain.targetTolerance = Math.max(
        0,
        toFiniteNumber(nextChain.targetTolerance, 0.001)
      );
      nextChain.targetMode =
        nextChain.targetMode === 'bone' && nextChain.targetBoneName
          ? 'bone'
          : 'position';
      nextChain.targetBoneName =
        typeof nextChain.targetBoneName === 'string'
          ? nextChain.targetBoneName.trim()
          : '';
      nextChain.effectorBoneName =
        typeof nextChain.effectorBoneName === 'string'
          ? nextChain.effectorBoneName.trim()
          : '';
      nextChain.linkBoneNames = nextChain.linkBoneNames
        .map((boneName) => boneName.trim())
        .filter((boneName) => !!boneName);

      return nextChain;
    }

    private _getIKLinkBones(chain: Model3DIKChainSettings): THREE.Bone[] {
      const explicitBones = chain.linkBoneNames
        .map((boneName) => this._getBoneByName(boneName))
        .filter((bone): bone is THREE.Bone => !!bone);
      if (explicitBones.length > 0) {
        return explicitBones;
      }

      const effectorBone = this._getBoneByName(chain.effectorBoneName);
      if (!effectorBone) {
        return [];
      }

      const implicitBones: THREE.Bone[] = [];
      let currentBone = effectorBone.parent;
      while (currentBone && (currentBone as any).isBone) {
        implicitBones.push(currentBone as THREE.Bone);
        currentBone = currentBone.parent;
      }
      return implicitBones;
    }

    private _resolveIKTargetWorldPosition(
      chain: Model3DIKChainSettings,
      outTargetPosition: THREE.Vector3
    ): boolean {
      if (chain.targetMode === 'bone' && chain.targetBoneName) {
        const targetBone = this._getBoneByName(chain.targetBoneName);
        if (targetBone) {
          targetBone.getWorldPosition(outTargetPosition);
          return true;
        }
      }

      outTargetPosition.set(
        chain.targetPosition[0],
        chain.targetPosition[1],
        chain.targetPosition[2]
      );
      return true;
    }

    private _applyIKLinkLimits(
      chain: Model3DIKChainSettings,
      linkBone: THREE.Bone
    ): void {
      const linkLimits = chain.linkAngleLimits[linkBone.name];
      if (!linkLimits) {
        return;
      }

      const currentEuler = new THREE.Euler().setFromQuaternion(
        linkBone.quaternion,
        linkBone.rotation.order
      );
      currentEuler.x = gdjs.toRad(
        THREE.MathUtils.clamp(
          gdjs.toDegrees(currentEuler.x),
          linkLimits.minAngleXDegrees,
          linkLimits.maxAngleXDegrees
        )
      );
      currentEuler.y = gdjs.toRad(
        THREE.MathUtils.clamp(
          gdjs.toDegrees(currentEuler.y),
          linkLimits.minAngleYDegrees,
          linkLimits.maxAngleYDegrees
        )
      );
      currentEuler.z = gdjs.toRad(
        THREE.MathUtils.clamp(
          gdjs.toDegrees(currentEuler.z),
          linkLimits.minAngleZDegrees,
          linkLimits.maxAngleZDegrees
        )
      );
      linkBone.rotation.copy(currentEuler);
    }

    private _applyIKChain(chain: Model3DIKChainSettings): void {
      if (!chain.enabled || chain.blendFactor <= epsilon) {
        return;
      }

      const effectorBone = this._getBoneByName(chain.effectorBoneName);
      if (!effectorBone) {
        return;
      }

      const linkBones = this._getIKLinkBones(chain);
      if (linkBones.length === 0) {
        return;
      }

      const targetWorldPosition = new THREE.Vector3();
      if (!this._resolveIKTargetWorldPosition(chain, targetWorldPosition)) {
        return;
      }

      const minStepAngle = Math.max(0, gdjs.toRad(Math.abs(chain.minAngle)));
      const maxStepAngle = Math.max(
        minStepAngle,
        gdjs.toRad(Math.abs(chain.maxAngle))
      );
      const targetTolerance = Math.max(chain.targetTolerance, epsilon);
      const linkWorldPosition = new THREE.Vector3();
      const effectorWorldPosition = new THREE.Vector3();
      const effectorDirection = new THREE.Vector3();
      const targetDirection = new THREE.Vector3();
      const rotationAxis = new THREE.Vector3();
      const deltaQuaternion = new THREE.Quaternion();
      const appliedQuaternion = new THREE.Quaternion();
      const linkWorldQuaternion = new THREE.Quaternion();
      const parentWorldQuaternion = new THREE.Quaternion();
      const nextWorldQuaternion = new THREE.Quaternion();
      const identityQuaternion = new THREE.Quaternion();

      for (let iteration = 0; iteration < chain.iterationCount; iteration++) {
        effectorBone.getWorldPosition(effectorWorldPosition);
        if (
          effectorWorldPosition.distanceToSquared(targetWorldPosition) <=
          targetTolerance * targetTolerance
        ) {
          break;
        }

        let hasAppliedRotation = false;
        for (const linkBone of linkBones) {
          linkBone.getWorldPosition(linkWorldPosition);
          effectorBone.getWorldPosition(effectorWorldPosition);

          effectorDirection.subVectors(effectorWorldPosition, linkWorldPosition);
          targetDirection.subVectors(targetWorldPosition, linkWorldPosition);
          if (
            effectorDirection.lengthSq() <= epsilon ||
            targetDirection.lengthSq() <= epsilon
          ) {
            continue;
          }

          effectorDirection.normalize();
          targetDirection.normalize();
          deltaQuaternion.setFromUnitVectors(effectorDirection, targetDirection);
          let stepAngle =
            2 * Math.acos(THREE.MathUtils.clamp(deltaQuaternion.w, -1, 1));
          if (!Number.isFinite(stepAngle) || stepAngle <= epsilon) {
            continue;
          }

          rotationAxis.set(
            deltaQuaternion.x,
            deltaQuaternion.y,
            deltaQuaternion.z
          );
          if (rotationAxis.lengthSq() <= epsilon) {
            continue;
          }
          rotationAxis.normalize();

          stepAngle = THREE.MathUtils.clamp(
            stepAngle,
            minStepAngle,
            maxStepAngle
          );
          appliedQuaternion
            .copy(identityQuaternion)
            .slerp(
              deltaQuaternion.setFromAxisAngle(rotationAxis, stepAngle),
              chain.blendFactor
            );

          linkBone.getWorldQuaternion(linkWorldQuaternion);
          if (linkBone.parent) {
            linkBone.parent.getWorldQuaternion(parentWorldQuaternion);
            parentWorldQuaternion.invert();
          } else {
            parentWorldQuaternion.identity();
          }

          nextWorldQuaternion.copy(linkWorldQuaternion).premultiply(
            appliedQuaternion
          );
          linkBone.quaternion
            .copy(parentWorldQuaternion)
            .multiply(nextWorldQuaternion);
          this._applyIKLinkLimits(chain, linkBone);
          linkBone.updateMatrixWorld(true);
          hasAppliedRotation = true;

          effectorBone.getWorldPosition(effectorWorldPosition);
          if (
            effectorWorldPosition.distanceToSquared(targetWorldPosition) <=
            targetTolerance * targetTolerance
          ) {
            return;
          }
        }

        if (!hasAppliedRotation) {
          break;
        }
      }
    }

    private _applyConfiguredIKChains(): void {
      this._ikChains.forEach((chain) => this._applyIKChain(chain));
    }

    private _captureCurrentIKPose(): Model3DIKPoseData {
      const bones: Record<string, Model3DIKPoseBoneData> = {};
      this._threeObject.traverse((node) => {
        if (!(node as any).isBone || !node.name) {
          return;
        }
        const bone = node as THREE.Bone;
        bones[bone.name] = {
          position: [bone.position.x, bone.position.y, bone.position.z],
          quaternion: [
            bone.quaternion.x,
            bone.quaternion.y,
            bone.quaternion.z,
            bone.quaternion.w,
          ],
          scale: [bone.scale.x, bone.scale.y, bone.scale.z],
        };
      });
      return { bones };
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
      if (this._currentBlendMotions.length > 0) {
        return !this._currentBlendMotions.some((motion) => {
          const action = this._blendActionsBySource.get(motion.source);
          return !!action && action.isRunning();
        });
      }
      return this._action ? !this._action.isRunning() : true;
    }

    animationPaused() {
      return this._action ? this._action.paused : false;
    }

    pauseAnimation() {
      this._forEachAnimationAction((action) => {
        action.paused = true;
      });
    }

    resumeAnimation() {
      this._forEachAnimationAction((action) => {
        action.paused = false;
      });
    }

    playAnimation(
      animationName: string,
      shouldLoop: boolean,
      ignoreCrossFade: boolean = false,
      crossfadeDuration: float | null = null
    ) {
      const nextAction = this._getOrCreateAnimationAction(
        animationName,
        shouldLoop
      );
      if (!nextAction) {
        return;
      }
      const previousAction = this._action;
      this._currentBlendMotions = [];
      this._action = nextAction;
      this._action.reset();
      this._action.setEffectiveWeight(1);
      this._action.enabled = true;
      this._action.paused = previousAction ? !!previousAction.paused : false;

      if (
        previousAction &&
        previousAction !== this._action &&
        !ignoreCrossFade
      ) {
        this._action.crossFadeFrom(
          previousAction,
          crossfadeDuration ?? this._model3DRuntimeObject._crossfadeDuration,
          false
        );
      }
      this._action.play();
      this._stopInactiveBlendActions(
        new Set([animationName]),
        ignoreCrossFade
          ? 0
          : crossfadeDuration ?? this._model3DRuntimeObject._crossfadeDuration
      );
      // Make sure the first frame is displayed.
      this._animationMixer.update(0);
    }

    playBlendAnimation(
      motions: Model3DBlendAnimationMotion[],
      ignoreCrossFade: boolean = false,
      crossfadeDuration: float | null = null
    ): void {
      const normalizedMotions = this._normalizeBlendMotions(motions);
      if (normalizedMotions.length === 0) {
        this._currentBlendMotions = [];
        this._stopInactiveBlendActions(new Set());
        this._action = null;
        return;
      }

      const previousAction = this._action;
      const activeSources = new Set<string>();
      normalizedMotions.forEach((motion) => {
        const action = this._getOrCreateAnimationAction(motion.source, motion.loop);
        if (!action) {
          return;
        }
        activeSources.add(motion.source);
        action.reset();
        action.setEffectiveWeight(motion.weight);
        action.enabled = true;
        action.paused = previousAction ? !!previousAction.paused : false;
        if (
          previousAction &&
          previousAction !== action &&
          !ignoreCrossFade
        ) {
          action.crossFadeFrom(
            previousAction,
            crossfadeDuration ?? this._model3DRuntimeObject._crossfadeDuration,
            false
          );
        }
        action.play();
        this._blendActionsBySource.set(motion.source, action);
      });

      this._currentBlendMotions = normalizedMotions;
      this._setPrimaryBlendAction(normalizedMotions);
      this._stopInactiveBlendActions(
        activeSources,
        ignoreCrossFade
          ? 0
          : crossfadeDuration ?? this._model3DRuntimeObject._crossfadeDuration
      );
      this._animationMixer.update(0);
    }

    updateBlendAnimation(motions: Model3DBlendAnimationMotion[]): void {
      const normalizedMotions = this._normalizeBlendMotions(motions);
      if (normalizedMotions.length === 0) {
        this._currentBlendMotions = [];
        this._stopInactiveBlendActions(new Set());
        this._action = null;
        return;
      }

      const referenceTime = this._action ? this._action.time : 0;
      const isPaused = this._action ? !!this._action.paused : false;
      const activeSources = new Set<string>();

      normalizedMotions.forEach((motion) => {
        const action = this._getOrCreateAnimationAction(motion.source, motion.loop);
        if (!action) {
          return;
        }
        activeSources.add(motion.source);
        if (!action.isRunning()) {
          action.reset();
          action.time = referenceTime;
          action.play();
        }
        action.setEffectiveWeight(motion.weight);
        action.enabled = true;
        action.paused = isPaused;
        this._blendActionsBySource.set(motion.source, action);
      });

      this._currentBlendMotions = normalizedMotions;
      this._setPrimaryBlendAction(normalizedMotions);
      this._stopInactiveBlendActions(activeSources);
      this._animationMixer.update(0);
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
    ): void {
      const normalizedChainName = chainName.trim();
      const normalizedEffectorBoneName = effectorBoneName.trim();
      if (!normalizedChainName || !normalizedEffectorBoneName) {
        return;
      }

      const currentEffectorPosition =
        this._getCurrentBoneWorldPosition(normalizedEffectorBoneName) ||
        cloneFloatPoint3D(defaultIKTargetPosition);
      const normalizedTargetBoneName = targetBoneName.trim();
      const nextChain = this._buildIKChainSettings(normalizedChainName, {
        effectorBoneName: normalizedEffectorBoneName,
        targetBoneName: normalizedTargetBoneName,
        targetMode: normalizedTargetBoneName ? 'bone' : 'position',
        targetPosition: currentEffectorPosition,
        linkBoneNames,
        iterationCount,
        blendFactor,
        minAngle,
        maxAngle,
      });
      this._ikChains.set(normalizedChainName, nextChain);
      this._applyIKChain(nextChain);
    }

    setIKTargetPosition(
      chainName: string,
      targetX: float,
      targetY: float,
      targetZ: float
    ): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      const nextChain = this._buildIKChainSettings(chainName, {
        ...chain,
        targetMode: 'position',
        targetBoneName: '',
        targetPosition: [targetX, targetY, targetZ],
      });
      this._ikChains.set(chainName, nextChain);
      this._applyIKChain(nextChain);
    }

    setIKTargetBone(chainName: string, targetBoneName: string): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      const normalizedTargetBoneName = targetBoneName.trim();
      const nextChain = this._buildIKChainSettings(chainName, {
        ...chain,
        targetBoneName: normalizedTargetBoneName,
        targetMode: normalizedTargetBoneName ? 'bone' : 'position',
      });
      this._ikChains.set(chainName, nextChain);
      this._applyIKChain(nextChain);
    }

    setIKEnabled(chainName: string, enabled: boolean): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, { ...chain, enabled })
      );
    }

    setIKIterationCount(chainName: string, iterationCount: number): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, { ...chain, iterationCount })
      );
    }

    setIKBlendFactor(chainName: string, blendFactor: number): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, { ...chain, blendFactor })
      );
    }

    setIKAngleLimits(
      chainName: string,
      minAngleDegrees: number,
      maxAngleDegrees: number
    ): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, {
          ...chain,
          minAngle: minAngleDegrees,
          maxAngle: maxAngleDegrees,
        })
      );
    }

    setIKTargetTolerance(chainName: string, tolerance: number): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, {
          ...chain,
          targetTolerance: tolerance,
        })
      );
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
    ): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }

      const nextChain = this._buildIKChainSettings(chainName, {
        ...chain,
        linkAngleLimits: {
          ...chain.linkAngleLimits,
          [linkBoneName]: normalizeIKLinkAngleLimits({
            minAngleXDegrees,
            maxAngleXDegrees,
            minAngleYDegrees,
            maxAngleYDegrees,
            minAngleZDegrees,
            maxAngleZDegrees,
          }),
        },
      });
      this._ikChains.set(chainName, nextChain);
    }

    clearIKLinkAngleLimits(chainName: string, linkBoneName: string): void {
      const chain = this._ikChains.get(chainName);
      if (!chain || !chain.linkAngleLimits[linkBoneName]) {
        return;
      }
      const { [linkBoneName]: _deleted, ...remainingLimits } =
        chain.linkAngleLimits;
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, {
          ...chain,
          linkAngleLimits: remainingLimits,
        })
      );
    }

    clearIKLinkConstraints(chainName: string): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, {
          ...chain,
          linkAngleLimits: {},
        })
      );
    }

    setIKGizmosEnabled(enabled: boolean): void {
      this._ikGizmosEnabled = enabled;
    }

    areIKGizmosEnabled(): boolean {
      return this._ikGizmosEnabled;
    }

    removeIKChain(chainName: string): void {
      this._ikChains.delete(chainName);
    }

    clearIKChains(): void {
      this._ikChains.clear();
    }

    hasIKChain(chainName: string): boolean {
      return this._ikChains.has(chainName);
    }

    getIKChainCount(): number {
      return this._ikChains.size;
    }

    getIKChainNames(): string[] {
      return Array.from(this._ikChains.keys()).sort((left, right) =>
        left.localeCompare(right)
      );
    }

    getIKChainSettings(chainName: string): Model3DIKChainSettings | null {
      const chain = this._ikChains.get(chainName);
      return chain ? cloneIKChainSettings(chain) : null;
    }

    getIKBoneNames(): string[] {
      return this._getBoneNames();
    }

    exportIKChainsToJSON(): string {
      return JSON.stringify({
        version: 1,
        chains: this.getIKChainNames()
          .map((chainName) => this._ikChains.get(chainName))
          .filter((chain): chain is Model3DIKChainSettings => !!chain)
          .map((chain) => cloneIKChainSettings(chain)),
      });
    }

    importIKChainsFromJSON(chainsJSON: string, clearExisting: boolean): void {
      try {
        const parsedValue = JSON.parse(chainsJSON);
        const rawChains = Array.isArray(parsedValue)
          ? parsedValue
          : Array.isArray(parsedValue?.chains)
          ? parsedValue.chains
          : [];
        if (clearExisting) {
          this._ikChains.clear();
        }

        rawChains.forEach((rawChain: any, index: number) => {
          if (!rawChain || typeof rawChain !== 'object') {
            return;
          }

          const chainName =
            typeof rawChain.name === 'string' && rawChain.name.trim()
              ? rawChain.name.trim()
              : `Chain ${index + 1}`;
          const targetPosition = clampFloatPoint3D(
            rawChain.targetPosition,
            defaultIKTargetPosition
          );
          const nextChain = this._buildIKChainSettings(chainName, {
            enabled:
              rawChain.enabled === undefined ? true : !!rawChain.enabled,
            effectorBoneName:
              typeof rawChain.effectorBoneName === 'string'
                ? rawChain.effectorBoneName
                : '',
            targetBoneName:
              typeof rawChain.targetBoneName === 'string'
                ? rawChain.targetBoneName
                : '',
            targetMode:
              rawChain.targetMode === 'bone' && rawChain.targetBoneName
                ? 'bone'
                : 'position',
            targetPosition,
            linkBoneNames: Array.isArray(rawChain.linkBoneNames)
              ? rawChain.linkBoneNames.filter(
                  (boneName: unknown): boneName is string =>
                    typeof boneName === 'string'
                )
              : [],
            iterationCount: toFiniteNumber(rawChain.iterationCount, 12),
            blendFactor: toFiniteNumber(rawChain.blendFactor, 1),
            minAngle: toFiniteNumber(
              rawChain.minAngle ?? rawChain.minAngleDegrees,
              -180
            ),
            maxAngle: toFiniteNumber(
              rawChain.maxAngle ?? rawChain.maxAngleDegrees,
              180
            ),
            targetTolerance: toFiniteNumber(rawChain.targetTolerance, 0.001),
            linkAngleLimits:
              rawChain.linkAngleLimits &&
              typeof rawChain.linkAngleLimits === 'object'
                ? mapRecord(
                    rawChain.linkAngleLimits as Record<string, unknown>,
                    (limits) => normalizeIKLinkAngleLimits(limits)
                  )
                : {},
          });
          this._ikChains.set(chainName, nextChain);
        });
      } catch (error) {
        console.warn('Unable to import IK chains from JSON.', error);
      }
    }

    saveIKPose(poseName: string): void {
      const normalizedPoseName = poseName.trim();
      if (!normalizedPoseName) {
        return;
      }
      this._ikPoses.set(normalizedPoseName, this._captureCurrentIKPose());
    }

    applyIKPose(poseName: string): void {
      const pose = this._ikPoses.get(poseName);
      if (!pose) {
        return;
      }
      Object.entries(pose.bones).forEach(([boneName, boneData]) => {
        const bone = this._getBoneByName(boneName);
        if (!bone) {
          return;
        }
        bone.position.set(
          boneData.position[0],
          boneData.position[1],
          boneData.position[2]
        );
        bone.quaternion.set(
          boneData.quaternion[0],
          boneData.quaternion[1],
          boneData.quaternion[2],
          boneData.quaternion[3]
        );
        bone.scale.set(
          boneData.scale[0],
          boneData.scale[1],
          boneData.scale[2]
        );
      });
      this._threeObject.updateMatrixWorld(true);
    }

    removeIKPose(poseName: string): void {
      this._ikPoses.delete(poseName);
    }

    clearIKPoses(): void {
      this._ikPoses.clear();
    }

    hasIKPose(poseName: string): boolean {
      return this._ikPoses.has(poseName);
    }

    getIKPoseCount(): number {
      return this._ikPoses.size;
    }

    getIKPoseNames(): string[] {
      return Array.from(this._ikPoses.keys()).sort((left, right) =>
        left.localeCompare(right)
      );
    }

    pinIKTargetToCurrentEffector(chainName: string): void {
      const chain = this._ikChains.get(chainName);
      if (!chain) {
        return;
      }
      const currentEffectorPosition = this._getCurrentBoneWorldPosition(
        chain.effectorBoneName
      );
      if (!currentEffectorPosition) {
        return;
      }
      this._ikChains.set(
        chainName,
        this._buildIKChainSettings(chainName, {
          ...chain,
          targetMode: 'position',
          targetBoneName: '',
          targetPosition: currentEffectorPosition,
        })
      );
    }

    pinAllIKTargetsToCurrentEffectors(): void {
      this.getIKChainNames().forEach((chainName) =>
        this.pinIKTargetToCurrentEffector(chainName)
      );
    }

    exportIKPosesToJSON(): string {
      return JSON.stringify({
        version: 1,
        poses: this.getIKPoseNames()
          .map((poseName) => ({
            name: poseName,
            bones: cloneIKPoseData(this._ikPoses.get(poseName) || { bones: {} })
              .bones,
          }))
          .filter((pose) => !!pose.name),
      });
    }

    importIKPosesFromJSON(posesJSON: string, clearExisting: boolean): void {
      try {
        const parsedValue = JSON.parse(posesJSON);
        const rawPoses = Array.isArray(parsedValue)
          ? parsedValue
          : Array.isArray(parsedValue?.poses)
          ? parsedValue.poses
          : [];
        if (clearExisting) {
          this._ikPoses.clear();
        }

        rawPoses.forEach((rawPose: any, index: number) => {
          if (!rawPose || typeof rawPose !== 'object') {
            return;
          }
          const poseName =
            typeof rawPose.name === 'string' && rawPose.name.trim()
              ? rawPose.name.trim()
              : `Pose ${index + 1}`;
          const rawBones =
            rawPose.bones && typeof rawPose.bones === 'object'
              ? rawPose.bones
              : {};
          const poseData: Model3DIKPoseData = {
            bones: mapRecord(
              rawBones as Record<string, unknown>,
              (rawBoneData) => {
                const boneData =
                  rawBoneData && typeof rawBoneData === 'object'
                    ? (rawBoneData as any)
                    : {};
                return {
                  position: clampFloatPoint3D(
                    boneData.position,
                    defaultIKTargetPosition
                  ),
                  quaternion: [
                    toFiniteNumber(boneData.quaternion?.[0], 0),
                    toFiniteNumber(boneData.quaternion?.[1], 0),
                    toFiniteNumber(boneData.quaternion?.[2], 0),
                    toFiniteNumber(boneData.quaternion?.[3], 1),
                  ],
                  scale: clampFloatPoint3D(boneData.scale, [1, 1, 1]),
                };
              }
            ),
          };
          this._ikPoses.set(poseName, poseData);
        });
      } catch (error) {
        console.warn('Unable to import IK poses from JSON.', error);
      }
    }

    onDestroy(): void {
      this._animationMixer.stopAllAction();
      this._forEachAnimationAction((action) => action.stop());
      this._blendActionsBySource.clear();
      this._currentBlendMotions = [];
      this._ikChains.clear();
      this._ikPoses.clear();
    }

    getAnimationElapsedTime(): float {
      return this._action ? this._action.time : 0;
    }

    setAnimationElapsedTime(time: float): void {
      this._forEachAnimationAction((action) => {
        action.time = time;
      });
    }

    setAnimationTimeScale(timeScale: float): void {
      this._forEachAnimationAction((action) => {
        action.timeScale = timeScale;
      });
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
