namespace gdjs {
  interface LightingPipelineState {
    mode?: string;
    realtimeWeight?: number;
    physicallyCorrectLights?: boolean;
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

  let rectAreaLightSupportAvailable = false;
  const initializeRectAreaLightSupport = (() => {
    let hasAttemptedInit = false;
    return (): void => {
      if (hasAttemptedInit) {
        return;
      }
      hasAttemptedInit = true;
      const threeAny = THREE as typeof THREE & {
        RectAreaLightUniformsLib?: {
          init?: () => void;
        };
      };
      if (
        threeAny.RectAreaLightUniformsLib &&
        typeof threeAny.RectAreaLightUniformsLib.init === 'function'
      ) {
        threeAny.RectAreaLightUniformsLib.init();
        rectAreaLightSupportAvailable = true;
      }
    };
  })();

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
        context.strokeRect(24, 36, 80, 56);
        context.beginPath();
        context.moveTo(40, 64);
        context.lineTo(88, 64);
        context.moveTo(64, 40);
        context.lineTo(64, 88);
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

  export interface RectAreaLightObjectData extends Object3DData {
    content: Object3DDataContent & {
      enabled: boolean | undefined;
      color: string;
      intensity: number | undefined;
      usePhysicalUnits: boolean | undefined;
      power: number | undefined;
      lightWidth: number | undefined;
      lightHeight: number | undefined;
      showDebugGizmos: boolean | undefined;
    };
  }

  type RectAreaLightObjectNetworkSyncDataType = {
    en: boolean;
    c: string;
    i: number;
    uph: boolean;
    pw: number;
    lw: number;
    lh: number;
    dbg: boolean;
  };

  type RectAreaLightObjectNetworkSyncData = Object3DNetworkSyncData &
    RectAreaLightObjectNetworkSyncDataType;

  export class RectAreaLightRuntimeObject extends gdjs.RuntimeObject3D {
    private _renderer: gdjs.RectAreaLightRuntimeObjectRenderer;

    private _enabled: boolean;
    private _color: string;
    private _intensity: number;
    private _usePhysicalUnits: boolean;
    private _power: number;
    private _lightWidth: number;
    private _lightHeight: number;
    private _showDebugGizmos: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: RectAreaLightObjectData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);

      const objectContent = objectData.content;
      this._enabled =
        objectContent.enabled === undefined ? true : !!objectContent.enabled;
      this._color = objectContent.color || '255;255;255';
      this._intensity = Math.max(
        0,
        objectContent.intensity !== undefined ? objectContent.intensity : 35
      );
      this._usePhysicalUnits =
        objectContent.usePhysicalUnits === undefined
          ? true
          : !!objectContent.usePhysicalUnits;
      this._power = Math.max(
        0,
        objectContent.power !== undefined ? objectContent.power : 22000
      );
      this._lightWidth = Math.max(
        1,
        objectContent.lightWidth !== undefined ? objectContent.lightWidth : 180
      );
      this._lightHeight = Math.max(
        1,
        objectContent.lightHeight !== undefined ? objectContent.lightHeight : 90
      );
      this._showDebugGizmos =
        objectContent.showDebugGizmos === undefined
          ? true
          : !!objectContent.showDebugGizmos;

      this._renderer = new gdjs.RectAreaLightRuntimeObjectRenderer(
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
      this._renderer.setUsePhysicalUnits(this._usePhysicalUnits);
      this._renderer.setPower(this._power);
      this._renderer.setLightWidth(this._lightWidth);
      this._renderer.setLightHeight(this._lightHeight);
      this._renderer.setRuntimeEnabled(this._enabled);
      this._renderer.setShowDebugGizmos(this._showDebugGizmos);
    }

    override updateFromObjectData(
      oldObjectData: RectAreaLightObjectData,
      newObjectData: RectAreaLightObjectData
    ): boolean {
      super.updateFromObjectData(oldObjectData, newObjectData);

      const objectContent = newObjectData.content;
      this.setEnabled(
        objectContent.enabled === undefined ? true : !!objectContent.enabled
      );
      this.setColor(objectContent.color || '255;255;255');
      this.setIntensity(
        objectContent.intensity !== undefined ? objectContent.intensity : 35
      );
      this.setUsePhysicalUnits(
        objectContent.usePhysicalUnits === undefined
          ? true
          : !!objectContent.usePhysicalUnits
      );
      this.setPower(objectContent.power !== undefined ? objectContent.power : 22000);
      this.setLightWidth(
        objectContent.lightWidth !== undefined ? objectContent.lightWidth : 180
      );
      this.setLightHeight(
        objectContent.lightHeight !== undefined ? objectContent.lightHeight : 90
      );
      this.setShowDebugGizmos(
        objectContent.showDebugGizmos === undefined
          ? true
          : !!objectContent.showDebugGizmos
      );

      return true;
    }

