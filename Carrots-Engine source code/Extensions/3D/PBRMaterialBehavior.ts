namespace gdjs {
  const pbrManagedMaterialUserDataKey = '__gdScene3dPbrMaterial';
  const pbrMaterialRoughnessUserDataKey = '__gdScene3dPbrRoughness';
  const pbrSceneEnvMapIntensityUserDataKey = '__gdScene3dPbrEnvMapIntensity';
  const pbrMaterialScanIntervalFrames = 15;
  const pbrStableMaterialScanIntervalFrames = 120;
  const pbrEnvironmentSyncIntervalFrames = 30;
  const pbrDefaultMetalness = 0;
  const pbrDefaultRoughness = 0.5;
  const pbrDefaultEnvMapIntensity = 1.0;
  const pbrDefaultEmissiveIntensity = 0;
  const pbrDefaultNormalScale = 1;
  const pbrDefaultAOMapIntensity = 1;

  interface PBRSharedTextureVariantState {
    texture: THREE.Texture;
    refCount: number;
  }

  const pbrSharedTextureVariantsByKey = new Map<
    string,
    PBRSharedTextureVariantState
  >();

  type RuntimeObjectWith3DRenderer = gdjs.RuntimeObject & {
    get3DRendererObject?: () => THREE.Object3D | null;
  };

  type PBRManagedMaterial =
    | THREE.MeshStandardMaterial
    | THREE.MeshPhysicalMaterial;

  interface PBRMaterialOriginalState {
    metalness: number;
    roughness: number;
    envMapIntensity: number;
    emissiveHex: number;
    emissiveIntensity: number;
    map: THREE.Texture | null;
    normalMap: THREE.Texture | null;
    aoMap: THREE.Texture | null;
    normalScale: THREE.Vector2;
    aoMapIntensity: number;
  }

  interface PBRPatchedMeshState {
    originalMaterial: THREE.Material | THREE.Material[];
    patchedMaterial: THREE.Material | THREE.Material[];
    clonedMaterials: PBRManagedMaterial[];
    materialStateByClone: Map<PBRManagedMaterial, PBRMaterialOriginalState>;
    geometry: THREE.BufferGeometry | null;
    hadUv2Attribute: boolean;
    originalUv2Attribute:
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | null;
    uv2WasPatched: boolean;
  }

  interface ScenePBREnvironmentState {
    fallbackRenderTarget: THREE.WebGLRenderTarget | null;
    pmremGenerator: THREE.PMREMGenerator | null;
  }

  const pbrEnvironmentStateByScene = new WeakMap<
    THREE.Scene,
    ScenePBREnvironmentState
  >();

  /**
   * @category Behaviors > 3D
   */
  export class PBRMaterialRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _metalness: number;
    private _roughness: number;
    private _envMapIntensity: number;
    private _emissiveColorHex: number;
    private _emissiveIntensity: number;
    private _normalScale: number;
    private _normalMapAsset: string;
    private _normalMapTexture: THREE.Texture | null;
    private _normalMapTextureAsset: string;
    private _aoMapAsset: string;
    private _aoMapIntensity: number;
    private _aoMapTexture: THREE.Texture | null;
    private _aoMapTextureAsset: string;
    private _albedoMapAsset: string;
    private _albedoMapTexture: THREE.Texture | null;
    private _albedoMapTextureAsset: string;
    private _patchedMeshes: Map<THREE.Mesh, PBRPatchedMeshState>;
    private _textureVariantsByKey: Map<string, THREE.Texture>;
    private _materialScanCounter: number;
    private _materialScanIntervalFrames: number;
    private _environmentSyncCounter: number;
    private _hasPendingTextureResolution: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);

      this._metalness = this._clamp01(
        behaviorData.metalness !== undefined ? behaviorData.metalness : 0
      );
      this._roughness = this._clamp01(
        behaviorData.roughness !== undefined ? behaviorData.roughness : 0.5
      );
      this._envMapIntensity = this._clamp(
        behaviorData.envMapIntensity !== undefined
          ? behaviorData.envMapIntensity
          : 1.0,
        0,
        4
      );
      this._emissiveColorHex = gdjs.rgbOrHexStringToNumber(
        behaviorData.emissiveColor || '0;0;0'
      );
      this._emissiveIntensity = this._clamp(
        behaviorData.emissiveIntensity !== undefined
          ? behaviorData.emissiveIntensity
          : 0,
        0,
        4
      );
      this._normalScale = this._clamp(
        behaviorData.normalScale !== undefined ? behaviorData.normalScale : 1,
        0,
        2
      );
      this._normalMapAsset = behaviorData.normalMapAsset || '';
      this._normalMapTexture = null;
      this._normalMapTextureAsset = '';
      this._aoMapAsset = behaviorData.aoMapAsset || '';
      this._aoMapIntensity = this._clamp(
        behaviorData.aoMapIntensity !== undefined
          ? behaviorData.aoMapIntensity
          : 1,
        0,
        1
      );
      this._aoMapTexture = null;
      this._aoMapTextureAsset = '';
      this._albedoMapAsset = behaviorData.map || '';
      this._albedoMapTexture = null;
      this._albedoMapTextureAsset = '';
      this._patchedMeshes = new Map();
      this._textureVariantsByKey = new Map();
      this._materialScanCounter = pbrMaterialScanIntervalFrames;
      this._materialScanIntervalFrames = pbrMaterialScanIntervalFrames;
      this._environmentSyncCounter = pbrEnvironmentSyncIntervalFrames;
      this._hasPendingTextureResolution = false;
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.metalness !== undefined) {
        this.setMetalness(behaviorData.metalness);
      }
      if (behaviorData.roughness !== undefined) {
        this.setRoughness(behaviorData.roughness);
      }
      if (behaviorData.envMapIntensity !== undefined) {
        this.setEnvMapIntensity(behaviorData.envMapIntensity);
      }
      if (behaviorData.emissiveColor !== undefined) {
        this.setEmissiveColor(behaviorData.emissiveColor);
      }
      if (behaviorData.emissiveIntensity !== undefined) {
        this.setEmissiveIntensity(behaviorData.emissiveIntensity);
      }
      if (behaviorData.normalScale !== undefined) {
        this.setNormalScale(behaviorData.normalScale);
      }
      if (behaviorData.normalMapAsset !== undefined) {
        this.setNormalMapAsset(behaviorData.normalMapAsset);
      }
      if (behaviorData.aoMapAsset !== undefined) {
        this.setAOMapAsset(behaviorData.aoMapAsset);
      }
      if (behaviorData.aoMapIntensity !== undefined) {
        this.setAOMapIntensity(behaviorData.aoMapIntensity);
      }
      if (behaviorData.map !== undefined) {
        this.setMap(behaviorData.map);
      }
      return true;
    }

    override onCreated(): void {
      this._materialScanCounter = pbrMaterialScanIntervalFrames;
      this._materialScanIntervalFrames = pbrMaterialScanIntervalFrames;
      this._environmentSyncCounter = pbrEnvironmentSyncIntervalFrames;
      this._hasPendingTextureResolution = false;
      this._patchOwnerMaterials();
      this._ensureEnvironmentFallbackAndSceneIntensity();
    }

    override onActivate(): void {
      this._materialScanCounter = pbrMaterialScanIntervalFrames;
      this._materialScanIntervalFrames = pbrMaterialScanIntervalFrames;
      this._environmentSyncCounter = pbrEnvironmentSyncIntervalFrames;
      this._hasPendingTextureResolution = false;
      this._patchOwnerMaterials();
      this._ensureEnvironmentFallbackAndSceneIntensity();
    }

    override onDeActivate(): void {
      this._restorePatchedMeshes();
    }

    override onDestroy(): void {
      this._restorePatchedMeshes();
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      if (this._environmentSyncCounter >= pbrEnvironmentSyncIntervalFrames) {
        this._environmentSyncCounter = 0;
        this._ensureEnvironmentFallbackAndSceneIntensity();
      } else {
        this._environmentSyncCounter++;
      }

      if (this._materialScanCounter >= this._materialScanIntervalFrames) {
        this._materialScanCounter = 0;
        const patchResult = this._patchOwnerMaterials();
        this._materialScanIntervalFrames =
          patchResult.hasPatchedMeshes &&
          !patchResult.changed &&
          !this._hasPendingTextureResolution
            ? pbrStableMaterialScanIntervalFrames
            : pbrMaterialScanIntervalFrames;
      } else {
        this._materialScanCounter++;
      }
    }

    setMetalness(value: number): void {
      this._metalness = this._clamp01(value);
      this._applyParametersToPatchedMaterials();
    }

    getMetalness(): number {
      return this._metalness;
    }

    setRoughness(value: number): void {
      this._roughness = this._clamp01(value);
      this._applyParametersToPatchedMaterials();
    }

    getRoughness(): number {
      return this._roughness;
    }

    setEnvMapIntensity(value: number): void {
      this._envMapIntensity = this._clamp(value, 0, 4);
      this._applyParametersToPatchedMaterials();
      this._ensureEnvironmentFallbackAndSceneIntensity();
    }

    getEnvMapIntensity(): number {
      return this._envMapIntensity;
    }

    setEmissiveIntensity(value: number): void {
      this._emissiveIntensity = this._clamp(value, 0, 4);
      this._applyParametersToPatchedMaterials();
    }

    getEmissiveIntensity(): number {
      return this._emissiveIntensity;
    }

    setEmissiveColor(color: string): void {
      this._emissiveColorHex = gdjs.rgbOrHexStringToNumber(color || '0;0;0');
      this._applyParametersToPatchedMaterials();
    }

    setNormalScale(value: number): void {
      this._normalScale = this._clamp(value, 0, 2);
      this._applyParametersToPatchedMaterials();
    }

    getNormalScale(): number {
      return this._normalScale;
    }

    setNormalMapAsset(assetName: string): void {
      this._disposeTextureVariants();
      this._normalMapAsset = assetName || '';
      this._normalMapTextureAsset = '';
      this._normalMapTexture = null;
      this._applyParametersToPatchedMaterials();
    }

    setAOMapAsset(assetName: string): void {
      this._disposeTextureVariants();
      this._aoMapAsset = assetName || '';
      this._aoMapTextureAsset = '';
      this._aoMapTexture = null;
      this._applyParametersToPatchedMaterials();
    }

    setAOMapIntensity(value: number): void {
      this._aoMapIntensity = this._clamp(value, 0, 1);
      this._applyParametersToPatchedMaterials();
    }

    getAOMapIntensity(): number {
      return this._aoMapIntensity;
    }

    setMap(assetName: string): void {
      this._disposeTextureVariants();
      this._albedoMapAsset = assetName || '';
      this._albedoMapTextureAsset = '';
      this._albedoMapTexture = null;
      this._applyParametersToPatchedMaterials();
    }

    private _clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    private _clamp01(value: number): number {
      return this._clamp(value, 0, 1);
    }

    private _isNearlyEqual(a: number, b: number, epsilon = 1e-4): boolean {
      return Math.abs(a - b) <= epsilon;
    }

    private _hasCustomPBROverrides(): boolean {
      return !(
        this._isNearlyEqual(this._metalness, pbrDefaultMetalness) &&
        this._isNearlyEqual(this._roughness, pbrDefaultRoughness) &&
        this._isNearlyEqual(this._envMapIntensity, pbrDefaultEnvMapIntensity) &&
        this._isNearlyEqual(
          this._emissiveIntensity,
          pbrDefaultEmissiveIntensity
        ) &&
        this._isNearlyEqual(this._normalScale, pbrDefaultNormalScale) &&
        this._isNearlyEqual(this._aoMapIntensity, pbrDefaultAOMapIntensity) &&
        this._emissiveColorHex === 0 &&
        !this._normalMapAsset &&
        !this._aoMapAsset &&
        !this._albedoMapAsset
      );
    }

    private _isSupportedMaterial(
      material: THREE.Material
    ): material is PBRManagedMaterial {
      const typedMaterial = material as THREE.Material & {
        isMeshStandardMaterial?: boolean;
        isMeshPhysicalMaterial?: boolean;
        isMeshBasicMaterial?: boolean;
        isShaderMaterial?: boolean;
      };

      if (!typedMaterial || typedMaterial.isMeshBasicMaterial) {
        return false;
      }
      if (typedMaterial.isShaderMaterial) {
        return false;
      }
      return !!(
        typedMaterial.isMeshStandardMaterial ||
        typedMaterial.isMeshPhysicalMaterial
      );
    }

    private _getOwner3DObject(): THREE.Object3D | null {
      const owner3DObject = this.owner as RuntimeObjectWith3DRenderer;
      if (
        !owner3DObject ||
        typeof owner3DObject.get3DRendererObject !== 'function'
      ) {
        return null;
      }
      return owner3DObject.get3DRendererObject() || null;
    }

    private _getThreeSceneAndRenderer(): {
      scene: THREE.Scene;
      renderer: THREE.WebGLRenderer;
    } | null {
      const runtimeScene = this.owner.getRuntimeScene();
      if (!runtimeScene) {
        return null;
      }
      const layer = runtimeScene.getLayer(this.owner.getLayer());
      if (!layer) {
        return null;
      }
      const layerRenderer = layer.getRenderer() as any;
      if (
        !layerRenderer ||
        typeof layerRenderer.getThreeScene !== 'function' ||
        !layerRenderer.getThreeScene()
      ) {
        return null;
      }
      const scene = layerRenderer.getThreeScene() as THREE.Scene;
      const renderer = runtimeScene
        .getGame()
        .getRenderer()
        .getThreeRenderer() as THREE.WebGLRenderer;
      if (!renderer) {
        return null;
      }
      return { scene, renderer };
    }

    private _getOrCreateEnvironmentState(
      scene: THREE.Scene
    ): ScenePBREnvironmentState {
      const existing = pbrEnvironmentStateByScene.get(scene);
      if (existing) {
        return existing;
      }

      const state: ScenePBREnvironmentState = {
        fallbackRenderTarget: null,
        pmremGenerator: null,
      };
      pbrEnvironmentStateByScene.set(scene, state);
      return state;
    }

    private _ensureEnvironmentFallbackAndSceneIntensity(): void {
      const sceneAndRenderer = this._getThreeSceneAndRenderer();
      if (!sceneAndRenderer) {
        return;
      }

      const { scene, renderer } = sceneAndRenderer;
      const state = this._getOrCreateEnvironmentState(scene);
      scene.userData = scene.userData || {};
      scene.userData[pbrSceneEnvMapIntensityUserDataKey] = this._envMapIntensity;

      if (scene.environment) {
        return;
      }

      if (!state.pmremGenerator) {
        state.pmremGenerator = new THREE.PMREMGenerator(renderer);
      }

      if (state.fallbackRenderTarget) {
        scene.environment = state.fallbackRenderTarget.texture;
        return;
      }

      const pmremGenerator = state.pmremGenerator;
      const background = scene.background;
      let environmentRenderTarget: THREE.WebGLRenderTarget | null = null;

      try {
        const backgroundTexture = background as THREE.Texture | undefined;
        if (backgroundTexture && (backgroundTexture as any).isCubeTexture) {
          environmentRenderTarget = pmremGenerator.fromCubemap(
            backgroundTexture as THREE.CubeTexture
          );
        } else if (backgroundTexture && (backgroundTexture as any).isTexture) {
          environmentRenderTarget =
            pmremGenerator.fromEquirectangular(backgroundTexture);
        } else {
          const fallbackScene = new THREE.Scene();
          fallbackScene.background =
            background && (background as any).isColor
              ? (background as THREE.Color).clone()
              : new THREE.Color(0.5, 0.5, 0.5);
          environmentRenderTarget = pmremGenerator.fromScene(
            fallbackScene,
            0,
            0.1,
            100
          );
        }
      } catch (error) {
        const fallbackScene = new THREE.Scene();
        fallbackScene.background = new THREE.Color(0.5, 0.5, 0.5);
        environmentRenderTarget = pmremGenerator.fromScene(
          fallbackScene,
          0,
          0.1,
          100
        );
      } finally {
        pmremGenerator.dispose();
        state.pmremGenerator = null;
      }

      if (!environmentRenderTarget) {
        return;
      }

      state.fallbackRenderTarget = environmentRenderTarget;
      scene.environment = environmentRenderTarget.texture;
    }

    private _getImageManager(): gdjs.PixiImageManager | null {
      const imageManager = this.owner
        .getRuntimeScene()
        .getGame()
        .getImageManager() as gdjs.PixiImageManager;
      if (!imageManager || typeof imageManager.getThreeTexture !== 'function') {
        return null;
      }
      return imageManager;
    }

    private _isPlaceholderTexture(texture: THREE.Texture | null): boolean {
      if (!texture || !texture.userData) {
        return false;
      }
      return texture.userData.__gdPlaceholderTexture === true;
    }

    private _resolveNormalMapTexture(): THREE.Texture | null {
      if (!this._normalMapAsset) {
        this._normalMapTextureAsset = '';
        this._normalMapTexture = null;
        return null;
      }

      if (
        this._normalMapTextureAsset === this._normalMapAsset &&
        this._normalMapTexture &&
        !this._isPlaceholderTexture(this._normalMapTexture)
      ) {
        return this._normalMapTexture;
      }

      this._normalMapTextureAsset = this._normalMapAsset;
      this._normalMapTexture = null;

      try {
        const imageManager = this._getImageManager();
        if (imageManager) {
          this._normalMapTexture =
            imageManager.getThreeTexture(this._normalMapAsset) || null;
        }
      } catch (error) {
        this._normalMapTexture = null;
      }

      if (!this._normalMapTexture || this._isPlaceholderTexture(this._normalMapTexture)) {
        this._hasPendingTextureResolution = true;
        return null;
      }
      return this._normalMapTexture;
    }

    private _resolveAOMapTexture(): THREE.Texture | null {
      if (!this._aoMapAsset) {
        this._aoMapTextureAsset = '';
        this._aoMapTexture = null;
        return null;
      }

      if (
        this._aoMapTextureAsset === this._aoMapAsset &&
        this._aoMapTexture &&
        !this._isPlaceholderTexture(this._aoMapTexture)
      ) {
        return this._aoMapTexture;
      }

      this._aoMapTextureAsset = this._aoMapAsset;
      this._aoMapTexture = null;

      try {
        const imageManager = this._getImageManager();
        if (imageManager) {
          this._aoMapTexture =
            imageManager.getThreeTexture(this._aoMapAsset) || null;
        }
      } catch (error) {
        this._aoMapTexture = null;
      }

      if (!this._aoMapTexture || this._isPlaceholderTexture(this._aoMapTexture)) {
        this._hasPendingTextureResolution = true;
        return null;
      }
      return this._aoMapTexture;
    }

    private _resolveAlbedoMapTexture(): THREE.Texture | null {
      if (!this._albedoMapAsset) {
        this._albedoMapTextureAsset = '';
        this._albedoMapTexture = null;
        return null;
      }

      if (
        this._albedoMapTextureAsset === this._albedoMapAsset &&
        this._albedoMapTexture &&
        !this._isPlaceholderTexture(this._albedoMapTexture)
      ) {
        return this._albedoMapTexture;
      }

      this._albedoMapTextureAsset = this._albedoMapAsset;
      this._albedoMapTexture = null;

      try {
        const imageManager = this._getImageManager();
        if (imageManager) {
          this._albedoMapTexture =
            imageManager.getThreeTexture(this._albedoMapAsset) || null;
        }
      } catch (error) {
        this._albedoMapTexture = null;
      }

      if (!this._albedoMapTexture || this._isPlaceholderTexture(this._albedoMapTexture)) {
        this._hasPendingTextureResolution = true;
        return null;
      }
      return this._albedoMapTexture;
    }

    private _getMaxTextureAnisotropy(): number {
      const sceneAndRenderer = this._getThreeSceneAndRenderer();
      if (!sceneAndRenderer) {
        return 1;
      }
      const rendererMaxAnisotropy = Math.max(
        1,
        sceneAndRenderer.renderer.capabilities.getMaxAnisotropy()
      );
      // Cap anisotropy to keep texture quality high without a large GPU cost spike.
      return Math.min(4, rendererMaxAnisotropy);
    }

    private _getTextureVariant(
      texture: THREE.Texture | null,
      usage: 'color' | 'data'
    ): THREE.Texture | null {
      if (!texture) {
        return null;
      }

      const srgbColorSpace = (THREE as { SRGBColorSpace?: unknown })
        .SRGBColorSpace;
      const noColorSpace = (THREE as { NoColorSpace?: unknown }).NoColorSpace;
      const desiredColorSpace =
        usage === 'color' ? srgbColorSpace : noColorSpace;
      const typedTexture = texture as THREE.Texture & { colorSpace?: unknown };

      if (
        desiredColorSpace === undefined ||
        typedTexture.colorSpace === desiredColorSpace
      ) {
        return texture;
      }

      const cacheKey = texture.uuid + '|' + usage;
      const existingVariant = this._textureVariantsByKey.get(cacheKey);
      if (existingVariant) {
        return existingVariant;
      }

      const sharedVariantState = pbrSharedTextureVariantsByKey.get(cacheKey);
      if (sharedVariantState) {
        sharedVariantState.refCount += 1;
        this._textureVariantsByKey.set(cacheKey, sharedVariantState.texture);
        return sharedVariantState.texture;
      }

      const variant = texture.clone();
      (variant as any).colorSpace = desiredColorSpace;
      variant.needsUpdate = true;
      pbrSharedTextureVariantsByKey.set(cacheKey, {
        texture: variant,
        refCount: 1,
      });
      this._textureVariantsByKey.set(cacheKey, variant);
      return variant;
    }

    private _disposeTextureVariants(): void {
      for (const [cacheKey, texture] of this._textureVariantsByKey.entries()) {
        const sharedVariantState = pbrSharedTextureVariantsByKey.get(cacheKey);
        if (sharedVariantState) {
          sharedVariantState.refCount -= 1;
          if (sharedVariantState.refCount <= 0) {
            sharedVariantState.texture.dispose();
            pbrSharedTextureVariantsByKey.delete(cacheKey);
          }
        } else {
          texture.dispose();
        }
      }
      this._textureVariantsByKey.clear();
    }

    private _ensureUv2ForAO(
      mesh: THREE.Mesh,
      patchState: PBRPatchedMeshState
    ): void {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      if (!geometry || !geometry.attributes) {
        return;
      }
      if (geometry.attributes.uv2 || !geometry.attributes.uv) {
        return;
      }

      geometry.attributes.uv2 = geometry.attributes.uv;
      patchState.uv2WasPatched = true;
      patchState.geometry = geometry;
    }

    private _restorePatchedUv2(patchState: PBRPatchedMeshState): void {
      if (!patchState.uv2WasPatched || !patchState.geometry) {
        return;
      }

      const geometry = patchState.geometry;
      if (!geometry.attributes) {
        return;
      }

      if (patchState.hadUv2Attribute && patchState.originalUv2Attribute) {
        geometry.attributes.uv2 = patchState.originalUv2Attribute;
      } else {
        delete (geometry.attributes as any).uv2;
      }
      patchState.uv2WasPatched = false;
    }

    private _applyParametersToMaterial(
      material: PBRManagedMaterial,
      originalState: PBRMaterialOriginalState,
      normalMapTexture: THREE.Texture | null,
      aoMapTexture: THREE.Texture | null,
      albedoMapTexture: THREE.Texture | null,
      maxTextureAnisotropy: number
    ): boolean {
      const hasCustomOverrides = this._hasCustomPBROverrides();
      if (hasCustomOverrides) {
        material.metalness = this._metalness;
        material.roughness = this._roughness;
        material.envMapIntensity = this._envMapIntensity;
        material.emissive.setHex(this._emissiveColorHex);
        material.emissiveIntensity = this._emissiveIntensity;
      } else {
        material.metalness = originalState.metalness;
        material.roughness = originalState.roughness;
        material.envMapIntensity = originalState.envMapIntensity;
        material.emissive.setHex(originalState.emissiveHex);
        material.emissiveIntensity = originalState.emissiveIntensity;
      }

      const resolvedNormalMap = this._normalMapAsset
        ? normalMapTexture
        : originalState.normalMap;
      const resolvedAOMap = this._aoMapAsset ? aoMapTexture : originalState.aoMap;
      const resolvedAlbedoMap = this._albedoMapAsset
        ? albedoMapTexture
        : originalState.map;

      const previousMap = material.map;
      const previousNormalMap = material.normalMap;
      const previousAOMap = material.aoMap;

      material.normalMap = this._getTextureVariant(resolvedNormalMap, 'data');
      material.aoMap = this._getTextureVariant(resolvedAOMap, 'data');
      material.map = this._getTextureVariant(resolvedAlbedoMap, 'color');
      material.normalMapType = THREE.TangentSpaceNormalMap;

      if (this._normalMapAsset && material.normalMap) {
        material.normalScale.set(this._normalScale, this._normalScale);
      } else {
        material.normalScale.copy(originalState.normalScale);
      }

      material.aoMapIntensity = this._aoMapAsset
        ? this._aoMapIntensity
        : originalState.aoMapIntensity;

      if (material.map) {
        material.map.anisotropy = Math.max(
          material.map.anisotropy || 1,
          maxTextureAnisotropy
        );
      }
      if (material.normalMap) {
        material.normalMap.anisotropy = Math.max(
          material.normalMap.anisotropy || 1,
          maxTextureAnisotropy
        );
      }
      if (material.aoMap) {
        material.aoMap.anisotropy = Math.max(
          material.aoMap.anisotropy || 1,
          maxTextureAnisotropy
        );
      }

      material.userData = material.userData || {};
      material.userData[pbrManagedMaterialUserDataKey] = true;
      material.userData[pbrMaterialRoughnessUserDataKey] = material.roughness;
      if (
        previousMap !== material.map ||
        previousNormalMap !== material.normalMap ||
        previousAOMap !== material.aoMap
      ) {
        material.needsUpdate = true;
        return true;
      }

      return false;
    }

    private _applyParametersToMesh(
      mesh: THREE.Mesh,
      patchState: PBRPatchedMeshState
    ): boolean {
      const normalMapTexture = this._resolveNormalMapTexture();
      const aoMapTexture = this._resolveAOMapTexture();
      const albedoMapTexture = this._resolveAlbedoMapTexture();
      const maxTextureAnisotropy = this._getMaxTextureAnisotropy();
      let changed = false;

      const shouldEnsureUv2ForAO =
        (!!this._aoMapAsset && !!aoMapTexture) ||
        patchState.clonedMaterials.some((material) => {
          const originalState = patchState.materialStateByClone.get(material);
          return !!(originalState && originalState.aoMap);
        });

      if (shouldEnsureUv2ForAO) {
        const hadPatchedUv2 = patchState.uv2WasPatched;
        this._ensureUv2ForAO(mesh, patchState);
        changed = changed || hadPatchedUv2 !== patchState.uv2WasPatched;
      }

      for (const material of patchState.clonedMaterials) {
        const originalState = patchState.materialStateByClone.get(material);
        if (!originalState) {
          continue;
        }
        changed = this._applyParametersToMaterial(
          material,
          originalState,
          normalMapTexture,
          aoMapTexture,
          albedoMapTexture,
          maxTextureAnisotropy
        ) || changed;
      }

      return changed;
    }

    private _applyParametersToPatchedMaterials(): void {
      this._hasPendingTextureResolution = false;
      for (const [mesh, patchState] of this._patchedMeshes.entries()) {
        this._applyParametersToMesh(mesh, patchState);
      }
      if (this._hasPendingTextureResolution) {
        this._materialScanIntervalFrames = pbrMaterialScanIntervalFrames;
      }
    }

    private _disposePatchedMeshState(state: PBRPatchedMeshState): void {
      for (const material of state.clonedMaterials) {
        material.dispose();
      }
    }

    private _restorePatchedMeshes(): void {
      for (const [mesh, state] of this._patchedMeshes.entries()) {
        mesh.material = state.originalMaterial as
          | THREE.Material
          | THREE.Material[];
        this._restorePatchedUv2(state);
        this._disposePatchedMeshState(state);
      }
      this._patchedMeshes.clear();
      this._disposeTextureVariants();
    }

    private _patchMeshMaterial(mesh: THREE.Mesh): boolean {
      if (!mesh.material) {
        return false;
      }

      const previousState = this._patchedMeshes.get(mesh);
      if (previousState) {
        if (mesh.material === previousState.patchedMaterial) {
          return this._applyParametersToMesh(mesh, previousState);
        }
        this._restorePatchedUv2(previousState);
        this._disposePatchedMeshState(previousState);
        this._patchedMeshes.delete(mesh);
      }

      const originalMaterial = mesh.material as
        | THREE.Material
        | THREE.Material[];
      const sourceMaterials = Array.isArray(originalMaterial)
        ? originalMaterial.slice()
        : [originalMaterial];
      const patchedMaterials = sourceMaterials.slice();
      const clonedMaterials: PBRManagedMaterial[] = [];
      const materialStateByClone = new Map<
        PBRManagedMaterial,
        PBRMaterialOriginalState
      >();
      let hasPatchedMaterial = false;

      for (let index = 0; index < sourceMaterials.length; index++) {
        const sourceMaterial = sourceMaterials[index];
        if (!sourceMaterial || !this._isSupportedMaterial(sourceMaterial)) {
          continue;
        }

        const clonedMaterial = sourceMaterial.clone() as PBRManagedMaterial;
        patchedMaterials[index] = clonedMaterial;
        clonedMaterials.push(clonedMaterial);
        materialStateByClone.set(clonedMaterial, {
          metalness: clonedMaterial.metalness,
          roughness: clonedMaterial.roughness,
          envMapIntensity: clonedMaterial.envMapIntensity,
          emissiveHex: clonedMaterial.emissive.getHex(),
          emissiveIntensity: clonedMaterial.emissiveIntensity,
          map: clonedMaterial.map || null,
          normalMap: clonedMaterial.normalMap || null,
          aoMap: clonedMaterial.aoMap || null,
          normalScale: clonedMaterial.normalScale.clone(),
          aoMapIntensity: clonedMaterial.aoMapIntensity,
        });
        hasPatchedMaterial = true;
      }

      if (!hasPatchedMaterial) {
        return false;
      }

      const appliedMaterial = Array.isArray(originalMaterial)
        ? patchedMaterials
        : patchedMaterials[0];
      mesh.material = appliedMaterial as THREE.Material | THREE.Material[];

      const geometry = mesh.geometry as THREE.BufferGeometry;
      const hasGeometryAttributes = !!(geometry && geometry.attributes);
      const hadUv2Attribute = !!(
        hasGeometryAttributes && geometry.attributes.uv2
      );
      const patchState: PBRPatchedMeshState = {
        originalMaterial,
        patchedMaterial: appliedMaterial as THREE.Material | THREE.Material[],
        clonedMaterials,
        materialStateByClone,
        geometry: geometry || null,
        hadUv2Attribute,
        originalUv2Attribute: hadUv2Attribute ? geometry.attributes.uv2 : null,
        uv2WasPatched: false,
      };
      this._patchedMeshes.set(mesh, patchState);
      this._applyParametersToMesh(mesh, patchState);
      return true;
    }

    private _patchOwnerMaterials(): { hasPatchedMeshes: boolean; changed: boolean } {
      const owner3DObject = this._getOwner3DObject();
      if (!owner3DObject) {
        if (this._patchedMeshes.size > 0) {
          this._restorePatchedMeshes();
          return { hasPatchedMeshes: false, changed: true };
        }
        return { hasPatchedMeshes: false, changed: false };
      }

      let changed = false;
      this._hasPendingTextureResolution = false;
      const visibleMeshes = new Set<THREE.Mesh>();
      owner3DObject.traverse((object3D) => {
        const mesh = object3D as THREE.Mesh;
        if (!mesh || !mesh.isMesh || !mesh.material) {
          return;
        }
        visibleMeshes.add(mesh);
        changed = this._patchMeshMaterial(mesh) || changed;
      });

      for (const [mesh, state] of this._patchedMeshes.entries()) {
        if (visibleMeshes.has(mesh)) {
          continue;
        }
        this._restorePatchedUv2(state);
        this._disposePatchedMeshState(state);
        this._patchedMeshes.delete(mesh);
        changed = true;
      }

      return { hasPatchedMeshes: this._patchedMeshes.size > 0, changed };
    }
  }

  gdjs.registerBehavior(
    'Scene3D::PBRMaterial',
    gdjs.PBRMaterialRuntimeBehavior
  );
}
