namespace gdjs {
  export type Scene3DPostProcessingQualityMode = 'low' | 'medium' | 'high';

  export interface Scene3DPostProcessingQualityProfile {
    captureScale: number;
    ssaoSamples: number;
    ssrSteps: number;
    fogSteps: number;
    dofSamples: number;
    dofBlurScale: number;
  }

  export interface Scene3DSharedCapture {
    colorTexture: THREE.Texture;
    depthTexture: THREE.DepthTexture | null;
    width: number;
    height: number;
    quality: Scene3DPostProcessingQualityProfile;
  }

  export interface Scene3DShaderPipelineStats {
    variantCount: number;
    pendingVariantCount: number;
    compilePassCount: number;
    lastCompileDurationMs: number;
    compileInProgress: boolean;
  }

  interface LayerRendererWithPostProcessingMethods {
    addPostProcessingPass?: (pass: THREE_ADDONS.Pass) => void;
    removePostProcessingPass?: (pass: THREE_ADDONS.Pass) => void;
    getThreeEffectComposer?: () => THREE_ADDONS.EffectComposer | null;
    getThreeScene?: () => THREE.Scene | null;
    getThreeCamera?: () => THREE.Camera | null;
    __gdScene3DAddPostProcessingPassOriginal?: (
      pass: THREE_ADDONS.Pass
    ) => void;
    __gdScene3DRemovePostProcessingPassOriginal?: (
      pass: THREE_ADDONS.Pass
    ) => void;
    __gdScene3DPostProcessingPatched?: boolean;
  }

  interface Scene3DSharedPostProcessingState {
    renderTarget: THREE.WebGLRenderTarget;
    renderSize: THREE.Vector2;
    previousViewport: THREE.Vector4;
    previousScissor: THREE.Vector4;
    lastCaptureTimeFromStartMs: number;
    qualityMode: Scene3DPostProcessingQualityMode;
    hasStackController: boolean;
    stackEnabled: boolean;
    lastPassOrderSignature: string;
    effectQualityOverrides: Record<string, Scene3DPostProcessingQualityMode>;
    adaptiveQualityEnabled: boolean;
    adaptiveTargetFps: number;
    adaptiveTargetFrameMs: number;
    adaptiveQualityMode: Scene3DPostProcessingQualityMode;
    adaptiveFrameTimeAverageMs: number;
    lastFrameTimeFromStartMs: number;
    lastAdaptiveQualityChangeTimeFromStartMs: number;
    adaptiveCaptureScaleMultiplier: number;
    shaderPrecompileEnabled: boolean;
    shaderOptimizePostEffects: boolean;
    shaderIncludeSceneVariants: boolean;
    shaderWarmupBatchSize: number;
    shaderCompileCadenceMs: number;
    shaderVariantMultiplier: number;
    shaderVerboseValidation: boolean;
    shaderValidationThrottleMs: number;
    shaderKnownPostMaterialKeys: Set<string>;
    shaderKnownSceneMaterialKeys: Set<string>;
    shaderPendingPostMaterials: THREE.Material[];
    shaderLastSceneVariantSignature: string;
    shaderPendingSceneCompile: boolean;
    shaderForceWarmupStep: boolean;
    shaderLastWarmupStepTimeFromStartMs: number;
    shaderLastDiscoveryTimeFromStartMs: number;
    shaderLastCompileTimeFromStartMs: number;
    shaderVariantCount: number;
    shaderPendingVariantCount: number;
    shaderCompilePassCount: number;
    shaderLastCompileDurationMs: number;
    shaderCompileInProgress: boolean;
    shaderLastValidationLogTimeFromStartMs: number;
  }

  const qualityProfiles: {
    [key in Scene3DPostProcessingQualityMode]: Scene3DPostProcessingQualityProfile;
  } = {
    low: {
      captureScale: 0.67,
      ssaoSamples: 6,
      ssrSteps: 14,
      fogSteps: 20,
      dofSamples: 4,
      dofBlurScale: 0.75,
    },
    medium: {
      // Medium prioritizes image stability while keeping good performance.
      captureScale: 0.85,
      ssaoSamples: 8,
      ssrSteps: 24,
      fogSteps: 32,
      dofSamples: 6,
      dofBlurScale: 0.95,
    },
    high: {
      captureScale: 1,
      ssaoSamples: 12,
      ssrSteps: 32,
      fogSteps: 48,
      dofSamples: 8,
      dofBlurScale: 1.1,
    },
  };
  const qualityRank: Record<Scene3DPostProcessingQualityMode, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  const warmupPassDefaultBatchSize = 2;
  const defaultCompileCadenceMs = 180;
  const defaultVariantMultiplier = 1;
  const defaultValidationThrottleMs = 1200;

  const managedPassOrder: string[] = [
    'SSAO',
    'RIM',
    'DOF',
    'SSR',
    'FOG',
    'BLOOM',
  ];
  const managedPassOrderMap = new Map<string, number>(
    managedPassOrder.map((id, index) => [id, index])
  );

  const sharedStateByLayerRenderer = new WeakMap<
    object,
    Scene3DSharedPostProcessingState
  >();

