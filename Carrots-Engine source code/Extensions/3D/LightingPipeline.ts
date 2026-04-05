namespace gdjs {
  interface LightingPipelineFilterNetworkSyncData {
    m: string;
    rw: number;
    bw: number;
    pe: boolean;
    pi: number;
    ps: number;
    psc: number;
    pgc: number;
    pscn: boolean;
    am: string;
    ads: number;
    acs: number;
    sqs?: number;
    lds?: number;
    rso: boolean;
    pcl: boolean;
    apt?: boolean;
    tfr?: number;
    mas?: number;
    mal?: number;
    mli?: number;
    shp?: boolean;
    sho?: boolean;
    ssi?: number;
    scd?: number;
    smm?: number;
    svi?: boolean;
    svv?: boolean;
    svt?: number;
    wse?: boolean;
    wsa?: boolean;
    wsl?: number;
    wsp?: number;
    wsw?: boolean;
    wss?: boolean;
    cle?: boolean;
    clx?: number;
    cly?: number;
    clz?: number;
    cln?: number;
    clc?: number;
    cla?: number;
    cls?: number;
    clu?: number;
    clr?: number;
  }

  type LightingPipelineMode = 'realtime' | 'baked' | 'hybrid';
  type LightingAttenuationModel =
    | 'physical'
    | 'balanced'
    | 'cinematic'
    | 'stylized';

  interface SceneLightingPipelineState {
    mode: LightingPipelineMode;
    realtimeWeight: number;
    bakedWeight: number;
    probeEnabled: boolean;
    probeIntensity: number;
    probeSmoothing: number;
    probeSkyColorHex: number;
    probeGroundColorHex: number;
    probeUseSceneColors: boolean;
    attenuationModel: LightingAttenuationModel;
    attenuationDistanceScale: number;
    attenuationDecayScale: number;
    shadowQualityScale: number;
    lodDistanceScale: number;
    realtimeShadowsOnly: boolean;
    physicallyCorrectLights: boolean;
    adaptivePerformanceScale: number;
    lodUpdateIntervalScale: number;
    probeLight: THREE.LightProbe | null;
    probeHemisphereLight: THREE.HemisphereLight | null;
    currentProbeSkyColor: THREE.Color;
    currentProbeGroundColor: THREE.Color;
    cachedProbeTargetSkyColor: THREE.Color;
    cachedProbeTargetGroundColor: THREE.Color;
    probeColorSamplingTimer: number;
    shaderVariantCount: number;
    shaderPendingVariantCount: number;
    shaderCompilePassCount: number;
    shaderLastCompileDurationMs: number;
    shaderCompileInProgress: boolean;
    wasmSimdEnabled: boolean;
    wasmSimdSupported: boolean;
    wasmThreadsSupported: boolean;
    wasmSimdActive: boolean;
    wasmSimdAutoTune: boolean;
    wasmSimdMinLodObjectCount: number;
    wasmSimdMinPhysicsBodyCount: number;
    wasmSimdEnablePhysicsWorkerPreparation: boolean;
    wasmSimdEnablePhysicsSnapshotObjectSync: boolean;
    clusteredLightsEnabled: boolean;
    clusteredGridX: number;
    clusteredGridY: number;
    clusteredGridZ: number;
    clusteredNeighborRadius: number;
    clusteredMaxLightsPerCell: number;
    clusteredMaxActiveLights: number;
    clusteredMaxShadowLights: number;
    clusteredUpdateCadenceMs: number;
    clusteredRangeScale: number;
    clusteredLastUpdateTimeMs: number;
    clusteredManagedLightCount: number;
    clusteredActiveLights: number;
    clusteredCulledLights: number;
    clusteredVisitedClusterCount: number;
  }

  interface ClusteredLightMeta {
    desiredVisible: boolean;
    managed: boolean;
    lastAppliedVisible: boolean;
  }

  interface Scene3DWasmSimdRuntimeConfig {
    enabled: boolean;
    supported: boolean;
    threadsSupported: boolean;
    active: boolean;
    autoTune: boolean;
    minLodObjectCount: number;
    minPhysicsBodyCount: number;
    enablePhysicsWorkerPreparation: boolean;
    enablePhysicsSnapshotObjectSync: boolean;
  }

  const lightingPipelineStateKey = '__gdScene3dLightingPipelineState';
  const lightingProbeHelperFlagKey = '__gdScene3dLightingProbeHelper';
  const scene3DWasmSimdConfigKey = '__gdScene3dWasmSimdConfig';
  const clusteredLightMetaKey = '__gdScene3dClusterMeta';

  const clamp01 = (value: number): number =>
    gdjs.evtTools.common.clamp(0, 1, value);
  const clampNonNegative = (value: number): number => Math.max(0, value);
  const clampShaderWarmupBatchSize = (value: number): number =>
    gdjs.evtTools.common.clamp(
      1,
      12,
      Number.isFinite(value) ? Math.round(value) : 2
    );
  const clampShaderCompileCadenceMs = (value: number): number =>
    gdjs.evtTools.common.clamp(60, 3000, Number.isFinite(value) ? value : 180);
  const clampShaderVariantMultiplier = (value: number): number =>
    gdjs.evtTools.common.clamp(0.5, 4, Number.isFinite(value) ? value : 1);
  const clampShaderValidationThrottleMs = (value: number): number =>
    gdjs.evtTools.common.clamp(250, 30000, Number.isFinite(value) ? value : 1200);
  const clampSimdObjectCountThreshold = (value: number, fallback: number): number =>
    gdjs.evtTools.common.clamp(
      1,
      50000,
      Number.isFinite(value) ? Math.round(value) : fallback
    );
  const clampClusterGridDimension = (value: number, fallback: number): number =>
    gdjs.evtTools.common.clamp(
      2,
      64,
      Number.isFinite(value) ? Math.round(value) : fallback
    );
  const clampClusterNeighborRadius = (value: number): number =>
    gdjs.evtTools.common.clamp(
      0,
      6,
      Number.isFinite(value) ? Math.round(value) : 1
    );
  const clampClusterPerCellLimit = (value: number): number =>
    gdjs.evtTools.common.clamp(
      1,
      16,
      Number.isFinite(value) ? Math.round(value) : 3
    );
  const clampClusterActiveLightLimit = (value: number): number =>
    gdjs.evtTools.common.clamp(
      1,
      256,
      Number.isFinite(value) ? Math.round(value) : 24
    );
  const clampClusterShadowLightLimit = (value: number): number =>
    gdjs.evtTools.common.clamp(
      0,
      64,
      Number.isFinite(value) ? Math.round(value) : 8
    );
  const clampClusterCadenceMs = (value: number): number =>
    gdjs.evtTools.common.clamp(
      16,
      1000,
      Number.isFinite(value) ? value : 80
    );
  const clampClusterRangeScale = (value: number): number =>
    gdjs.evtTools.common.clamp(0.2, 3, Number.isFinite(value) ? value : 1);

  const parseMode = (value: string): LightingPipelineMode => {
    if (value === 'realtime' || value === 'baked' || value === 'hybrid') {
      return value;
    }
    return 'hybrid';
  };

  const parseAttenuationModel = (
    value: string
  ): LightingAttenuationModel => {
    if (
      value === 'physical' ||
      value === 'balanced' ||
      value === 'cinematic' ||
      value === 'stylized'
    ) {
      return value;
    }
    return 'physical';
  };

  const getOrCreatePipelineState = (
    scene: THREE.Scene
  ): SceneLightingPipelineState => {
    const sceneWithPipeline = scene as THREE.Scene & {
      userData: { [key: string]: any };
    };
    sceneWithPipeline.userData = sceneWithPipeline.userData || {};
    const existingState = sceneWithPipeline.userData[
      lightingPipelineStateKey
    ] as SceneLightingPipelineState | undefined;
    if (existingState) {
      return existingState;
    }

    const defaultState: SceneLightingPipelineState = {
      mode: 'hybrid',
      realtimeWeight: 1,
      bakedWeight: 1,
      probeEnabled: true,
      probeIntensity: 0.5,
      probeSmoothing: 2.5,
      probeSkyColorHex: 0xbfd7ff,
      probeGroundColorHex: 0x6d7356,
      probeUseSceneColors: true,
      attenuationModel: 'physical',
      attenuationDistanceScale: 1,
      attenuationDecayScale: 1,
      shadowQualityScale: 1.2,
      lodDistanceScale: 1,
      realtimeShadowsOnly: true,
      physicallyCorrectLights: true,
      adaptivePerformanceScale: 1,
      lodUpdateIntervalScale: 1,
      probeLight: null,
      probeHemisphereLight: null,
      currentProbeSkyColor: new THREE.Color(0xbfd7ff),
      currentProbeGroundColor: new THREE.Color(0x6d7356),
      cachedProbeTargetSkyColor: new THREE.Color(0xbfd7ff),
      cachedProbeTargetGroundColor: new THREE.Color(0x6d7356),
      probeColorSamplingTimer: 0,
      shaderVariantCount: 0,
      shaderPendingVariantCount: 0,
      shaderCompilePassCount: 0,
      shaderLastCompileDurationMs: 0,
      shaderCompileInProgress: false,
      wasmSimdEnabled: true,
      wasmSimdSupported: false,
      wasmThreadsSupported: false,
      wasmSimdActive: false,
      wasmSimdAutoTune: true,
      wasmSimdMinLodObjectCount: 64,
      wasmSimdMinPhysicsBodyCount: 24,
      wasmSimdEnablePhysicsWorkerPreparation: true,
      wasmSimdEnablePhysicsSnapshotObjectSync: true,
      clusteredLightsEnabled: true,
      clusteredGridX: 14,
      clusteredGridY: 8,
      clusteredGridZ: 18,
      clusteredNeighborRadius: 1,
      clusteredMaxLightsPerCell: 3,
      clusteredMaxActiveLights: 24,
      clusteredMaxShadowLights: 8,
      clusteredUpdateCadenceMs: 80,
      clusteredRangeScale: 1,
      clusteredLastUpdateTimeMs: -1,
      clusteredManagedLightCount: 0,
      clusteredActiveLights: 0,
      clusteredCulledLights: 0,
      clusteredVisitedClusterCount: 0,
    };
    sceneWithPipeline.userData[lightingPipelineStateKey] = defaultState;
    return defaultState;
  };

  const getProbeMultiplier = (state: SceneLightingPipelineState): number => {
    if (state.mode === 'realtime') {
      return 0.2;
    }
    if (state.mode === 'baked') {
      return 1;
    }
    return 0.6 + 0.4 * (1 - clamp01(state.realtimeWeight));
  };

  const removeProbeObjects = (
    scene: THREE.Scene,
    state: SceneLightingPipelineState
  ): void => {
    if (state.probeLight) {
      scene.remove(state.probeLight);
      state.probeLight = null;
    }
    if (state.probeHemisphereLight) {
      scene.remove(state.probeHemisphereLight);
      state.probeHemisphereLight = null;
    }
  };

  const ensureProbeObjects = (
    scene: THREE.Scene,
    state: SceneLightingPipelineState
  ): void => {
    if (!state.probeLight) {
      state.probeLight = new THREE.LightProbe();
      (
        state.probeLight as THREE.LightProbe & {
          userData: { [key: string]: any };
        }
      ).userData = {
        [lightingProbeHelperFlagKey]: true,
      };
      scene.add(state.probeLight);
    }
    if (!state.probeHemisphereLight) {
      state.probeHemisphereLight = new THREE.HemisphereLight();
      (
        state.probeHemisphereLight as THREE.HemisphereLight & {
          userData: { [key: string]: any };
        }
      ).userData = {
        [lightingProbeHelperFlagKey]: true,
      };
      state.probeHemisphereLight.position.set(0, 0, 1);
      scene.add(state.probeHemisphereLight);
    }
  };

  const sampleProbeTargetColors = (
    scene: THREE.Scene,
    state: SceneLightingPipelineState
  ): { skyColor: THREE.Color; groundColor: THREE.Color } => {
    if (!state.probeUseSceneColors) {
      return {
        skyColor: new THREE.Color(state.probeSkyColorHex),
        groundColor: new THREE.Color(state.probeGroundColorHex),
      };
    }

    const background = scene.background as THREE.Color | null | undefined;
    if (background && (background as any).isColor) {
      const color = (background as THREE.Color).clone();
      return { skyColor: color.clone(), groundColor: color };
    }

    let sampledHemisphere: THREE.HemisphereLight | null = null;
    scene.traverse(object => {
      if (sampledHemisphere) {
        return;
      }
      const hemisphereLight = object as THREE.HemisphereLight & {
        isHemisphereLight?: boolean;
        userData?: { [key: string]: any };
      };
      if (
        !hemisphereLight.isHemisphereLight ||
        !hemisphereLight.visible ||
        (hemisphereLight.userData &&
          hemisphereLight.userData[lightingProbeHelperFlagKey])
      ) {
        return;
      }
      sampledHemisphere = hemisphereLight;
    });

    if (sampledHemisphere) {
      const hemisphere = sampledHemisphere as THREE.HemisphereLight;
      return {
        skyColor: hemisphere.color.clone(),
        groundColor: hemisphere.groundColor.clone(),
      };
    }

    return {
      skyColor: new THREE.Color(state.probeSkyColorHex),
      groundColor: new THREE.Color(state.probeGroundColorHex),
    };
  };

const updateProbeLighting = (
  scene: THREE.Scene,
  state: SceneLightingPipelineState,
  deltaTime: number
): void => {
    if (!state.probeEnabled || state.probeIntensity <= 0) {
      removeProbeObjects(scene, state);
      return;
    }

    ensureProbeObjects(scene, state);
    if (!state.probeLight || !state.probeHemisphereLight) {
      return;
    }

  const safeDeltaTime = Math.max(0, deltaTime);
  state.probeColorSamplingTimer = Math.max(
    0,
    state.probeColorSamplingTimer - safeDeltaTime
  );
  if (state.probeColorSamplingTimer <= 0) {
    const sampledColors = sampleProbeTargetColors(scene, state);
    state.cachedProbeTargetSkyColor.copy(sampledColors.skyColor);
    state.cachedProbeTargetGroundColor.copy(sampledColors.groundColor);
    const baseSamplingPeriod = state.probeUseSceneColors ? 0.16 : 0.25;
    // During performance pressure, sample less often to reduce per-frame overhead.
    const samplingMultiplier =
      state.adaptivePerformanceScale < 0.75 ? 1.8 : 1;
    state.probeColorSamplingTimer = baseSamplingPeriod * samplingMultiplier;
  }

  const smoothing = Math.max(0, state.probeSmoothing);
  const alpha =
    smoothing <= 0 ? 1 : 1 - Math.exp(-smoothing * safeDeltaTime);

  state.currentProbeSkyColor.lerp(state.cachedProbeTargetSkyColor, alpha);
  state.currentProbeGroundColor.lerp(state.cachedProbeTargetGroundColor, alpha);

    const probeMultiplier = getProbeMultiplier(state);
    const effectiveProbeIntensity =
      clampNonNegative(state.probeIntensity) * probeMultiplier;

    const mixedColor = state.currentProbeSkyColor
      .clone()
      .multiplyScalar(0.65)
      .add(state.currentProbeGroundColor.clone().multiplyScalar(0.35));

    // Approximate an irradiance probe from a constant SH term.
    for (let i = 0; i < 9; i++) {
      state.probeLight.sh.coefficients[i].set(0, 0, 0);
    }
    state.probeLight.sh.coefficients[0].set(
      mixedColor.r * Math.PI,
      mixedColor.g * Math.PI,
      mixedColor.b * Math.PI
    );
    state.probeLight.intensity = effectiveProbeIntensity;
    state.probeLight.visible = effectiveProbeIntensity > 0.0001;

    state.probeHemisphereLight.color.copy(state.currentProbeSkyColor);
    state.probeHemisphereLight.groundColor.copy(state.currentProbeGroundColor);
    state.probeHemisphereLight.intensity = effectiveProbeIntensity * 0.35;
    state.probeHemisphereLight.visible =
      state.probeHemisphereLight.intensity > 0.0001;
  };

  const applyRendererLightingMode = (
    target: EffectsTarget,
    state: SceneLightingPipelineState
  ): void => {
    const runtimeScene = target.getRuntimeScene ? target.getRuntimeScene() : null;
    if (!runtimeScene || !runtimeScene.getGame) {
      return;
    }
    const gameRenderer = runtimeScene.getGame().getRenderer();
    if (!gameRenderer || !(gameRenderer as any).getThreeRenderer) {
      return;
    }
    const threeRenderer = (gameRenderer as any).getThreeRenderer() as
      | THREE.WebGLRenderer
      | null;
    if (!threeRenderer) {
      return;
    }
    const rendererWithLightingMode = threeRenderer as THREE.WebGLRenderer & {
      physicallyCorrectLights?: boolean;
      useLegacyLights?: boolean;
    };
    const shouldUsePhysicalLights = !!state.physicallyCorrectLights;
    if (
      typeof rendererWithLightingMode.physicallyCorrectLights === 'boolean' &&
      rendererWithLightingMode.physicallyCorrectLights !== shouldUsePhysicalLights
    ) {
      rendererWithLightingMode.physicallyCorrectLights =
        shouldUsePhysicalLights;
    }
    if (
      typeof rendererWithLightingMode.useLegacyLights === 'boolean' &&
      rendererWithLightingMode.useLegacyLights === shouldUsePhysicalLights
    ) {
      rendererWithLightingMode.useLegacyLights = !shouldUsePhysicalLights;
    }
  };

  const updateSceneShaderPipelineStats = (
    target: EffectsTarget,
    state: SceneLightingPipelineState
  ): void => {
    if (!(target instanceof gdjs.Layer)) {
      return;
    }
    const shaderStatsGetter = (gdjs as unknown as {
      getScene3DShaderPrecompileStats?: (
        target: gdjs.Layer
      ) => gdjs.Scene3DShaderPipelineStats | null;
    }).getScene3DShaderPrecompileStats;
    if (typeof shaderStatsGetter !== 'function') {
      return;
    }
    const shaderStats = shaderStatsGetter(target);
    if (!shaderStats) {
      return;
    }
    state.shaderVariantCount = shaderStats.variantCount;
    state.shaderPendingVariantCount = shaderStats.pendingVariantCount;
    state.shaderCompilePassCount = shaderStats.compilePassCount;
    state.shaderLastCompileDurationMs = shaderStats.lastCompileDurationMs;
    state.shaderCompileInProgress = shaderStats.compileInProgress;
  };

  const getWasmFeatureSupportSnapshot = (): {
    simdSupported: boolean;
    threadsSupported: boolean;
  } => {
    const runtimeCapabilities = (gdjs as unknown as {
      runtimeCapabilities?: {
        getWasmFeatureSupportSnapshot?: () => {
          simdSupported?: boolean;
          threadsSupported?: boolean;
        };
      };
    }).runtimeCapabilities;
    if (
      runtimeCapabilities &&
      typeof runtimeCapabilities.getWasmFeatureSupportSnapshot === 'function'
    ) {
      const snapshot = runtimeCapabilities.getWasmFeatureSupportSnapshot();
      return {
        simdSupported: !!(snapshot && snapshot.simdSupported),
        threadsSupported: !!(snapshot && snapshot.threadsSupported),
      };
    }
    return {
      simdSupported: false,
      threadsSupported: false,
    };
  };

  export const getScene3DWasmSimdRuntimeConfig = (
    runtimeScene: gdjs.RuntimeScene | null | undefined
  ): Scene3DWasmSimdRuntimeConfig | null => {
    if (!runtimeScene) {
      return null;
    }
    const runtimeSceneAny = runtimeScene as gdjs.RuntimeScene & {
      [scene3DWasmSimdConfigKey]?: unknown;
    };
    const config = runtimeSceneAny[scene3DWasmSimdConfigKey] as
      | Scene3DWasmSimdRuntimeConfig
      | undefined;
    if (!config) {
      return null;
    }
    return { ...config };
  };

  const setScene3DWasmSimdRuntimeConfig = (
    target: EffectsTarget,
    config: Scene3DWasmSimdRuntimeConfig
  ): void => {
    const runtimeScene = target.getRuntimeScene ? target.getRuntimeScene() : null;
    if (!runtimeScene) {
      return;
    }
    const runtimeSceneAny = runtimeScene as gdjs.RuntimeScene & {
      [scene3DWasmSimdConfigKey]?: Scene3DWasmSimdRuntimeConfig;
    };
    runtimeSceneAny[scene3DWasmSimdConfigKey] = {
      ...config,
    };
  };

  interface ClusteredLocalLight extends THREE.Light {
    isPointLight?: boolean;
    isSpotLight?: boolean;
    isRectAreaLight?: boolean;
    intensity?: number;
    distance?: number;
    castShadow?: boolean;
    width?: number;
    height?: number;
    userData?: { [key: string]: any };
  }

  interface ClusteredLocalLightCandidate {
    light: ClusteredLocalLight;
    score: number;
    clusterX: number;
    clusterY: number;
    clusterZ: number;
    isShadowCaster: boolean;
  }

  const clusterTempLightWorldPosition = new THREE.Vector3();
  const clusterTempLightViewPosition = new THREE.Vector3();

  const isClusteredLocalLight = (object: THREE.Object3D): object is ClusteredLocalLight => {
    const light = object as ClusteredLocalLight;
    if (!(light.isPointLight || light.isSpotLight || light.isRectAreaLight)) {
      return false;
    }
    if (light.userData && light.userData[lightingProbeHelperFlagKey]) {
      return false;
    }
    return true;
  };

  const getOrCreateClusteredLightMeta = (
    light: ClusteredLocalLight
  ): ClusteredLightMeta => {
    const lightWithData = light as ClusteredLocalLight & {
      userData: { [key: string]: any };
    };
    lightWithData.userData = lightWithData.userData || {};
    const existingMeta = lightWithData.userData[
      clusteredLightMetaKey
    ] as ClusteredLightMeta | undefined;
    if (existingMeta) {
      return existingMeta;
    }
    const newMeta: ClusteredLightMeta = {
      desiredVisible: !!light.visible,
      managed: false,
      lastAppliedVisible: !!light.visible,
    };
    lightWithData.userData[clusteredLightMetaKey] = newMeta;
    return newMeta;
  };

  const restoreClusteredLocalLightOverrides = (
    scene: THREE.Scene,
    state?: SceneLightingPipelineState
  ): void => {
    let managedLightCount = 0;
    scene.traverse(object => {
      if (!isClusteredLocalLight(object)) {
        return;
      }
      const light = object;
      const meta = getOrCreateClusteredLightMeta(light);
      if (meta.managed) {
        light.visible = !!meta.desiredVisible;
        meta.lastAppliedVisible = !!meta.desiredVisible;
        meta.managed = false;
      }
      managedLightCount++;
    });
    if (state) {
      state.clusteredManagedLightCount = managedLightCount;
      state.clusteredActiveLights = 0;
      state.clusteredCulledLights = 0;
      state.clusteredVisitedClusterCount = 0;
    }
  };

  const getThreeCameraFromEffectTarget = (
    target: EffectsTarget
  ): THREE.Camera | null => {
    if (!(target instanceof gdjs.Layer)) {
      return null;
    }
    const layerRenderer = target.getRenderer() as {
      getThreeCamera?: () => THREE.Camera | null;
    };
    if (!layerRenderer || typeof layerRenderer.getThreeCamera !== 'function') {
      return null;
    }
    return layerRenderer.getThreeCamera() || null;
  };

  const getClusteredLightInfluenceRadius = (
    light: ClusteredLocalLight,
    fallbackDistance: number
  ): number => {
    if (light.isPointLight || light.isSpotLight) {
      const localDistance = Number(light.distance);
      if (Number.isFinite(localDistance) && localDistance > 0) {
        return Math.max(1, localDistance);
      }
      return Math.max(1, fallbackDistance * 0.7);
    }
    if (light.isRectAreaLight) {
      const width = Math.max(1, Number(light.width) || 1);
      const height = Math.max(1, Number(light.height) || 1);
      return Math.max(1, Math.sqrt(width * width + height * height) * 2);
    }
    return Math.max(1, fallbackDistance * 0.6);
  };

  const applyClusteredLocalLights = (
    target: EffectsTarget,
    scene: THREE.Scene,
    state: SceneLightingPipelineState
  ): void => {
    if (!state.clusteredLightsEnabled) {
      restoreClusteredLocalLightOverrides(scene, state);
      return;
    }

    const runtimeScene = target.getRuntimeScene ? target.getRuntimeScene() : null;
    const nowMs = runtimeScene
      ? runtimeScene.getTimeManager().getTimeFromStart()
      : Date.now();
    if (
      state.clusteredLastUpdateTimeMs >= 0 &&
      nowMs - state.clusteredLastUpdateTimeMs < state.clusteredUpdateCadenceMs
    ) {
      return;
    }
    state.clusteredLastUpdateTimeMs = nowMs;

    const camera = getThreeCameraFromEffectTarget(target);
    if (!camera) {
      restoreClusteredLocalLightOverrides(scene, state);
      return;
    }

    camera.updateMatrixWorld();
    if ((camera as { matrixWorldInverse?: THREE.Matrix4 }).matrixWorldInverse) {
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    }

    const perspectiveCamera = camera as THREE.PerspectiveCamera & {
      isPerspectiveCamera?: boolean;
      isOrthographicCamera?: boolean;
    };
    const orthographicCamera = camera as THREE.OrthographicCamera & {
      isPerspectiveCamera?: boolean;
      isOrthographicCamera?: boolean;
    };

    const near = Math.max(0.01, Number((camera as any).near) || 0.1);
    const cameraFar = Number((camera as any).far);
    const fallbackFar =
      Number.isFinite(cameraFar) && cameraFar > near + 1 ? cameraFar : 3000;
    const far = Math.max(
      near + 10,
      fallbackFar * Math.max(0.2, state.clusteredRangeScale)
    );
    const depthSpan = Math.max(1, far - near);
    const gridX = Math.max(2, state.clusteredGridX);
    const gridY = Math.max(2, state.clusteredGridY);
    const gridZ = Math.max(2, state.clusteredGridZ);
    const neighborRadius = Math.max(0, state.clusteredNeighborRadius);
    const centerClusterX = Math.floor((gridX - 1) * 0.5);
    const centerClusterY = Math.floor((gridY - 1) * 0.5);

    const perspectiveFovRad = perspectiveCamera.isPerspectiveCamera
      ? THREE.MathUtils.degToRad(
          Math.max(1, Math.min(179, Number(perspectiveCamera.fov) || 60))
        )
      : 0;
    const perspectiveAspect = perspectiveCamera.isPerspectiveCamera
      ? Math.max(0.01, Number(perspectiveCamera.aspect) || 1)
      : 1;

    const orthoZoom = orthographicCamera.isOrthographicCamera
      ? Math.max(0.0001, Number(orthographicCamera.zoom) || 1)
      : 1;
    const orthoLeft = orthographicCamera.isOrthographicCamera
      ? Number(orthographicCamera.left) / orthoZoom
      : -1;
    const orthoRight = orthographicCamera.isOrthographicCamera
      ? Number(orthographicCamera.right) / orthoZoom
      : 1;
    const orthoTop = orthographicCamera.isOrthographicCamera
      ? Number(orthographicCamera.top) / orthoZoom
      : 1;
    const orthoBottom = orthographicCamera.isOrthographicCamera
      ? Number(orthographicCamera.bottom) / orthoZoom
      : -1;

    const clusterCandidates = new Map<string, ClusteredLocalLightCandidate[]>();
    const allCandidates: ClusteredLocalLightCandidate[] = [];
    const localLights: ClusteredLocalLight[] = [];
    let visibleLocalLights = 0;

    scene.traverse(object => {
      if (!isClusteredLocalLight(object)) {
        return;
      }
      const light = object;
      localLights.push(light);
      const meta = getOrCreateClusteredLightMeta(light);
      if (meta.managed && light.visible !== meta.lastAppliedVisible) {
        meta.desiredVisible = !!light.visible;
        meta.managed = false;
      }
      if (!meta.managed) {
        meta.desiredVisible = !!light.visible;
      }
      if (!meta.desiredVisible) {
        meta.lastAppliedVisible = false;
        return;
      }

      visibleLocalLights++;
      const intensity = Math.max(0, Number(light.intensity) || 0);
      if (intensity <= 0.0001) {
        return;
      }

      light.getWorldPosition(clusterTempLightWorldPosition);
      clusterTempLightViewPosition
        .copy(clusterTempLightWorldPosition)
        .applyMatrix4(camera.matrixWorldInverse);

      const depth = -clusterTempLightViewPosition.z;
      if (!Number.isFinite(depth) || depth < near || depth > far) {
        return;
      }

      let normalizedX = 0.5;
      let normalizedY = 0.5;
      if (perspectiveCamera.isPerspectiveCamera) {
        const halfHeight = Math.max(
          0.0001,
          Math.tan(perspectiveFovRad * 0.5) * depth
        );
        const halfWidth = Math.max(0.0001, halfHeight * perspectiveAspect);
        normalizedX =
          clusterTempLightViewPosition.x / (halfWidth * 2) + 0.5;
        normalizedY =
          clusterTempLightViewPosition.y / (halfHeight * 2) + 0.5;
      } else if (orthographicCamera.isOrthographicCamera) {
        const width = Math.max(0.0001, orthoRight - orthoLeft);
        const height = Math.max(0.0001, orthoTop - orthoBottom);
        normalizedX = (clusterTempLightViewPosition.x - orthoLeft) / width;
        normalizedY = (clusterTempLightViewPosition.y - orthoBottom) / height;
      }
      const normalizedZ = (depth - near) / depthSpan;
      if (
        normalizedX < -0.15 ||
        normalizedX > 1.15 ||
        normalizedY < -0.15 ||
        normalizedY > 1.15 ||
        normalizedZ < 0 ||
        normalizedZ > 1
      ) {
        return;
      }

      const clusterX = gdjs.evtTools.common.clamp(
        0,
        gridX - 1,
        Math.floor(normalizedX * gridX)
      );
      const clusterY = gdjs.evtTools.common.clamp(
        0,
        gridY - 1,
        Math.floor(normalizedY * gridY)
      );
      const clusterZ = gdjs.evtTools.common.clamp(
        0,
        gridZ - 1,
        Math.floor(normalizedZ * gridZ)
      );

      const influenceRadius = getClusteredLightInfluenceRadius(light, far);
      const normalizedDepth = depth / Math.max(1, influenceRadius);
      const clusterDistanceFromViewCenter = Math.sqrt(
        Math.pow((clusterX - centerClusterX) / Math.max(1, centerClusterX + 1), 2) +
          Math.pow((clusterY - centerClusterY) / Math.max(1, centerClusterY + 1), 2)
      );
      const shadowBoost = light.castShadow ? 1.24 : 1;
      const score =
        (intensity * shadowBoost) /
        (1 + normalizedDepth * 1.2 + clusterDistanceFromViewCenter * 0.9);

      const candidate: ClusteredLocalLightCandidate = {
        light,
        score,
        clusterX,
        clusterY,
        clusterZ,
        isShadowCaster: !!light.castShadow,
      };
      allCandidates.push(candidate);

      const clusterKey = `${clusterX}|${clusterY}|${clusterZ}`;
      const existingCandidates = clusterCandidates.get(clusterKey);
      if (existingCandidates) {
        existingCandidates.push(candidate);
      } else {
        clusterCandidates.set(clusterKey, [candidate]);
      }
    });

    const prioritizedCandidates: ClusteredLocalLightCandidate[] = [];
    const selectedLights = new Set<ClusteredLocalLight>();
    const relevantClusterCandidates: ClusteredLocalLightCandidate[] = [];
    let visitedClusterCount = 0;
    for (const [clusterKey, candidatesInCluster] of clusterCandidates) {
      const keyTokens = clusterKey.split('|');
      const clusterX = Number(keyTokens[0]);
      const clusterY = Number(keyTokens[1]);
      const clusterZ = Number(keyTokens[2]);
      const isInNeighborhood =
        Math.abs(clusterX - centerClusterX) <= neighborRadius &&
        Math.abs(clusterY - centerClusterY) <= neighborRadius &&
        clusterZ <= Math.min(gridZ - 1, neighborRadius * 6 + 4);
      if (!isInNeighborhood) {
        continue;
      }
      visitedClusterCount++;
      candidatesInCluster.sort((first, second) => second.score - first.score);
      const localBudget = Math.min(
        candidatesInCluster.length,
        Math.max(1, state.clusteredMaxLightsPerCell)
      );
      for (let index = 0; index < localBudget; index++) {
        relevantClusterCandidates.push(candidatesInCluster[index]);
      }
    }

    if (relevantClusterCandidates.length === 0) {
      allCandidates.sort((first, second) => second.score - first.score);
      const fallbackCount = Math.min(
        allCandidates.length,
        Math.max(1, state.clusteredMaxActiveLights)
      );
      for (let index = 0; index < fallbackCount; index++) {
        relevantClusterCandidates.push(allCandidates[index]);
      }
      visitedClusterCount = clusterCandidates.size;
    }

    relevantClusterCandidates.sort((first, second) => second.score - first.score);
    let shadowLightCount = 0;
    const maxShadowLights = Math.max(0, state.clusteredMaxShadowLights);
    const maxActiveLights = Math.max(1, state.clusteredMaxActiveLights);
    for (const candidate of relevantClusterCandidates) {
      if (prioritizedCandidates.length >= maxActiveLights) {
        break;
      }
      if (candidate.isShadowCaster && shadowLightCount >= maxShadowLights) {
        continue;
      }
      prioritizedCandidates.push(candidate);
      selectedLights.add(candidate.light);
      if (candidate.isShadowCaster) {
        shadowLightCount++;
      }
    }
    if (prioritizedCandidates.length < maxActiveLights) {
      allCandidates.sort((first, second) => second.score - first.score);
      for (const candidate of allCandidates) {
        if (prioritizedCandidates.length >= maxActiveLights) {
          break;
        }
        if (selectedLights.has(candidate.light)) {
          continue;
        }
        if (candidate.isShadowCaster && shadowLightCount >= maxShadowLights) {
          continue;
        }
        prioritizedCandidates.push(candidate);
        selectedLights.add(candidate.light);
        if (candidate.isShadowCaster) {
          shadowLightCount++;
        }
      }
    }

    const activeLights = selectedLights;

    for (const light of localLights) {
      const meta = getOrCreateClusteredLightMeta(light);
      if (!meta.desiredVisible) {
        light.visible = false;
        meta.managed = false;
        meta.lastAppliedVisible = false;
        continue;
      }
      const shouldRemainVisible = activeLights.has(light);
      light.visible = shouldRemainVisible;
      meta.managed = true;
      meta.lastAppliedVisible = shouldRemainVisible;
    }

    state.clusteredManagedLightCount = localLights.length;
    state.clusteredActiveLights = activeLights.size;
    state.clusteredCulledLights = Math.max(
      0,
      visibleLocalLights - state.clusteredActiveLights
    );
    state.clusteredVisitedClusterCount = Math.max(0, visitedClusterCount);
  };

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::LightingPipeline',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }

        return new (class implements gdjs.PixiFiltersTools.Filter {
          private _isEnabled: boolean = false;
          private _mode: LightingPipelineMode;
          private _realtimeWeight: number;
          private _bakedWeight: number;
          private _probeEnabled: boolean;
          private _probeIntensity: number;
          private _probeSmoothing: number;
          private _probeSkyColorHex: number;
          private _probeGroundColorHex: number;
          private _probeUseSceneColors: boolean;
          private _attenuationModel: LightingAttenuationModel;
          private _attenuationDistanceScale: number;
          private _attenuationDecayScale: number;
          private _shadowQualityScale: number;
          private _lodDistanceScale: number;
          private _realtimeShadowsOnly: boolean;
          private _physicallyCorrectLights: boolean;
          private _adaptivePerformanceEnabled: boolean;
          private _targetFrameRate: number;
          private _minAdaptiveShadowQualityScale: number;
          private _minAdaptiveLodDistanceScale: number;
          private _maxAdaptiveLodUpdateIntervalScale: number;
          private _smoothedFrameTimeMs: number;
          private _adaptivePerformanceScale: number;
          private _shaderPrecompileEnabled: boolean;
          private _shaderOptimizePostEffects: boolean;
          private _shaderIncludeSceneVariants: boolean;
          private _shaderWarmupBatchSize: number;
          private _shaderCompileCadenceMs: number;
          private _shaderVariantMultiplier: number;
          private _shaderVerboseValidation: boolean;
          private _shaderValidationThrottleMs: number;
          private _wasmSimdEnabled: boolean;
          private _wasmSimdAutoTune: boolean;
          private _wasmSimdMinLodObjectCount: number;
          private _wasmSimdMinPhysicsBodyCount: number;
          private _wasmSimdEnablePhysicsWorkerPreparation: boolean;
          private _wasmSimdEnablePhysicsSnapshotObjectSync: boolean;
          private _clusteredLightsEnabled: boolean;
          private _clusteredGridX: number;
          private _clusteredGridY: number;
          private _clusteredGridZ: number;
          private _clusteredNeighborRadius: number;
          private _clusteredMaxLightsPerCell: number;
          private _clusteredMaxActiveLights: number;
          private _clusteredMaxShadowLights: number;
          private _clusteredUpdateCadenceMs: number;
          private _clusteredRangeScale: number;

          constructor() {
            this._mode = parseMode(effectData.stringParameters.mode || 'hybrid');
            this._realtimeWeight = clamp01(
              effectData.doubleParameters.realtimeWeight !== undefined
                ? effectData.doubleParameters.realtimeWeight
                : 1
            );
            this._bakedWeight = clampNonNegative(
              effectData.doubleParameters.bakedWeight !== undefined
                ? effectData.doubleParameters.bakedWeight
                : 1
            );
            this._probeEnabled =
              effectData.booleanParameters.probeEnabled === undefined
                ? true
                : !!effectData.booleanParameters.probeEnabled;
            this._probeIntensity = clampNonNegative(
              effectData.doubleParameters.probeIntensity !== undefined
                ? effectData.doubleParameters.probeIntensity
                : 0.5
            );
            this._probeSmoothing = clampNonNegative(
              effectData.doubleParameters.probeSmoothing !== undefined
                ? effectData.doubleParameters.probeSmoothing
                : 2.5
            );
            this._probeSkyColorHex = gdjs.rgbOrHexStringToNumber(
              effectData.stringParameters.probeSkyColor || '191;215;255'
            );
            this._probeGroundColorHex = gdjs.rgbOrHexStringToNumber(
              effectData.stringParameters.probeGroundColor || '109;115;86'
            );
            this._probeUseSceneColors =
              effectData.booleanParameters.probeUseSceneColors === undefined
                ? true
                : !!effectData.booleanParameters.probeUseSceneColors;
            this._attenuationModel = parseAttenuationModel(
              effectData.stringParameters.attenuationModel || 'balanced'
            );
            this._attenuationDistanceScale = clampNonNegative(
              effectData.doubleParameters.attenuationDistanceScale !== undefined
                ? effectData.doubleParameters.attenuationDistanceScale
                : 1
            );
            this._attenuationDecayScale = clampNonNegative(
              effectData.doubleParameters.attenuationDecayScale !== undefined
                ? effectData.doubleParameters.attenuationDecayScale
                : 1
            );
            this._shadowQualityScale = gdjs.evtTools.common.clamp(
              0.35,
              2,
              effectData.doubleParameters.shadowQualityScale !== undefined
                ? effectData.doubleParameters.shadowQualityScale
                : 1.2
            );
            this._lodDistanceScale = gdjs.evtTools.common.clamp(
              0.25,
              4,
              effectData.doubleParameters.lodDistanceScale !== undefined
                ? effectData.doubleParameters.lodDistanceScale
                : 1
            );
            this._realtimeShadowsOnly =
              effectData.booleanParameters.realtimeShadowsOnly === undefined
                ? true
                : !!effectData.booleanParameters.realtimeShadowsOnly;
            this._physicallyCorrectLights =
              effectData.booleanParameters.physicallyCorrectLights === undefined
                ? true
                : !!effectData.booleanParameters.physicallyCorrectLights;
            this._adaptivePerformanceEnabled =
              effectData.booleanParameters.adaptivePerformanceEnabled === undefined
                ? true
                : !!effectData.booleanParameters.adaptivePerformanceEnabled;
            this._targetFrameRate = gdjs.evtTools.common.clamp(
              20,
              240,
              effectData.doubleParameters.targetFrameRate !== undefined
                ? effectData.doubleParameters.targetFrameRate
                : 60
            );
            this._minAdaptiveShadowQualityScale = gdjs.evtTools.common.clamp(
              0.35,
              1,
              effectData.doubleParameters.minAdaptiveShadowQualityScale !==
                undefined
                ? effectData.doubleParameters.minAdaptiveShadowQualityScale
                : 0.75
            );
            this._minAdaptiveLodDistanceScale = gdjs.evtTools.common.clamp(
              0.25,
              1,
              effectData.doubleParameters.minAdaptiveLodDistanceScale !==
                undefined
                ? effectData.doubleParameters.minAdaptiveLodDistanceScale
                : 0.55
            );
            this._maxAdaptiveLodUpdateIntervalScale = gdjs.evtTools.common.clamp(
              1,
              4,
              effectData.doubleParameters.maxAdaptiveLodUpdateIntervalScale !==
                undefined
                ? effectData.doubleParameters.maxAdaptiveLodUpdateIntervalScale
                : 2.2
            );
            this._smoothedFrameTimeMs = 1000 / this._targetFrameRate;
            this._adaptivePerformanceScale = 1;
            this._shaderPrecompileEnabled =
              effectData.booleanParameters.shaderPrecompileEnabled === undefined
                ? true
                : !!effectData.booleanParameters.shaderPrecompileEnabled;
            this._shaderOptimizePostEffects =
              effectData.booleanParameters.shaderOptimizePostEffects === undefined
                ? true
                : !!effectData.booleanParameters.shaderOptimizePostEffects;
            this._shaderIncludeSceneVariants =
              effectData.booleanParameters.shaderIncludeSceneVariants === undefined
                ? true
                : !!effectData.booleanParameters.shaderIncludeSceneVariants;
            this._shaderWarmupBatchSize = clampShaderWarmupBatchSize(
              effectData.doubleParameters.shaderWarmupBatchSize
            );
            this._shaderCompileCadenceMs = clampShaderCompileCadenceMs(
              effectData.doubleParameters.shaderCompileCadenceMs
            );
            this._shaderVariantMultiplier = clampShaderVariantMultiplier(
              effectData.doubleParameters.shaderVariantMultiplier
            );
            this._shaderVerboseValidation =
              effectData.booleanParameters.shaderVerboseValidation === undefined
                ? false
                : !!effectData.booleanParameters.shaderVerboseValidation;
            this._shaderValidationThrottleMs = clampShaderValidationThrottleMs(
              effectData.doubleParameters.shaderValidationThrottleMs
            );
            this._wasmSimdEnabled =
              effectData.booleanParameters.wasmSimdEnabled === undefined
                ? true
                : !!effectData.booleanParameters.wasmSimdEnabled;
            this._wasmSimdAutoTune =
              effectData.booleanParameters.wasmSimdAutoTune === undefined
                ? true
                : !!effectData.booleanParameters.wasmSimdAutoTune;
            this._wasmSimdMinLodObjectCount = clampSimdObjectCountThreshold(
              effectData.doubleParameters.wasmSimdMinLodObjectCount,
              64
            );
            this._wasmSimdMinPhysicsBodyCount = clampSimdObjectCountThreshold(
              effectData.doubleParameters.wasmSimdMinPhysicsBodyCount,
              24
            );
            this._wasmSimdEnablePhysicsWorkerPreparation =
              effectData.booleanParameters.wasmSimdEnablePhysicsWorkerPreparation ===
              undefined
                ? true
                : !!effectData.booleanParameters
                    .wasmSimdEnablePhysicsWorkerPreparation;
            this._wasmSimdEnablePhysicsSnapshotObjectSync =
              effectData.booleanParameters
                .wasmSimdEnablePhysicsSnapshotObjectSync === undefined
                ? true
                : !!effectData.booleanParameters
                    .wasmSimdEnablePhysicsSnapshotObjectSync;
            this._clusteredLightsEnabled =
              effectData.booleanParameters.clusteredLightsEnabled === undefined
                ? true
                : !!effectData.booleanParameters.clusteredLightsEnabled;
            this._clusteredGridX = clampClusterGridDimension(
              effectData.doubleParameters.clusteredGridX,
              14
            );
            this._clusteredGridY = clampClusterGridDimension(
              effectData.doubleParameters.clusteredGridY,
              8
            );
            this._clusteredGridZ = clampClusterGridDimension(
              effectData.doubleParameters.clusteredGridZ,
              18
            );
            this._clusteredNeighborRadius = clampClusterNeighborRadius(
              effectData.doubleParameters.clusteredNeighborRadius
            );
            this._clusteredMaxLightsPerCell = clampClusterPerCellLimit(
              effectData.doubleParameters.clusteredMaxLightsPerCell
            );
            this._clusteredMaxActiveLights = clampClusterActiveLightLimit(
              effectData.doubleParameters.clusteredMaxActiveLights
            );
            this._clusteredMaxShadowLights = clampClusterShadowLightLimit(
              effectData.doubleParameters.clusteredMaxShadowLights
            );
            this._clusteredUpdateCadenceMs = clampClusterCadenceMs(
              effectData.doubleParameters.clusteredUpdateCadenceMs
            );
            this._clusteredRangeScale = clampClusterRangeScale(
              effectData.doubleParameters.clusteredRangeScale
            );

            void target;
          }

          private _getScene(target: EffectsTarget): THREE.Scene | null {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            return scene || null;
          }

          private _applyToScene(target: EffectsTarget, scene: THREE.Scene): void {
            const state = getOrCreatePipelineState(scene);
            state.mode = this._mode;
            state.realtimeWeight = this._realtimeWeight;
            state.bakedWeight = this._bakedWeight;
            state.probeEnabled = this._probeEnabled;
            state.probeIntensity = this._probeIntensity;
            state.probeSmoothing = this._probeSmoothing;
            state.probeSkyColorHex = this._probeSkyColorHex;
            state.probeGroundColorHex = this._probeGroundColorHex;
            state.probeUseSceneColors = this._probeUseSceneColors;
            state.attenuationModel = this._attenuationModel;
            state.attenuationDistanceScale = this._attenuationDistanceScale;
            state.attenuationDecayScale = this._attenuationDecayScale;
            const wasmFeatures = getWasmFeatureSupportSnapshot();
            const wasmSimdSupported = wasmFeatures.simdSupported;
            const wasmThreadsSupported = wasmFeatures.threadsSupported;
            const wasmSimdActive = this._wasmSimdEnabled && wasmSimdSupported;
            const adaptiveScale = this._adaptivePerformanceEnabled
              ? this._adaptivePerformanceScale
              : 1;
            const normalizedAdaptiveScale =
              this._adaptivePerformanceEnabled &&
              this._minAdaptiveShadowQualityScale < 1
                ? gdjs.evtTools.common.clamp(
                    0,
                    1,
                    (adaptiveScale - this._minAdaptiveShadowQualityScale) /
                      (1 - this._minAdaptiveShadowQualityScale)
                  )
                : 1;
            const adaptiveLodDistanceScale =
              this._minAdaptiveLodDistanceScale +
              (1 - this._minAdaptiveLodDistanceScale) * normalizedAdaptiveScale;

            state.shadowQualityScale = gdjs.evtTools.common.clamp(
              0.25,
              2,
              this._shadowQualityScale * adaptiveScale
            );
            state.lodDistanceScale = gdjs.evtTools.common.clamp(
              0.1,
              4,
              this._lodDistanceScale * adaptiveLodDistanceScale
            );
            state.adaptivePerformanceScale = adaptiveScale;
            state.lodUpdateIntervalScale =
              1 +
              (1 - normalizedAdaptiveScale) *
                (this._maxAdaptiveLodUpdateIntervalScale - 1);
            if (wasmSimdActive && this._wasmSimdAutoTune) {
              state.lodUpdateIntervalScale = Math.max(
                1,
                state.lodUpdateIntervalScale * 0.82
              );
            }
            state.realtimeShadowsOnly = this._realtimeShadowsOnly;
            state.physicallyCorrectLights = this._physicallyCorrectLights;
            state.wasmSimdEnabled = this._wasmSimdEnabled;
            state.wasmSimdSupported = wasmSimdSupported;
            state.wasmThreadsSupported = wasmThreadsSupported;
            state.wasmSimdActive = wasmSimdActive;
            state.wasmSimdAutoTune = this._wasmSimdAutoTune;
            state.wasmSimdMinLodObjectCount = this._wasmSimdMinLodObjectCount;
            state.wasmSimdMinPhysicsBodyCount =
              this._wasmSimdMinPhysicsBodyCount;
            state.wasmSimdEnablePhysicsWorkerPreparation =
              this._wasmSimdEnablePhysicsWorkerPreparation;
            state.wasmSimdEnablePhysicsSnapshotObjectSync =
              this._wasmSimdEnablePhysicsSnapshotObjectSync;
            state.clusteredLightsEnabled = this._clusteredLightsEnabled;
            state.clusteredGridX = this._clusteredGridX;
            state.clusteredGridY = this._clusteredGridY;
            state.clusteredGridZ = this._clusteredGridZ;
            state.clusteredNeighborRadius = this._clusteredNeighborRadius;
            state.clusteredMaxLightsPerCell = this._clusteredMaxLightsPerCell;
            state.clusteredMaxActiveLights = this._clusteredMaxActiveLights;
            state.clusteredMaxShadowLights = this._clusteredMaxShadowLights;
            state.clusteredUpdateCadenceMs = this._clusteredUpdateCadenceMs;
            state.clusteredRangeScale = this._clusteredRangeScale;

            setScene3DWasmSimdRuntimeConfig(target, {
              enabled: this._wasmSimdEnabled,
              supported: wasmSimdSupported,
              threadsSupported: wasmThreadsSupported,
              active: wasmSimdActive,
              autoTune: this._wasmSimdAutoTune,
              minLodObjectCount: this._wasmSimdMinLodObjectCount,
              minPhysicsBodyCount: this._wasmSimdMinPhysicsBodyCount,
              enablePhysicsWorkerPreparation:
                this._wasmSimdEnablePhysicsWorkerPreparation,
              enablePhysicsSnapshotObjectSync:
                this._wasmSimdEnablePhysicsSnapshotObjectSync,
            });

            const tunedShaderWarmupBatchSize =
              wasmSimdActive && this._wasmSimdAutoTune
                ? clampShaderWarmupBatchSize(this._shaderWarmupBatchSize + 1)
                : this._shaderWarmupBatchSize;
            const tunedShaderCompileCadenceMs =
              wasmSimdActive && this._wasmSimdAutoTune
                ? clampShaderCompileCadenceMs(this._shaderCompileCadenceMs * 0.85)
                : this._shaderCompileCadenceMs;

            const shaderConfigSetter = (gdjs as unknown as {
              setScene3DShaderPrecompileConfig?: (
                target: gdjs.Layer,
                enabled: boolean,
                optimizePostEffects?: boolean,
                includeSceneVariants?: boolean,
                warmupBatchSize?: number,
                compileCadenceMs?: number,
                variantMultiplier?: number,
                verboseValidation?: boolean,
                validationThrottleMs?: number
              ) => void;
            }).setScene3DShaderPrecompileConfig;
            if (
              target instanceof gdjs.Layer &&
              typeof shaderConfigSetter === 'function'
            ) {
              shaderConfigSetter(
                target,
                this._shaderPrecompileEnabled,
                this._shaderOptimizePostEffects,
                this._shaderIncludeSceneVariants,
                tunedShaderWarmupBatchSize,
                tunedShaderCompileCadenceMs,
                this._shaderVariantMultiplier,
                this._shaderVerboseValidation,
                this._shaderValidationThrottleMs
              );
            }
            applyRendererLightingMode(target, state);
            updateSceneShaderPipelineStats(target, state);
          }

          private _updateAdaptivePerformance(deltaTime: number): void {
            if (!this._adaptivePerformanceEnabled) {
              this._adaptivePerformanceScale = 1;
              return;
            }

            const safeFrameMs = gdjs.evtTools.common.clamp(
              1,
              120,
              Math.max(0, deltaTime) * 1000
            );
            const smoothingAlpha = 1 - Math.exp(-Math.max(0, deltaTime) * 4);
            this._smoothedFrameTimeMs +=
              (safeFrameMs - this._smoothedFrameTimeMs) * smoothingAlpha;

            const targetFrameMs = 1000 / Math.max(20, this._targetFrameRate);
            const rawScale = gdjs.evtTools.common.clamp(
              this._minAdaptiveShadowQualityScale,
              1,
              targetFrameMs / Math.max(targetFrameMs, this._smoothedFrameTimeMs)
            );
            const adaptationRate =
              rawScale < this._adaptivePerformanceScale ? 0.28 : 0.07;
            this._adaptivePerformanceScale +=
              (rawScale - this._adaptivePerformanceScale) * adaptationRate;
            this._adaptivePerformanceScale = gdjs.evtTools.common.clamp(
              this._minAdaptiveShadowQualityScale,
              1,
              this._adaptivePerformanceScale
            );
          }

          isEnabled(target: EffectsTarget): boolean {
            return this._isEnabled;
          }

          setEnabled(target: EffectsTarget, enabled: boolean): boolean {
            if (this._isEnabled === enabled) {
              return true;
            }
            if (enabled) {
              return this.applyEffect(target);
            }
            return this.removeEffect(target);
          }

          applyEffect(target: EffectsTarget): boolean {
            const scene = this._getScene(target);
            if (!scene) {
              return false;
            }
            this._isEnabled = true;
            this._applyToScene(target, scene);
            const state = getOrCreatePipelineState(scene);
            applyClusteredLocalLights(target, scene, state);
            return true;
          }

          removeEffect(target: EffectsTarget): boolean {
            const scene = this._getScene(target);
            if (!scene) {
              this._isEnabled = false;
              return false;
            }
            const state = getOrCreatePipelineState(scene);
            removeProbeObjects(scene, state);
            restoreClusteredLocalLightOverrides(scene);
            const sceneWithPipeline = scene as THREE.Scene & {
              userData: { [key: string]: any };
            };
            if (sceneWithPipeline.userData) {
              delete sceneWithPipeline.userData[lightingPipelineStateKey];
            }
            this._isEnabled = false;
            return true;
          }

          updatePreRender(target: EffectsTarget): any {
            if (!this._isEnabled) {
              return;
            }
            const scene = this._getScene(target);
            if (!scene) {
              return;
            }

            const runtimeScene = target.getRuntimeScene
              ? target.getRuntimeScene()
              : null;
            const deltaTime = runtimeScene
              ? Math.max(0, runtimeScene.getElapsedTime() / 1000)
              : 1 / 60;
            this._updateAdaptivePerformance(deltaTime);
            this._applyToScene(target, scene);
            const state = getOrCreatePipelineState(scene);
            updateProbeLighting(scene, state, deltaTime);
            applyClusteredLocalLights(target, scene, state);
          }

          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'realtimeWeight') {
              this._realtimeWeight = clamp01(value);
            } else if (parameterName === 'bakedWeight') {
              this._bakedWeight = clampNonNegative(value);
            } else if (parameterName === 'probeIntensity') {
              this._probeIntensity = clampNonNegative(value);
            } else if (parameterName === 'probeSmoothing') {
              this._probeSmoothing = clampNonNegative(value);
            } else if (parameterName === 'attenuationDistanceScale') {
              this._attenuationDistanceScale = clampNonNegative(value);
            } else if (parameterName === 'attenuationDecayScale') {
              this._attenuationDecayScale = clampNonNegative(value);
            } else if (parameterName === 'shadowQualityScale') {
              this._shadowQualityScale = gdjs.evtTools.common.clamp(
                0.35,
                2,
                value
              );
            } else if (parameterName === 'lodDistanceScale') {
              this._lodDistanceScale = gdjs.evtTools.common.clamp(
                0.25,
                4,
                value
              );
            } else if (parameterName === 'targetFrameRate') {
              this._targetFrameRate = gdjs.evtTools.common.clamp(20, 240, value);
              this._smoothedFrameTimeMs = 1000 / this._targetFrameRate;
            } else if (parameterName === 'minAdaptiveShadowQualityScale') {
              this._minAdaptiveShadowQualityScale = gdjs.evtTools.common.clamp(
                0.35,
                1,
                value
              );
            } else if (parameterName === 'minAdaptiveLodDistanceScale') {
              this._minAdaptiveLodDistanceScale = gdjs.evtTools.common.clamp(
                0.25,
                1,
                value
              );
            } else if (parameterName === 'maxAdaptiveLodUpdateIntervalScale') {
              this._maxAdaptiveLodUpdateIntervalScale = gdjs.evtTools.common.clamp(
                1,
                4,
                value
              );
            } else if (parameterName === 'shaderWarmupBatchSize') {
              this._shaderWarmupBatchSize = clampShaderWarmupBatchSize(value);
            } else if (parameterName === 'shaderCompileCadenceMs') {
              this._shaderCompileCadenceMs = clampShaderCompileCadenceMs(value);
            } else if (parameterName === 'shaderVariantMultiplier') {
              this._shaderVariantMultiplier = clampShaderVariantMultiplier(value);
            } else if (parameterName === 'shaderValidationThrottleMs') {
              this._shaderValidationThrottleMs = clampShaderValidationThrottleMs(
                value
              );
            } else if (parameterName === 'wasmSimdMinLodObjectCount') {
              this._wasmSimdMinLodObjectCount = clampSimdObjectCountThreshold(
                value,
                64
              );
            } else if (parameterName === 'wasmSimdMinPhysicsBodyCount') {
              this._wasmSimdMinPhysicsBodyCount = clampSimdObjectCountThreshold(
                value,
                24
              );
            } else if (parameterName === 'clusteredGridX') {
              this._clusteredGridX = clampClusterGridDimension(value, 14);
            } else if (parameterName === 'clusteredGridY') {
              this._clusteredGridY = clampClusterGridDimension(value, 8);
            } else if (parameterName === 'clusteredGridZ') {
              this._clusteredGridZ = clampClusterGridDimension(value, 18);
            } else if (parameterName === 'clusteredNeighborRadius') {
              this._clusteredNeighborRadius = clampClusterNeighborRadius(value);
            } else if (parameterName === 'clusteredMaxLightsPerCell') {
              this._clusteredMaxLightsPerCell = clampClusterPerCellLimit(value);
            } else if (parameterName === 'clusteredMaxActiveLights') {
              this._clusteredMaxActiveLights =
                clampClusterActiveLightLimit(value);
            } else if (parameterName === 'clusteredMaxShadowLights') {
              this._clusteredMaxShadowLights =
                clampClusterShadowLightLimit(value);
            } else if (parameterName === 'clusteredUpdateCadenceMs') {
              this._clusteredUpdateCadenceMs = clampClusterCadenceMs(value);
            } else if (parameterName === 'clusteredRangeScale') {
              this._clusteredRangeScale = clampClusterRangeScale(value);
            }
          }

          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'realtimeWeight') {
              return this._realtimeWeight;
            }
            if (parameterName === 'bakedWeight') {
              return this._bakedWeight;
            }
            if (parameterName === 'probeIntensity') {
              return this._probeIntensity;
            }
            if (parameterName === 'probeSmoothing') {
              return this._probeSmoothing;
            }
            if (parameterName === 'attenuationDistanceScale') {
              return this._attenuationDistanceScale;
            }
            if (parameterName === 'attenuationDecayScale') {
              return this._attenuationDecayScale;
            }
            if (parameterName === 'shadowQualityScale') {
              return this._shadowQualityScale;
            }
            if (parameterName === 'lodDistanceScale') {
              return this._lodDistanceScale;
            }
            if (parameterName === 'targetFrameRate') {
              return this._targetFrameRate;
            }
            if (parameterName === 'minAdaptiveShadowQualityScale') {
              return this._minAdaptiveShadowQualityScale;
            }
            if (parameterName === 'minAdaptiveLodDistanceScale') {
              return this._minAdaptiveLodDistanceScale;
            }
            if (parameterName === 'maxAdaptiveLodUpdateIntervalScale') {
              return this._maxAdaptiveLodUpdateIntervalScale;
            }
            if (parameterName === 'shaderWarmupBatchSize') {
              return this._shaderWarmupBatchSize;
            }
            if (parameterName === 'shaderCompileCadenceMs') {
              return this._shaderCompileCadenceMs;
            }
            if (parameterName === 'shaderVariantMultiplier') {
              return this._shaderVariantMultiplier;
            }
            if (parameterName === 'shaderValidationThrottleMs') {
              return this._shaderValidationThrottleMs;
            }
            if (parameterName === 'wasmSimdMinLodObjectCount') {
              return this._wasmSimdMinLodObjectCount;
            }
            if (parameterName === 'wasmSimdMinPhysicsBodyCount') {
              return this._wasmSimdMinPhysicsBodyCount;
            }
            if (parameterName === 'clusteredGridX') {
              return this._clusteredGridX;
            }
            if (parameterName === 'clusteredGridY') {
              return this._clusteredGridY;
            }
            if (parameterName === 'clusteredGridZ') {
              return this._clusteredGridZ;
            }
            if (parameterName === 'clusteredNeighborRadius') {
              return this._clusteredNeighborRadius;
            }
            if (parameterName === 'clusteredMaxLightsPerCell') {
              return this._clusteredMaxLightsPerCell;
            }
            if (parameterName === 'clusteredMaxActiveLights') {
              return this._clusteredMaxActiveLights;
            }
            if (parameterName === 'clusteredMaxShadowLights') {
              return this._clusteredMaxShadowLights;
            }
            if (parameterName === 'clusteredUpdateCadenceMs') {
              return this._clusteredUpdateCadenceMs;
            }
            if (parameterName === 'clusteredRangeScale') {
              return this._clusteredRangeScale;
            }
            return 0;
          }

          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'mode') {
              this._mode = parseMode(value);
            } else if (parameterName === 'attenuationModel') {
              this._attenuationModel = parseAttenuationModel(value);
            } else if (parameterName === 'probeSkyColor') {
              this._probeSkyColorHex = gdjs.rgbOrHexStringToNumber(value);
            } else if (parameterName === 'probeGroundColor') {
              this._probeGroundColorHex = gdjs.rgbOrHexStringToNumber(value);
            }
          }

          updateColorParameter(parameterName: string, value: number): void {
            if (parameterName === 'probeSkyColor') {
              this._probeSkyColorHex = value;
            } else if (parameterName === 'probeGroundColor') {
              this._probeGroundColorHex = value;
            }
          }

          getColorParameter(parameterName: string): number {
            if (parameterName === 'probeSkyColor') {
              return this._probeSkyColorHex;
            }
            if (parameterName === 'probeGroundColor') {
              return this._probeGroundColorHex;
            }
            return 0;
          }

          updateBooleanParameter(parameterName: string, value: boolean): void {
            if (parameterName === 'probeEnabled') {
              this._probeEnabled = value;
            } else if (parameterName === 'probeUseSceneColors') {
              this._probeUseSceneColors = value;
            } else if (parameterName === 'realtimeShadowsOnly') {
              this._realtimeShadowsOnly = value;
            } else if (parameterName === 'physicallyCorrectLights') {
              this._physicallyCorrectLights = value;
            } else if (parameterName === 'adaptivePerformanceEnabled') {
              this._adaptivePerformanceEnabled = value;
            } else if (parameterName === 'shaderPrecompileEnabled') {
              this._shaderPrecompileEnabled = value;
            } else if (parameterName === 'shaderOptimizePostEffects') {
              this._shaderOptimizePostEffects = value;
            } else if (parameterName === 'shaderIncludeSceneVariants') {
              this._shaderIncludeSceneVariants = value;
            } else if (parameterName === 'shaderVerboseValidation') {
              this._shaderVerboseValidation = value;
            } else if (parameterName === 'wasmSimdEnabled') {
              this._wasmSimdEnabled = value;
            } else if (parameterName === 'wasmSimdAutoTune') {
              this._wasmSimdAutoTune = value;
            } else if (parameterName === 'wasmSimdEnablePhysicsWorkerPreparation') {
              this._wasmSimdEnablePhysicsWorkerPreparation = value;
            } else if (
              parameterName === 'wasmSimdEnablePhysicsSnapshotObjectSync'
            ) {
              this._wasmSimdEnablePhysicsSnapshotObjectSync = value;
            } else if (parameterName === 'clusteredLightsEnabled') {
              this._clusteredLightsEnabled = value;
            }
          }

          getNetworkSyncData(): LightingPipelineFilterNetworkSyncData {
            return {
              m: this._mode,
              rw: this._realtimeWeight,
              bw: this._bakedWeight,
              pe: this._probeEnabled,
              pi: this._probeIntensity,
              ps: this._probeSmoothing,
              psc: this._probeSkyColorHex,
              pgc: this._probeGroundColorHex,
              pscn: this._probeUseSceneColors,
              am: this._attenuationModel,
              ads: this._attenuationDistanceScale,
              acs: this._attenuationDecayScale,
              sqs: this._shadowQualityScale,
              lds: this._lodDistanceScale,
              rso: this._realtimeShadowsOnly,
              pcl: this._physicallyCorrectLights,
              apt: this._adaptivePerformanceEnabled,
              tfr: this._targetFrameRate,
              mas: this._minAdaptiveShadowQualityScale,
              mal: this._minAdaptiveLodDistanceScale,
              mli: this._maxAdaptiveLodUpdateIntervalScale,
              shp: this._shaderPrecompileEnabled,
              sho: this._shaderOptimizePostEffects,
              ssi: this._shaderWarmupBatchSize,
              scd: this._shaderCompileCadenceMs,
              smm: this._shaderVariantMultiplier,
              svi: this._shaderIncludeSceneVariants,
              svv: this._shaderVerboseValidation,
              svt: this._shaderValidationThrottleMs,
              wse: this._wasmSimdEnabled,
              wsa: this._wasmSimdAutoTune,
              wsl: this._wasmSimdMinLodObjectCount,
              wsp: this._wasmSimdMinPhysicsBodyCount,
              wsw: this._wasmSimdEnablePhysicsWorkerPreparation,
              wss: this._wasmSimdEnablePhysicsSnapshotObjectSync,
              cle: this._clusteredLightsEnabled,
              clx: this._clusteredGridX,
              cly: this._clusteredGridY,
              clz: this._clusteredGridZ,
              cln: this._clusteredNeighborRadius,
              clc: this._clusteredMaxLightsPerCell,
              cla: this._clusteredMaxActiveLights,
              cls: this._clusteredMaxShadowLights,
              clu: this._clusteredUpdateCadenceMs,
              clr: this._clusteredRangeScale,
            };
          }

          updateFromNetworkSyncData(
            syncData: LightingPipelineFilterNetworkSyncData
          ): void {
            this._mode = parseMode(syncData.m);
            this._realtimeWeight = clamp01(syncData.rw);
            this._bakedWeight = clampNonNegative(syncData.bw);
            this._probeEnabled = !!syncData.pe;
            this._probeIntensity = clampNonNegative(syncData.pi);
            this._probeSmoothing = clampNonNegative(syncData.ps);
            this._probeSkyColorHex = syncData.psc;
            this._probeGroundColorHex = syncData.pgc;
            this._probeUseSceneColors = !!syncData.pscn;
            this._attenuationModel = parseAttenuationModel(syncData.am);
            this._attenuationDistanceScale = clampNonNegative(syncData.ads);
            this._attenuationDecayScale = clampNonNegative(syncData.acs);
            this._shadowQualityScale = gdjs.evtTools.common.clamp(
              0.35,
              2,
              syncData.sqs !== undefined ? syncData.sqs : 1.2
            );
            this._lodDistanceScale = gdjs.evtTools.common.clamp(
              0.25,
              4,
              syncData.lds !== undefined ? syncData.lds : 1
            );
            this._realtimeShadowsOnly = !!syncData.rso;
            this._physicallyCorrectLights = !!syncData.pcl;
            this._adaptivePerformanceEnabled =
              syncData.apt === undefined ? true : !!syncData.apt;
            this._targetFrameRate = gdjs.evtTools.common.clamp(
              20,
              240,
              syncData.tfr !== undefined ? syncData.tfr : 60
            );
            this._smoothedFrameTimeMs = 1000 / this._targetFrameRate;
            this._minAdaptiveShadowQualityScale = gdjs.evtTools.common.clamp(
              0.35,
              1,
              syncData.mas !== undefined ? syncData.mas : 0.75
            );
            this._minAdaptiveLodDistanceScale = gdjs.evtTools.common.clamp(
              0.25,
              1,
              syncData.mal !== undefined ? syncData.mal : 0.55
            );
            this._maxAdaptiveLodUpdateIntervalScale = gdjs.evtTools.common.clamp(
              1,
              4,
              syncData.mli !== undefined ? syncData.mli : 2.2
            );
            this._shaderPrecompileEnabled =
              syncData.shp === undefined ? true : !!syncData.shp;
            this._shaderOptimizePostEffects =
              syncData.sho === undefined ? true : !!syncData.sho;
            this._shaderIncludeSceneVariants =
              syncData.svi === undefined ? true : !!syncData.svi;
            this._shaderWarmupBatchSize = clampShaderWarmupBatchSize(
              syncData.ssi !== undefined ? syncData.ssi : 2
            );
            this._shaderCompileCadenceMs = clampShaderCompileCadenceMs(
              syncData.scd !== undefined ? syncData.scd : 180
            );
            this._shaderVariantMultiplier = clampShaderVariantMultiplier(
              syncData.smm !== undefined ? syncData.smm : 1
            );
            this._shaderVerboseValidation = !!syncData.svv;
            this._shaderValidationThrottleMs = clampShaderValidationThrottleMs(
              syncData.svt !== undefined ? syncData.svt : 1200
            );
            this._wasmSimdEnabled =
              syncData.wse === undefined ? true : !!syncData.wse;
            this._wasmSimdAutoTune =
              syncData.wsa === undefined ? true : !!syncData.wsa;
            this._wasmSimdMinLodObjectCount = clampSimdObjectCountThreshold(
              syncData.wsl !== undefined ? syncData.wsl : 64,
              64
            );
            this._wasmSimdMinPhysicsBodyCount = clampSimdObjectCountThreshold(
              syncData.wsp !== undefined ? syncData.wsp : 24,
              24
            );
            this._wasmSimdEnablePhysicsWorkerPreparation =
              syncData.wsw === undefined ? true : !!syncData.wsw;
            this._wasmSimdEnablePhysicsSnapshotObjectSync =
              syncData.wss === undefined ? true : !!syncData.wss;
            this._clusteredLightsEnabled =
              syncData.cle === undefined ? true : !!syncData.cle;
            this._clusteredGridX = clampClusterGridDimension(
              syncData.clx !== undefined ? syncData.clx : 14,
              14
            );
            this._clusteredGridY = clampClusterGridDimension(
              syncData.cly !== undefined ? syncData.cly : 8,
              8
            );
            this._clusteredGridZ = clampClusterGridDimension(
              syncData.clz !== undefined ? syncData.clz : 18,
              18
            );
            this._clusteredNeighborRadius = clampClusterNeighborRadius(
              syncData.cln !== undefined ? syncData.cln : 1
            );
            this._clusteredMaxLightsPerCell = clampClusterPerCellLimit(
              syncData.clc !== undefined ? syncData.clc : 3
            );
            this._clusteredMaxActiveLights = clampClusterActiveLightLimit(
              syncData.cla !== undefined ? syncData.cla : 24
            );
            this._clusteredMaxShadowLights = clampClusterShadowLightLimit(
              syncData.cls !== undefined ? syncData.cls : 8
            );
            this._clusteredUpdateCadenceMs = clampClusterCadenceMs(
              syncData.clu !== undefined ? syncData.clu : 80
            );
            this._clusteredRangeScale = clampClusterRangeScale(
              syncData.clr !== undefined ? syncData.clr : 1
            );
          }
        })();
      }
    })()
  );
}
