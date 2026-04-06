namespace gdjs {
  const AUTO_CHANNEL_OFFSET = 200000000;

  const clampVolumePercent = (value: number): number =>
    Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));
  const clampPitch = (value: number): number =>
    Math.max(0.01, Number.isFinite(value) ? value : 1);
  const clampChannel = (value: number): integer =>
    Number.isFinite(value) ? Math.floor(value) : -1;
  const clampDistance = (value: number, fallback: number): number =>
    Math.max(1, Number.isFinite(value) ? value : fallback);
  const clampDistanceModel = (value: string): 'inverse' | 'linear' =>
    value === 'linear' ? 'linear' : 'inverse';
  const clampPanningModel = (value: string): 'HRTF' | 'equalpower' =>
    value === 'equalpower' ? 'equalpower' : 'HRTF';
  const clampConeAngle = (value: number, fallback: number): number =>
    Math.max(0, Math.min(360, Number.isFinite(value) ? value : fallback));
  const clampConeOuterGain = (value: number): number =>
    Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const defaultSoundEmitterRefDistance = 120;
  const defaultSoundEmitterMaxDistance = 1800;
  const defaultSoundEmitterRolloffFactor = 1.15;
  const defaultSoundEmitterHelperSize = 24;
  const minSoundEmitterHelperSize = 12;
  const maxSoundEmitterHelperSize = 96;

  const clampSoundEmitterHelperSize = (value: number): number =>
    Math.max(
      minSoundEmitterHelperSize,
      Math.min(
        maxSoundEmitterHelperSize,
        Number.isFinite(value) ? value : defaultSoundEmitterHelperSize
      )
    );

  const sanitizeSoundEmitterDistanceRange = (
    refDistance: number,
    maxDistance: number
  ): [number, number] => {
    const safeRefDistance = Math.max(1, Number.isFinite(refDistance) ? refDistance : 1);
    const safeMaxDistance = Math.max(
      safeRefDistance + 1,
      Number.isFinite(maxDistance) ? maxDistance : safeRefDistance + 1
    );
    return [safeRefDistance, safeMaxDistance];
  };

  let soundSelectionIconTexture: THREE.Texture | null = null;
  const getSoundSelectionIconTexture = (): THREE.Texture => {
    if (soundSelectionIconTexture) {
      return soundSelectionIconTexture;
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

        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(32, 50);
        context.lineTo(52, 50);
        context.lineTo(73, 34);
        context.lineTo(73, 94);
        context.lineTo(52, 78);
        context.lineTo(32, 78);
        context.closePath();
        context.fill();

        context.strokeStyle = '#ffffff';
        context.lineWidth = 8;
        context.beginPath();
        context.arc(76, 64, 18, -0.8, 0.8);
        context.stroke();
        context.lineWidth = 6;
        context.beginPath();
        context.arc(76, 64, 30, -0.8, 0.8);
        context.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      if ('colorSpace' in texture && THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      soundSelectionIconTexture = texture;
      return soundSelectionIconTexture;
    }

    const fallbackData = new Uint8Array([255, 255, 255, 255]);
    const fallbackTexture = new THREE.DataTexture(fallbackData, 1, 1);
    fallbackTexture.needsUpdate = true;
    soundSelectionIconTexture = fallbackTexture;
    return soundSelectionIconTexture;
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
      map: getSoundSelectionIconTexture(),
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

  const createSoundRangeWireGeometry = (distance: number): THREE.BufferGeometry => {
    const safeDistance = Math.max(10, Number.isFinite(distance) ? distance : 1200);
    const points: THREE.Vector3[] = [];
    const segmentCount = 36;
    const arcStart = -0.95;
    const arcLength = 1.9;
    const ringScales = [0.36, 0.68, 1];

    for (let ringIndex = 0; ringIndex < ringScales.length; ringIndex++) {
      const radius = safeDistance * ringScales[ringIndex];
      for (let i = 0; i < segmentCount; i++) {
        const theta = arcStart + (i / segmentCount) * arcLength * Math.PI;
        const nextTheta =
          arcStart + ((i + 1) / segmentCount) * arcLength * Math.PI;

        // Audio wave arcs on YZ plane (front hemisphere around -Z).
        points.push(
          new THREE.Vector3(
            0,
            Math.sin(theta) * radius,
            -Math.cos(theta) * radius
          ),
          new THREE.Vector3(
            0,
            Math.sin(nextTheta) * radius,
            -Math.cos(nextTheta) * radius
          )
        );

        // Audio wave arcs on XZ plane.
        points.push(
          new THREE.Vector3(
            Math.sin(theta) * radius,
            0,
            -Math.cos(theta) * radius
          ),
          new THREE.Vector3(
            Math.sin(nextTheta) * radius,
            0,
            -Math.cos(nextTheta) * radius
          )
        );
      }
    }

    // Outer reference ring for max audible distance.
    for (let i = 0; i < segmentCount; i++) {
      const theta = (i / segmentCount) * Math.PI * 2;
      const nextTheta = ((i + 1) / segmentCount) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(theta) * safeDistance,
          Math.sin(theta) * safeDistance,
          0
        ),
        new THREE.Vector3(
          Math.cos(nextTheta) * safeDistance,
          Math.sin(nextTheta) * safeDistance,
          0
        )
      );
    }

    // Small forward axis hint.
    points.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -safeDistance));

    return new THREE.BufferGeometry().setFromPoints(points);
  };

  export interface SoundEmitterObjectData extends Object3DData {
    content: Object3DDataContent & {
      enabled: boolean | undefined;
      soundResourceName: string;
      autoPlay: boolean | undefined;
      loop: boolean | undefined;
      volume: number | undefined;
      pitch: number | undefined;
      channel: number | undefined;
      refDistance: number | undefined;
      maxDistance: number | undefined;
      rolloffFactor: number | undefined;
      distanceModel: 'inverse' | 'linear' | undefined;
      panningModel: 'HRTF' | 'equalpower' | undefined;
      coneInnerAngle: number | undefined;
      coneOuterAngle: number | undefined;
      coneOuterGain: number | undefined;
      followObjectRotation: boolean | undefined;
      showDebugGizmos: boolean | undefined;
    };
  }

  type SoundEmitterObjectNetworkSyncDataType = {
    en: boolean;
    sr: string;
    ap: boolean;
    lp: boolean;
    v: number;
    p: number;
    ch: number;
    rd: number;
    md: number;
    rf: number;
    dm: 'inverse' | 'linear';
    pm: 'HRTF' | 'equalpower';
    cia: number;
    coa: number;
    cog: number;
    for: boolean;
    dbg: boolean;
  };

  type SoundEmitterObjectNetworkSyncData = Object3DNetworkSyncData &
    SoundEmitterObjectNetworkSyncDataType;

  export class SoundEmitterRuntimeObject extends gdjs.RuntimeObject3D {
    private _renderer: gdjs.SoundEmitterRuntimeObjectRenderer;

    private _enabled: boolean;
    private _soundResourceName: string;
    private _autoPlay: boolean;
    private _loop: boolean;
    private _volume: number;
    private _pitch: number;
    private _channel: integer;
    private _refDistance: number;
    private _maxDistance: number;
    private _rolloffFactor: number;
    private _distanceModel: 'inverse' | 'linear';
    private _panningModel: 'HRTF' | 'equalpower';
    private _coneInnerAngle: number;
    private _coneOuterAngle: number;
    private _coneOuterGain: number;
    private _followObjectRotation: boolean;
    private _showDebugGizmos: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: SoundEmitterObjectData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);

      const objectContent = objectData.content;
      this._enabled =
        objectContent.enabled === undefined ? true : !!objectContent.enabled;
      this._soundResourceName = objectContent.soundResourceName || '';
      this._autoPlay =
        objectContent.autoPlay === undefined ? true : !!objectContent.autoPlay;
      this._loop = objectContent.loop === undefined ? true : !!objectContent.loop;
      this._volume = clampVolumePercent(
        objectContent.volume !== undefined ? objectContent.volume : 100
      );
      this._pitch = clampPitch(
        objectContent.pitch !== undefined ? objectContent.pitch : 1
      );
      this._channel = clampChannel(
        objectContent.channel !== undefined ? objectContent.channel : -1
      );
      const initialRefDistance = clampDistance(
        objectContent.refDistance !== undefined
          ? objectContent.refDistance
          : defaultSoundEmitterRefDistance,
        defaultSoundEmitterRefDistance
      );
      const initialMaxDistance = clampDistance(
        objectContent.maxDistance !== undefined
          ? objectContent.maxDistance
          : defaultSoundEmitterMaxDistance,
        defaultSoundEmitterMaxDistance
      );
      [this._refDistance, this._maxDistance] = sanitizeSoundEmitterDistanceRange(
        initialRefDistance,
        initialMaxDistance
      );
      this._rolloffFactor = Math.max(
        0,
        Number.isFinite(objectContent.rolloffFactor)
          ? objectContent.rolloffFactor!
          : defaultSoundEmitterRolloffFactor
      );
      this._distanceModel = clampDistanceModel(
        objectContent.distanceModel || 'inverse'
      );
      this._panningModel = clampPanningModel(
        objectContent.panningModel || 'HRTF'
      );
      this._coneInnerAngle = clampConeAngle(
        objectContent.coneInnerAngle !== undefined
          ? objectContent.coneInnerAngle
          : 360,
        360
      );
      this._coneOuterAngle = clampConeAngle(
        objectContent.coneOuterAngle !== undefined
          ? objectContent.coneOuterAngle
          : 360,
        360
      );
      this._coneOuterGain = clampConeOuterGain(
        objectContent.coneOuterGain !== undefined
          ? objectContent.coneOuterGain
          : 0
      );
      this._followObjectRotation =
        objectContent.followObjectRotation === undefined
          ? false
          : !!objectContent.followObjectRotation;
      this._showDebugGizmos =
        objectContent.showDebugGizmos === undefined
          ? true
          : !!objectContent.showDebugGizmos;

      this._renderer = new gdjs.SoundEmitterRuntimeObjectRenderer(
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
      this._renderer.setRuntimeEnabled(this._enabled);
      this._renderer.setSoundResourceName(this._soundResourceName);
      this._renderer.setAutoPlay(this._autoPlay);
      this._renderer.setLoop(this._loop);
      this._renderer.setVolume(this._volume);
      this._renderer.setPitch(this._pitch);
      this._renderer.setChannel(this._channel);
      this._renderer.setRefDistance(this._refDistance);
      this._renderer.setMaxDistance(this._maxDistance);
      this._renderer.setRolloffFactor(this._rolloffFactor);
      this._renderer.setDistanceModel(this._distanceModel);
      this._renderer.setPanningModel(this._panningModel);
      this._renderer.setConeInnerAngle(this._coneInnerAngle);
      this._renderer.setConeOuterAngle(this._coneOuterAngle);
      this._renderer.setConeOuterGain(this._coneOuterGain);
      this._renderer.setFollowObjectRotation(this._followObjectRotation);
      this._renderer.setShowDebugGizmos(this._showDebugGizmos);
    }

    override updateFromObjectData(
      oldObjectData: SoundEmitterObjectData,
      newObjectData: SoundEmitterObjectData
    ): boolean {
      super.updateFromObjectData(oldObjectData, newObjectData);

      const objectContent = newObjectData.content;
      this.setEnabled(
        objectContent.enabled === undefined ? true : !!objectContent.enabled
      );
      this.setSoundResourceName(objectContent.soundResourceName || '');
      this.setAutoPlay(
        objectContent.autoPlay === undefined ? true : !!objectContent.autoPlay
      );
      this.setLoop(objectContent.loop === undefined ? true : !!objectContent.loop);
      this.setVolume(
        objectContent.volume !== undefined ? objectContent.volume : 100
      );
      this.setPitch(objectContent.pitch !== undefined ? objectContent.pitch : 1);
      this.setChannel(
        objectContent.channel !== undefined ? objectContent.channel : -1
      );
      this.setRefDistance(
        objectContent.refDistance !== undefined
          ? objectContent.refDistance
          : defaultSoundEmitterRefDistance
      );
      this.setMaxDistance(
        objectContent.maxDistance !== undefined
          ? objectContent.maxDistance
          : defaultSoundEmitterMaxDistance
      );
      this.setRolloffFactor(
        objectContent.rolloffFactor !== undefined
          ? objectContent.rolloffFactor
          : defaultSoundEmitterRolloffFactor
      );
      this.setDistanceModel(objectContent.distanceModel || 'inverse');
      this.setPanningModel(objectContent.panningModel || 'HRTF');
      this.setConeInnerAngle(
        objectContent.coneInnerAngle !== undefined
          ? objectContent.coneInnerAngle
          : 360
      );
      this.setConeOuterAngle(
        objectContent.coneOuterAngle !== undefined
          ? objectContent.coneOuterAngle
          : 360
      );
      this.setConeOuterGain(
        objectContent.coneOuterGain !== undefined ? objectContent.coneOuterGain : 0
      );
      this.setFollowObjectRotation(
        objectContent.followObjectRotation === undefined
          ? false
          : !!objectContent.followObjectRotation
      );
      this.setShowDebugGizmos(
        objectContent.showDebugGizmos === undefined
          ? true
          : !!objectContent.showDebugGizmos
      );

      return true;
    }

    override onDeletedFromScene(): void {
      this._renderer.disposeManagedSound(this.getRuntimeScene());
      super.onDeletedFromScene();
    }

    override onDestroyed(): void {
      this._renderer.disposeManagedSound(this.getRuntimeScene());
      super.onDestroyed();
    }

    override updatePreRender(): void {
      this._renderer.updatePreRender(this.getRuntimeScene());
    }

    override getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): SoundEmitterObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        en: this._enabled,
        sr: this._soundResourceName,
        ap: this._autoPlay,
        lp: this._loop,
        v: this._volume,
        p: this._pitch,
        ch: this._channel,
        rd: this._refDistance,
        md: this._maxDistance,
        rf: this._rolloffFactor,
        dm: this._distanceModel,
        pm: this._panningModel,
        cia: this._coneInnerAngle,
        coa: this._coneOuterAngle,
        cog: this._coneOuterGain,
        for: this._followObjectRotation,
        dbg: this._showDebugGizmos,
      };
    }

    override updateFromNetworkSyncData(
      networkSyncData: SoundEmitterObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.en !== undefined) {
        this.setEnabled(networkSyncData.en);
      }
      if (networkSyncData.sr !== undefined) {
        this.setSoundResourceName(networkSyncData.sr);
      }
      if (networkSyncData.ap !== undefined) {
        this.setAutoPlay(networkSyncData.ap);
      }
      if (networkSyncData.lp !== undefined) {
        this.setLoop(networkSyncData.lp);
      }
      if (networkSyncData.v !== undefined) {
        this.setVolume(networkSyncData.v);
      }
      if (networkSyncData.p !== undefined) {
        this.setPitch(networkSyncData.p);
      }
      if (networkSyncData.ch !== undefined) {
        this.setChannel(networkSyncData.ch);
      }
      if (networkSyncData.rd !== undefined) {
        this.setRefDistance(networkSyncData.rd);
      }
      if (networkSyncData.md !== undefined) {
        this.setMaxDistance(networkSyncData.md);
      }
      if (networkSyncData.rf !== undefined) {
        this.setRolloffFactor(networkSyncData.rf);
      }
      if (networkSyncData.dm !== undefined) {
        this.setDistanceModel(networkSyncData.dm);
      }
      if (networkSyncData.pm !== undefined) {
        this.setPanningModel(networkSyncData.pm);
      }
      if (networkSyncData.cia !== undefined) {
        this.setConeInnerAngle(networkSyncData.cia);
      }
      if (networkSyncData.coa !== undefined) {
        this.setConeOuterAngle(networkSyncData.coa);
      }
      if (networkSyncData.cog !== undefined) {
        this.setConeOuterGain(networkSyncData.cog);
      }
      if (networkSyncData.for !== undefined) {
        this.setFollowObjectRotation(networkSyncData.for);
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

    setSoundResourceName(soundResourceName: string): void {
      this._soundResourceName = soundResourceName || '';
      this._renderer.setSoundResourceName(this._soundResourceName);
    }

    getSoundResourceName(): string {
      return this._soundResourceName;
    }

    setAutoPlay(autoPlay: boolean): void {
      this._autoPlay = !!autoPlay;
      this._renderer.setAutoPlay(this._autoPlay);
    }

    isAutoPlayEnabled(): boolean {
      return this._autoPlay;
    }

    setLoop(loop: boolean): void {
      this._loop = !!loop;
      this._renderer.setLoop(this._loop);
    }

    isLoopEnabled(): boolean {
      return this._loop;
    }

    setVolume(volume: number): void {
      this._volume = clampVolumePercent(volume);
      this._renderer.setVolume(this._volume);
    }

    getVolume(): number {
      return this._volume;
    }

    setPitch(pitch: number): void {
      this._pitch = clampPitch(pitch);
      this._renderer.setPitch(this._pitch);
    }

    getPitch(): number {
      return this._pitch;
    }

    setChannel(channel: number): void {
      this._channel = clampChannel(channel);
      this._renderer.setChannel(this._channel);
    }

    getChannel(): number {
      return this._channel;
    }

    setRefDistance(refDistance: number): void {
      const [safeRefDistance, safeMaxDistance] = sanitizeSoundEmitterDistanceRange(
        clampDistance(refDistance, defaultSoundEmitterRefDistance),
        this._maxDistance
      );
      this._refDistance = safeRefDistance;
      if (this._maxDistance !== safeMaxDistance) {
        this._maxDistance = safeMaxDistance;
        this._renderer.setMaxDistance(this._maxDistance);
      }
      this._renderer.setRefDistance(this._refDistance);
    }

    getRefDistance(): number {
      return this._refDistance;
    }

    setMaxDistance(maxDistance: number): void {
      const [safeRefDistance, safeMaxDistance] = sanitizeSoundEmitterDistanceRange(
        this._refDistance,
        clampDistance(maxDistance, defaultSoundEmitterMaxDistance)
      );
      if (this._refDistance !== safeRefDistance) {
        this._refDistance = safeRefDistance;
        this._renderer.setRefDistance(this._refDistance);
      }
      this._maxDistance = safeMaxDistance;
      this._renderer.setMaxDistance(this._maxDistance);
    }

    getMaxDistance(): number {
      return this._maxDistance;
    }

    setRolloffFactor(rolloffFactor: number): void {
      this._rolloffFactor = Math.max(
        0,
        Number.isFinite(rolloffFactor) ? rolloffFactor : 1
      );
      this._renderer.setRolloffFactor(this._rolloffFactor);
    }

    getRolloffFactor(): number {
      return this._rolloffFactor;
    }

    setDistanceModel(distanceModel: string): void {
      this._distanceModel = clampDistanceModel(distanceModel);
      this._renderer.setDistanceModel(this._distanceModel);
    }

    getDistanceModel(): 'inverse' | 'linear' {
      return this._distanceModel;
    }

    setPanningModel(panningModel: string): void {
      this._panningModel = clampPanningModel(panningModel);
      this._renderer.setPanningModel(this._panningModel);
    }

    getPanningModel(): 'HRTF' | 'equalpower' {
      return this._panningModel;
    }

    setConeInnerAngle(coneInnerAngle: number): void {
      this._coneInnerAngle = clampConeAngle(coneInnerAngle, 360);
      this._renderer.setConeInnerAngle(this._coneInnerAngle);
    }

    getConeInnerAngle(): number {
      return this._coneInnerAngle;
    }

    setConeOuterAngle(coneOuterAngle: number): void {
      this._coneOuterAngle = clampConeAngle(coneOuterAngle, 360);
      this._renderer.setConeOuterAngle(this._coneOuterAngle);
    }

    getConeOuterAngle(): number {
      return this._coneOuterAngle;
    }

    setConeOuterGain(coneOuterGain: number): void {
      this._coneOuterGain = clampConeOuterGain(coneOuterGain);
      this._renderer.setConeOuterGain(this._coneOuterGain);
    }

    getConeOuterGain(): number {
      return this._coneOuterGain;
    }

    setFollowObjectRotation(followObjectRotation: boolean): void {
      this._followObjectRotation = !!followObjectRotation;
      this._renderer.setFollowObjectRotation(this._followObjectRotation);
    }

    isFollowingObjectRotation(): boolean {
      return this._followObjectRotation;
    }

    setShowDebugGizmos(showDebugGizmos: boolean): void {
      this._showDebugGizmos = !!showDebugGizmos;
      this._renderer.setShowDebugGizmos(this._showDebugGizmos);
    }

    areDebugGizmosShown(): boolean {
      return this._showDebugGizmos;
    }

    play(): void {
      this._renderer.playFromEvents();
    }

    stop(): void {
      this._renderer.stopFromEvents();
    }

    refreshSpatialization(): void {
      this._renderer.refreshSpatialization();
    }

    isPlaying(): boolean {
      return this._renderer.isPlaying();
    }
  }

  export class SoundEmitterRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _selectionProxyMesh: THREE.Mesh;
    private _selectionProxyLogoMaterial: THREE.MeshBasicMaterial;
    private _debugRangeLines: THREE.LineSegments;
    private _debugRangeSignature: string;
    private _runtimeEnabled: boolean;
    private _soundResourceName: string;
    private _autoPlay: boolean;
    private _loop: boolean;
    private _volume: number;
    private _pitch: number;
    private _channel: integer;
    private _refDistance: number;
    private _maxDistance: number;
    private _rolloffFactor: number;
    private _distanceModel: 'inverse' | 'linear';
    private _panningModel: 'HRTF' | 'equalpower';
    private _coneInnerAngle: number;
    private _coneOuterAngle: number;
    private _coneOuterGain: number;
    private _followObjectRotation: boolean;
    private _showDebugGizmos: boolean;
    private _lastEffectiveChannel: integer | null;
    private _tempForwardDirection: THREE.Vector3;
    private _tempCameraPosition: THREE.Vector3;
    private _tempCameraDirection: THREE.Vector3;
    private _tempCameraUp: THREE.Vector3;
    private _manualPlayRequested: boolean;

    constructor(
      runtimeObject: gdjs.SoundEmitterRuntimeObject,
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

      const debugRangeLines = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: 0x9edbff,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
          depthTest: false,
        })
      );
      debugRangeLines.frustumCulled = false;
      debugRangeLines.renderOrder = 9998;
      threeGroup.add(debugRangeLines);

      super(runtimeObject, instanceContainer, threeGroup);

      this._selectionProxyMesh = selectionProxyMesh;
      this._selectionProxyLogoMaterial = logoFaceMaterial;
      this._debugRangeLines = debugRangeLines;
      this._debugRangeSignature = '';
      this._runtimeEnabled = true;
      this._soundResourceName = '';
      this._autoPlay = true;
      this._loop = true;
      this._volume = 1;
      this._pitch = 1;
      this._channel = -1;
      this._refDistance = defaultSoundEmitterRefDistance;
      this._maxDistance = defaultSoundEmitterMaxDistance;
      this._rolloffFactor = defaultSoundEmitterRolloffFactor;
      this._distanceModel = 'inverse';
      this._panningModel = 'HRTF';
      this._coneInnerAngle = 360;
      this._coneOuterAngle = 360;
      this._coneOuterGain = 0;
      this._followObjectRotation = false;
      this._showDebugGizmos = true;
      this._lastEffectiveChannel = null;
      this._tempForwardDirection = new THREE.Vector3(0, 0, -1);
      this._tempCameraPosition = new THREE.Vector3();
      this._tempCameraDirection = new THREE.Vector3();
      this._tempCameraUp = new THREE.Vector3(0, 1, 0);
      this._manualPlayRequested = false;

      this.updateSize();
      this.updatePosition();
      this.updateRotation();
      this._refreshDebugRangeGeometry();
      this._updateVisibility();
    }

    override updateSize(): void {
      const object = this._object;
      const width = clampSoundEmitterHelperSize(Math.abs(object.getWidth()));
      const height = clampSoundEmitterHelperSize(Math.abs(object.getHeight()));
      const depth = clampSoundEmitterHelperSize(Math.abs(object.getDepth()));
      this._selectionProxyMesh.scale.set(
        object.isFlippedX() ? -width : width,
        object.isFlippedY() ? -height : height,
        object.isFlippedZ() ? -depth : depth
      );
      this.updatePosition();
    }

    override updateVisibility(): void {
      this._updateVisibility();
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

    private _shouldShowDebugHelpers(): boolean {
      return this._shouldShowSelectionProxy();
    }

    private _updateVisibility(): void {
      const objectVisible = !this._object.isHidden() && this._runtimeEnabled;
      const editorVisible = this._shouldShowSelectionProxy();
      this._selectionProxyMesh.visible =
        objectVisible && editorVisible;
      this._debugRangeLines.visible =
        objectVisible && this._showDebugGizmos && this._shouldShowDebugHelpers();
    }

    private _getSoundManager(
      runtimeScene: gdjs.RuntimeScene | null | undefined
    ): (gdjs.SoundManager & {
      playSoundOnChannel?: Function;
      getSoundOnChannel?: Function;
      setSoundSpatialPositionOnChannel?: Function;
      setSoundListenerSpatialPosition?: Function;
      setSoundListenerSpatialOrientation?: Function;
    }) | null {
      if (!runtimeScene) {
        return null;
      }
      const soundManager = runtimeScene.getSoundManager() as gdjs.SoundManager & {
        playSoundOnChannel?: Function;
        getSoundOnChannel?: Function;
        setSoundSpatialPositionOnChannel?: Function;
        setSoundListenerSpatialPosition?: Function;
        setSoundListenerSpatialOrientation?: Function;
      };
      if (!soundManager) {
        return null;
      }
      return soundManager;
    }

    private _getEffectiveChannel(): integer {
      if (this._channel >= 0) {
        return this._channel;
      }
      return AUTO_CHANNEL_OFFSET + this._object.getUniqueId();
    }

    private _isOurSound(sound: any): boolean {
      if (!sound) {
        return false;
      }
      if (typeof sound._audioResourceName === 'string') {
        return sound._audioResourceName === this._soundResourceName;
      }
      return true;
    }

    private _stopManagedChannel(
      runtimeScene: gdjs.RuntimeScene | null | undefined,
      channel: integer
    ): void {
      const soundManager = this._getSoundManager(runtimeScene);
      if (
        !soundManager ||
        typeof soundManager.getSoundOnChannel !== 'function'
      ) {
        return;
      }
      const sound = soundManager.getSoundOnChannel(channel);
      if (sound && this._isOurSound(sound) && typeof sound.stop === 'function') {
        sound.stop();
      }
    }

    private _refreshDebugRangeGeometry(): void {
      const signature = this._maxDistance.toFixed(3);
      if (this._debugRangeSignature === signature) {
        return;
      }
      this._debugRangeSignature = signature;
      const oldGeometry = this._debugRangeLines.geometry;
      this._debugRangeLines.geometry = createSoundRangeWireGeometry(this._maxDistance);
      if (oldGeometry) {
        oldGeometry.dispose();
      }
    }

    private _ensurePlayback(runtimeScene: gdjs.RuntimeScene): void {
      const soundManager = this._getSoundManager(runtimeScene);
      if (
        !soundManager ||
        typeof soundManager.playSoundOnChannel !== 'function' ||
        typeof soundManager.getSoundOnChannel !== 'function'
      ) {
        return;
      }

      const effectiveChannel = this._getEffectiveChannel();
      const shouldPlay =
        this._runtimeEnabled &&
        (this._autoPlay || this._manualPlayRequested) &&
        !!this._soundResourceName &&
        this._soundResourceName.length > 0;

      if (
        this._lastEffectiveChannel !== null &&
        this._lastEffectiveChannel !== effectiveChannel
      ) {
        this._stopManagedChannel(runtimeScene, this._lastEffectiveChannel);
        this._lastEffectiveChannel = null;
      }

      if (!shouldPlay) {
        this._stopManagedChannel(runtimeScene, effectiveChannel);
        this._lastEffectiveChannel = null;
        this._manualPlayRequested = false;
        return;
      }

      let sound = soundManager.getSoundOnChannel(effectiveChannel);
      const hasOurSound = this._isOurSound(sound);

      if (!sound || !hasOurSound) {
        soundManager.playSoundOnChannel(
          this._soundResourceName,
          effectiveChannel,
          this._loop,
          this._volume * 100,
          this._pitch
        );
        sound = soundManager.getSoundOnChannel(effectiveChannel);
      }

      if (!sound) {
        return;
      }

      if (typeof sound.setLoop === 'function') {
        sound.setLoop(this._loop);
      }
      if (typeof sound.setRate === 'function') {
        sound.setRate(this._pitch);
      }
      if (typeof sound.setVolume === 'function') {
        sound.setVolume(this._volume);
      }
      if (typeof sound.playing === 'function' && !sound.playing()) {
        if (typeof sound.play === 'function') {
          sound.play();
        }
      }

      this._applyPannerAttributes(sound);
      this._lastEffectiveChannel = effectiveChannel;
      this._manualPlayRequested = false;
    }

    private _applyPannerAttributes(sound: any): void {
      const howl = sound ? sound._howl : null;
      const id = sound ? sound._id : undefined;
      if (!howl || typeof howl.pannerAttr !== 'function') {
        return;
      }
      try {
        howl.pannerAttr(
          {
            distanceModel: this._distanceModel,
            maxDistance: this._maxDistance,
            panningModel: this._panningModel,
            refDistance: this._refDistance,
            rolloffFactor: this._rolloffFactor,
            coneInnerAngle: this._coneInnerAngle,
            coneOuterAngle: this._coneOuterAngle,
            coneOuterGain: this._coneOuterGain,
          },
          id
        );
      } catch (error) {
        // Gracefully ignore unsupported spatial API.
      }
    }

    private _updateSoundPosition(runtimeScene: gdjs.RuntimeScene): void {
      const soundManager = this._getSoundManager(runtimeScene);
      if (
        !soundManager ||
        typeof soundManager.setSoundSpatialPositionOnChannel !== 'function'
      ) {
        return;
      }
      const effectiveChannel = this._getEffectiveChannel();
      soundManager.setSoundSpatialPositionOnChannel(
        effectiveChannel,
        this._object.getCenterXInScene(),
        this._object.getCenterYInScene(),
        this._object.getCenterZInScene()
      );
    }

    private _updateSoundOrientation(runtimeScene: gdjs.RuntimeScene): void {
      if (!this._followObjectRotation) {
        return;
      }
      const soundManager = this._getSoundManager(runtimeScene);
      if (
        !soundManager ||
        typeof soundManager.getSoundOnChannel !== 'function'
      ) {
        return;
      }
      const effectiveChannel = this._getEffectiveChannel();
      const sound = soundManager.getSoundOnChannel(effectiveChannel);
      if (!sound || !this._isOurSound(sound)) {
        return;
      }

      const howl = sound ? sound._howl : null;
      const id = sound ? sound._id : undefined;
      if (!howl || typeof howl.orientation !== 'function') {
        return;
      }

      this._tempForwardDirection
        .set(0, 0, -1)
        .applyEuler(
          new THREE.Euler(
            gdjs.toRad(this._object.getRotationX()),
            gdjs.toRad(this._object.getRotationY()),
            gdjs.toRad(this._object.angle),
            'ZYX'
          )
        )
        .normalize();

      try {
        howl.orientation(
          this._tempForwardDirection.x,
          this._tempForwardDirection.y,
          this._tempForwardDirection.z,
          id
        );
      } catch (error) {
        // Gracefully ignore unsupported orientation API.
      }
    }

    private _getLayerThreeCamera(
      runtimeScene: gdjs.RuntimeScene
    ): THREE.Camera | null {
      const layer = runtimeScene.getLayer(this._object.getLayer());
      if (!layer || typeof layer.getRenderer !== 'function') {
        return null;
      }
      const layerRenderer = layer.getRenderer() as any & {
        getThreeCamera?: () => THREE.Camera | null;
      };
      if (!layerRenderer || typeof layerRenderer.getThreeCamera !== 'function') {
        return null;
      }
      return layerRenderer.getThreeCamera() || null;
    }

    private _updateSpatialListener(runtimeScene: gdjs.RuntimeScene): void {
      const soundManager = this._getSoundManager(runtimeScene);
      if (
        !soundManager ||
        typeof soundManager.setSoundListenerSpatialPosition !== 'function' ||
        typeof soundManager.setSoundListenerSpatialOrientation !== 'function'
      ) {
        return;
      }

      const camera = this._getLayerThreeCamera(runtimeScene);
      if (!camera) {
        return;
      }

      camera.updateMatrixWorld();
      camera.getWorldPosition(this._tempCameraPosition);
      camera.getWorldDirection(this._tempCameraDirection).normalize();
      this._tempCameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

      soundManager.setSoundListenerSpatialPosition(
        this._tempCameraPosition.x,
        this._tempCameraPosition.y,
        this._tempCameraPosition.z
      );
      soundManager.setSoundListenerSpatialOrientation(
        this._tempCameraDirection.x,
        this._tempCameraDirection.y,
        this._tempCameraDirection.z,
        this._tempCameraUp.x,
        this._tempCameraUp.y,
        this._tempCameraUp.z
      );
    }

    updatePreRender(runtimeScene: gdjs.RuntimeScene): void {
      this._updateSpatialListener(runtimeScene);
      this._ensurePlayback(runtimeScene);
      this._updateSoundPosition(runtimeScene);
      this._updateSoundOrientation(runtimeScene);
      this._refreshDebugRangeGeometry();
      this._updateVisibility();
    }

    private _syncPlaybackState(): void {
      const runtimeScene = this._object.getRuntimeScene();
      if (!runtimeScene) {
        return;
      }
      this._updateSpatialListener(runtimeScene);
      this._ensurePlayback(runtimeScene);
      this._updateSoundPosition(runtimeScene);
      this._updateSoundOrientation(runtimeScene);
    }

    disposeManagedSound(runtimeScene: gdjs.RuntimeScene | null | undefined): void {
      if (!runtimeScene) {
        return;
      }
      if (this._lastEffectiveChannel !== null) {
        this._stopManagedChannel(runtimeScene, this._lastEffectiveChannel);
      }
      this._stopManagedChannel(runtimeScene, this._getEffectiveChannel());
      this._lastEffectiveChannel = null;
      this._manualPlayRequested = false;
    }

    setRuntimeEnabled(enabled: boolean): void {
      this._runtimeEnabled = !!enabled;
      if (!this._runtimeEnabled) {
        this.disposeManagedSound(this._object.getRuntimeScene());
      } else {
        this._syncPlaybackState();
      }
      this._updateVisibility();
    }

    setSoundResourceName(soundResourceName: string): void {
      if (this._soundResourceName === soundResourceName) {
        return;
      }
      this.disposeManagedSound(this._object.getRuntimeScene());
      this._soundResourceName = soundResourceName || '';
      this._syncPlaybackState();
    }

    setAutoPlay(autoPlay: boolean): void {
      this._autoPlay = !!autoPlay;
      if (!this._autoPlay) {
        this._manualPlayRequested = false;
        this.disposeManagedSound(this._object.getRuntimeScene());
      } else {
        this._syncPlaybackState();
      }
    }

    setLoop(loop: boolean): void {
      this._loop = !!loop;
    }

    setVolume(volumePercent: number): void {
      this._volume = clampVolumePercent(volumePercent) / 100;
      const brightness = 0.55 + this._volume * 0.45;
      this._selectionProxyLogoMaterial.color.setRGB(
        brightness,
        brightness,
        brightness
      );
    }

    setPitch(pitch: number): void {
      this._pitch = clampPitch(pitch);
    }

    setChannel(channel: number): void {
      const safeChannel = clampChannel(channel);
      if (safeChannel === this._channel) {
        return;
      }
      this.disposeManagedSound(this._object.getRuntimeScene());
      this._channel = safeChannel;
      this._syncPlaybackState();
    }

    setRefDistance(refDistance: number): void {
      const [safeRefDistance, safeMaxDistance] = sanitizeSoundEmitterDistanceRange(
        clampDistance(refDistance, defaultSoundEmitterRefDistance),
        this._maxDistance
      );
      const maxDistanceChanged = this._maxDistance !== safeMaxDistance;
      this._refDistance = safeRefDistance;
      this._maxDistance = safeMaxDistance;
      if (maxDistanceChanged) {
        this._refreshDebugRangeGeometry();
      }
    }

    setMaxDistance(maxDistance: number): void {
      const [safeRefDistance, safeMaxDistance] = sanitizeSoundEmitterDistanceRange(
        this._refDistance,
        clampDistance(maxDistance, defaultSoundEmitterMaxDistance)
      );
      this._refDistance = safeRefDistance;
      this._maxDistance = safeMaxDistance;
      this._refreshDebugRangeGeometry();
    }

    setRolloffFactor(rolloffFactor: number): void {
      this._rolloffFactor = Math.max(
        0,
        Number.isFinite(rolloffFactor) ? rolloffFactor : 1
      );
    }

    setDistanceModel(distanceModel: 'inverse' | 'linear'): void {
      this._distanceModel = clampDistanceModel(distanceModel);
    }

    setPanningModel(panningModel: 'HRTF' | 'equalpower'): void {
      this._panningModel = clampPanningModel(panningModel);
    }

    setConeInnerAngle(coneInnerAngle: number): void {
      this._coneInnerAngle = clampConeAngle(coneInnerAngle, 360);
    }

    setConeOuterAngle(coneOuterAngle: number): void {
      this._coneOuterAngle = clampConeAngle(coneOuterAngle, 360);
    }

    setConeOuterGain(coneOuterGain: number): void {
      this._coneOuterGain = clampConeOuterGain(coneOuterGain);
    }

    setFollowObjectRotation(followObjectRotation: boolean): void {
      this._followObjectRotation = !!followObjectRotation;
    }

    setShowDebugGizmos(showDebugGizmos: boolean): void {
      this._showDebugGizmos = !!showDebugGizmos;
      this._updateVisibility();
    }

    playFromEvents(): void {
      this._manualPlayRequested = true;
      this._syncPlaybackState();
    }

    stopFromEvents(): void {
      this._manualPlayRequested = false;
      this.disposeManagedSound(this._object.getRuntimeScene());
    }

    refreshSpatialization(): void {
      const runtimeScene = this._object.getRuntimeScene();
      if (!runtimeScene) {
        return;
      }
      this._updateSpatialListener(runtimeScene);
      const soundManager = this._getSoundManager(runtimeScene);
      if (!soundManager || typeof soundManager.getSoundOnChannel !== 'function') {
        return;
      }
      const sound = soundManager.getSoundOnChannel(this._getEffectiveChannel());
      if (sound && this._isOurSound(sound)) {
        this._applyPannerAttributes(sound);
      }
      this._updateSoundPosition(runtimeScene);
      this._updateSoundOrientation(runtimeScene);
    }

    isPlaying(): boolean {
      const runtimeScene = this._object.getRuntimeScene();
      if (!runtimeScene) {
        return false;
      }
      const soundManager = this._getSoundManager(runtimeScene);
      if (!soundManager || typeof soundManager.getSoundOnChannel !== 'function') {
        return false;
      }
      const sound = soundManager.getSoundOnChannel(this._getEffectiveChannel());
      if (!sound || !this._isOurSound(sound)) {
        return false;
      }
      if (typeof sound.playing === 'function') {
        return !!sound.playing();
      }
      return true;
    }
  }

  gdjs.registerObject(
    'Scene3D::SoundEmitterObject',
    gdjs.SoundEmitterRuntimeObject
  );
}
