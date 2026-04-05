namespace gdjs {
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
        context.arc(64, 64, 30, 0, Math.PI * 2);
        context.stroke();

        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(64, 64, 12, 0, Math.PI * 2);
        context.fill();

        context.lineWidth = 7;
        context.beginPath();
        context.moveTo(18, 64);
        context.lineTo(42, 64);
        context.moveTo(86, 64);
        context.lineTo(110, 64);
        context.moveTo(64, 18);
        context.lineTo(64, 42);
        context.moveTo(64, 86);
        context.lineTo(64, 110);
        context.stroke();
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

  export interface PointLightObjectData extends Object3DData {
    content: Object3DDataContent & {
      enabled: boolean | undefined;
      color: string;
      intensity: number | undefined;
      distance: number | undefined;
      decay: number | undefined;
      castShadow: boolean | undefined;
      shadowQuality: 'low' | 'medium' | 'high' | undefined;
      shadowBias: number | undefined;
      shadowNormalBias: number | undefined;
      shadowRadius: number | undefined;
      shadowNear: number | undefined;
      shadowFar: number | undefined;
      usePhysicalUnits: boolean | undefined;
      power: number | undefined;
      shadowAutoTuning: boolean | undefined;
    };
  }

  type PointLightObjectNetworkSyncDataType = {
    en: boolean;
    c: string;
    i: number;
    d: number;
    dc: number;
    cs: boolean;
    sq: 'low' | 'medium' | 'high';
    sb: number;
    snb: number;
    sr: number;
    sn: number;
    sf: number;
    uph: boolean;
    pw: number;
    sat: boolean;
  };

  type PointLightObjectNetworkSyncData = Object3DNetworkSyncData &
    PointLightObjectNetworkSyncDataType;

  export class PointLightRuntimeObject extends gdjs.RuntimeObject3D {
    private _renderer: gdjs.PointLightRuntimeObjectRenderer;

    private _enabled: boolean;
    private _color: string;
    private _intensity: number;
    private _distance: number;
    private _decay: number;
    private _castShadow: boolean;
    private _shadowQuality: 'low' | 'medium' | 'high';
    private _shadowBias: number;
    private _shadowNormalBias: number;
    private _shadowRadius: number;
    private _shadowNear: number;
    private _shadowFar: number;
    private _usePhysicalUnits: boolean;
    private _power: number;
    private _shadowAutoTuningEnabled: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: PointLightObjectData,
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
        objectContent.distance !== undefined ? objectContent.distance : 900
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
      this._usePhysicalUnits =
        objectContent.usePhysicalUnits === undefined
          ? true
          : !!objectContent.usePhysicalUnits;
      this._power = Math.max(
        0,
        objectContent.power !== undefined ? objectContent.power : 2600
      );
      this._shadowAutoTuningEnabled =
        objectContent.shadowAutoTuning === undefined
          ? true
          : !!objectContent.shadowAutoTuning;

      this._renderer = new gdjs.PointLightRuntimeObjectRenderer(
        this,
        instanceContainer
      );
      this._applyAllPropertiesToRenderer();

      this.onCreated();
    }

    getRenderer(): gdjs.RuntimeObject3DRenderer {
      return this._renderer;
    }

    private _applyAllPropertiesToRenderer(): void {
      this._renderer.setColor(this._color);
      this._renderer.setIntensity(this._intensity);
      this._renderer.setDistance(this._distance);
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
      this._renderer.setUsePhysicalUnits(this._usePhysicalUnits);
      this._renderer.setPower(this._power);
      this._renderer.setShadowAutoTuning(this._shadowAutoTuningEnabled);
    }

    override updateFromObjectData(
      oldObjectData: PointLightObjectData,
      newObjectData: PointLightObjectData
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
        objectContent.distance !== undefined ? objectContent.distance : 900
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
      this.setUsePhysicalUnits(
        objectContent.usePhysicalUnits === undefined
          ? true
          : !!objectContent.usePhysicalUnits
      );
      this.setPower(objectContent.power !== undefined ? objectContent.power : 2600);
      this.setShadowAutoTuning(
        objectContent.shadowAutoTuning === undefined
          ? true
          : !!objectContent.shadowAutoTuning
      );

      return true;
    }

    override updatePreRender(): void {
      this._renderer.updatePreRender(this.getRuntimeScene());
    }

    override getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): PointLightObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        en: this._enabled,
        c: this._color,
        i: this._intensity,
        d: this._distance,
        dc: this._decay,
        cs: this._castShadow,
        sq: this._shadowQuality,
        sb: this._shadowBias,
        snb: this._shadowNormalBias,
        sr: this._shadowRadius,
        sn: this._shadowNear,
        sf: this._shadowFar,
        uph: this._usePhysicalUnits,
        pw: this._power,
        sat: this._shadowAutoTuningEnabled,
      };
    }

    override updateFromNetworkSyncData(
      networkSyncData: PointLightObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.en !== undefined) this.setEnabled(networkSyncData.en);
      if (networkSyncData.c !== undefined) this.setColor(networkSyncData.c);
      if (networkSyncData.i !== undefined) this.setIntensity(networkSyncData.i);
      if (networkSyncData.d !== undefined) this.setDistance(networkSyncData.d);
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
      if (networkSyncData.uph !== undefined)
        this.setUsePhysicalUnits(networkSyncData.uph);
      if (networkSyncData.pw !== undefined) this.setPower(networkSyncData.pw);
      if (networkSyncData.sat !== undefined)
        this.setShadowAutoTuning(networkSyncData.sat);
    }

    setEnabled(enabled: boolean): void {
      this._enabled = !!enabled;
      this._renderer.setRuntimeEnabled(this._enabled);
    }

    isEnabled(): boolean {
      return this._enabled;
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
  }

  export class PointLightRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _pointLight: THREE.PointLight;
    private _selectionProxyMesh: THREE.Mesh;
    private _selectionProxyLogoMaterial: THREE.MeshBasicMaterial;
    private _shadowMapSize: integer;
    private _shadowMapDirty: boolean;
    private _shadowNear: number;
    private _shadowFar: number;
    private _shadowCameraDirty: boolean;
    private _runtimeEnabled: boolean;
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

    constructor(
      runtimeObject: gdjs.PointLightRuntimeObject,
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

      const pointLight = new THREE.PointLight(0xffffff, 2.2, 900, 2);
      pointLight.position.set(0, 0, 0);
      threeGroup.add(pointLight);

      super(runtimeObject, instanceContainer, threeGroup);

      this._pointLight = pointLight;
      this._selectionProxyMesh = selectionProxyMesh;
      this._selectionProxyLogoMaterial = logoFaceMaterial;
      this._shadowMapSize = 1024;
      this._shadowMapDirty = true;
      this._shadowNear = 1;
      this._shadowFar = 2000;
      this._shadowCameraDirty = true;
      this._runtimeEnabled = true;
      this._usePhysicalUnits = true;
      this._power = 2600;
      this._baseIntensity = 2.2;
      this._baseDistance = 900;
      this._baseDecay = 2;
      this._castShadowRequested = false;
      this._shadowAutoTuningEnabled = true;
      this._pipelineRealtimeMultiplier = 1;
      this._pipelineAllowsRealtimeShadows = true;
      this._pipelineShadowQualityScale = 1;
      this._effectiveShadowMapSize = 1024;
      this._maxRendererShadowMapSize = 2048;
      this._pipelineRefreshCooldown = 0;

      this.updateSize();
      this.updatePosition();
      this.updateRotation();
      this._updateShadowMapSize();
      this._updateShadowCamera();
      this._applyShadowTuning();
      this._updateLightVisibility();
    }

    override updateSize(): void {
      // Keep point light transforms stable regardless of object scaling.
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

    override updateVisibility(): void {
      this._updateLightVisibility();
    }

    private _updateLightVisibility(): void {
      this._pointLight.visible = !this._object.isHidden() && this._runtimeEnabled;
      this._selectionProxyMesh.visible =
        !this._object.isHidden() &&
        this._runtimeEnabled &&
        this._shouldShowSelectionProxy();
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
      this._pointLight.distance = attenuation.distance;
      this._pointLight.decay = attenuation.decay;

      if (this._usePhysicalUnits && this._pointLight.power !== undefined) {
        this._pointLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier
        );
      } else {
        this._pointLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }

      const shouldCastShadow =
        this._castShadowRequested && this._pipelineAllowsRealtimeShadows;
      if (this._pointLight.castShadow !== shouldCastShadow) {
        this._pointLight.castShadow = shouldCastShadow;
        if (shouldCastShadow) {
          this._shadowMapDirty = true;
          this._shadowCameraDirty = true;
          this._pointLight.shadow.needsUpdate = true;
        }
      }
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
      if (!this._pointLight.castShadow) {
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

      this._effectiveShadowMapSize = Math.max(
        512,
        this._getClosestShadowMapSize(
          this._shadowMapSize * this._pipelineShadowQualityScale
        )
      );
      this._pointLight.shadow.mapSize.set(
        this._effectiveShadowMapSize,
        this._effectiveShadowMapSize
      );
      this._pointLight.shadow.map?.dispose();
      this._pointLight.shadow.map = null;
      this._pointLight.shadow.needsUpdate = true;
    }

    private _applyShadowTuning(): void {
      const manualBias = Math.max(0, -this._pointLight.shadow.bias);
      const manualNormalBias = Math.max(0, this._pointLight.shadow.normalBias);
      if (!this._shadowAutoTuningEnabled) {
        this._pointLight.shadow.bias = -manualBias;
        this._pointLight.shadow.normalBias = manualNormalBias;
        return;
      }

      const shadowFar = Math.max(1, this._pointLight.shadow.camera.far);
      const texelWorldSize =
        (shadowFar * 2) / Math.max(1, this._effectiveShadowMapSize);
      const automaticBias = Math.max(0.00005, texelWorldSize * 0.0008);
      const automaticNormalBias = texelWorldSize * 0.03;
      this._pointLight.shadow.bias = -Math.max(manualBias, automaticBias);
      this._pointLight.shadow.normalBias = Math.max(
        manualNormalBias,
        automaticNormalBias
      );
    }

    private _updateShadowCamera(): void {
      if (!this._shadowCameraDirty) {
        return;
      }
      this._shadowCameraDirty = false;

      const safeNear = Math.max(0.01, this._shadowNear);
      const effectiveDistance = this._pointLight.distance;
      const effectiveFar =
        effectiveDistance > 0
          ? Math.min(
              this._shadowFar,
              effectiveDistance + Math.max(50, effectiveDistance * 0.25)
            )
          : this._shadowFar;
      const shadowCamera = this._pointLight.shadow
        .camera as THREE.PerspectiveCamera;
      shadowCamera.near = safeNear;
      shadowCamera.far = Math.max(safeNear + 1, effectiveFar);
      shadowCamera.updateProjectionMatrix();
      this._pointLight.shadow.needsUpdate = true;
    }

    updatePreRender(_runtimeScene: gdjs.RuntimeScene): void {
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
      this._updateLightVisibility();
    }

    setRuntimeEnabled(enabled: boolean): void {
      this._runtimeEnabled = !!enabled;
      this._updateLightVisibility();
    }

    setColor(color: string): void {
      this._pointLight.color.set(gdjs.rgbOrHexStringToNumber(color));
      this._selectionProxyLogoMaterial.color.copy(this._pointLight.color);
    }

    setIntensity(intensity: number): void {
      this._baseIntensity = Math.max(0, intensity);
      if (!this._usePhysicalUnits) {
        this._pointLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
    }

    setDistance(distance: number): void {
      this._baseDistance = Math.max(0, distance);
      this._shadowCameraDirty = true;
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
      this._pointLight.shadow.bias = shadowBias;
    }

    setShadowNormalBias(shadowNormalBias: number): void {
      this._pointLight.shadow.normalBias = Math.max(0, shadowNormalBias);
    }

    setShadowRadius(shadowRadius: number): void {
      this._pointLight.shadow.radius = Math.max(0, shadowRadius);
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
        if (this._pointLight.power !== undefined) {
          this._pointLight.power = Math.max(
            0,
            this._power * this._pipelineRealtimeMultiplier
          );
        }
      } else {
        this._pointLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
    }

    setPower(power: number): void {
      this._power = Math.max(0, power);
      if (this._usePhysicalUnits && this._pointLight.power !== undefined) {
        this._pointLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier
        );
      }
    }

    setShadowAutoTuning(enabled: boolean): void {
      this._shadowAutoTuningEnabled = !!enabled;
    }
  }

  gdjs.registerObject('Scene3D::PointLightObject', gdjs.PointLightRuntimeObject);
}

