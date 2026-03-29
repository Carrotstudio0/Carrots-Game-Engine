namespace gdjs {
  type Model3DAnimation = { name: string; source: string; loop: boolean };
  type Model3DMaterialTypeString =
    | 'Basic'
    | 'StandardWithoutMetalness'
    | 'KeepOriginal'
    | 'Matte'
    | 'Standard'
    | 'Glossy'
    | 'Metallic';
  type Model3DMaterialProjectionMode = 'UV' | 'Triplanar';

  type Model3DObjectNetworkSyncDataType = {
    mt: number;
    op: FloatPoint3D | null;
    cp: FloatPoint3D | null;
    anis: Model3DAnimation[];
    ai: integer;
    ass: float;
    aet: float;
    ap: boolean;
    cfd: float;
  };

  type Model3DObjectNetworkSyncData = Object3DNetworkSyncData &
    Model3DObjectNetworkSyncDataType;

  /**
   * Base parameters for {@link gdjs.Model3DRuntimeObject}
   * @category Objects > 3D Model
   */
  export interface Model3DObjectData extends Object3DData {
    /** The base parameters of the Model3D object */
    content: Object3DDataContent & {
      modelResourceName: string;
      rotationX: number;
      rotationY: number;
      rotationZ: number;
      keepAspectRatio: boolean;
      materialType: Model3DMaterialTypeString;
      materialTextureResourceName?: string;
      materialGraphEnabled?: boolean;
      materialGraphBlend?: number;
      materialGraphDefinition?: string;
      materialGraphFragmentShader?: string;
      materialProjectionMode?: Model3DMaterialProjectionMode;
      materialGraphVersion?: string;
      originLocation:
        | 'ModelOrigin'
        | 'ObjectCenter'
        | 'BottomCenterZ'
        | 'BottomCenterY'
        | 'TopLeft';
      centerLocation:
        | 'ModelOrigin'
        | 'ObjectCenter'
        | 'BottomCenterZ'
        | 'BottomCenterY';
      animations: Model3DAnimation[];
      crossfadeDuration: float;
      isCastingShadow: boolean;
      isReceivingShadow: boolean;
    };
  }

  type FloatPoint3D = [float, float, float];

  const getPointForLocation = (location: string): FloatPoint3D | null => {
    switch (location) {
      case 'ModelOrigin':
        return null;
      case 'ObjectCenter':
        return [0.5, 0.5, 0.5];
      case 'BottomCenterZ':
        return [0.5, 0.5, 0];
      case 'BottomCenterY':
        return [0.5, 1, 0.5];
      case 'TopLeft':
        return [0, 0, 0];
      default:
        return null;
    }
  };

  const parseIKLinkBoneNames = (linkBoneNames: string): string[] =>
    linkBoneNames
      .split(',')
      .map((boneName) => boneName.trim())
      .filter((boneName) => !!boneName);

  const normalizeMaterialProjectionMode = (
    mode?: string
  ): Model3DMaterialProjectionMode =>
    mode && mode.toLowerCase() === 'triplanar' ? 'Triplanar' : 'UV';

  /**
   * A 3D object which displays a 3D model.
   * @category Objects > 3D Model
   */
  export class Model3DRuntimeObject
    extends gdjs.RuntimeObject3D
    implements gdjs.Animatable
  {
    private static readonly _defaultOriginPoint: FloatPoint3D = [0, 0, 0];
    private static readonly _defaultCenterPoint: FloatPoint3D = [0.5, 0.5, 0.5];

    _renderer: gdjs.Model3DRuntimeObjectRenderer;

    _modelResourceName: string;
    _materialType: gdjs.Model3DRuntimeObject.MaterialType =
      gdjs.Model3DRuntimeObject.MaterialType.Standard;
    _materialTextureResourceName: string = '';
    _materialGraphEnabled: boolean = false;
    _materialGraphBlend: float = 1;
    _materialGraphDefinition: string = '';
    _materialGraphFragmentShader: string = '';
    _materialProjectionMode: Model3DMaterialProjectionMode = 'UV';
    _materialGraphVersion: string = '1';

    /**
     * The local point of the model that will be at the object position.
     *
     * Coordinates are between 0 and 1.
     *
     * Its value is `null` when the point is configured to `"ModelOrigin"`
     * because the model origin needs to be evaluated according to the object
     * configuration.
     * @see gdjs.Model3DRuntimeObject3DRenderer.getOriginPoint
     */
    _originPoint: FloatPoint3D | null;
    /**
     * The local point of the model that is used as rotation center.
     *
     * Coordinates are between 0 and 1.
     *
     * Its value is `null` when the point is configured to `"ModelOrigin"`
     * because the model origin needs to be evaluated according to the object
     * configuration.
     * @see gdjs.Model3DRuntimeObject3DRenderer.getCenterPoint
     */
    _centerPoint: FloatPoint3D | null;

    _animations: Model3DAnimation[];
    _currentAnimationIndex: integer = 0;
    _animationSpeedScale: float = 1;
    _animationPaused: boolean = false;
    _crossfadeDuration: float = 0;
    _isCastingShadow: boolean = true;
    _isReceivingShadow: boolean = true;
    _data: Model3DObjectData;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: Model3DObjectData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);
      this._data = objectData;
      this._modelResourceName = objectData.content.modelResourceName;
      this._animations = objectData.content.animations;
      this._originPoint = getPointForLocation(
        objectData.content.originLocation
      );
      this._centerPoint = getPointForLocation(
        objectData.content.centerLocation
      );
      this._renderer = new gdjs.Model3DRuntimeObjectRenderer(
        this,
        instanceContainer
      );
      this._materialType = this._convertMaterialType(
        objectData.content.materialType
      );
      this._materialTextureResourceName =
        objectData.content.materialTextureResourceName || '';
      this._materialGraphEnabled = !!objectData.content.materialGraphEnabled;
      this._materialGraphBlend =
        objectData.content.materialGraphBlend !== undefined
          ? objectData.content.materialGraphBlend
          : 1;
      this._materialGraphDefinition =
        objectData.content.materialGraphDefinition || '';
      this._materialGraphFragmentShader =
        objectData.content.materialGraphFragmentShader || '';
      this._materialProjectionMode = normalizeMaterialProjectionMode(
        objectData.content.materialProjectionMode
      );
      this._materialGraphVersion = objectData.content.materialGraphVersion || '1';
      this._crossfadeDuration = objectData.content.crossfadeDuration || 0;

      this.setIsCastingShadow(objectData.content.isCastingShadow);
      this.setIsReceivingShadow(objectData.content.isReceivingShadow);
      this.onModelChanged(objectData);

      // *ALWAYS* call `this.onCreated()` at the very end of your object constructor.
      this.onCreated();
    }

    /**
     * To be called after the renderer loaded a Model resource:
     * - After the renderer was instantiated
     * - After reloading the model
     */
    private onModelChanged(objectData: Model3DObjectData) {
      this._updateModel(objectData);
      if (this._animations.length > 0) {
        this._renderer.playAnimation(
          this._animations[0].source,
          this._animations[0].loop,
          true
        );
      }
    }

    override updateOriginalDimensionsFromObjectData(
      oldObjectData: Object3DData,
      newObjectData: Object3DData
    ): void {
      // Original dimensions must not be reset by `super.updateFromObjectData`.
      // `_updateModel` has a different logic to evaluate them using `keepAspectRatio`.
    }

    updateFromObjectData(
      oldObjectData: Model3DObjectData,
      newObjectData: Model3DObjectData
    ): boolean {
      super.updateFromObjectData(oldObjectData, newObjectData);

      if (
        oldObjectData.content.materialType !==
        newObjectData.content.materialType
      ) {
        this._materialType = this._convertMaterialType(
          newObjectData.content.materialType
        );
      }
      this._materialTextureResourceName =
        newObjectData.content.materialTextureResourceName || '';
      this._materialGraphEnabled = !!newObjectData.content.materialGraphEnabled;
      this._materialGraphBlend =
        newObjectData.content.materialGraphBlend !== undefined
          ? newObjectData.content.materialGraphBlend
          : 1;
      this._materialGraphDefinition =
        newObjectData.content.materialGraphDefinition || '';
      this._materialGraphFragmentShader =
        newObjectData.content.materialGraphFragmentShader || '';
      this._materialProjectionMode = normalizeMaterialProjectionMode(
        newObjectData.content.materialProjectionMode
      );
      this._materialGraphVersion = newObjectData.content.materialGraphVersion || '1';
      if (
        oldObjectData.content.modelResourceName !==
        newObjectData.content.modelResourceName
      ) {
        this._reloadModel(newObjectData);
      } else if (
        oldObjectData.content.width !== newObjectData.content.width ||
        oldObjectData.content.height !== newObjectData.content.height ||
        oldObjectData.content.depth !== newObjectData.content.depth ||
        oldObjectData.content.rotationX !== newObjectData.content.rotationX ||
        oldObjectData.content.rotationY !== newObjectData.content.rotationY ||
        oldObjectData.content.rotationZ !== newObjectData.content.rotationZ ||
        oldObjectData.content.keepAspectRatio !==
          newObjectData.content.keepAspectRatio ||
        oldObjectData.content.materialType !==
          newObjectData.content.materialType ||
        oldObjectData.content.materialTextureResourceName !==
          newObjectData.content.materialTextureResourceName ||
        oldObjectData.content.materialGraphEnabled !==
          newObjectData.content.materialGraphEnabled ||
        oldObjectData.content.materialGraphBlend !==
          newObjectData.content.materialGraphBlend ||
        oldObjectData.content.materialGraphFragmentShader !==
          newObjectData.content.materialGraphFragmentShader ||
        oldObjectData.content.materialProjectionMode !==
          newObjectData.content.materialProjectionMode ||
        oldObjectData.content.centerLocation !==
          newObjectData.content.centerLocation
      ) {
        // The center is applied to the model by `_updateModel`.
        this._centerPoint = getPointForLocation(
          newObjectData.content.centerLocation
        );
        this.onModelChanged(newObjectData);
      }
      if (
        oldObjectData.content.originLocation !==
        newObjectData.content.originLocation
      ) {
        this._originPoint = getPointForLocation(
          newObjectData.content.originLocation
        );
        this._renderer.updatePosition();
      }
      if (
        oldObjectData.content.isCastingShadow !==
        newObjectData.content.isCastingShadow
      ) {
        this.setIsCastingShadow(newObjectData.content.isCastingShadow);
      }
      if (
        oldObjectData.content.isReceivingShadow !==
        newObjectData.content.isReceivingShadow
      ) {
        this.setIsReceivingShadow(newObjectData.content.isReceivingShadow);
      }
      if (this.getInstanceContainer().getGame().isInGameEdition()) {
        const oldDefaultAnimationSource =
          this._animations.length > 0 ? this._animations[0].source : null;
        this._animations = newObjectData.content.animations;
        const newDefaultAnimationSource =
          this._animations.length > 0 ? this._animations[0].source : null;
        if (
          newDefaultAnimationSource &&
          oldDefaultAnimationSource !== newDefaultAnimationSource
        ) {
          this._renderer.playAnimation(
            newDefaultAnimationSource,
            this._animations[0].loop,
            true
          );
        }
      }
      return true;
    }

    getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): Model3DObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        mt: this._materialType,
        op: this._originPoint,
        cp: this._centerPoint,
        anis: this._animations,
        ai: this._currentAnimationIndex,
        ass: this._animationSpeedScale,
        aet: this.getAnimationElapsedTime(),
        ap: this._animationPaused,
        cfd: this._crossfadeDuration,
      };
    }

    updateFromNetworkSyncData(
      networkSyncData: Model3DObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.mt !== undefined) {
        this._materialType = networkSyncData.mt;
      }
      if (networkSyncData.op !== undefined) {
        this._originPoint = networkSyncData.op;
      }
      if (networkSyncData.cp !== undefined) {
        this._centerPoint = networkSyncData.cp;
      }
      if (networkSyncData.anis !== undefined) {
        this._animations = networkSyncData.anis;
      }
      if (networkSyncData.ass !== undefined) {
        this.setAnimationSpeedScale(networkSyncData.ass);
      }
      if (networkSyncData.ai !== undefined) {
        this.setAnimationIndex(networkSyncData.ai);
      }
      if (networkSyncData.aet !== undefined) {
        this.setAnimationElapsedTime(networkSyncData.aet);
      }
      if (networkSyncData.ap !== undefined) {
        if (networkSyncData.ap !== this.isAnimationPaused()) {
          networkSyncData.ap ? this.pauseAnimation() : this.resumeAnimation();
        }
      }
      if (networkSyncData.cfd !== undefined) {
        this._crossfadeDuration = networkSyncData.cfd;
      }
    }

    _reloadModel(objectData: Model3DObjectData) {
      this._modelResourceName = objectData.content.modelResourceName;
      this._renderer._reloadModel(this, this._runtimeScene);
      this.onModelChanged(objectData);
    }

    _updateModel(objectData: Model3DObjectData) {
      const rotationX = objectData.content.rotationX || 0;
      const rotationY = objectData.content.rotationY || 0;
      const rotationZ = objectData.content.rotationZ || 0;
      const width = objectData.content.width || 100;
      const height = objectData.content.height || 100;
      const depth = objectData.content.depth || 100;
      const keepAspectRatio = objectData.content.keepAspectRatio;
      this._renderer._updateModel(
        rotationX,
        rotationY,
        rotationZ,
        width,
        height,
        depth,
        keepAspectRatio
      );
    }

    getRenderer(): RuntimeObject3DRenderer {
      return this._renderer;
    }

    _convertMaterialType(
      materialTypeString: string
    ): gdjs.Model3DRuntimeObject.MaterialType {
      switch (materialTypeString) {
        case 'Basic':
          return gdjs.Model3DRuntimeObject.MaterialType.Basic;
        case 'KeepOriginal':
          return gdjs.Model3DRuntimeObject.MaterialType.KeepOriginal;
        case 'StandardWithoutMetalness':
          return gdjs.Model3DRuntimeObject.MaterialType.StandardWithoutMetalness;
        case 'Matte':
          return gdjs.Model3DRuntimeObject.MaterialType.Matte;
        case 'Glossy':
          return gdjs.Model3DRuntimeObject.MaterialType.Glossy;
        case 'Metallic':
          return gdjs.Model3DRuntimeObject.MaterialType.Metallic;
        case 'Standard':
        default:
          return gdjs.Model3DRuntimeObject.MaterialType.Standard;
      }
    }

    update(instanceContainer: gdjs.RuntimeInstanceContainer): void {
      const elapsedTime = this.getElapsedTime() / 1000;
      this._renderer.updateAnimation(elapsedTime);
    }

    /**
     * Get the index of the animation being played.
     * @return The index of the new animation being played
     */
    getAnimationIndex(): number {
      return this._currentAnimationIndex;
    }

    /**
     * Change the animation being played.
     * @param animationIndex The index of the new animation to be played
     */
    setAnimationIndex(animationIndex: number): void {
      animationIndex = animationIndex | 0;
      if (
        animationIndex < this._animations.length &&
        this._currentAnimationIndex !== animationIndex &&
        animationIndex >= 0
      ) {
        const animation = this._animations[animationIndex];
        this._currentAnimationIndex = animationIndex;
        this._renderer.playAnimation(animation.source, animation.loop);
        if (this._animationPaused) {
          this._renderer.pauseAnimation();
        }
      }
    }

    /**
     * Get the name of the animation being played.
     * @return The name of the new animation being played
     */
    getAnimationName(): string {
      if (this._currentAnimationIndex >= this._animations.length) {
        return '';
      }
      return this._animations[this._currentAnimationIndex].name;
    }

    /**
     * Change the animation being played.
     * @param newAnimationName The name of the new animation to be played
     */
    setAnimationName(newAnimationName: string): void {
      if (!newAnimationName) {
        return;
      }
      const animationIndex = this._animations.findIndex(
        (animation) => animation.name === newAnimationName
      );
      if (animationIndex >= 0) {
        this.setAnimationIndex(animationIndex);
      }
    }

    isCurrentAnimationName(name: string): boolean {
      return this.getAnimationName() === name;
    }

    /**
     * Return true if animation has ended.
     * The animation had ended if:
     * - it's not configured as a loop;
     * - the current frame is the last frame;
     * - the last frame has been displayed long enough.
     */
    hasAnimationEnded(): boolean {
      return this._renderer.hasAnimationEnded();
    }

    setIsCastingShadow(value: boolean): void {
      this._isCastingShadow = value;
      this._renderer._updateShadow();
    }

    setIsReceivingShadow(value: boolean): void {
      this._isReceivingShadow = value;
      this._renderer._updateShadow();
    }

    setCrossfadeDuration(duration: number): void {
      if (this._crossfadeDuration === duration) return;
      this._crossfadeDuration = duration;
    }

    configureIKChain(
      chainName: string,
      effectorBoneName: string,
      targetBoneName: string,
      linkBoneNames: string,
      iterationCount: number,
      blendFactor: number,
      minAngle: number,
      maxAngle: number
    ): void {
      this._renderer.configureIKChain(
        chainName,
        effectorBoneName,
        targetBoneName,
        parseIKLinkBoneNames(linkBoneNames),
        iterationCount,
        blendFactor,
        minAngle,
        maxAngle
      );
    }

    setIKTargetPosition(
      chainName: string,
      targetX: float,
      targetY: float,
      targetZ: float
    ): void {
      this._renderer.setIKTargetPosition(chainName, targetX, targetY, targetZ);
    }

    setIKTargetBone(chainName: string, targetBoneName: string): void {
      this._renderer.setIKTargetBone(chainName, targetBoneName);
    }

    setIKEnabled(chainName: string, enabled: boolean): void {
      this._renderer.setIKEnabled(chainName, enabled);
    }

    setIKIterationCount(chainName: string, iterationCount: number): void {
      this._renderer.setIKIterationCount(chainName, iterationCount);
    }

    setIKBlendFactor(chainName: string, blendFactor: number): void {
      this._renderer.setIKBlendFactor(chainName, blendFactor);
    }

    setIKAngleLimits(
      chainName: string,
      minAngleDegrees: number,
      maxAngleDegrees: number
    ): void {
      this._renderer.setIKAngleLimits(
        chainName,
        minAngleDegrees,
        maxAngleDegrees
      );
    }

    setIKTargetTolerance(chainName: string, tolerance: number): void {
      this._renderer.setIKTargetTolerance(chainName, tolerance);
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
      this._renderer.setIKLinkAngleLimits(
        chainName,
        linkBoneName,
        minAngleXDegrees,
        maxAngleXDegrees,
        minAngleYDegrees,
        maxAngleYDegrees,
        minAngleZDegrees,
        maxAngleZDegrees
      );
    }

    clearIKLinkAngleLimits(chainName: string, linkBoneName: string): void {
      this._renderer.clearIKLinkAngleLimits(chainName, linkBoneName);
    }

    clearIKLinkConstraints(chainName: string): void {
      this._renderer.clearIKLinkConstraints(chainName);
    }

    setIKGizmosEnabled(enabled: boolean): void {
      this._renderer.setIKGizmosEnabled(enabled);
    }

    areIKGizmosEnabled(): boolean {
      return this._renderer.areIKGizmosEnabled();
    }

    removeIKChain(chainName: string): void {
      this._renderer.removeIKChain(chainName);
    }

    clearIKChains(): void {
      this._renderer.clearIKChains();
    }

    hasIKChain(chainName: string): boolean {
      return this._renderer.hasIKChain(chainName);
    }

    getIKChainCount(): number {
      return this._renderer.getIKChainCount();
    }

    getIKChainNames(): string[] {
      return this._renderer.getIKChainNames();
    }

    getIKChainSettings(chainName: string): any {
      return this._renderer.getIKChainSettings(chainName);
    }

    getIKBoneNames(): string[] {
      return this._renderer.getIKBoneNames();
    }

    saveIKPose(poseName: string): void {
      this._renderer.saveIKPose(poseName);
    }

    applyIKPose(poseName: string): void {
      this._renderer.applyIKPose(poseName);
    }

    removeIKPose(poseName: string): void {
      this._renderer.removeIKPose(poseName);
    }

    clearIKPoses(): void {
      this._renderer.clearIKPoses();
    }

    hasIKPose(poseName: string): boolean {
      return this._renderer.hasIKPose(poseName);
    }

    getIKPoseCount(): number {
      return this._renderer.getIKPoseCount();
    }

    pinIKTargetToCurrentEffector(chainName: string): void {
      this._renderer.pinIKTargetToCurrentEffector(chainName);
    }

    pinAllIKTargetsToCurrentEffectors(): void {
      this._renderer.pinAllIKTargetsToCurrentEffectors();
    }

    exportIKPosesToJSON(): string {
      return this._renderer.exportIKPosesToJSON();
    }

    importIKPosesFromJSON(posesJSON: string, clearExisting: boolean): void {
      this._renderer.importIKPosesFromJSON(posesJSON, clearExisting);
    }

    override onDeletedFromScene(): void {
      this._renderer.onDestroy();
      super.onDeletedFromScene();
    }

    override onDestroyed(): void {
      this._renderer.onDestroy();
      super.onDestroyed();
    }

    isAnimationPaused() {
      return this._animationPaused;
    }

    pauseAnimation() {
      this._animationPaused = true;
      this._renderer.pauseAnimation();
    }

    resumeAnimation() {
      this._animationPaused = false;
      this._renderer.resumeAnimation();
    }

    getAnimationSpeedScale() {
      return this._animationSpeedScale;
    }

    setAnimationSpeedScale(ratio: float): void {
      this._animationSpeedScale = ratio;
      this._renderer.setAnimationTimeScale(ratio);
    }

    getAnimationElapsedTime(): float {
      return this._renderer.getAnimationElapsedTime();
    }

    setAnimationElapsedTime(time: float): void {
      this._renderer.setAnimationElapsedTime(time);
      if (!this._animationPaused) {
        this._renderer.resumeAnimation();
      }
    }

    getAnimationDuration(): float {
      return this._renderer.getAnimationDuration(
        this._animations[this._currentAnimationIndex].source
      );
    }

    getCenterX(): float {
      const centerPoint = this._getCenterPointForRuntimeAccess();
      return this.getWidth() * centerPoint[0];
    }

    getCenterY(): float {
      const centerPoint = this._getCenterPointForRuntimeAccess();
      return this.getHeight() * centerPoint[1];
    }

    getCenterZ(): float {
      const centerPoint = this._getCenterPointForRuntimeAccess();
      return this.getDepth() * centerPoint[2];
    }

    getDrawableX(): float {
      const originPoint = this._getOriginPointForRuntimeAccess();
      return this.getX() - this.getWidth() * originPoint[0];
    }

    getDrawableY(): float {
      const originPoint = this._getOriginPointForRuntimeAccess();
      return this.getY() - this.getHeight() * originPoint[1];
    }

    getDrawableZ(): float {
      const originPoint = this._getOriginPointForRuntimeAccess();
      return this.getZ() - this.getDepth() * originPoint[2];
    }

    private _getCenterPointForRuntimeAccess(): FloatPoint3D {
      const renderer = (this as any)._renderer as
        | gdjs.Model3DRuntimeObjectRenderer
        | undefined;
      if (renderer && typeof renderer.getCenterPoint === 'function') {
        return renderer.getCenterPoint();
      }
      if (this._centerPoint) {
        return this._centerPoint;
      }
      return gdjs.Model3DRuntimeObject._defaultCenterPoint;
    }

    private _getOriginPointForRuntimeAccess(): FloatPoint3D {
      const renderer = (this as any)._renderer as
        | gdjs.Model3DRuntimeObjectRenderer
        | undefined;
      if (renderer && typeof renderer.getOriginPoint === 'function') {
        return renderer.getOriginPoint();
      }
      if (this._originPoint) {
        return this._originPoint;
      }
      return gdjs.Model3DRuntimeObject._defaultOriginPoint;
    }
  }

  /** @category Objects > 3D Model */
  export namespace Model3DRuntimeObject {
    export enum MaterialType {
      Basic,
      StandardWithoutMetalness,
      KeepOriginal,
      Matte,
      Standard,
      Glossy,
      Metallic,
    }
  }
  gdjs.registerObject('Scene3D::Model3DObject', gdjs.Model3DRuntimeObject);
}