    override updatePreRender(): void {
      this._renderer.updatePreRender(this.getRuntimeScene());
    }

    override getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): RectAreaLightObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        en: this._enabled,
        c: this._color,
        i: this._intensity,
        uph: this._usePhysicalUnits,
        pw: this._power,
        lw: this._lightWidth,
        lh: this._lightHeight,
        dbg: this._showDebugGizmos,
      };
    }

    override updateFromNetworkSyncData(
      networkSyncData: RectAreaLightObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.en !== undefined) {
        this.setEnabled(networkSyncData.en);
      }
      if (networkSyncData.c !== undefined) {
        this.setColor(networkSyncData.c);
      }
      if (networkSyncData.i !== undefined) {
        this.setIntensity(networkSyncData.i);
      }
      if (networkSyncData.uph !== undefined) {
        this.setUsePhysicalUnits(networkSyncData.uph);
      }
      if (networkSyncData.pw !== undefined) {
        this.setPower(networkSyncData.pw);
      }
      if (networkSyncData.lw !== undefined) {
        this.setLightWidth(networkSyncData.lw);
      }
      if (networkSyncData.lh !== undefined) {
        this.setLightHeight(networkSyncData.lh);
      }
      if (networkSyncData.dbg !== undefined) {
        this.setShowDebugGizmos(networkSyncData.dbg);
      }
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
      this._renderer.setColor(this._color);
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

    setLightWidth(lightWidth: number): void {
      this._lightWidth = Math.max(1, lightWidth);
      this._renderer.setLightWidth(this._lightWidth);
    }

    getLightWidth(): number {
      return this._lightWidth;
    }

    setLightHeight(lightHeight: number): void {
      this._lightHeight = Math.max(1, lightHeight);
      this._renderer.setLightHeight(this._lightHeight);
    }

    getLightHeight(): number {
      return this._lightHeight;
    }

    setShowDebugGizmos(showDebugGizmos: boolean): void {
      this._showDebugGizmos = !!showDebugGizmos;
      this._renderer.setShowDebugGizmos(this._showDebugGizmos);
    }

    areDebugGizmosShown(): boolean {
      return this._showDebugGizmos;
    }
  }

  export class RectAreaLightRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _rectAreaLight: THREE.RectAreaLight;
    private _rectAreaFallbackSpotLight: THREE.SpotLight;
    private _rectAreaFallbackTarget: THREE.Object3D;
    private _selectionProxyMesh: THREE.Mesh;
    private _selectionProxyLogoMaterial: THREE.MeshBasicMaterial;
    private _debugAreaHelper: THREE.LineSegments;
    private _runtimeEnabled: boolean;
    private _showDebugGizmos: boolean;
    private _usePhysicalUnits: boolean;
    private _power: number;
    private _baseIntensity: number;
    private _baseLightWidth: number;
    private _baseLightHeight: number;
    private _pipelineRealtimeMultiplier: number;
    private _pipelineRefreshCooldown: integer;

    constructor(
      runtimeObject: gdjs.RectAreaLightRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      initializeRectAreaLightSupport();

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

      const rectAreaLight = new THREE.RectAreaLight(0xffffff, 35, 180, 90);
      rectAreaLight.position.set(0, 0, 0);
      threeGroup.add(rectAreaLight);
      const rectAreaFallbackSpotLight = new THREE.SpotLight(
        0xffffff,
        2.5,
        520,
        gdjs.toRad(80),
        0.75,
        2
      );
      rectAreaFallbackSpotLight.castShadow = false;
      const rectAreaFallbackTarget = new THREE.Object3D();
      rectAreaFallbackTarget.position.set(0, 0, -520);
      rectAreaFallbackSpotLight.target = rectAreaFallbackTarget;
      threeGroup.add(rectAreaFallbackSpotLight);
      threeGroup.add(rectAreaFallbackTarget);

      const helperGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1));
      const helperMaterial = new THREE.LineBasicMaterial({
        color: 0xa8f7ea,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const debugAreaHelper = new THREE.LineSegments(helperGeometry, helperMaterial);
      debugAreaHelper.visible = false;
      threeGroup.add(debugAreaHelper);

      super(runtimeObject, instanceContainer, threeGroup);

      this._rectAreaLight = rectAreaLight;
      this._rectAreaFallbackSpotLight = rectAreaFallbackSpotLight;
      this._rectAreaFallbackTarget = rectAreaFallbackTarget;
      this._selectionProxyMesh = selectionProxyMesh;
      this._selectionProxyLogoMaterial = logoFaceMaterial;
      this._debugAreaHelper = debugAreaHelper;
      this._runtimeEnabled = true;
      this._showDebugGizmos = true;
      this._usePhysicalUnits = true;
      this._power = 22000;
      this._baseIntensity = 35;
      this._baseLightWidth = 180;
      this._baseLightHeight = 90;
      this._pipelineRealtimeMultiplier = 1;
      this._pipelineRefreshCooldown = 0;

      this.updateSize();
      this.updatePosition();
      this.updateRotation();
      this._updateAreaSize();
      this._applyLightingPipeline();
      this._updateLightVisibility();
    }

    override updateSize(): void {
      // Keep area light dimensions independent from object scaling.
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

      if (this._usePhysicalUnits && this._rectAreaLight.power !== undefined) {
        this._rectAreaLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier
        );
      } else {
        this._rectAreaLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
      const fallbackDistance = Math.max(
        140,
        Math.max(this._baseLightWidth, this._baseLightHeight) * 3
      );
      this._rectAreaFallbackSpotLight.distance = fallbackDistance;
      this._rectAreaFallbackSpotLight.angle = gdjs.toRad(80);
      this._rectAreaFallbackSpotLight.penumbra = 0.75;
      this._rectAreaFallbackSpotLight.decay = 2;
      this._rectAreaFallbackTarget.position.set(0, 0, -fallbackDistance);
      this._rectAreaFallbackTarget.updateMatrixWorld(true);
      this._rectAreaFallbackSpotLight.color.copy(this._rectAreaLight.color);
      if (
        this._usePhysicalUnits &&
        this._rectAreaFallbackSpotLight.power !== undefined
      ) {
        this._rectAreaFallbackSpotLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier * 0.55
        );
      } else {
        this._rectAreaFallbackSpotLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier * 2.2
        );
      }
    }

    private _updateAreaSize(): void {
      this._rectAreaLight.width = this._baseLightWidth;
      this._rectAreaLight.height = this._baseLightHeight;
      this._debugAreaHelper.scale.set(this._baseLightWidth, this._baseLightHeight, 1);
    }

    private _updateLightVisibility(): void {
      const objectVisible = !this._object.isHidden();
      this._rectAreaLight.visible =
        objectVisible && this._runtimeEnabled && rectAreaLightSupportAvailable;
      this._rectAreaFallbackSpotLight.visible =
        objectVisible && this._runtimeEnabled && !rectAreaLightSupportAvailable;
      this._selectionProxyMesh.visible =
        objectVisible &&
        this._runtimeEnabled &&
        this._shouldShowSelectionProxy();
      this._debugAreaHelper.visible =
        this._showDebugGizmos && objectVisible && this._runtimeEnabled;
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

    updatePreRender(_runtimeScene: gdjs.RuntimeScene): void {
      if (this._pipelineRefreshCooldown <= 0) {
        this._pipelineRefreshCooldown = 4;
        this._applyLightingPipeline();
      } else {
        this._pipelineRefreshCooldown--;
      }
      this._updateLightVisibility();
    }

    setRuntimeEnabled(enabled: boolean): void {
      this._runtimeEnabled = !!enabled;
      this._updateLightVisibility();
    }

    setColor(color: string): void {
      this._rectAreaLight.color.set(gdjs.rgbOrHexStringToNumber(color));
      this._rectAreaFallbackSpotLight.color.copy(this._rectAreaLight.color);
      this._selectionProxyLogoMaterial.color.copy(this._rectAreaLight.color);
    }

    setIntensity(intensity: number): void {
      this._baseIntensity = Math.max(0, intensity);
      if (!this._usePhysicalUnits) {
        this._rectAreaLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
    }

    setUsePhysicalUnits(usePhysicalUnits: boolean): void {
      this._usePhysicalUnits = !!usePhysicalUnits;
      if (this._usePhysicalUnits) {
        if (this._rectAreaLight.power !== undefined) {
          this._rectAreaLight.power = Math.max(
            0,
            this._power * this._pipelineRealtimeMultiplier
          );
        }
      } else {
        this._rectAreaLight.intensity = Math.max(
          0,
          this._baseIntensity * this._pipelineRealtimeMultiplier
        );
      }
    }

    setPower(power: number): void {
      this._power = Math.max(0, power);
      if (this._usePhysicalUnits && this._rectAreaLight.power !== undefined) {
        this._rectAreaLight.power = Math.max(
          0,
          this._power * this._pipelineRealtimeMultiplier
        );
      }
    }

    setLightWidth(lightWidth: number): void {
      this._baseLightWidth = Math.max(1, lightWidth);
      this._updateAreaSize();
    }

    setLightHeight(lightHeight: number): void {
      this._baseLightHeight = Math.max(1, lightHeight);
      this._updateAreaSize();
    }

    setShowDebugGizmos(showDebugGizmos: boolean): void {
      this._showDebugGizmos = !!showDebugGizmos;
      this._updateLightVisibility();
    }
  }

  gdjs.registerObject(
    'Scene3D::RectAreaLightObject',
    gdjs.RectAreaLightRuntimeObject
  );
}

