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
  };

  type Model3DIKResolvedChain = {
    definition: Model3DIKChainDefinition;
    effectorBone: THREE.Bone;
    targetBone: THREE.Bone | null;
    linkBones: THREE.Bone[];
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

    private _ikScratchTargetPosition = new THREE.Vector3();
    private _ikScratchLinkPosition = new THREE.Vector3();
    private _ikScratchEffectorPosition = new THREE.Vector3();
    private _ikScratchToEffector = new THREE.Vector3();
    private _ikScratchToTarget = new THREE.Vector3();
    private _ikScratchRotationAxis = new THREE.Vector3();
    private _ikScratchLinkWorldQuaternion = new THREE.Quaternion();
    private _ikScratchLinkWorldQuaternionInverse = new THREE.Quaternion();
    private _ikScratchDeltaQuaternion = new THREE.Quaternion();

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
    }

    updateAnimation(timeDelta: float) {
      this._animationMixer.update(timeDelta);
      this._updateIK();
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
      const normalizedLinkBoneNames = linkBoneNames
        .map((linkBoneName) => linkBoneName.trim())
        .filter((linkBoneName) => !!linkBoneName);

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

    removeIKChain(chainName: string): void {
      const normalizedChainName = chainName.trim();
      this._ikChains.delete(normalizedChainName);
      this._resolvedIKChains.delete(normalizedChainName);
    }

    clearIKChains(): void {
      this._ikChains.clear();
      this._resolvedIKChains.clear();
    }

    hasIKChain(chainName: string): boolean {
      return this._ikChains.has(chainName.trim());
    }

    getIKChainCount(): number {
      return this._ikChains.size;
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

        const linkBones = chain.linkBoneNames
          .map((linkBoneName) => this._bonesByName.get(linkBoneName))
          .filter((linkBone): linkBone is THREE.Bone => !!linkBone);
        if (linkBones.length === 0) continue;

        const targetBone =
          chain.targetMode === 'bone'
            ? this._bonesByName.get(chain.targetBoneName) || null
            : null;

        this._resolvedIKChains.set(chain.name, {
          definition: chain,
          effectorBone,
          targetBone,
          linkBones,
        });
      }
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
          targetPosition.set(targetX, targetY, targetZ);
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
        for (const linkBone of resolvedChain.linkBones) {
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
          linkBone.updateMatrixWorld(true);
          hasRotatedBone = true;
        }

        resolvedChain.effectorBone.getWorldPosition(this._ikScratchEffectorPosition);
        if (
          this._ikScratchEffectorPosition.distanceToSquared(targetPosition) <
          epsilon
        ) {
          break;
        }
        if (!hasRotatedBone) {
          break;
        }
      }
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