  const normalizeQualityMode = (
    value: string
  ): Scene3DPostProcessingQualityMode => {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'low' || normalized === 'high') {
      return normalized;
    }
    return 'high';
  };
  const getHigherQualityMode = (
    first: Scene3DPostProcessingQualityMode,
    second: Scene3DPostProcessingQualityMode
  ): Scene3DPostProcessingQualityMode => {
    const safeFirst = normalizeQualityMode(first);
    const safeSecond = normalizeQualityMode(second);
    return qualityRank[safeFirst] >= qualityRank[safeSecond]
      ? safeFirst
      : safeSecond;
  };
  const getLowerQualityMode = (
    first: Scene3DPostProcessingQualityMode,
    second: Scene3DPostProcessingQualityMode
  ): Scene3DPostProcessingQualityMode => {
    const safeFirst = normalizeQualityMode(first);
    const safeSecond = normalizeQualityMode(second);
    return qualityRank[safeFirst] <= qualityRank[safeSecond]
      ? safeFirst
      : safeSecond;
  };
  const getNextLowerQualityMode = (
    mode: Scene3DPostProcessingQualityMode
  ): Scene3DPostProcessingQualityMode => {
    if (mode === 'high') {
      return 'medium';
    }
    if (mode === 'medium') {
      return 'low';
    }
    return 'low';
  };
  const getNextHigherQualityMode = (
    mode: Scene3DPostProcessingQualityMode
  ): Scene3DPostProcessingQualityMode => {
    if (mode === 'low') {
      return 'medium';
    }
    if (mode === 'medium') {
      return 'high';
    }
    return 'high';
  };
  const clampAdaptiveTargetFps = (value: number): number => {
    const numericValue = Number.isFinite(value) ? value : 60;
    return gdjs.evtTools.common.clamp(24, 144, numericValue);
  };
  const clampShaderWarmupBatchSize = (value: number): number => {
    const numericValue = Number.isFinite(value)
      ? Math.round(value)
      : warmupPassDefaultBatchSize;
    return gdjs.evtTools.common.clamp(1, 12, numericValue);
  };
  const clampShaderCompileCadenceMs = (value: number): number => {
    const numericValue = Number.isFinite(value)
      ? value
      : defaultCompileCadenceMs;
    return gdjs.evtTools.common.clamp(60, 3000, numericValue);
  };
  const clampShaderVariantMultiplier = (value: number): number => {
    const numericValue = Number.isFinite(value) ? value : defaultVariantMultiplier;
    return gdjs.evtTools.common.clamp(0.5, 4, numericValue);
  };
  const clampShaderValidationThrottleMs = (value: number): number => {
    const numericValue = Number.isFinite(value)
      ? value
      : defaultValidationThrottleMs;
    return gdjs.evtTools.common.clamp(250, 30000, numericValue);
  };

  const getLayerRendererKey = (target: gdjs.Layer): object | null => {
    const renderer = target.getRenderer();
    if (!renderer) {
      return null;
    }
    return renderer as unknown as object;
  };

  const createSharedState = (): Scene3DSharedPostProcessingState => {
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });
    renderTarget.texture.generateMipmaps = false;
    renderTarget.depthTexture = new THREE.DepthTexture(1, 1);
    renderTarget.depthTexture.format = THREE.DepthFormat;
    renderTarget.depthTexture.type = THREE.UnsignedIntType;
    renderTarget.depthTexture.needsUpdate = true;

    return {
      renderTarget,
      renderSize: new THREE.Vector2(),
      previousViewport: new THREE.Vector4(),
      previousScissor: new THREE.Vector4(),
      lastCaptureTimeFromStartMs: -1,
      qualityMode: 'high',
      hasStackController: false,
      stackEnabled: true,
      lastPassOrderSignature: '',
      effectQualityOverrides: {},
      adaptiveQualityEnabled: false,
      adaptiveTargetFps: 60,
      adaptiveTargetFrameMs: 1000 / 60,
      adaptiveQualityMode: 'high',
      adaptiveFrameTimeAverageMs: -1,
      lastFrameTimeFromStartMs: -1,
      lastAdaptiveQualityChangeTimeFromStartMs: -1,
      adaptiveCaptureScaleMultiplier: 1,
      shaderPrecompileEnabled: true,
      shaderOptimizePostEffects: true,
      shaderIncludeSceneVariants: true,
      shaderWarmupBatchSize: warmupPassDefaultBatchSize,
      shaderCompileCadenceMs: defaultCompileCadenceMs,
      shaderVariantMultiplier: defaultVariantMultiplier,
      shaderVerboseValidation: false,
      shaderValidationThrottleMs: defaultValidationThrottleMs,
      shaderKnownPostMaterialKeys: new Set<string>(),
      shaderKnownSceneMaterialKeys: new Set<string>(),
      shaderPendingPostMaterials: [],
      shaderLastSceneVariantSignature: '',
      shaderPendingSceneCompile: false,
      shaderForceWarmupStep: false,
      shaderLastWarmupStepTimeFromStartMs: -1,
      shaderLastDiscoveryTimeFromStartMs: -1,
      shaderLastCompileTimeFromStartMs: -1,
      shaderVariantCount: 0,
      shaderPendingVariantCount: 0,
      shaderCompilePassCount: 0,
      shaderLastCompileDurationMs: 0,
      shaderCompileInProgress: false,
      shaderLastValidationLogTimeFromStartMs: -1,
    };
  };

  const getOrCreateSharedState = (
    target: gdjs.Layer
  ): Scene3DSharedPostProcessingState | null => {
    const key = getLayerRendererKey(target);
    if (!key) {
      return null;
    }

    const existingState = sharedStateByLayerRenderer.get(key);
    if (existingState) {
      ensureLayerRendererShaderWarmupHooks(target, existingState);
      return existingState;
    }

    const newState = createSharedState();
    sharedStateByLayerRenderer.set(key, newState);
    ensureLayerRendererShaderWarmupHooks(target, newState);
    return newState;
  };

  const getTimeFromStartMs = (target: gdjs.Layer): number => {
    const runtimeScene: any = target.getRuntimeScene();
    if (!runtimeScene) {
      return 0;
    }

    const scene =
      typeof runtimeScene.getScene === 'function'
        ? runtimeScene.getScene()
        : runtimeScene;
    if (!scene || typeof scene.getTimeManager !== 'function') {
      return 0;
    }
    return scene.getTimeManager().getTimeFromStart();
  };

  interface Scene3DPostProcessWarmupResources {
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  }

  let scene3DPostProcessWarmupResources:
    | Scene3DPostProcessWarmupResources
    | null = null;
  let scene3DAutoPassIdSeed = 1;

  const getOrCreateScene3DPostProcessWarmupResources = (): Scene3DPostProcessWarmupResources => {
    if (scene3DPostProcessWarmupResources) {
      return scene3DPostProcessWarmupResources;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
    camera.position.z = 1;
    const warmupMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), warmupMaterial);
    scene.add(mesh);
    scene3DPostProcessWarmupResources = {
      scene,
      camera,
      mesh,
    };
    return scene3DPostProcessWarmupResources;
  };

  const getLayerRendererWithPostProcessing = (
    target: gdjs.Layer
  ): LayerRendererWithPostProcessingMethods | null => {
    const renderer = target.getRenderer();
    if (!renderer) {
      return null;
    }
    return renderer as unknown as LayerRendererWithPostProcessingMethods;
  };

  const getComposerFromLayerRenderer = (
    layerRenderer: LayerRendererWithPostProcessingMethods | null
  ): THREE_ADDONS.EffectComposer | null => {
    if (
      !layerRenderer ||
      typeof layerRenderer.getThreeEffectComposer !== 'function'
    ) {
      return null;
    }
    return layerRenderer.getThreeEffectComposer() || null;
  };

  const getLayerSceneAndCamera = (
    layerRenderer: LayerRendererWithPostProcessingMethods | null
  ): { scene: THREE.Scene; camera: THREE.Camera } | null => {
    if (
      !layerRenderer ||
      typeof layerRenderer.getThreeScene !== 'function' ||
      typeof layerRenderer.getThreeCamera !== 'function'
    ) {
      return null;
    }
    const scene = layerRenderer.getThreeScene();
    const camera = layerRenderer.getThreeCamera();
    if (!scene || !camera) {
      return null;
    }
    return { scene, camera };
  };

  const getOrAssignScene3DPassId = (
    pass: THREE_ADDONS.Pass,
    passIndex: number
  ): string => {
    const passAny = pass as any;
    const existingId = passAny.__scene3dEffectId as string | undefined;
    if (existingId && existingId.length > 0) {
      return existingId;
    }

    const constructorName =
      passAny && passAny.constructor && passAny.constructor.name
        ? String(passAny.constructor.name).toUpperCase()
        : 'PASS';
    const generatedId = `AUTO_${constructorName}_${passIndex}_${scene3DAutoPassIdSeed++}`;
    passAny.__scene3dEffectId = generatedId;
    return generatedId;
  };

  const ensureScene3DPassIds = (
    composer: THREE_ADDONS.EffectComposer | null
  ): void => {
    if (!composer || !(composer as any).passes) {
      return;
    }
    const composerPasses = (composer as any).passes as Array<THREE_ADDONS.Pass>;
    for (let index = 0; index < composerPasses.length; index++) {
      const pass = composerPasses[index];
      getOrAssignScene3DPassId(pass, index);
    }
  };

  const getMaterialVariantSignature = (material: THREE.Material): string => {
    const materialAny = material as THREE.Material & {
      defines?: Record<string, unknown>;
      lights?: boolean;
      fog?: boolean;
      skinning?: boolean;
      morphTargets?: boolean;
      morphNormals?: boolean;
      vertexColors?: boolean;
      toneMapped?: boolean;
      alphaTest?: number;
      transparent?: boolean;
      side?: number;
      version?: number;
    };
    const definesObject = materialAny.defines || {};
    const definesSignature = Object.keys(definesObject)
      .sort()
      .map(defineKey => `${defineKey}:${String(definesObject[defineKey])}`)
      .join(',');
    return [
      material.type || 'Material',
      materialAny.side !== undefined ? materialAny.side : 0,
      materialAny.transparent ? 1 : 0,
      materialAny.alphaTest !== undefined ? materialAny.alphaTest : 0,
      materialAny.fog ? 1 : 0,
      materialAny.lights ? 1 : 0,
      materialAny.skinning ? 1 : 0,
      materialAny.morphTargets ? 1 : 0,
      materialAny.morphNormals ? 1 : 0,
      materialAny.vertexColors ? 1 : 0,
      materialAny.toneMapped === false ? 0 : 1,
      materialAny.version !== undefined ? materialAny.version : 0,
      definesSignature,
    ].join('|');
  };

  const getSceneLightingVariantSignature = (scene: THREE.Scene): string => {
    let ambientCount = 0;
    let hemisphereCount = 0;
    let directionalCount = 0;
    let pointCount = 0;
    let spotCount = 0;
    let rectAreaCount = 0;
    scene.traverse(object3D => {
      const light = object3D as THREE.Light & {
        isLight?: boolean;
        visible?: boolean;
      };
      if (!light || !light.isLight || light.visible === false) {
        return;
      }
      if (light instanceof THREE.AmbientLight) {
        ambientCount++;
      } else if (light instanceof THREE.HemisphereLight) {
        hemisphereCount++;
      } else if (light instanceof THREE.DirectionalLight) {
        directionalCount++;
      } else if (light instanceof THREE.PointLight) {
        pointCount++;
      } else if (light instanceof THREE.SpotLight) {
        spotCount++;
      } else if ((light as any).isRectAreaLight) {
        rectAreaCount++;
      }
    });
    return `A${ambientCount}|H${hemisphereCount}|D${directionalCount}|P${pointCount}|S${spotCount}|R${rectAreaCount}`;
  };

  const collectSceneMaterialVariantKeys = (
    scene: THREE.Scene
  ): Set<string> => {
    const keys = new Set<string>();
    scene.traverse(object3D => {
      const objectAny = object3D as THREE.Object3D & {
        material?: THREE.Material | THREE.Material[];
        isMesh?: boolean;
        isPoints?: boolean;
        isLine?: boolean;
        isSprite?: boolean;
        visible?: boolean;
      };
      if (!objectAny || objectAny.visible === false || !objectAny.material) {
        return;
      }
      if (
        !objectAny.isMesh &&
        !objectAny.isPoints &&
        !objectAny.isLine &&
        !objectAny.isSprite
      ) {
        return;
      }
      const materials = Array.isArray(objectAny.material)
        ? objectAny.material
        : [objectAny.material];
      for (let index = 0; index < materials.length; index++) {
        const material = materials[index];
        if (!material || !(material as any).isMaterial) {
          continue;
        }
        keys.add(getMaterialVariantSignature(material));
      }
    });
    return keys;
  };

  const collectPassMaterials = (
    pass: THREE_ADDONS.Pass
  ): THREE.Material[] => {
    const materials: THREE.Material[] = [];
    const visitedObjects = new Set<any>();
    const visitedMaterials = new Set<string>();

    const visit = (value: any, depth: number): void => {
      if (value === null || value === undefined || depth > 4) {
        return;
      }
      if (visitedObjects.has(value)) {
        return;
      }
      visitedObjects.add(value);

      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          visit(value[index], depth + 1);
        }
        return;
      }

      const maybeMaterial = value as THREE.Material & {
        isMaterial?: boolean;
        uuid?: string;
      };
      if (maybeMaterial.isMaterial) {
        const materialKey = `${maybeMaterial.uuid || ''}|${getMaterialVariantSignature(
          maybeMaterial
        )}`;
        if (!visitedMaterials.has(materialKey)) {
          visitedMaterials.add(materialKey);
          materials.push(maybeMaterial);
        }
        return;
      }

      if (typeof value !== 'object') {
        return;
      }

      const objectValue = value as Record<string, unknown>;
      for (const key of Object.keys(objectValue)) {
        if (key === 'parent' || key === 'scene' || key === 'renderer') {
          continue;
        }
        visit(objectValue[key], depth + 1);
      }
    };

    visit(pass as any, 0);
    return materials;
  };

  const compilePostProcessMaterial = (
    threeRenderer: THREE.WebGLRenderer,
    material: THREE.Material
  ): boolean => {
    if (!material || !(material as any).isMaterial) {
      return false;
    }
    const warmupResources = getOrCreateScene3DPostProcessWarmupResources();
    const previousMaterial = warmupResources.mesh.material;
    warmupResources.mesh.material = material;
    try {
      material.needsUpdate = true;
      threeRenderer.compile(warmupResources.scene, warmupResources.camera);
      return true;
    } catch (error) {
      return false;
    } finally {
      warmupResources.mesh.material = previousMaterial;
    }
  };

  const compileSceneVariants = (
    threeRenderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ): boolean => {
    try {
      threeRenderer.compile(scene, camera);
      return true;
    } catch (error) {
      return false;
    }
  };

  const updateShaderVariantDiscovery = (
    target: gdjs.Layer,
    state: Scene3DSharedPostProcessingState,
    scene: THREE.Scene
  ): void => {
    const layerRenderer = getLayerRendererWithPostProcessing(target);
    const composer = getComposerFromLayerRenderer(layerRenderer);
    ensureScene3DPassIds(composer);
    if (state.shaderOptimizePostEffects && composer && (composer as any).passes) {
      const composerPasses = (composer as any).passes as Array<THREE_ADDONS.Pass>;
      for (let passIndex = 0; passIndex < composerPasses.length; passIndex++) {
        const pass = composerPasses[passIndex];
        const materials = collectPassMaterials(pass);
        for (let materialIndex = 0; materialIndex < materials.length; materialIndex++) {
          const material = materials[materialIndex];
          const materialKey = `${material.uuid}|${getMaterialVariantSignature(
            material
          )}`;
          if (state.shaderKnownPostMaterialKeys.has(materialKey)) {
            continue;
          }
          state.shaderKnownPostMaterialKeys.add(materialKey);
          state.shaderPendingPostMaterials.push(material);
        }
      }
    }

    const sceneMaterialKeys = collectSceneMaterialVariantKeys(scene);
    for (const key of sceneMaterialKeys) {
      state.shaderKnownSceneMaterialKeys.add(key);
    }
    const sortedSceneKeys = Array.from(sceneMaterialKeys).sort();
    const sceneVariantSignature =
      sortedSceneKeys.join(';') + '||' + getSceneLightingVariantSignature(scene);
    if (sceneVariantSignature !== state.shaderLastSceneVariantSignature) {
      state.shaderLastSceneVariantSignature = sceneVariantSignature;
      if (state.shaderIncludeSceneVariants) {
        state.shaderPendingSceneCompile = true;
      }
    }

    state.shaderVariantCount =
      state.shaderKnownPostMaterialKeys.size + state.shaderKnownSceneMaterialKeys.size;
    state.shaderPendingVariantCount =
      state.shaderPendingPostMaterials.length +
      (state.shaderPendingSceneCompile ? 1 : 0);
  };

  const runShaderWarmupStep = (
    target: gdjs.Layer,
    state: Scene3DSharedPostProcessingState,
    threeRenderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    timeFromStartMs: number
  ): void => {
    if (!state.shaderPrecompileEnabled) {
      state.shaderPendingPostMaterials.length = 0;
      state.shaderPendingSceneCompile = false;
      state.shaderPendingVariantCount = 0;
      state.shaderCompileInProgress = false;
      return;
    }

    if (
      !state.shaderForceWarmupStep &&
      state.shaderLastWarmupStepTimeFromStartMs === timeFromStartMs
    ) {
      return;
    }
    state.shaderLastWarmupStepTimeFromStartMs = timeFromStartMs;

    const shouldRefreshVariantDiscovery =
      state.shaderForceWarmupStep ||
      state.shaderLastDiscoveryTimeFromStartMs < 0 ||
      timeFromStartMs - state.shaderLastDiscoveryTimeFromStartMs >=
        Math.max(120, state.shaderCompileCadenceMs * 0.5);
    if (shouldRefreshVariantDiscovery) {
      updateShaderVariantDiscovery(target, state, scene);
      state.shaderLastDiscoveryTimeFromStartMs = timeFromStartMs;
    }

    const compileBudget = clampShaderWarmupBatchSize(
      Math.round(state.shaderWarmupBatchSize * state.shaderVariantMultiplier)
    );
    const canCompileNow =
      state.shaderForceWarmupStep ||
      state.shaderLastCompileTimeFromStartMs < 0 ||
      timeFromStartMs - state.shaderLastCompileTimeFromStartMs >=
        state.shaderCompileCadenceMs;

    if (!canCompileNow) {
      return;
    }

    let compiledAny = false;
    let compileStartTimeMs = 0;
    if (typeof performance !== 'undefined' && performance.now) {
      compileStartTimeMs = performance.now();
    } else {
      compileStartTimeMs = Date.now();
    }
    state.shaderCompileInProgress = true;
    try {
      for (
        let compileIndex = 0;
        compileIndex < compileBudget &&
        state.shaderPendingPostMaterials.length > 0;
        compileIndex++
      ) {
        const material = state.shaderPendingPostMaterials.shift();
        if (!material) {
          continue;
        }
        const compiled = compilePostProcessMaterial(threeRenderer, material);
        if (compiled) {
          compiledAny = true;
          state.shaderCompilePassCount++;
        }
      }

      if (
        state.shaderIncludeSceneVariants &&
        state.shaderPendingSceneCompile &&
        state.shaderPendingPostMaterials.length === 0
      ) {
        const compiledScene = compileSceneVariants(threeRenderer, scene, camera);
        if (compiledScene) {
          compiledAny = true;
          state.shaderCompilePassCount++;
        }
        state.shaderPendingSceneCompile = false;
      }
    } finally {
      state.shaderCompileInProgress = false;
      const compileEndTimeMs =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      state.shaderLastCompileDurationMs = Math.max(
        0,
        compileEndTimeMs - compileStartTimeMs
      );
      if (compiledAny) {
        state.shaderLastCompileTimeFromStartMs = timeFromStartMs;
      }
      state.shaderForceWarmupStep = false;
      state.shaderPendingVariantCount =
        state.shaderPendingPostMaterials.length +
        (state.shaderPendingSceneCompile ? 1 : 0);
      if (
        state.shaderVerboseValidation &&
        (state.shaderLastValidationLogTimeFromStartMs < 0 ||
          timeFromStartMs - state.shaderLastValidationLogTimeFromStartMs >=
            state.shaderValidationThrottleMs)
      ) {
        state.shaderLastValidationLogTimeFromStartMs = timeFromStartMs;
        console.debug(
          '[Scene3D::ShaderPrecompile] variants=%d pending=%d compilePasses=%d lastCompileMs=%d',
          state.shaderVariantCount,
          state.shaderPendingVariantCount,
          state.shaderCompilePassCount,
          state.shaderLastCompileDurationMs
        );
      }
    }
  };

  const ensureLayerRendererShaderWarmupHooks = (
    target: gdjs.Layer,
    state: Scene3DSharedPostProcessingState
  ): void => {
    const layerRenderer = getLayerRendererWithPostProcessing(target);
    if (!layerRenderer || layerRenderer.__gdScene3DPostProcessingPatched) {
      return;
    }
    const originalAdd = layerRenderer.addPostProcessingPass;
    const originalRemove = layerRenderer.removePostProcessingPass;
    if (
      typeof originalAdd !== 'function' ||
      typeof originalRemove !== 'function'
    ) {
      return;
    }

    layerRenderer.__gdScene3DAddPostProcessingPassOriginal = originalAdd;
    layerRenderer.__gdScene3DRemovePostProcessingPassOriginal = originalRemove;

    layerRenderer.addPostProcessingPass = (pass: THREE_ADDONS.Pass) => {
      originalAdd.call(layerRenderer, pass);
      if (pass) {
        getOrAssignScene3DPassId(pass, -1);
      }
      state.shaderForceWarmupStep = true;
      state.lastPassOrderSignature = '';
      const runtimeScene = target.getRuntimeScene();
      const threeRenderer = runtimeScene
        .getGame()
        .getRenderer()
        .getThreeRenderer();
      const sceneAndCamera = getLayerSceneAndCamera(layerRenderer);
      if (threeRenderer && sceneAndCamera) {
        runShaderWarmupStep(
          target,
          state,
          threeRenderer,
          sceneAndCamera.scene,
          sceneAndCamera.camera,
          getTimeFromStartMs(target)
        );
      }
    };
    layerRenderer.removePostProcessingPass = (pass: THREE_ADDONS.Pass) => {
      originalRemove.call(layerRenderer, pass);
      state.shaderForceWarmupStep = true;
      state.lastPassOrderSignature = '';
      const runtimeScene = target.getRuntimeScene();
      const threeRenderer = runtimeScene
        .getGame()
        .getRenderer()
        .getThreeRenderer();
      const sceneAndCamera = getLayerSceneAndCamera(layerRenderer);
      if (threeRenderer && sceneAndCamera) {
        runShaderWarmupStep(
          target,
          state,
          threeRenderer,
          sceneAndCamera.scene,
          sceneAndCamera.camera,
          getTimeFromStartMs(target)
        );
      }
    };
    layerRenderer.__gdScene3DPostProcessingPatched = true;
  };

  export const setScene3DShaderPrecompileConfig = function (
    target: gdjs.Layer,
    enabled: boolean,
    optimizePostEffects?: boolean,
    includeSceneVariants?: boolean,
    warmupBatchSize?: number,
    compileCadenceMs?: number,
    variantMultiplier?: number,
    verboseValidation?: boolean,
    validationThrottleMs?: number
  ): void {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return;
    }
    state.shaderPrecompileEnabled = !!enabled;
    state.shaderOptimizePostEffects =
      optimizePostEffects === undefined ? true : !!optimizePostEffects;
    state.shaderIncludeSceneVariants =
      includeSceneVariants === undefined ? true : !!includeSceneVariants;
    state.shaderWarmupBatchSize = clampShaderWarmupBatchSize(
      warmupBatchSize === undefined
        ? state.shaderWarmupBatchSize
        : warmupBatchSize
    );
    state.shaderCompileCadenceMs = clampShaderCompileCadenceMs(
      compileCadenceMs === undefined
        ? state.shaderCompileCadenceMs
        : compileCadenceMs
    );
    state.shaderVariantMultiplier = clampShaderVariantMultiplier(
      variantMultiplier === undefined
        ? state.shaderVariantMultiplier
        : variantMultiplier
    );
    state.shaderVerboseValidation =
      verboseValidation === undefined ? false : !!verboseValidation;
    state.shaderValidationThrottleMs = clampShaderValidationThrottleMs(
      validationThrottleMs === undefined
        ? state.shaderValidationThrottleMs
        : validationThrottleMs
    );
    state.shaderForceWarmupStep = true;
  };

  export const getScene3DShaderPrecompileStats = function (
    target: gdjs.Layer
  ): Scene3DShaderPipelineStats | null {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return null;
    }
    return {
      variantCount: state.shaderVariantCount,
      pendingVariantCount: state.shaderPendingVariantCount,
      compilePassCount: state.shaderCompilePassCount,
      lastCompileDurationMs: state.shaderLastCompileDurationMs,
      compileInProgress: state.shaderCompileInProgress,
    };
  };

  export const markScene3DPostProcessingPass = function (
    pass: THREE_ADDONS.Pass,
    passId: string
  ): void {
    (pass as any).__scene3dEffectId = passId;
  };

  export const setScene3DPostProcessingStackConfig = function (
    target: gdjs.Layer,
    enabled: boolean,
    qualityMode: string,
    adaptiveQualityEnabled?: boolean,
    adaptiveTargetFps?: number
  ): void {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return;
    }

    state.hasStackController = true;
    state.stackEnabled = enabled;
    state.qualityMode = normalizeQualityMode(qualityMode);
    state.adaptiveQualityEnabled =
      adaptiveQualityEnabled === undefined ? false : !!adaptiveQualityEnabled;
    state.adaptiveTargetFps = clampAdaptiveTargetFps(
      adaptiveTargetFps === undefined ? state.adaptiveTargetFps : adaptiveTargetFps
    );
    state.adaptiveTargetFrameMs = 1000 / state.adaptiveTargetFps;
    const requestedQualityMode = getRequestedScene3DQualityMode(state);
    if (
      !state.adaptiveQualityEnabled ||
      state.adaptiveFrameTimeAverageMs < 0 ||
      qualityRank[state.adaptiveQualityMode] > qualityRank[requestedQualityMode]
    ) {
      state.adaptiveQualityMode = requestedQualityMode;
      state.adaptiveCaptureScaleMultiplier = 1;
    }
    state.shaderForceWarmupStep = true;
  };

  export const setScene3DPostProcessingEffectQualityMode = function (
    target: gdjs.Layer,
    effectId: string,
    qualityMode: string
  ): void {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return;
    }

    if (!effectId) {
      return;
    }

    state.effectQualityOverrides[effectId] = normalizeQualityMode(qualityMode);
  };

  export const clearScene3DPostProcessingEffectQualityMode = function (
    target: gdjs.Layer,
    effectId: string
  ): void {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return;
    }
    if (!effectId) {
      return;
    }
    delete state.effectQualityOverrides[effectId];
  };

  export const clearScene3DPostProcessingStackConfig = function (
    target: gdjs.Layer
  ): void {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return;
    }

    state.hasStackController = false;
    state.stackEnabled = true;
    state.qualityMode = 'high';
    state.lastPassOrderSignature = '';
    state.effectQualityOverrides = {};
    state.adaptiveQualityEnabled = false;
    state.adaptiveTargetFps = 60;
    state.adaptiveTargetFrameMs = 1000 / 60;
    state.adaptiveQualityMode = 'high';
    state.adaptiveFrameTimeAverageMs = -1;
    state.lastFrameTimeFromStartMs = -1;
    state.lastAdaptiveQualityChangeTimeFromStartMs = -1;
    state.adaptiveCaptureScaleMultiplier = 1;
    state.shaderForceWarmupStep = true;
  };

  export const isScene3DPostProcessingEnabled = function (
    target: gdjs.Layer
  ): boolean {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return true;
    }
    return !state.hasStackController || state.stackEnabled;
  };

  const getRequestedScene3DQualityMode = (
    state: Scene3DSharedPostProcessingState
  ): Scene3DPostProcessingQualityMode => {
    let mode = normalizeQualityMode(state.qualityMode);
    for (const effectId in state.effectQualityOverrides) {
      mode = getHigherQualityMode(
        mode,
        normalizeQualityMode(state.effectQualityOverrides[effectId])
      );
    }
    return mode;
  };
  const getEffectiveScene3DQualityMode = (
    state: Scene3DSharedPostProcessingState
  ): Scene3DPostProcessingQualityMode => {
    const requestedMode = getRequestedScene3DQualityMode(state);
    if (
      !state.adaptiveQualityEnabled ||
      !state.hasStackController ||
      !state.stackEnabled
    ) {
      return requestedMode;
    }
    return getLowerQualityMode(requestedMode, state.adaptiveQualityMode);
  };

  const updateAdaptiveQualityState = (
    state: Scene3DSharedPostProcessingState,
    timeFromStartMs: number
  ): void => {
    const requestedMode = getRequestedScene3DQualityMode(state);
    if (
      !state.adaptiveQualityEnabled ||
      !state.hasStackController ||
      !state.stackEnabled
    ) {
      state.adaptiveQualityMode = requestedMode;
      state.adaptiveCaptureScaleMultiplier = 1;
      state.lastFrameTimeFromStartMs = timeFromStartMs;
      return;
    }

    if (
      state.lastFrameTimeFromStartMs >= 0 &&
      timeFromStartMs > state.lastFrameTimeFromStartMs
    ) {
      const frameDeltaMs = Math.max(
        1,
        Math.min(120, timeFromStartMs - state.lastFrameTimeFromStartMs)
      );
      state.adaptiveFrameTimeAverageMs =
        state.adaptiveFrameTimeAverageMs < 0
          ? frameDeltaMs
          : state.adaptiveFrameTimeAverageMs * 0.9 + frameDeltaMs * 0.1;
    }
    state.lastFrameTimeFromStartMs = timeFromStartMs;

    if (qualityRank[state.adaptiveQualityMode] > qualityRank[requestedMode]) {
      state.adaptiveQualityMode = requestedMode;
      state.lastAdaptiveQualityChangeTimeFromStartMs = timeFromStartMs;
    }

    const averageFrameTimeMs = state.adaptiveFrameTimeAverageMs;
    if (averageFrameTimeMs > 0) {
      const targetFrameMs = Math.max(1, state.adaptiveTargetFrameMs);
      const timeSinceLastSwitchMs =
        state.lastAdaptiveQualityChangeTimeFromStartMs < 0
          ? Number.POSITIVE_INFINITY
          : timeFromStartMs - state.lastAdaptiveQualityChangeTimeFromStartMs;
      const canSwitchQuality = timeSinceLastSwitchMs >= 1400;
      const shouldDecreaseQuality = averageFrameTimeMs > targetFrameMs * 1.24;
      const shouldIncreaseQuality = averageFrameTimeMs < targetFrameMs * 0.76;

      if (shouldDecreaseQuality && canSwitchQuality) {
        const nextMode = getNextLowerQualityMode(state.adaptiveQualityMode);
        if (nextMode !== state.adaptiveQualityMode) {
          state.adaptiveQualityMode = nextMode;
          state.lastAdaptiveQualityChangeTimeFromStartMs = timeFromStartMs;
        }
      } else if (
        shouldIncreaseQuality &&
        canSwitchQuality &&
        qualityRank[state.adaptiveQualityMode] < qualityRank[requestedMode]
      ) {
        const nextMode = getNextHigherQualityMode(state.adaptiveQualityMode);
        state.adaptiveQualityMode = getLowerQualityMode(nextMode, requestedMode);
        state.lastAdaptiveQualityChangeTimeFromStartMs = timeFromStartMs;
      }

      const frameBudgetRatio = targetFrameMs / Math.max(1, averageFrameTimeMs);
      state.adaptiveCaptureScaleMultiplier = gdjs.evtTools.common.clamp(
        0.85,
        1,
        frameBudgetRatio
      );
    } else {
      state.adaptiveCaptureScaleMultiplier = 1;
    }
  };

  export const getScene3DPostProcessingQualityProfileForMode = function (
    qualityMode: string
  ): Scene3DPostProcessingQualityProfile {
    return qualityProfiles[normalizeQualityMode(qualityMode)];
  };
  export const getScene3DPostProcessingQualityProfileForLayerMode = function (
    target: gdjs.Layer,
    preferredQualityMode: string
  ): Scene3DPostProcessingQualityProfile {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return qualityProfiles[normalizeQualityMode(preferredQualityMode)];
    }
    const preferredMode = normalizeQualityMode(preferredQualityMode);
    if (
      !state.adaptiveQualityEnabled ||
      !state.hasStackController ||
      !state.stackEnabled
    ) {
      return qualityProfiles[preferredMode];
    }
    const effectiveMode = getLowerQualityMode(
      preferredMode,
      state.adaptiveQualityMode
    );
    return qualityProfiles[effectiveMode];
  };

  export const getScene3DPostProcessingQualityProfile = function (
    target: gdjs.Layer
  ): Scene3DPostProcessingQualityProfile {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return qualityProfiles.high;
    }
    return qualityProfiles[getEffectiveScene3DQualityMode(state)];
  };

  export const captureScene3DSharedTextures = function (
    target: gdjs.Layer,
    threeRenderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ): Scene3DSharedCapture | null {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return null;
    }

    const timeFromStart = getTimeFromStartMs(target);
    updateAdaptiveQualityState(state, timeFromStart);

    const quality = getScene3DPostProcessingQualityProfile(target);
    const captureScale = gdjs.evtTools.common.clamp(
      0.6,
      1,
      quality.captureScale * state.adaptiveCaptureScaleMultiplier
    );
    const effectiveQuality: Scene3DPostProcessingQualityProfile = {
      ...quality,
      captureScale,
    };
    const renderTarget = state.renderTarget;

    threeRenderer.getDrawingBufferSize(state.renderSize);
    const width = Math.max(
      1,
      Math.round(
        (state.renderSize.x || target.getWidth()) * effectiveQuality.captureScale
      )
    );
    const height = Math.max(
      1,
      Math.round(
        (state.renderSize.y || target.getHeight()) * effectiveQuality.captureScale
      )
    );

    if (renderTarget.width !== width || renderTarget.height !== height) {
      renderTarget.setSize(width, height);
      if (renderTarget.depthTexture) {
        renderTarget.depthTexture.needsUpdate = true;
      }
    }
    renderTarget.texture.colorSpace = threeRenderer.outputColorSpace;

    if (state.lastCaptureTimeFromStartMs !== timeFromStart) {
      const previousRenderTarget = threeRenderer.getRenderTarget();
      const previousAutoClear = threeRenderer.autoClear;
      const previousScissorTest = threeRenderer.getScissorTest();
      const previousXrEnabled = threeRenderer.xr.enabled;
      threeRenderer.getViewport(state.previousViewport);
      threeRenderer.getScissor(state.previousScissor);

      threeRenderer.xr.enabled = false;
      threeRenderer.autoClear = true;
      threeRenderer.setRenderTarget(renderTarget);
      threeRenderer.setViewport(0, 0, renderTarget.width, renderTarget.height);
      threeRenderer.setScissor(0, 0, renderTarget.width, renderTarget.height);
      threeRenderer.setScissorTest(false);
      threeRenderer.clear(true, true, true);
      threeRenderer.render(scene, camera);

      threeRenderer.setRenderTarget(previousRenderTarget);
      threeRenderer.setViewport(state.previousViewport);
      threeRenderer.setScissor(state.previousScissor);
      threeRenderer.setScissorTest(previousScissorTest);
      threeRenderer.autoClear = previousAutoClear;
      threeRenderer.xr.enabled = previousXrEnabled;

      state.lastCaptureTimeFromStartMs = timeFromStart;
    }

    runShaderWarmupStep(
      target,
      state,
      threeRenderer,
      scene,
      camera,
      timeFromStart
    );

    return {
      colorTexture: renderTarget.texture,
      depthTexture: renderTarget.depthTexture,
      width,
      height,
      quality: effectiveQuality,
    };
  };

  export const reorderScene3DPostProcessingPasses = function (
    target: gdjs.Layer
  ): void {
    const state = getOrCreateSharedState(target);
    if (!state) {
      return;
    }

    const layerRenderer: any = target.getRenderer();
    if (
      !layerRenderer ||
      typeof layerRenderer.getThreeEffectComposer !== 'function'
    ) {
      return;
    }
    const composer = layerRenderer.getThreeEffectComposer();
    if (!composer || !composer.passes) {
      return;
    }
    ensureScene3DPassIds(composer);

    const composerPasses = composer.passes as Array<THREE_ADDONS.Pass & any>;
    const detectedPasses = composerPasses
      .map((pass, index) => ({
        pass,
        index,
        id: (pass as any).__scene3dEffectId as string | undefined,
      }))
      .filter((entry) => !!entry.id && managedPassOrderMap.has(entry.id));

    if (detectedPasses.length <= 1) {
      return;
    }

    const currentSignature = detectedPasses.map((entry) => entry.id).join('|');
    if (state.lastPassOrderSignature === currentSignature) {
      return;
    }

    const sorted = detectedPasses
      .slice()
      .sort((a, b) => {
        const orderA = managedPassOrderMap.get(a.id || '') || 999;
        const orderB = managedPassOrderMap.get(b.id || '') || 999;
        if (orderA === orderB) {
          return a.index - b.index;
        }
        return orderA - orderB;
      })
      .map((entry) => entry.pass);

    const renderer = target.getRenderer();
    for (const pass of detectedPasses) {
      renderer.removePostProcessingPass(pass.pass);
    }
    for (const pass of sorted) {
      renderer.addPostProcessingPass(pass);
    }

    state.lastPassOrderSignature = sorted
      .map((pass) => (pass as any).__scene3dEffectId as string)
      .join('|');

    const runtimeScene = target.getRuntimeScene();
    const threeRenderer = runtimeScene
      .getGame()
      .getRenderer()
      .getThreeRenderer();
    const sceneAndCamera = getLayerSceneAndCamera(layerRenderer);
    if (threeRenderer && sceneAndCamera) {
      runShaderWarmupStep(
        target,
        state,
        threeRenderer,
        sceneAndCamera.scene,
        sceneAndCamera.camera,
        getTimeFromStartMs(target)
      );
    }
  };

  export const hasManagedScene3DPostProcessingPass = function (
    target: gdjs.Layer
  ): boolean {
    const layerRenderer: any = target.getRenderer();
    if (
      !layerRenderer ||
      typeof layerRenderer.getThreeEffectComposer !== 'function'
    ) {
      return false;
    }
    const composer = layerRenderer.getThreeEffectComposer();
    if (!composer || !composer.passes) {
      return false;
    }
    ensureScene3DPassIds(composer);

    const composerPasses = composer.passes as Array<THREE_ADDONS.Pass & any>;
    return composerPasses.some((pass) => {
      const passId = (pass as any).__scene3dEffectId as string | undefined;
      return (
        !!passId &&
        managedPassOrderMap.has(passId) &&
        (pass as any).enabled !== false
      );
    });
  };
}
