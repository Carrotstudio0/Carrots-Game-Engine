namespace gdjs {
  const DEFAULT_MAX_ACTIVE_SPOT_LIGHTS = 8;

  const clampSpotLightAngle = (value: number): number =>
    Math.max(1, Math.min(89, value));

  const clampShadowQuality = (value: string): 'low' | 'medium' | 'high' => {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'low' || normalized === 'high') {
      return normalized;
    }
    return 'medium';
  };

  const shadowQualityToMapSize = (quality: string): integer => {
    const normalized = clampShadowQuality(quality);
    if (normalized === 'low') {
      return 512;
    }
    if (normalized === 'high') {
      return 2048;
    }
    return 1024;
  };

  const sanitizeLayerName = (layerName: string): string => layerName || '';

  interface LightingPipelineState {
    mode?: string;
    realtimeWeight?: number;
    attenuationModel?: string;
    attenuationDistanceScale?: number;
    attenuationDecayScale?: number;
    realtimeShadowsOnly?: boolean;
    physicallyCorrectLights?: boolean;
    shadowQualityScale?: number;
  }

  const lightingPipelineStateKey = '__gdScene3dLightingPipelineState';

  const getLightingPipelineState = (
    scene: THREE.Scene | null | undefined
  ): LightingPipelineState | null => {
    if (!scene) {
      return null;
    }
    const state = (scene as THREE.Scene & {
      userData?: { [key: string]: any };
    }).userData?.[lightingPipelineStateKey] as LightingPipelineState | undefined;
    return state || null;
  };

  const getRealtimeLightingMultiplier = (
    state: LightingPipelineState | null
  ): number => {
    if (!state || !state.mode) {
      return 1;
    }
    if (state.mode === 'realtime') {
      return 1;
    }
    if (state.mode === 'baked') {
      return 0;
    }
    return gdjs.evtTools.common.clamp(
      0,
      1,
      state.realtimeWeight !== undefined ? state.realtimeWeight : 1
    );
  };

  const shouldUseRealtimeShadows = (
    state: LightingPipelineState | null,
    realtimeMultiplier: number
  ): boolean => {
    if (!state || state.realtimeShadowsOnly === undefined) {
      return true;
    }
    if (!state.realtimeShadowsOnly) {
      return true;
    }
    return realtimeMultiplier > 0.02;
  };

  const getAttenuationModelMultipliers = (
    model: string
  ): { distanceScale: number; decayScale: number } => {
    if (model === 'cinematic') {
      return { distanceScale: 1.35, decayScale: 0.75 };
    }
    if (model === 'stylized') {
      return { distanceScale: 1.6, decayScale: 0.55 };
    }
    if (model === 'physical') {
      return { distanceScale: 1, decayScale: 1 };
    }
    return { distanceScale: 1.12, decayScale: 0.9 };
  };

  const computePipelineAttenuation = (
    distance: number,
    decay: number,
    state: LightingPipelineState | null
  ): { distance: number; decay: number } => {
    if (!state) {
      return { distance: Math.max(0, distance), decay: Math.max(0, decay) };
    }
    const modelMultipliers = getAttenuationModelMultipliers(
      state.attenuationModel || 'balanced'
    );
    const distanceScale =
      Math.max(0, state.attenuationDistanceScale ?? 1) *
      modelMultipliers.distanceScale;
    const decayScale =
      Math.max(0, state.attenuationDecayScale ?? 1) * modelMultipliers.decayScale;
    return {
      distance: distance > 0 ? Math.max(0, distance * distanceScale) : 0,
      decay: Math.max(0, decay * decayScale),
    };
  };

  let lightSelectionIconTexture: THREE.Texture | null = null;
  const getLightSelectionIconTexture = (): THREE.Texture => {
    if (lightSelectionIconTexture) {
      return lightSelectionIconTexture;
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'rgba(0,0,0,0)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.strokeStyle = '#ffffff';
        context.lineWidth = 8;
        context.beginPath();
        context.arc(64, 56, 18, Math.PI, Math.PI * 2);
        context.stroke();

        context.beginPath();
        context.moveTo(46, 56);
        context.lineTo(64, 102);
        context.lineTo(82, 56);
        context.closePath();
        context.stroke();

        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(64, 44, 11, 0, Math.PI * 2);
        context.fill();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      if ('colorSpace' in texture && THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      lightSelectionIconTexture = texture;
      return lightSelectionIconTexture;
    }

    const fallbackData = new Uint8Array([255, 255, 255, 255]);
    const fallbackTexture = new THREE.DataTexture(fallbackData, 1, 1);
    fallbackTexture.needsUpdate = true;
    lightSelectionIconTexture = fallbackTexture;
    return lightSelectionIconTexture;
  };

  const createInvisibleSelectionProxyMaterial = (): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

  const createSelectionProxyMaterials = (): {
    materials: THREE.Material[];
    logoFaceMaterial: THREE.MeshBasicMaterial;
  } => {
    const logoFaceMaterial = new THREE.MeshBasicMaterial({
      map: getLightSelectionIconTexture(),
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // BoxGeometry material groups: +X, -X, +Y, -Y, +Z, -Z.
    // Keep logo on +X side to match professional editors.
    const materials: THREE.Material[] = [
      logoFaceMaterial,
      createInvisibleSelectionProxyMaterial(),
      createInvisibleSelectionProxyMaterial(),
      createInvisibleSelectionProxyMaterial(),
      createInvisibleSelectionProxyMaterial(),
      createInvisibleSelectionProxyMaterial(),
    ];
    return {
      materials,
      logoFaceMaterial,
    };
  };

  interface SpotLightGuardrailsState {
    lights: Set<gdjs.SpotLightRuntimeObject>;
    maxActiveByLayerName: Map<string, integer>;
    lastUpdateTimeFromStartMs: number;
  }

  const spotLightGuardrailsStateByRuntimeScene = new WeakMap<
    gdjs.RuntimeScene,
    SpotLightGuardrailsState
  >();

  const getOrCreateGuardrailsState = (
    runtimeScene: gdjs.RuntimeScene
  ): SpotLightGuardrailsState => {
    const existingState =
      spotLightGuardrailsStateByRuntimeScene.get(runtimeScene);
    if (existingState) {
      return existingState;
    }

    const newState: SpotLightGuardrailsState = {
      lights: new Set(),
      maxActiveByLayerName: new Map(),
      lastUpdateTimeFromStartMs: -1,
    };
    spotLightGuardrailsStateByRuntimeScene.set(runtimeScene, newState);
    return newState;
  };

  export namespace scene3d {
    export namespace spotLights {
      export const registerSpotLight = (
        light: gdjs.SpotLightRuntimeObject
      ): void => {
        const runtimeScene = light.getRuntimeScene();
        const state = getOrCreateGuardrailsState(runtimeScene);
        state.lights.add(light);
      };

      export const unregisterSpotLight = (
        light: gdjs.SpotLightRuntimeObject
      ): void => {
        const runtimeScene = light.getRuntimeScene();
        const state = spotLightGuardrailsStateByRuntimeScene.get(runtimeScene);
        if (!state) {
          return;
        }
        state.lights.delete(light);
      };

      export const setMaxActiveSpotLights = (
        runtimeScene: gdjs.RuntimeScene,
        layerName: string,
        maxActiveSpotLights: number
      ): void => {
        const state = getOrCreateGuardrailsState(runtimeScene);
        const safeMax = Math.max(0, Math.floor(maxActiveSpotLights));
        state.maxActiveByLayerName.set(sanitizeLayerName(layerName), safeMax);
      };

      export const getMaxActiveSpotLights = (
        runtimeScene: gdjs.RuntimeScene,
        layerName: string
      ): number => {
        const state = getOrCreateGuardrailsState(runtimeScene);
        const configuredMax = state.maxActiveByLayerName.get(
          sanitizeLayerName(layerName)
        );
        if (configuredMax === undefined) {
          return DEFAULT_MAX_ACTIVE_SPOT_LIGHTS;
        }
        return configuredMax;
      };

      export const updateGuardrailsForScene = (
        runtimeScene: gdjs.RuntimeScene
      ): void => {
        const state = spotLightGuardrailsStateByRuntimeScene.get(runtimeScene);
        if (!state) {
          return;
        }

        const timeFromStart = runtimeScene.getTimeManager().getTimeFromStart();
        if (state.lastUpdateTimeFromStartMs === timeFromStart) {
          return;
        }
        state.lastUpdateTimeFromStartMs = timeFromStart;

        const spotLightsByLayerName = new Map<
          string,
          gdjs.SpotLightRuntimeObject[]
        >();

        for (const spotLight of state.lights) {
          if (!spotLight.shouldUseGuardrails()) {
            spotLight.setGuardrailActive(true);
            continue;
          }

          const layerName = sanitizeLayerName(spotLight.getLayer());
          const lights = spotLightsByLayerName.get(layerName);
          if (lights) {
            lights.push(spotLight);
          } else {
            spotLightsByLayerName.set(layerName, [spotLight]);
          }
        }

        for (const [layerName, lights] of spotLightsByLayerName) {
          if (lights.length === 0) {
            continue;
          }

          if (!runtimeScene.hasLayer(layerName)) {
            for (const light of lights) {
              light.setGuardrailActive(false);
            }
            continue;
          }

          const layer = runtimeScene.getLayer(layerName);
          const cameraX = layer.getCameraX();
          const cameraY = layer.getCameraY();
          const cameraZ = layer.getCameraZ(
            layer.getInitialCamera3DFieldOfView()
          );

          lights.sort(
            (firstLight, secondLight) =>
              firstLight.getDistanceToCameraSquared(cameraX, cameraY, cameraZ) -
              secondLight.getDistanceToCameraSquared(cameraX, cameraY, cameraZ)
          );

          const maxActiveLights = getMaxActiveSpotLights(
            runtimeScene,
            layerName
          );

          for (let index = 0; index < lights.length; index++) {
            lights[index].setGuardrailActive(index < maxActiveLights);
          }
        }
      };
    }
  }

  export interface SpotLightObjectData extends Object3DData {
    content: Object3DDataContent & {
      enabled: boolean | undefined;
      color: string;
      intensity: number | undefined;
      distance: number | undefined;
      angle: number | undefined;
      penumbra: number | undefined;
      decay: number | undefined;
      castShadow: boolean | undefined;
      shadowQuality: 'low' | 'medium' | 'high' | undefined;
      shadowBias: number | undefined;
      shadowNormalBias: number | undefined;
      shadowRadius: number | undefined;
      shadowNear: number | undefined;
      shadowFar: number | undefined;
      guardrailsEnabled: boolean | undefined;
      enableTargetHandle: boolean | undefined;
      targetOffsetX: number | undefined;
      targetOffsetY: number | undefined;
      targetOffsetZ: number | undefined;
      usePhysicalUnits: boolean | undefined;
      power: number | undefined;
      shadowAutoTuning: boolean | undefined;
      physicsBounceEnabled: boolean | undefined;
      physicsBounceIntensityScale: number | undefined;
      physicsBounceDistance: number | undefined;
      physicsBounceOriginOffset: number | undefined;
      physicsBounceCastShadow: boolean | undefined;
      physicsBounceUseSurfaceResponse: boolean | undefined;
      physicsBounceSurfaceTintStrength: number | undefined;
      physicsBounceSurfaceEnergyScale: number | undefined;
    };
  }

  type SpotLightObjectNetworkSyncDataType = {
    en: boolean;
    c: string;
    i: number;
    d: number;
    a: number;
    p: number;
    dc: number;
    cs: boolean;
    sq: 'low' | 'medium' | 'high';
    sb: number;
    snb: number;
    sr: number;
    sn: number;
    sf: number;
    ge: boolean;
    ga: boolean;
    uth: boolean;
    tx: number;
    ty: number;
    tz: number;
    uph: boolean;
    pw: number;
    sat: boolean;
    pbe: boolean;
    pbi: number;
    pbd: number;
    pbo: number;
    pbc: boolean;
    pbsr: boolean;
    pbst: number;
    pbse: number;
  };

  type SpotLightObjectNetworkSyncData = Object3DNetworkSyncData &
    SpotLightObjectNetworkSyncDataType;

  export class SpotLightRuntimeObject extends gdjs.RuntimeObject3D {
    private _renderer: gdjs.SpotLightRuntimeObjectRenderer;

    private _enabled: boolean;
    private _color: string;
    private _intensity: number;
    private _distance: number;
    private _angle: number;
    private _penumbra: number;
    private _decay: number;
    private _castShadow: boolean;
    private _shadowQuality: 'low' | 'medium' | 'high';
    private _shadowBias: number;
    private _shadowNormalBias: number;
    private _shadowRadius: number;
    private _shadowNear: number;
    private _shadowFar: number;
    private _guardrailsEnabled: boolean;
    private _guardrailActive: boolean;
    private _useTargetHandle: boolean;
    private _targetOffsetX: number;
    private _targetOffsetY: number;
    private _targetOffsetZ: number;
    private _usePhysicalUnits: boolean;
    private _power: number;
    private _shadowAutoTuningEnabled: boolean;
    private _physicsBounceEnabled: boolean;
    private _physicsBounceIntensityScale: number;
    private _physicsBounceDistance: number;
    private _physicsBounceOriginOffset: number;
    private _physicsBounceCastShadow: boolean;
    private _physicsBounceUseSurfaceResponse: boolean;
    private _physicsBounceSurfaceTintStrength: number;
    private _physicsBounceSurfaceEnergyScale: number;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: SpotLightObjectData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);

      const objectContent = objectData.content;
      this._enabled =
        objectContent.enabled === undefined ? true : !!objectContent.enabled;
      this._color = objectContent.color || '255;255;255';
      this._intensity = Math.max(
        0,
        objectContent.intensity !== undefined ? objectContent.intensity : 2.2
      );
      this._distance = Math.max(
        0,
        objectContent.distance !== undefined ? objectContent.distance : 950
      );
      this._angle = clampSpotLightAngle(
        objectContent.angle !== undefined ? objectContent.angle : 40
      );
      this._penumbra = Math.max(
        0,
        Math.min(
          1,
          objectContent.penumbra !== undefined ? objectContent.penumbra : 0.22
        )
      );
      this._decay = Math.max(
        0,
        objectContent.decay !== undefined ? objectContent.decay : 2
      );
      this._castShadow = !!objectContent.castShadow;
      this._shadowQuality = clampShadowQuality(
        objectContent.shadowQuality || 'high'
      );
      this._shadowBias =
        objectContent.shadowBias !== undefined
          ? objectContent.shadowBias
          : 0.001;
      this._shadowNormalBias = Math.max(
        0,
        objectContent.shadowNormalBias !== undefined
          ? objectContent.shadowNormalBias
          : 0.02
      );
      this._shadowRadius = Math.max(
        0,
        objectContent.shadowRadius !== undefined
          ? objectContent.shadowRadius
          : 2
      );
      this._shadowNear = Math.max(
        0.01,
        objectContent.shadowNear !== undefined ? objectContent.shadowNear : 1
      );
      this._shadowFar = Math.max(
        this._shadowNear + 1,
        objectContent.shadowFar !== undefined ? objectContent.shadowFar : 2000
      );
      this._guardrailsEnabled =
        objectContent.guardrailsEnabled === undefined
          ? true
          : !!objectContent.guardrailsEnabled;
      this._guardrailActive = true;
      this._useTargetHandle =
        objectContent.enableTargetHandle === undefined
          ? true
          : !!objectContent.enableTargetHandle;
      this._targetOffsetX =
        objectContent.targetOffsetX !== undefined ? objectContent.targetOffsetX : 0;
      this._targetOffsetY =
        objectContent.targetOffsetY !== undefined ? objectContent.targetOffsetY : 0;
      this._targetOffsetZ =
        objectContent.targetOffsetZ !== undefined
          ? objectContent.targetOffsetZ
          : -(this._distance > 0 ? this._distance : 950);
      this._usePhysicalUnits =
        objectContent.usePhysicalUnits === undefined
          ? true
          : !!objectContent.usePhysicalUnits;
      this._power = Math.max(
        0,
        objectContent.power !== undefined ? objectContent.power : 3200
      );
      this._shadowAutoTuningEnabled =
        objectContent.shadowAutoTuning === undefined
          ? true
          : !!objectContent.shadowAutoTuning;
      this._physicsBounceEnabled = !!objectContent.physicsBounceEnabled;
      this._physicsBounceIntensityScale = Math.max(
        0,
        objectContent.physicsBounceIntensityScale !== undefined
          ? objectContent.physicsBounceIntensityScale
          : 0.35
      );
      this._physicsBounceDistance = Math.max(
        1,
        objectContent.physicsBounceDistance !== undefined
          ? objectContent.physicsBounceDistance
          : 380
      );
      this._physicsBounceOriginOffset = Math.max(
        0,
        objectContent.physicsBounceOriginOffset !== undefined
          ? objectContent.physicsBounceOriginOffset
          : 2
      );
      this._physicsBounceCastShadow = !!objectContent.physicsBounceCastShadow;
      this._physicsBounceUseSurfaceResponse =
        objectContent.physicsBounceUseSurfaceResponse === undefined
          ? true
          : !!objectContent.physicsBounceUseSurfaceResponse;
      this._physicsBounceSurfaceTintStrength = gdjs.evtTools.common.clamp(
        0,
        1,
        objectContent.physicsBounceSurfaceTintStrength !== undefined
          ? objectContent.physicsBounceSurfaceTintStrength
          : 0.75
      );
      this._physicsBounceSurfaceEnergyScale = Math.max(
        0,
        objectContent.physicsBounceSurfaceEnergyScale !== undefined
          ? objectContent.physicsBounceSurfaceEnergyScale
          : 1
      );

      this._renderer = new gdjs.SpotLightRuntimeObjectRenderer(
        this,
        instanceContainer
      );
      this._applyAllPropertiesToRenderer();

      gdjs.scene3d.spotLights.registerSpotLight(this);

      this.onCreated();
    }

    getRenderer(): gdjs.RuntimeObject3DRenderer {
      return this._renderer;
    }

    private _applyAllPropertiesToRenderer(): void {
      this._renderer.setColor(this._color);
      this._renderer.setIntensity(this._intensity);
      this._renderer.setDistance(this._distance);
      this._renderer.setAngle(this._angle);
      this._renderer.setPenumbra(this._penumbra);
      this._renderer.setDecay(this._decay);
      this._renderer.setCastShadow(this._castShadow);
      this._renderer.setShadowMapSize(
        shadowQualityToMapSize(this._shadowQuality)
      );
      this._renderer.setShadowBias(this._shadowBias);
      this._renderer.setShadowNormalBias(this._shadowNormalBias);
      this._renderer.setShadowRadius(this._shadowRadius);
      this._renderer.setShadowNear(this._shadowNear);
      this._renderer.setShadowFar(this._shadowFar);
      this._renderer.setRuntimeEnabled(this._enabled);
      this._renderer.setGuardrailActive(
        !this._guardrailsEnabled || this._guardrailActive
      );
      this._renderer.setUseTargetHandle(this._useTargetHandle);
      this._renderer.setTargetOffset(
        this._targetOffsetX,
        this._targetOffsetY,
        this._targetOffsetZ
      );
      this._renderer.setUsePhysicalUnits(this._usePhysicalUnits);
      this._renderer.setPower(this._power);
      this._renderer.setShadowAutoTuning(this._shadowAutoTuningEnabled);
      this._renderer.setPhysicsBounceEnabled(this._physicsBounceEnabled);
      this._renderer.setPhysicsBounceIntensityScale(
        this._physicsBounceIntensityScale
      );
      this._renderer.setPhysicsBounceDistance(this._physicsBounceDistance);
      this._renderer.setPhysicsBounceOriginOffset(this._physicsBounceOriginOffset);
      this._renderer.setPhysicsBounceCastShadow(this._physicsBounceCastShadow);
      this._renderer.setPhysicsBounceUseSurfaceResponse(
        this._physicsBounceUseSurfaceResponse
      );
      this._renderer.setPhysicsBounceSurfaceTintStrength(
        this._physicsBounceSurfaceTintStrength
      );
      this._renderer.setPhysicsBounceSurfaceEnergyScale(
        this._physicsBounceSurfaceEnergyScale
      );
    }

    override updateFromObjectData(
      oldObjectData: SpotLightObjectData,
      newObjectData: SpotLightObjectData
    ): boolean {
      super.updateFromObjectData(oldObjectData, newObjectData);

      const objectContent = newObjectData.content;
      this.setEnabled(
        objectContent.enabled === undefined ? true : !!objectContent.enabled
      );
      this.setColor(objectContent.color || '255;255;255');
      this.setIntensity(
        objectContent.intensity !== undefined ? objectContent.intensity : 2.2
      );
      this.setDistance(
        objectContent.distance !== undefined ? objectContent.distance : 950
      );
      this.setConeAngle(
        objectContent.angle !== undefined ? objectContent.angle : 40
      );
      this.setPenumbra(
        objectContent.penumbra !== undefined ? objectContent.penumbra : 0.22
      );
      this.setDecay(
        objectContent.decay !== undefined ? objectContent.decay : 2
      );
      this.setCastShadow(!!objectContent.castShadow);
      this.setShadowQuality(objectContent.shadowQuality || 'high');
      this.setShadowBias(
        objectContent.shadowBias !== undefined
          ? objectContent.shadowBias
          : 0.001
      );
      this.setShadowNormalBias(
        objectContent.shadowNormalBias !== undefined
          ? objectContent.shadowNormalBias
          : 0.02
      );
      this.setShadowRadius(
        objectContent.shadowRadius !== undefined
          ? objectContent.shadowRadius
          : 2
      );
      this.setShadowNear(
        objectContent.shadowNear !== undefined ? objectContent.shadowNear : 1
      );
      this.setShadowFar(
        objectContent.shadowFar !== undefined ? objectContent.shadowFar : 2000
      );
      this.setGuardrailsEnabled(
        objectContent.guardrailsEnabled === undefined
          ? true
          : !!objectContent.guardrailsEnabled
      );
      this.setUseTargetHandle(
        objectContent.enableTargetHandle === undefined
          ? true
          : !!objectContent.enableTargetHandle
      );
      this.setTargetOffset(
        objectContent.targetOffsetX !== undefined ? objectContent.targetOffsetX : 0,
        objectContent.targetOffsetY !== undefined ? objectContent.targetOffsetY : 0,
        objectContent.targetOffsetZ !== undefined
          ? objectContent.targetOffsetZ
          : -(this._distance > 0 ? this._distance : 950)
      );
      this.setUsePhysicalUnits(
        objectContent.usePhysicalUnits === undefined
          ? true
          : !!objectContent.usePhysicalUnits
      );
      this.setPower(objectContent.power !== undefined ? objectContent.power : 3200);
      this.setShadowAutoTuning(
        objectContent.shadowAutoTuning === undefined
          ? true
          : !!objectContent.shadowAutoTuning
      );
      this.setPhysicsBounceEnabled(!!objectContent.physicsBounceEnabled);
      this.setPhysicsBounceIntensityScale(
        objectContent.physicsBounceIntensityScale !== undefined
          ? objectContent.physicsBounceIntensityScale
          : 0.35
      );
      this.setPhysicsBounceDistance(
        objectContent.physicsBounceDistance !== undefined
          ? objectContent.physicsBounceDistance
          : 380
      );
      this.setPhysicsBounceOriginOffset(
        objectContent.physicsBounceOriginOffset !== undefined
          ? objectContent.physicsBounceOriginOffset
          : 2
      );
      this.setPhysicsBounceCastShadow(!!objectContent.physicsBounceCastShadow);
      this.setPhysicsBounceUseSurfaceResponse(
        objectContent.physicsBounceUseSurfaceResponse === undefined
          ? true
          : !!objectContent.physicsBounceUseSurfaceResponse
      );
      this.setPhysicsBounceSurfaceTintStrength(
        objectContent.physicsBounceSurfaceTintStrength !== undefined
          ? objectContent.physicsBounceSurfaceTintStrength
          : 0.75
      );
      this.setPhysicsBounceSurfaceEnergyScale(
        objectContent.physicsBounceSurfaceEnergyScale !== undefined
          ? objectContent.physicsBounceSurfaceEnergyScale
          : 1
      );

      return true;
    }

    override onDeletedFromScene(): void {
      gdjs.scene3d.spotLights.unregisterSpotLight(this);
      super.onDeletedFromScene();
    }

    override onDestroyed(): void {
      gdjs.scene3d.spotLights.unregisterSpotLight(this);
      super.onDestroyed();
    }

    override updatePreRender(): void {
      const runtimeScene = this.getRuntimeScene();
      gdjs.scene3d.spotLights.updateGuardrailsForScene(runtimeScene);
      this._renderer.updatePreRender(runtimeScene);
    }

    override getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): SpotLightObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        en: this._enabled,
        c: this._color,
        i: this._intensity,
        d: this._distance,
        a: this._angle,
        p: this._penumbra,
        dc: this._decay,
        cs: this._castShadow,
        sq: this._shadowQuality,
        sb: this._shadowBias,
        snb: this._shadowNormalBias,
        sr: this._shadowRadius,
        sn: this._shadowNear,
        sf: this._shadowFar,
        ge: this._guardrailsEnabled,
        ga: this._guardrailActive,
        uth: this._useTargetHandle,
        tx: this._targetOffsetX,
        ty: this._targetOffsetY,
        tz: this._targetOffsetZ,
        uph: this._usePhysicalUnits,
        pw: this._power,
        sat: this._shadowAutoTuningEnabled,
        pbe: this._physicsBounceEnabled,
        pbi: this._physicsBounceIntensityScale,
        pbd: this._physicsBounceDistance,
        pbo: this._physicsBounceOriginOffset,
        pbc: this._physicsBounceCastShadow,
        pbsr: this._physicsBounceUseSurfaceResponse,
        pbst: this._physicsBounceSurfaceTintStrength,
        pbse: this._physicsBounceSurfaceEnergyScale,
      };
    }

    override updateFromNetworkSyncData(
      networkSyncData: SpotLightObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.en !== undefined) this.setEnabled(networkSyncData.en);
      if (networkSyncData.c !== undefined) this.setColor(networkSyncData.c);
      if (networkSyncData.i !== undefined) this.setIntensity(networkSyncData.i);
      if (networkSyncData.d !== undefined) this.setDistance(networkSyncData.d);
      if (networkSyncData.a !== undefined) this.setConeAngle(networkSyncData.a);
      if (networkSyncData.p !== undefined) this.setPenumbra(networkSyncData.p);
      if (networkSyncData.dc !== undefined) this.setDecay(networkSyncData.dc);
      if (networkSyncData.cs !== undefined)
        this.setCastShadow(networkSyncData.cs);
      if (networkSyncData.sq !== undefined)
        this.setShadowQuality(networkSyncData.sq);
      if (networkSyncData.sb !== undefined)
        this.setShadowBias(networkSyncData.sb);
      if (networkSyncData.snb !== undefined)
        this.setShadowNormalBias(networkSyncData.snb);
      if (networkSyncData.sr !== undefined)
        this.setShadowRadius(networkSyncData.sr);
      if (networkSyncData.sn !== undefined)
        this.setShadowNear(networkSyncData.sn);
      if (networkSyncData.sf !== undefined)
        this.setShadowFar(networkSyncData.sf);
      if (networkSyncData.ge !== undefined)
        this.setGuardrailsEnabled(networkSyncData.ge);
      if (networkSyncData.ga !== undefined)
        this.setGuardrailActive(networkSyncData.ga);
      if (networkSyncData.uth !== undefined)
        this.setUseTargetHandle(networkSyncData.uth);
      if (networkSyncData.uph !== undefined)
        this.setUsePhysicalUnits(networkSyncData.uph);
      if (networkSyncData.pw !== undefined) this.setPower(networkSyncData.pw);
      if (networkSyncData.sat !== undefined)
        this.setShadowAutoTuning(networkSyncData.sat);
      if (networkSyncData.pbe !== undefined)
        this.setPhysicsBounceEnabled(networkSyncData.pbe);
      if (networkSyncData.pbi !== undefined)
        this.setPhysicsBounceIntensityScale(networkSyncData.pbi);
      if (networkSyncData.pbd !== undefined)
        this.setPhysicsBounceDistance(networkSyncData.pbd);
      if (networkSyncData.pbo !== undefined)
        this.setPhysicsBounceOriginOffset(networkSyncData.pbo);
      if (networkSyncData.pbc !== undefined)
        this.setPhysicsBounceCastShadow(networkSyncData.pbc);
      if (networkSyncData.pbsr !== undefined)
        this.setPhysicsBounceUseSurfaceResponse(networkSyncData.pbsr);
      if (networkSyncData.pbst !== undefined)
        this.setPhysicsBounceSurfaceTintStrength(networkSyncData.pbst);
      if (networkSyncData.pbse !== undefined)
        this.setPhysicsBounceSurfaceEnergyScale(networkSyncData.pbse);

      const syncedTargetOffsetX =
        networkSyncData.tx !== undefined
          ? networkSyncData.tx
          : this._targetOffsetX;
      const syncedTargetOffsetY =
        networkSyncData.ty !== undefined
          ? networkSyncData.ty
          : this._targetOffsetY;
      const syncedTargetOffsetZ =
        networkSyncData.tz !== undefined
          ? networkSyncData.tz
          : this._targetOffsetZ;
      if (
        networkSyncData.tx !== undefined ||
        networkSyncData.ty !== undefined ||
        networkSyncData.tz !== undefined
      ) {
        this.setTargetOffset(
          syncedTargetOffsetX,
          syncedTargetOffsetY,
          syncedTargetOffsetZ
        );
      }
    }

    setEnabled(enabled: boolean): void {
      this._enabled = !!enabled;
      this._renderer.setRuntimeEnabled(this._enabled);
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    isActiveAfterGuardrails(): boolean {
      return (
        this._enabled && (!this._guardrailsEnabled || this._guardrailActive)
      );
    }

    setColor(color: string): void {
      this._color = color;
      this._renderer.setColor(color);
    }

    getColor(): string {
      return this._color;
    }

    setIntensity(intensity: number): void {
      this._intensity = Math.max(0, intensity);
      this._renderer.setIntensity(this._intensity);
    }

    getIntensity(): number {
      return this._intensity;
    }

    setDistance(distance: number): void {
      this._distance = Math.max(0, distance);
      this._renderer.setDistance(this._distance);
    }

    getDistance(): number {
      return this._distance;
    }

    setConeAngle(angle: number): void {
      this._angle = clampSpotLightAngle(angle);
      this._renderer.setAngle(this._angle);
    }

    getConeAngle(): number {
      return this._angle;
    }

    setPenumbra(penumbra: number): void {
      this._penumbra = Math.max(0, Math.min(1, penumbra));
      this._renderer.setPenumbra(this._penumbra);
    }

    getPenumbra(): number {
      return this._penumbra;
    }

    setDecay(decay: number): void {
      this._decay = Math.max(0, decay);
      this._renderer.setDecay(this._decay);
    }

    getDecay(): number {
      return this._decay;
    }

    setCastShadow(castShadow: boolean): void {
      this._castShadow = !!castShadow;
      this._renderer.setCastShadow(this._castShadow);
    }

    isCastingShadow(): boolean {
      return this._castShadow;
    }

    setShadowQuality(shadowQuality: string): void {
      this._shadowQuality = clampShadowQuality(shadowQuality);
      this._renderer.setShadowMapSize(
        shadowQualityToMapSize(this._shadowQuality)
      );
    }

    getShadowQuality(): 'low' | 'medium' | 'high' {
      return this._shadowQuality;
    }

    setShadowBias(shadowBias: number): void {
      this._shadowBias = shadowBias;
      this._renderer.setShadowBias(this._shadowBias);
    }

    getShadowBias(): number {
      return this._shadowBias;
    }

    setShadowNormalBias(shadowNormalBias: number): void {
      this._shadowNormalBias = Math.max(0, shadowNormalBias);
      this._renderer.setShadowNormalBias(this._shadowNormalBias);
    }

    getShadowNormalBias(): number {
      return this._shadowNormalBias;
    }

    setShadowRadius(shadowRadius: number): void {
      this._shadowRadius = Math.max(0, shadowRadius);
      this._renderer.setShadowRadius(this._shadowRadius);
    }

    getShadowRadius(): number {
      return this._shadowRadius;
    }

    setShadowNear(shadowNear: number): void {
      this._shadowNear = Math.max(0.01, shadowNear);
      if (this._shadowFar < this._shadowNear + 1) {
        this._shadowFar = this._shadowNear + 1;
        this._renderer.setShadowFar(this._shadowFar);
      }
      this._renderer.setShadowNear(this._shadowNear);
    }

    getShadowNear(): number {
      return this._shadowNear;
    }

    setShadowFar(shadowFar: number): void {
      this._shadowFar = Math.max(this._shadowNear + 1, shadowFar);
      this._renderer.setShadowFar(this._shadowFar);
    }

    getShadowFar(): number {
      return this._shadowFar;
    }

    setGuardrailsEnabled(enabled: boolean): void {
      this._guardrailsEnabled = !!enabled;
      this._renderer.setGuardrailActive(
        !this._guardrailsEnabled || this._guardrailActive
      );
    }

    areGuardrailsEnabled(): boolean {
      return this._guardrailsEnabled;
    }

    shouldUseGuardrails(): boolean {
      return this._guardrailsEnabled && this._enabled && !this.isHidden();
    }

    setGuardrailActive(active: boolean): void {
      this._guardrailActive = !!active;
      this._renderer.setGuardrailActive(
        !this._guardrailsEnabled || this._guardrailActive
      );
    }

    setUseTargetHandle(useTargetHandle: boolean): void {
      this._useTargetHandle = !!useTargetHandle;
      this._renderer.setUseTargetHandle(this._useTargetHandle);
    }

    isTargetHandleEnabled(): boolean {
      return this._useTargetHandle;
    }

    setTargetOffset(offsetX: number, offsetY: number, offsetZ: number): void {
      this._targetOffsetX = Number.isFinite(offsetX) ? offsetX : 0;
      this._targetOffsetY = Number.isFinite(offsetY) ? offsetY : 0;
      const defaultOffsetZ = -(this._distance > 0 ? this._distance : 950);
      this._targetOffsetZ = Number.isFinite(offsetZ) ? offsetZ : defaultOffsetZ;
      this._renderer.setTargetOffset(
        this._targetOffsetX,
        this._targetOffsetY,
        this._targetOffsetZ
      );
    }

    getTargetOffsetX(): number {
      return this._targetOffsetX;
    }

    getTargetOffsetY(): number {
      return this._targetOffsetY;
    }

    getTargetOffsetZ(): number {
      return this._targetOffsetZ;
    }

    setUsePhysicalUnits(usePhysicalUnits: boolean): void {
      this._usePhysicalUnits = !!usePhysicalUnits;
      this._renderer.setUsePhysicalUnits(this._usePhysicalUnits);
    }

    usesPhysicalUnits(): boolean {
      return this._usePhysicalUnits;
    }

    setPower(power: number): void {
      this._power = Math.max(0, power);
      this._renderer.setPower(this._power);
    }

    getPower(): number {
      return this._power;
    }

    setShadowAutoTuning(enabled: boolean): void {
      this._shadowAutoTuningEnabled = !!enabled;
      this._renderer.setShadowAutoTuning(this._shadowAutoTuningEnabled);
    }

    isShadowAutoTuningEnabled(): boolean {
      return this._shadowAutoTuningEnabled;
    }

    setPhysicsBounceEnabled(enabled: boolean): void {
      this._physicsBounceEnabled = !!enabled;
      this._renderer.setPhysicsBounceEnabled(this._physicsBounceEnabled);
    }

    isPhysicsBounceEnabled(): boolean {
      return this._physicsBounceEnabled;
    }

    setPhysicsBounceIntensityScale(value: number): void {
      this._physicsBounceIntensityScale = Math.max(0, value);
      this._renderer.setPhysicsBounceIntensityScale(
        this._physicsBounceIntensityScale
      );
    }

    getPhysicsBounceIntensityScale(): number {
      return this._physicsBounceIntensityScale;
    }

    setPhysicsBounceDistance(value: number): void {
      this._physicsBounceDistance = Math.max(1, value);
      this._renderer.setPhysicsBounceDistance(this._physicsBounceDistance);
    }

    getPhysicsBounceDistance(): number {
      return this._physicsBounceDistance;
    }

    setPhysicsBounceOriginOffset(value: number): void {
      this._physicsBounceOriginOffset = Math.max(0, value);
      this._renderer.setPhysicsBounceOriginOffset(this._physicsBounceOriginOffset);
    }

    getPhysicsBounceOriginOffset(): number {
      return this._physicsBounceOriginOffset;
    }

    setPhysicsBounceCastShadow(value: boolean): void {
      this._physicsBounceCastShadow = !!value;
      this._renderer.setPhysicsBounceCastShadow(this._physicsBounceCastShadow);
    }

    isPhysicsBounceCastShadowEnabled(): boolean {
      return this._physicsBounceCastShadow;
    }

    setPhysicsBounceUseSurfaceResponse(value: boolean): void {
      this._physicsBounceUseSurfaceResponse = !!value;
      this._renderer.setPhysicsBounceUseSurfaceResponse(
        this._physicsBounceUseSurfaceResponse
      );
    }

    isPhysicsBounceUsingSurfaceResponse(): boolean {
      return this._physicsBounceUseSurfaceResponse;
    }

    setPhysicsBounceSurfaceTintStrength(value: number): void {
      this._physicsBounceSurfaceTintStrength = gdjs.evtTools.common.clamp(
        0,
        1,
        value
      );
      this._renderer.setPhysicsBounceSurfaceTintStrength(
        this._physicsBounceSurfaceTintStrength
      );
    }

    getPhysicsBounceSurfaceTintStrength(): number {
      return this._physicsBounceSurfaceTintStrength;
    }

    setPhysicsBounceSurfaceEnergyScale(value: number): void {
      this._physicsBounceSurfaceEnergyScale = Math.max(0, value);
      this._renderer.setPhysicsBounceSurfaceEnergyScale(
        this._physicsBounceSurfaceEnergyScale
      );
    }

    getPhysicsBounceSurfaceEnergyScale(): number {
      return this._physicsBounceSurfaceEnergyScale;
    }

    getDistanceToCameraSquared(
      cameraX: number,
      cameraY: number,
      cameraZ: number
    ): number {
      const dx = this.getCenterXInScene() - cameraX;
      const dy = this.getCenterYInScene() - cameraY;
      const dz = this.getCenterZInScene() - cameraZ;
      return dx * dx + dy * dy + dz * dz;
    }
  }

  export class SpotLightRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _spotLight: THREE.SpotLight;
    private _bounceLight: THREE.SpotLight;
    private _selectionProxyMesh: THREE.Mesh;
    private _selectionProxyLogoMaterial: THREE.MeshBasicMaterial;
    private _shadowMapSize: integer;
    private _shadowMapDirty: boolean;
    private _shadowNear: number;
    private _shadowFar: number;
    private _shadowCameraDirty: boolean;
    private _runtimeEnabled: boolean;
    private _guardrailActive: boolean;
    private _useTargetHandle: boolean;
    private _targetOffset: THREE.Vector3;
    private _usePhysicalUnits: boolean;
    private _power: number;
    private _baseIntensity: number;
    private _baseDistance: number;
    private _baseDecay: number;
    private _castShadowRequested: boolean;
    private _shadowAutoTuningEnabled: boolean;
    private _pipelineRealtimeMultiplier: number;
    private _pipelineAllowsRealtimeShadows: boolean;
    private _pipelineShadowQualityScale: number;
    private _effectiveShadowMapSize: integer;
    private _maxRendererShadowMapSize: integer;
    private _pipelineRefreshCooldown: integer;
    private _physicsBounceEnabled: boolean;
    private _physicsBounceIntensityScale: number;
    private _physicsBounceDistance: number;
    private _physicsBounceOriginOffset: number;
    private _physicsBounceCastShadow: boolean;
    private _physicsBounceUseSurfaceResponse: boolean;
    private _physicsBounceSurfaceTintStrength: number;
    private _physicsBounceSurfaceEnergyScale: number;
    private _cachedBounceSurfaceOwner: gdjs.RuntimeObject | null;
    private _cachedBounceSurfaceMaterial: THREE.Material | null;
    private _physicsBounceRaycastResult: gdjs.Physics3DRaycastResult;
    private _tempDirection: THREE.Vector3;
    private _tempWorldStart: THREE.Vector3;
    private _tempWorldEnd: THREE.Vector3;
    private _tempWorldHit: THREE.Vector3;
    private _tempWorldReflectedTarget: THREE.Vector3;
    private _tempSurfaceTintColor: THREE.Color;

    constructor(
      runtimeObject: gdjs.SpotLightRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      const threeGroup = new THREE.Group();
      const {
        materials: selectionProxyMaterials,
        logoFaceMaterial,
      } = createSelectionProxyMaterials();
      const selectionProxyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        selectionProxyMaterials
      );
      selectionProxyMesh.castShadow = false;
      selectionProxyMesh.receiveShadow = false;
      selectionProxyMesh.renderOrder = 1000;
      selectionProxyMesh.rotation.order = 'ZYX';
      threeGroup.add(selectionProxyMesh);

      const spotLight = new THREE.SpotLight(
        0xffffff,
        2.2,
        950,
        gdjs.toRad(40),
        0.22,
        2
      );
      spotLight.position.set(0, 0, 0);
      spotLight.target.position.set(0, 0, -1);
      const bounceLight = new THREE.SpotLight(
        0xffffff,
        0,
        380,
        gdjs.toRad(45),
        0.1,
        2
      );
      bounceLight.visible = false;
      bounceLight.target.position.set(0, 0, -1);
      threeGroup.add(spotLight);
      threeGroup.add(spotLight.target);
      threeGroup.add(bounceLight);
      threeGroup.add(bounceLight.target);

      super(runtimeObject, instanceContainer, threeGroup);

      this._spotLight = spotLight;
      this._bounceLight = bounceLight;
      this._selectionProxyMesh = selectionProxyMesh;
      this._selectionProxyLogoMaterial = logoFaceMaterial;
      this._shadowMapSize = 1024;
      this._shadowMapDirty = true;
      this._shadowNear = 1;
      this._shadowFar = 2000;
      this._shadowCameraDirty = true;
      this._runtimeEnabled = true;
      this._guardrailActive = true;
      this._useTargetHandle = true;
      this._targetOffset = new THREE.Vector3(0, 0, -1);
      this._usePhysicalUnits = true;
      this._power = 3200;
      this._baseIntensity = 2.2;
      this._baseDistance = 950;
      this._baseDecay = 2;
      this._castShadowRequested = false;
      this._shadowAutoTuningEnabled = true;
      this._pipelineRealtimeMultiplier = 1;
      this._pipelineAllowsRealtimeShadows = true;
      this._pipelineShadowQualityScale = 1;
      this._effectiveShadowMapSize = 1024;
      this._maxRendererShadowMapSize = 2048;
      this._pipelineRefreshCooldown = 0;
      this._physicsBounceEnabled = false;
      this._physicsBounceIntensityScale = 0.35;
      this._physicsBounceDistance = 380;
      this._physicsBounceOriginOffset = 2;
      this._physicsBounceCastShadow = false;
      this._physicsBounceUseSurfaceResponse = true;
      this._physicsBounceSurfaceTintStrength = 0.75;
      this._physicsBounceSurfaceEnergyScale = 1;
      this._cachedBounceSurfaceOwner = null;
      this._cachedBounceSurfaceMaterial = null;
      this._physicsBounceRaycastResult = {
        hasHit: false,
        hitX: 0,
        hitY: 0,
        hitZ: 0,
        normalX: 0,
        normalY: 0,
        normalZ: 0,
        reflectionDirectionX: 0,
        reflectionDirectionY: 0,
        reflectionDirectionZ: 0,
        distance: 0,
        fraction: 0,
        hitBehavior: null,
      };
      this._tempDirection = new THREE.Vector3(0, 0, -1);
      this._tempWorldStart = new THREE.Vector3();
      this._tempWorldEnd = new THREE.Vector3();
      this._tempWorldHit = new THREE.Vector3();
      this._tempWorldReflectedTarget = new THREE.Vector3();
      this._tempSurfaceTintColor = new THREE.Color(1, 1, 1);

      this.updateSize();
      this.updatePosition();
      this.updateRotation();
      this._updateShadowMapSize();
      this._updateShadowCamera();
      this._applyShadowTuning();
      this._updateLightVisibility();
    }

    override updateSize(): void {
      // Keep spotlight transforms stable regardless of object scaling.
      const object = this._object;
      const width = Math.max(1, Math.abs(object.getWidth()));
      const height = Math.max(1, Math.abs(object.getHeight()));
      const depth = Math.max(1, Math.abs(object.getDepth()));
      this._selectionProxyMesh.scale.set(
        object.isFlippedX() ? -width : width,
        object.isFlippedY() ? -height : height,
        object.isFlippedZ() ? -depth : depth
      );
      this.updatePosition();
    }

    override updateRotation(): void {
      super.updateRotation();
      this._updateTargetPosition();
    }

    override updateVisibility(): void {
      this._updateLightVisibility();
    }

    private _updateLightVisibility(): void {
      this._spotLight.visible =
        !this._object.isHidden() &&
        this._runtimeEnabled &&
        this._guardrailActive;
      this._selectionProxyMesh.visible =
        !this._object.isHidden() &&
        this._runtimeEnabled &&
        this._guardrailActive &&
        this._shouldShowSelectionProxy();
      this._bounceLight.visible =
        this._bounceLight.visible &&
        !this._object.isHidden() &&
        this._runtimeEnabled &&
        this._guardrailActive;
    }

    private _shouldShowSelectionProxy(): boolean {
      const runtimeScene = this._object.getRuntimeScene();
      if (!runtimeScene) {
        return false;
      }
      const runtimeGame = runtimeScene.getGame() as gdjs.RuntimeGame & {
        getInGameEditor?: () => any;
      };
      return !!(
        runtimeGame &&
        runtimeGame.getInGameEditor &&
        runtimeGame.getInGameEditor()
      );
    }

    private _updateTargetPosition(): void {
      if (this._useTargetHandle) {
        if (this._targetOffset.lengthSq() <= 0.0001) {
          this._spotLight.target.position.set(0, 0, -1);
        } else {
          this._spotLight.target.position.copy(this._targetOffset);
        }
      } else {
        this._spotLight.target.position.set(0, 0, -1);
      }
      this._spotLight.target.updateMatrixWorld(true);
      if (this._spotLight.castShadow) {
        this._spotLight.shadow.needsUpdate = true;
      }
    }

    private _getThreeSceneAndRenderer(): {
      scene: THREE.Scene;
      renderer: THREE.WebGLRenderer;
    } | null {
      const runtimeScene = this._object.getRuntimeScene();
      if (!runtimeScene) {
        return null;
      }
      const layer = runtimeScene.getLayer(this._object.getLayer());
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

    private _applyLightingPipeline(): void {
      const sceneAndRenderer = this._getThreeSceneAndRenderer();
      const pipelineState = getLightingPipelineState(sceneAndRenderer?.scene);

      this._pipelineRealtimeMultiplier = getRealtimeLightingMultiplier(pipelineState);
      this._pipelineAllowsRealtimeShadows = shouldUseRealtimeShadows(
        pipelineState,
        this._pipelineRealtimeMultiplier
      );

      let targetShadowQualityScale = 1;
      if (pipelineState) {
        const baseScale = Math.max(
          0.35,
          Math.min(2, pipelineState.shadowQualityScale ?? 1)
        );
        if (pipelineState.mode === 'baked') {
          targetShadowQualityScale = baseScale * 0.45;
        } else if (pipelineState.mode === 'hybrid') {
          targetShadowQualityScale =
            baseScale * (0.6 + 0.4 * this._pipelineRealtimeMultiplier);
        } else {
          targetShadowQualityScale = baseScale;
        }
      }
      targetShadowQualityScale = Math.max(0.35, Math.min(2, targetShadowQualityScale));
      if (
        Math.abs(targetShadowQualityScale - this._pipelineShadowQualityScale) >
        0.001
      ) {
        this._pipelineShadowQualityScale = targetShadowQualityScale;
        this._shadowMapDirty = true;
      }

      if (sceneAndRenderer) {
        const shouldUsePhysicalLights = pipelineState
          ? pipelineState.physicallyCorrectLights !== undefined
            ? !!pipelineState.physicallyCorrectLights
            : this._usePhysicalUnits
          : this._usePhysicalUnits;
        const rendererWithLightingMode = sceneAndRenderer.renderer as
          | (THREE.WebGLRenderer & {
              physicallyCorrectLights?: boolean;
              useLegacyLights?: boolean;
            })
          | null;
        if (
          rendererWithLightingMode &&
          typeof rendererWithLightingMode.physicallyCorrectLights === 'boolean'
        ) {
          rendererWithLightingMode.physicallyCorrectLights =
            shouldUsePhysicalLights;
        }
        if (
          rendererWithLightingMode &&
          typeof rendererWithLightingMode.useLegacyLights === 'boolean'
        ) {
          rendererWithLightingMode.useLegacyLights = !shouldUsePhysicalLights;
        }
      }

      const attenuation = computePipelineAttenuation(
        this._baseDistance,
        this._baseDecay,
        pipelineState
      );
      this._spotLight.distance = attenuation.distance;
      this._spotLight.decay = attenuation.decay;

      if (this._usePhysicalUnits && this._spotLight.power !== undefined) {
        this._spotLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier
        );
      } else {
        this._spotLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }

      const shouldCastShadow =
        this._castShadowRequested && this._pipelineAllowsRealtimeShadows;
      if (this._spotLight.castShadow !== shouldCastShadow) {
        this._spotLight.castShadow = shouldCastShadow;
        if (shouldCastShadow) {
          this._shadowMapDirty = true;
          this._shadowCameraDirty = true;
          this._spotLight.shadow.needsUpdate = true;
        }
      }

      this._bounceLight.castShadow =
        this._physicsBounceCastShadow && this._pipelineAllowsRealtimeShadows;
    }

    private _ensureSoftShadowRenderer(): void {
      const sceneAndRenderer = this._getThreeSceneAndRenderer();
      if (!sceneAndRenderer) {
        return;
      }
      const threeRenderer = sceneAndRenderer.renderer;
      if (!threeRenderer || !threeRenderer.shadowMap) {
        return;
      }
      const rendererMaxTextureSize =
        threeRenderer.capabilities &&
        typeof threeRenderer.capabilities.maxTextureSize === 'number'
          ? threeRenderer.capabilities.maxTextureSize
          : 2048;
      this._maxRendererShadowMapSize = Math.max(512, rendererMaxTextureSize);

      const shouldCastAnyShadow =
        this._spotLight.castShadow ||
        (this._physicsBounceEnabled && this._physicsBounceCastShadow);
      if (!shouldCastAnyShadow) {
        return;
      }

      threeRenderer.shadowMap.enabled = true;
      threeRenderer.shadowMap.autoUpdate = true;
      const preferredShadowType = THREE.PCFSoftShadowMap;
      if (threeRenderer.shadowMap.type !== preferredShadowType) {
        threeRenderer.shadowMap.type = preferredShadowType;
      }
    }

    private _sanitizeShadowMapSize(size: number): integer {
      const safeSize = Math.max(256, Math.min(4096, Math.floor(size)));
      const power = Math.round(Math.log2(safeSize));
      return Math.max(256, Math.min(4096, Math.pow(2, power)));
    }

    private _clampShadowMapSizeToRenderer(size: integer): integer {
      const safeRendererMax = Math.max(512, this._maxRendererShadowMapSize);
      let clampedSize = 512;
      while (clampedSize * 2 <= safeRendererMax) {
        clampedSize *= 2;
      }
      return Math.max(512, Math.min(size, clampedSize));
    }

    private _getClosestShadowMapSize(value: number): integer {
      const supportedSizes = [512, 1024, 2048, 4096];
      const target = Math.max(512, value);
      let closestSize = supportedSizes[0];
      let closestDelta = Math.abs(target - closestSize);
      for (let i = 1; i < supportedSizes.length; i++) {
        const size = supportedSizes[i];
        const delta = Math.abs(target - size);
        if (delta < closestDelta) {
          closestDelta = delta;
          closestSize = size;
        }
      }
      return this._clampShadowMapSizeToRenderer(closestSize);
    }

    private _updateShadowMapSize(): void {
      if (!this._shadowMapDirty) {
        return;
      }
      this._shadowMapDirty = false;

      this._effectiveShadowMapSize = this._getClosestShadowMapSize(
        this._shadowMapSize * this._pipelineShadowQualityScale
      );
      this._spotLight.shadow.mapSize.set(
        this._effectiveShadowMapSize,
        this._effectiveShadowMapSize
      );
      this._spotLight.shadow.map?.dispose();
      this._spotLight.shadow.map = null;
      this._spotLight.shadow.needsUpdate = true;

      if (this._physicsBounceCastShadow) {
        const bounceMapSize = this._getClosestShadowMapSize(
          Math.max(512, this._effectiveShadowMapSize * 0.5)
        );
        this._bounceLight.shadow.mapSize.set(bounceMapSize, bounceMapSize);
        this._bounceLight.shadow.map?.dispose();
        this._bounceLight.shadow.map = null;
        this._bounceLight.shadow.needsUpdate = true;
      }
    }

    private _applySpotShadowTuning(
      light: THREE.SpotLight,
      mapSize: number,
      normalBiasScale: number = 1,
      radiusScale: number = 1
    ): void {
      const manualBias = Math.max(0, -this._spotLight.shadow.bias);
      const manualNormalBias =
        Math.max(0, this._spotLight.shadow.normalBias) * normalBiasScale;
      const manualRadius =
        Math.max(0, this._spotLight.shadow.radius) * radiusScale;

      if (!this._shadowAutoTuningEnabled) {
        light.shadow.bias = -manualBias;
        light.shadow.normalBias = manualNormalBias;
        light.shadow.radius = manualRadius;
        return;
      }

      const shadowFar = Math.max(1, light.shadow.camera.far);
      const coneDiameter = Math.tan(this._spotLight.angle) * shadowFar * 2;
      const texelWorldSize = coneDiameter / Math.max(1, mapSize);
      const automaticBias = Math.max(0.00005, texelWorldSize * 0.0008);
      const automaticNormalBias = texelWorldSize * 0.03 * normalBiasScale;

      light.shadow.bias = -Math.max(manualBias, automaticBias);
      light.shadow.normalBias = Math.max(manualNormalBias, automaticNormalBias);
      light.shadow.radius = manualRadius;
    }

    private _applyShadowTuning(): void {
      if (this._spotLight.castShadow) {
        this._applySpotShadowTuning(this._spotLight, this._effectiveShadowMapSize);
      }
      if (this._bounceLight.castShadow) {
        this._applySpotShadowTuning(
          this._bounceLight,
          this._bounceLight.shadow.mapSize.x,
          0.75,
          0.75
        );
      }
    }

    private _updateShadowCamera(): void {
      if (!this._shadowCameraDirty) {
        return;
      }
      this._shadowCameraDirty = false;

      const safeNear = Math.max(0.01, this._shadowNear);
      this._shadowNear = safeNear;

      const effectiveDistance = this._spotLight.distance;
      const effectiveFar =
        effectiveDistance > 0
          ? Math.min(
              this._shadowFar,
              effectiveDistance + Math.max(50, effectiveDistance * 0.25)
            )
          : this._shadowFar;

      this._spotLight.shadow.mapSize.set(
        this._effectiveShadowMapSize,
        this._effectiveShadowMapSize
      );
      const shadowCamera = this._spotLight.shadow
        .camera as THREE.PerspectiveCamera;
      shadowCamera.near = safeNear;
      shadowCamera.far = Math.max(safeNear + 1, effectiveFar);
      shadowCamera.fov = Math.max(
        2,
        Math.min(170, gdjs.toDegrees(this._spotLight.angle) * 2)
      );
      shadowCamera.updateProjectionMatrix();
      this._spotLight.shadow.needsUpdate = true;

      if (this._physicsBounceCastShadow) {
        const bounceFar = Math.max(
          safeNear + 1,
          this._physicsBounceDistance +
            Math.max(25, this._physicsBounceDistance * 0.25)
        );
        this._bounceLight.shadow.camera.near = safeNear;
        this._bounceLight.shadow.camera.far = bounceFar;
        this._bounceLight.shadow.camera.fov = Math.max(
          2,
          Math.min(170, gdjs.toDegrees(this._spotLight.angle) * 2)
        );
        this._bounceLight.shadow.camera.updateProjectionMatrix();
        this._bounceLight.shadow.needsUpdate = true;
      }
    }

    private _hideBounceLight(): void {
      this._bounceLight.visible = false;
    }

    private _resolveFirstSurfaceMaterial(
      rootObject: THREE.Object3D
    ): THREE.Material | null {
      let firstMaterial: THREE.Material | null = null;
      rootObject.traverse((child: any) => {
        if (firstMaterial) {
          return;
        }
        if (!child || !child.isMesh || !child.material) {
          return;
        }
        if (Array.isArray(child.material)) {
          for (const material of child.material) {
            if (material) {
              firstMaterial = material as THREE.Material;
              return;
            }
          }
          return;
        }
        firstMaterial = child.material as THREE.Material;
      });
      return firstMaterial;
    }

    private _tryApplySurfaceResponse(
      raycastResult: gdjs.Physics3DRaycastResult
    ): number {
      this._tempSurfaceTintColor.set(1, 1, 1);
      if (!this._physicsBounceUseSurfaceResponse) {
        return 1;
      }

      const hitOwner = raycastResult.hitBehavior
        ? (raycastResult.hitBehavior.owner as any)
        : null;
      if (!hitOwner) {
        return 1;
      }

      if (hitOwner !== this._cachedBounceSurfaceOwner) {
        this._cachedBounceSurfaceOwner = hitOwner;
        this._cachedBounceSurfaceMaterial = null;
        const ownerRendererObject =
          hitOwner && typeof hitOwner.get3DRendererObject === 'function'
            ? (hitOwner.get3DRendererObject() as THREE.Object3D | null)
            : null;
        if (ownerRendererObject) {
          this._cachedBounceSurfaceMaterial =
            this._resolveFirstSurfaceMaterial(ownerRendererObject);
        }
      }

      const materialAsAny = this._cachedBounceSurfaceMaterial as
        | (THREE.Material & {
            color?: THREE.Color;
            roughness?: number;
            metalness?: number;
          })
        | null;
      if (!materialAsAny) {
        return 1;
      }

      const surfaceColor =
        materialAsAny.color && typeof materialAsAny.color.r === 'number'
          ? materialAsAny.color
          : null;
      if (surfaceColor) {
        this._tempSurfaceTintColor.lerp(
          surfaceColor,
          this._physicsBounceSurfaceTintStrength
        );
      }

      const roughness = gdjs.evtTools.common.clamp(
        0,
        1,
        materialAsAny.roughness !== undefined ? materialAsAny.roughness : 0.55
      );
      const metalness = gdjs.evtTools.common.clamp(
        0,
        1,
        materialAsAny.metalness !== undefined ? materialAsAny.metalness : 0
      );
      const luminance = surfaceColor
        ? gdjs.evtTools.common.clamp(
            0,
            1,
            surfaceColor.r * 0.2126 +
              surfaceColor.g * 0.7152 +
              surfaceColor.b * 0.0722
          )
        : 0.55;

      const reflectedEnergy = gdjs.evtTools.common.clamp(
        0.08,
        1.35,
        (0.18 + luminance * 0.82) *
          (1 - roughness * 0.5) *
          (0.9 + metalness * 0.2) *
          this._physicsBounceSurfaceEnergyScale
      );
      return reflectedEnergy;
    }

    private _updatePhysicsBounce(runtimeScene: gdjs.RuntimeScene): void {
      if (!this._physicsBounceEnabled) {
        this._hideBounceLight();
        return;
      }

      const physics3DRuntimeBehaviorClass = (gdjs as unknown as {
        Physics3DRuntimeBehavior?: {
          raycastClosestInScene?: (
            runtimeScene: gdjs.RuntimeScene,
            startX: float,
            startY: float,
            startZ: float,
            endX: float,
            endY: float,
            endZ: float,
            ignoreBehavior: gdjs.Physics3DRuntimeBehavior | null,
            outResult: gdjs.Physics3DRaycastResult
          ) => gdjs.Physics3DRaycastResult;
        };
      }).Physics3DRuntimeBehavior;
      const raycastClosestInScene =
        physics3DRuntimeBehaviorClass &&
        physics3DRuntimeBehaviorClass.raycastClosestInScene;
      if (!raycastClosestInScene) {
        this._hideBounceLight();
        return;
      }

      const threeObject = this.get3DRendererObject();
      threeObject.getWorldPosition(this._tempWorldStart);
      if (this._useTargetHandle) {
        this._tempWorldEnd.copy(this._targetOffset).applyMatrix4(threeObject.matrixWorld);
      } else {
        this._tempDirection.set(0, 0, -1).applyQuaternion(threeObject.quaternion);
        const traceLength =
          this._spotLight.distance > 0 ? this._spotLight.distance : 1200;
        this._tempWorldEnd
          .copy(this._tempWorldStart)
          .add(this._tempDirection.multiplyScalar(traceLength));
      }

      const raycastResult = raycastClosestInScene(
        runtimeScene,
        this._tempWorldStart.x,
        this._tempWorldStart.y,
        this._tempWorldStart.z,
        this._tempWorldEnd.x,
        this._tempWorldEnd.y,
        this._tempWorldEnd.z,
        null,
        this._physicsBounceRaycastResult
      );
      if (!raycastResult.hasHit) {
        this._hideBounceLight();
        return;
      }

      this._tempWorldHit.set(
        raycastResult.hitX + raycastResult.normalX * this._physicsBounceOriginOffset,
        raycastResult.hitY + raycastResult.normalY * this._physicsBounceOriginOffset,
        raycastResult.hitZ + raycastResult.normalZ * this._physicsBounceOriginOffset
      );
      this._tempWorldReflectedTarget.set(
        this._tempWorldHit.x +
          raycastResult.reflectionDirectionX * this._physicsBounceDistance,
        this._tempWorldHit.y +
          raycastResult.reflectionDirectionY * this._physicsBounceDistance,
        this._tempWorldHit.z +
          raycastResult.reflectionDirectionZ * this._physicsBounceDistance
      );

      const localBounceOrigin = this._tempWorldHit.clone();
      const localBounceTarget = this._tempWorldReflectedTarget.clone();
      threeObject.worldToLocal(localBounceOrigin);
      threeObject.worldToLocal(localBounceTarget);

      this._bounceLight.position.copy(localBounceOrigin);
      this._bounceLight.target.position.copy(localBounceTarget);
      this._bounceLight.target.updateMatrixWorld(true);
      const surfaceEnergy = this._tryApplySurfaceResponse(raycastResult);
      this._bounceLight.color
        .copy(this._spotLight.color)
        .multiply(this._tempSurfaceTintColor);
      const bouncedIntensityScale =
        this._physicsBounceIntensityScale * surfaceEnergy;
      this._bounceLight.intensity =
        this._spotLight.intensity * bouncedIntensityScale;
      if (this._usePhysicalUnits && this._bounceLight.power !== undefined) {
        this._bounceLight.power = this._spotLight.power * bouncedIntensityScale;
      }
      this._bounceLight.distance = this._physicsBounceDistance;
      this._bounceLight.angle = this._spotLight.angle;
      this._bounceLight.penumbra = this._spotLight.penumbra;
      this._bounceLight.decay = this._spotLight.decay;
      this._bounceLight.castShadow =
        this._physicsBounceCastShadow && this._pipelineAllowsRealtimeShadows;
      this._bounceLight.visible = true;
    }

    updatePreRender(runtimeScene: gdjs.RuntimeScene): void {
      const shouldRefreshPipeline =
        this._pipelineRefreshCooldown <= 0 ||
        this._shadowMapDirty ||
        this._shadowCameraDirty;
      if (shouldRefreshPipeline) {
        this._pipelineRefreshCooldown = 4;
        this._applyLightingPipeline();
        this._ensureSoftShadowRenderer();
      } else {
        this._pipelineRefreshCooldown--;
      }
      this._updateShadowMapSize();
      this._updateShadowCamera();
      if (shouldRefreshPipeline || this._shadowMapDirty || this._shadowCameraDirty) {
        this._applyShadowTuning();
      }
      this._updatePhysicsBounce(runtimeScene);
      this._updateLightVisibility();
    }

    setRuntimeEnabled(enabled: boolean): void {
      this._runtimeEnabled = !!enabled;
      this._updateLightVisibility();
    }

    setGuardrailActive(active: boolean): void {
      this._guardrailActive = !!active;
      this._updateLightVisibility();
    }

    setUseTargetHandle(useTargetHandle: boolean): void {
      this._useTargetHandle = !!useTargetHandle;
      this._updateTargetPosition();
    }

    setTargetOffset(offsetX: number, offsetY: number, offsetZ: number): void {
      this._targetOffset.set(offsetX, offsetY, offsetZ);
      if (this._targetOffset.lengthSq() <= 0.0001) {
        this._targetOffset.set(0, 0, -1);
      }
      this._updateTargetPosition();
    }

    setColor(color: string): void {
      this._spotLight.color.set(gdjs.rgbOrHexStringToNumber(color));
      this._bounceLight.color.copy(this._spotLight.color);
      this._selectionProxyLogoMaterial.color.copy(this._spotLight.color);
    }

    setIntensity(intensity: number): void {
      this._baseIntensity = Math.max(0, intensity);
      if (!this._usePhysicalUnits) {
        this._spotLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
    }

    setDistance(distance: number): void {
      this._baseDistance = Math.max(0, distance);
      this._shadowCameraDirty = true;
    }

    setAngle(angleInDegrees: number): void {
      this._spotLight.angle = gdjs.toRad(clampSpotLightAngle(angleInDegrees));
      this._shadowCameraDirty = true;
      this._updateShadowCamera();
    }

    setPenumbra(penumbra: number): void {
      this._spotLight.penumbra = Math.max(0, Math.min(1, penumbra));
    }

    setDecay(decay: number): void {
      this._baseDecay = Math.max(0, decay);
    }

    setCastShadow(castShadow: boolean): void {
      this._castShadowRequested = !!castShadow;
      if (this._castShadowRequested) {
        this._shadowMapDirty = true;
        this._shadowCameraDirty = true;
      }
    }

    setShadowMapSize(shadowMapSize: number): void {
      this._shadowMapSize = this._sanitizeShadowMapSize(shadowMapSize);
      this._shadowMapDirty = true;
    }

    setShadowBias(shadowBias: number): void {
      this._spotLight.shadow.bias = shadowBias;
      this._bounceLight.shadow.bias = shadowBias;
    }

    setShadowNormalBias(shadowNormalBias: number): void {
      this._spotLight.shadow.normalBias = Math.max(0, shadowNormalBias);
      this._bounceLight.shadow.normalBias = Math.max(0, shadowNormalBias * 0.75);
    }

    setShadowRadius(shadowRadius: number): void {
      this._spotLight.shadow.radius = Math.max(0, shadowRadius);
      this._bounceLight.shadow.radius = Math.max(0, shadowRadius * 0.75);
    }

    setShadowNear(shadowNear: number): void {
      this._shadowNear = Math.max(0.01, shadowNear);
      this._shadowCameraDirty = true;
    }

    setShadowFar(shadowFar: number): void {
      this._shadowFar = Math.max(this._shadowNear + 1, shadowFar);
      this._shadowCameraDirty = true;
    }

    setUsePhysicalUnits(usePhysicalUnits: boolean): void {
      this._usePhysicalUnits = !!usePhysicalUnits;
      if (this._usePhysicalUnits) {
        if (this._spotLight.power !== undefined) {
          this._spotLight.power = Math.max(
            0,
            this._power * this._pipelineRealtimeMultiplier
          );
        }
      } else {
        this._spotLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
    }

    setPower(power: number): void {
      this._power = Math.max(0, power);
      if (this._usePhysicalUnits && this._spotLight.power !== undefined) {
        this._spotLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier
        );
      }
    }

    setShadowAutoTuning(enabled: boolean): void {
      this._shadowAutoTuningEnabled = !!enabled;
    }

    setPhysicsBounceEnabled(enabled: boolean): void {
      this._physicsBounceEnabled = !!enabled;
      if (!this._physicsBounceEnabled) {
        this._hideBounceLight();
      }
    }

    setPhysicsBounceIntensityScale(value: number): void {
      this._physicsBounceIntensityScale = Math.max(0, value);
    }

    setPhysicsBounceDistance(value: number): void {
      this._physicsBounceDistance = Math.max(1, value);
      this._shadowCameraDirty = true;
    }

    setPhysicsBounceOriginOffset(value: number): void {
      this._physicsBounceOriginOffset = Math.max(0, value);
    }

    setPhysicsBounceCastShadow(value: boolean): void {
      this._physicsBounceCastShadow = !!value;
      this._shadowMapDirty = true;
      this._shadowCameraDirty = true;
    }

    setPhysicsBounceUseSurfaceResponse(value: boolean): void {
      this._physicsBounceUseSurfaceResponse = !!value;
      if (!this._physicsBounceUseSurfaceResponse) {
        this._cachedBounceSurfaceOwner = null;
        this._cachedBounceSurfaceMaterial = null;
      }
    }

    setPhysicsBounceSurfaceTintStrength(value: number): void {
      this._physicsBounceSurfaceTintStrength = gdjs.evtTools.common.clamp(
        0,
        1,
        value
      );
    }

    setPhysicsBounceSurfaceEnergyScale(value: number): void {
      this._physicsBounceSurfaceEnergyScale = Math.max(0, value);
    }
  }

  gdjs.registerObject('Scene3D::SpotLightObject', gdjs.SpotLightRuntimeObject);
}

