namespace gdjs {
  interface DirectionalLightFilterNetworkSyncData {
    i: number;
    c: number;
    e: number;
    r: number;
    t: string;
    msb?: number;
    snb?: number;
    sr?: number;
    ss?: boolean;
    sss?: number;
    dfc?: number;
    fs?: number;
    msd?: number;
    csl?: number;
    sms?: number;
    sfl?: number;
    sfc?: boolean;
    sat?: boolean;
    ao?: string;
    ox?: number;
    oy?: number;
    oz?: number;
    ro?: boolean;
    fr?: boolean;
    ia?: boolean;
    fdr?: boolean;
    dro?: number;
    deo?: number;
    cc?: number;
    acc?: boolean;
    lh?: boolean;
    sh?: boolean;
  }

  interface LightingPipelineState {
    mode?: string;
    realtimeWeight?: number;
    realtimeShadowsOnly?: boolean;
    physicallyCorrectLights?: boolean;
    shadowQualityScale?: number;
    wasmSimdActive?: boolean;
    wasmSimdAutoTune?: boolean;
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

  const csmCascadeCount = 3;
  const csmIntensityWeightsByCount: { [key: number]: number[] } = {
    1: [1],
    2: [0.62, 0.38],
    3: [0.5, 0.3, 0.2],
  };

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::DirectionalLight',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }
        return new (class implements gdjs.PixiFiltersTools.Filter {
          private _top: string = 'Z+';
          private _elevation: float = 45;
          private _rotation: float = 0;
          private _shadowMapSize: float = 2048;
          private _minimumShadowBias: float = 0;
          private _shadowNormalBias: float = 0.02;
          private _shadowRadius: float = 2;
          private _shadowStabilizationEnabled: boolean = true;
          private _shadowStabilizationStep: float = 0;
          private _distanceFromCamera: float = 1500;
          private _frustumSize: float = 4000;
          private _maxShadowDistance: float = 2000;
          private _cascadeSplitLambda: float = 0.78;
          private _shadowFollowLead: float = 0.45;
          private _shadowFollowCamera: boolean = false;
          private _shadowAutoTuningEnabled: boolean = true;
          private _attachedObjectName: string = '';
          private _attachedOffsetX: float = 0;
          private _attachedOffsetY: float = 0;
          private _attachedOffsetZ: float = 0;
          private _rotateOffsetsWithObjectAngle: boolean = false;
          private _followAttachedObjectRotation3D: boolean = false;
          private _inheritAttachedObjectScale: boolean = false;
          private _followDirectionWithAttachedObjectRotation3D: boolean = false;
          private _directionRotationOffset: float = 0;
          private _directionElevationOffset: float = 0;

          private _intensity: float = 2.2;
          private _colorHex: number = 0xffffff;
          private _shadowCastingEnabled: boolean = false;
          private _isEnabled: boolean = false;
          private _pipelineRealtimeMultiplier: float = 1;
          private _pipelineAllowsRealtimeShadows: boolean = true;
          private _pipelineShadowQualityScale: float = 1;
          private _pipelineWasmSimdActive: boolean = false;
          private _pipelineWasmSimdAutoTune: boolean = true;
          private _desiredCascadeCount: integer = csmCascadeCount;
          private _adaptiveCascadeCount: boolean = true;
          private _activeCascadeCount: integer = csmCascadeCount;
          private _lightHelperEnabled: boolean = false;
          private _shadowHelperEnabled: boolean = false;

          private _lights: THREE.DirectionalLight[] = [];
          private _lightHelpers: Array<THREE.Mesh | null> = [];
          private _shadowRangeHelpers: Array<THREE.Mesh | null> = [];
          private _shadowRangeHelperSignatures: string[] = [];
          private _shadowMapDirty = true;
          private _shadowCameraDirty = true;
          private _cascadeRanges: Array<{ near: float; far: float }> = [
            { near: 0, far: 200 },
            { near: 200, far: 800 },
            { near: 800, far: 2000 },
          ];
          private _cascadeFrustumSizes: float[] = [400, 1200, 2400];
          private _cascadeMapSizes: integer[] = [2048, 1024, 512];
          private _maxRendererShadowMapSize: integer = 2048;
          private _hadPreviousCameraPosition = false;
          private _previousCameraX: float = 0;
          private _previousCameraY: float = 0;
          private _previousCameraZ: float = 0;
          private _staticAnchorInitialized = false;
          private _staticAnchorX: float = 0;
          private _staticAnchorY: float = 0;
          private _staticAnchorZ: float = 0;
          private _temporaryOffsetVector = new THREE.Vector3();
          private _temporaryDirectionVector = new THREE.Vector3(1, 0, 0);
          private _temporaryEuler = new THREE.Euler(0, 0, 0, 'ZYX');

          constructor() {
            for (let i = 0; i < csmCascadeCount; i++) {
              const light = new THREE.DirectionalLight();
              light.castShadow = false;
              this._lights.push(light);
              this._lightHelpers.push(null);
              this._shadowRangeHelpers.push(null);
              this._shadowRangeHelperSignatures.push('');
            }
            this._top = effectData.stringParameters.top || this._top;
            this._elevation =
              effectData.doubleParameters.elevation !== undefined
                ? effectData.doubleParameters.elevation
                : this._elevation;
            this._rotation =
              effectData.doubleParameters.rotation !== undefined
                ? effectData.doubleParameters.rotation
                : this._rotation;
            this._intensity = Math.max(
              0,
              effectData.doubleParameters.intensity !== undefined
                ? effectData.doubleParameters.intensity
                : this._intensity
            );
            this._distanceFromCamera = Math.max(
              10,
              effectData.doubleParameters.distanceFromCamera !== undefined
                ? effectData.doubleParameters.distanceFromCamera
                : this._distanceFromCamera
            );
            this._frustumSize = Math.max(
              64,
              effectData.doubleParameters.frustumSize !== undefined
                ? effectData.doubleParameters.frustumSize
                : this._frustumSize
            );
            this._maxShadowDistance = Math.max(
              64,
              effectData.doubleParameters.maxShadowDistance !== undefined
                ? effectData.doubleParameters.maxShadowDistance
                : this._maxShadowDistance
            );
            this._minimumShadowBias = Math.max(
              0,
              effectData.doubleParameters.minimumShadowBias !== undefined
                ? effectData.doubleParameters.minimumShadowBias
                : this._minimumShadowBias
            );
            this._shadowNormalBias = Math.max(
              0,
              effectData.doubleParameters.shadowNormalBias !== undefined
                ? effectData.doubleParameters.shadowNormalBias
                : this._shadowNormalBias
            );
            this._shadowRadius = Math.max(
              0,
              effectData.doubleParameters.shadowRadius !== undefined
                ? effectData.doubleParameters.shadowRadius
                : this._shadowRadius
            );
            this._shadowStabilizationStep = Math.max(
              0,
              effectData.doubleParameters.shadowStabilizationStep !== undefined
                ? effectData.doubleParameters.shadowStabilizationStep
                : this._shadowStabilizationStep
            );
            this._cascadeSplitLambda = gdjs.evtTools.common.clamp(
              0,
              1,
              effectData.doubleParameters.cascadeSplitLambda !== undefined
                ? effectData.doubleParameters.cascadeSplitLambda
                : this._cascadeSplitLambda
            );
            this._shadowFollowLead = gdjs.evtTools.common.clamp(
              0,
              2,
              effectData.doubleParameters.shadowFollowLead !== undefined
                ? effectData.doubleParameters.shadowFollowLead
                : this._shadowFollowLead
            );
            this._desiredCascadeCount = this._clampCascadeCount(
              effectData.doubleParameters.cascadeCount !== undefined
                ? effectData.doubleParameters.cascadeCount
                : this._desiredCascadeCount
            );
            this._adaptiveCascadeCount =
              effectData.booleanParameters.adaptiveCascadeCount === undefined
                ? true
                : !!effectData.booleanParameters.adaptiveCascadeCount;
            this._shadowCastingEnabled =
              effectData.booleanParameters.isCastingShadow === undefined
                ? false
                : !!effectData.booleanParameters.isCastingShadow;
            this._shadowStabilizationEnabled =
              effectData.booleanParameters.shadowStabilization === undefined
                ? true
                : !!effectData.booleanParameters.shadowStabilization;
            this._shadowFollowCamera =
              effectData.booleanParameters.shadowFollowCamera === undefined
                ? false
                : !!effectData.booleanParameters.shadowFollowCamera;
            this._shadowAutoTuningEnabled =
              effectData.booleanParameters.shadowAutoTuning === undefined
                ? true
                : !!effectData.booleanParameters.shadowAutoTuning;
            this._lightHelperEnabled =
              effectData.booleanParameters.lightHelper === undefined
                ? false
                : !!effectData.booleanParameters.lightHelper;
            this._shadowHelperEnabled =
              effectData.booleanParameters.shadowHelper === undefined
                ? false
                : !!effectData.booleanParameters.shadowHelper;

            this._colorHex = gdjs.rgbOrHexStringToNumber(
              effectData.stringParameters.color || '255;255;255'
            );
            this._attachedObjectName =
              effectData.stringParameters.attachedObject || '';

            if (effectData.stringParameters.shadowQuality) {
              this._applyShadowQualityPreset(
                effectData.stringParameters.shadowQuality
              );
            } else if (effectData.doubleParameters.shadowMapSize !== undefined) {
              this._shadowMapSize = this._getClosestShadowMapSize(
                effectData.doubleParameters.shadowMapSize
              );
            }

            this._refreshActiveCascadeCount();
            this._setAllLightsColor(this._colorHex);
            this._setAllLightsIntensity(this._intensity);
            this._setShadowCastingEnabled(this._shadowCastingEnabled);
            for (let i = 0; i < this._lights.length; i++) {
              this._ensureCascadeHelpers(i);
            }
            this._updateShadowCameraDirtyState();
          }

          private _updateShadowCameraDirtyState(): void {
            this._shadowCameraDirty = true;
            this._shadowMapDirty = true;
          }

          private _createHelperMaterial(
            colorHex: number,
            opacity: number
          ): THREE.MeshBasicMaterial {
            return new THREE.MeshBasicMaterial({
              color: colorHex,
              wireframe: true,
              transparent: opacity < 1,
              opacity,
              depthTest: false,
              depthWrite: false,
              toneMapped: false,
            });
          }

          private _disposeHelperMesh(mesh: THREE.Mesh | null): void {
            if (!mesh) {
              return;
            }
            if (mesh.geometry) {
              mesh.geometry.dispose();
            }
            if (Array.isArray(mesh.material)) {
              for (const material of mesh.material) {
                material.dispose();
              }
            } else if (mesh.material) {
              mesh.material.dispose();
            }
          }

          private _replaceHelperGeometry(
            mesh: THREE.Mesh,
            geometry: THREE.BufferGeometry
          ): void {
            const previousGeometry = mesh.geometry;
            mesh.geometry = geometry;
            previousGeometry.dispose();
          }

          private _createDirectionalLightHelper(): THREE.Mesh {
            const geometry = new THREE.ConeGeometry(32, 128, 3);
            geometry.translate(0, 64, 0);
            geometry.rotateZ(gdjs.toRad(-90));
            const material = this._createHelperMaterial(this._colorHex, 0.88);
            const helper = new THREE.Mesh(geometry, material);
            helper.frustumCulled = false;
            helper.renderOrder = 10000;
            return helper;
          }

          private _createDirectionalShadowHelper(cascadeIndex: integer): THREE.Mesh {
            const geometry = this._buildDirectionalShadowHelperGeometry(cascadeIndex);
            const material = this._createHelperMaterial(0xff0000, 0.82);
            const helper = new THREE.Mesh(geometry, material);
            helper.frustumCulled = false;
            helper.renderOrder = 10001;
            return helper;
          }

          private _buildDirectionalShadowHelperGeometry(
            cascadeIndex: integer
          ): THREE.BufferGeometry {
            const light = this._lights[cascadeIndex];
            const shadowCamera = light.shadow.camera as THREE.OrthographicCamera;
            const cylinderHeight = Math.max(
              1,
              (shadowCamera && Number.isFinite(shadowCamera.far)
                ? shadowCamera.far
                : this._maxShadowDistance) || this._maxShadowDistance
            );
            const cylinderRadius = Math.max(
              1,
              Math.abs(
                (shadowCamera && Number.isFinite(shadowCamera.top)
                  ? shadowCamera.top
                  : this._frustumSize / 2) || this._frustumSize / 2
              )
            );
            const geometry = new THREE.CylinderGeometry(
              cylinderRadius,
              cylinderRadius,
              cylinderHeight,
              12,
              1
            );
            geometry.translate(0, -cylinderHeight / 2, 0);
            geometry.rotateZ(gdjs.toRad(90));
            return geometry;
          }

          private _refreshCascadeShadowHelperGeometry(cascadeIndex: integer): void {
            const shadowHelper = this._shadowRangeHelpers[cascadeIndex];
            if (!shadowHelper) {
              return;
            }
            const light = this._lights[cascadeIndex];
            const shadowCamera = light.shadow.camera as THREE.OrthographicCamera;
            const shadowFar = Math.max(
              1,
              (shadowCamera && Number.isFinite(shadowCamera.far)
                ? shadowCamera.far
                : this._maxShadowDistance) || this._maxShadowDistance
            );
            const shadowTop = Math.max(
              1,
              Math.abs(
                (shadowCamera && Number.isFinite(shadowCamera.top)
                  ? shadowCamera.top
                  : this._frustumSize / 2) || this._frustumSize / 2
              )
            );
            const signature =
              Math.round(shadowTop * 100) + ':' + Math.round(shadowFar * 100);
            if (this._shadowRangeHelperSignatures[cascadeIndex] === signature) {
              return;
            }
            this._shadowRangeHelperSignatures[cascadeIndex] = signature;
            this._replaceHelperGeometry(
              shadowHelper,
              this._buildDirectionalShadowHelperGeometry(cascadeIndex)
            );
          }

          private _ensureCascadeHelpers(cascadeIndex: integer): void {
            const light = this._lights[cascadeIndex];
            if (!light) {
              return;
            }

            let lightHelper = this._lightHelpers[cascadeIndex];
            if (this._lightHelperEnabled && !lightHelper) {
              lightHelper = this._createDirectionalLightHelper();
              light.add(lightHelper);
              this._lightHelpers[cascadeIndex] = lightHelper;
            } else if (!this._lightHelperEnabled && lightHelper) {
              light.remove(lightHelper);
              this._disposeHelperMesh(lightHelper);
              this._lightHelpers[cascadeIndex] = null;
            }

            let shadowHelper = this._shadowRangeHelpers[cascadeIndex];
            if (this._shadowHelperEnabled && !shadowHelper) {
              shadowHelper = this._createDirectionalShadowHelper(cascadeIndex);
              light.add(shadowHelper);
              this._shadowRangeHelpers[cascadeIndex] = shadowHelper;
              this._shadowRangeHelperSignatures[cascadeIndex] = '';
            } else if (!this._shadowHelperEnabled && shadowHelper) {
              light.remove(shadowHelper);
              this._disposeHelperMesh(shadowHelper);
              this._shadowRangeHelpers[cascadeIndex] = null;
              this._shadowRangeHelperSignatures[cascadeIndex] = '';
            }
          }

          private _setLightHelperEnabled(enabled: boolean): void {
            if (this._lightHelperEnabled === enabled) {
              return;
            }
            this._lightHelperEnabled = enabled;
            for (let i = 0; i < this._lights.length; i++) {
              this._ensureCascadeHelpers(i);
            }
          }

          private _setShadowHelperEnabled(enabled: boolean): void {
            if (this._shadowHelperEnabled === enabled) {
              return;
            }
            this._shadowHelperEnabled = enabled;
            for (let i = 0; i < this._lights.length; i++) {
              this._ensureCascadeHelpers(i);
            }
          }

          private _refreshHelpers(): void {
            for (let cascadeIndex = 0; cascadeIndex < this._lights.length; cascadeIndex++) {
              this._ensureCascadeHelpers(cascadeIndex);
              const isPrimaryCascade = cascadeIndex === 0;
              const isCascadeActive = cascadeIndex < this._activeCascadeCount;
              const light = this._lights[cascadeIndex];

              const lightHelper = this._lightHelpers[cascadeIndex];
              if (lightHelper) {
                lightHelper.visible = isPrimaryCascade && isCascadeActive;
                const lightHelperMaterial =
                  lightHelper.material as THREE.MeshBasicMaterial;
                lightHelperMaterial.color.setHex(this._colorHex);
              }

              const shadowHelper = this._shadowRangeHelpers[cascadeIndex];
              if (shadowHelper) {
                shadowHelper.visible =
                  isPrimaryCascade && isCascadeActive && light.castShadow;
                this._refreshCascadeShadowHelperGeometry(cascadeIndex);
              }
            }
          }

          private _clampCascadeCount(value: number): integer {
            return Math.max(
              1,
              Math.min(csmCascadeCount, Math.round(Number(value) || 0))
            );
          }

          private _getCascadeIntensityWeights(count: integer): number[] {
            const clampedCount = this._clampCascadeCount(count);
            const weights =
              csmIntensityWeightsByCount[clampedCount] ||
              csmIntensityWeightsByCount[csmCascadeCount];
            if (!weights || weights.length === 0) {
              return [1];
            }
            return weights;
          }

          private _computeEffectiveCascadeCount(): integer {
            let targetCascadeCount = this._clampCascadeCount(
              this._desiredCascadeCount
            );
            if (!this._adaptiveCascadeCount) {
              return targetCascadeCount;
            }

            if (this._pipelineRealtimeMultiplier < 0.35) {
              targetCascadeCount = Math.min(targetCascadeCount, 1);
            } else if (this._pipelineRealtimeMultiplier < 0.68) {
              targetCascadeCount = Math.min(targetCascadeCount, 2);
            }

            if (this._maxShadowDistance < 900) {
              targetCascadeCount = Math.min(targetCascadeCount, 1);
            } else if (this._maxShadowDistance < 1700) {
              targetCascadeCount = Math.min(targetCascadeCount, 2);
            }

            if (this._pipelineWasmSimdActive && this._pipelineWasmSimdAutoTune) {
              // SIMD-capable profiles can afford one stronger cascade tier
              // without destabilizing frame-time in large realtime scenes.
              if (
                this._pipelineShadowQualityScale > 1.05 &&
                this._pipelineRealtimeMultiplier > 0.72
              ) {
                targetCascadeCount = Math.min(
                  csmCascadeCount,
                  targetCascadeCount + 1
                );
              }
            }

            return this._clampCascadeCount(targetCascadeCount);
          }

          private _refreshActiveCascadeCount(): void {
            const nextCascadeCount = this._computeEffectiveCascadeCount();
            if (nextCascadeCount === this._activeCascadeCount) {
              return;
            }
            this._activeCascadeCount = nextCascadeCount;
            this._updateShadowCameraDirtyState();
          }

          private _applyShadowQualityPreset(quality: string): void {
            if (quality === 'low') {
              this._shadowMapSize = this._getClosestShadowMapSize(512);
              this._desiredCascadeCount = 1;
              this._cascadeSplitLambda = 0.62;
            } else if (quality === 'medium') {
              this._shadowMapSize = this._getClosestShadowMapSize(1024);
              this._desiredCascadeCount = 2;
              this._cascadeSplitLambda = 0.72;
            } else if (quality === 'high') {
              this._shadowMapSize = this._getClosestShadowMapSize(2048);
              this._desiredCascadeCount = 3;
              this._cascadeSplitLambda = 0.8;
            }
            this._refreshActiveCascadeCount();
            this._updateShadowCameraDirtyState();
          }

          private _setAllLightsColor(colorHex: number): void {
            this._colorHex = colorHex;
            for (const light of this._lights) {
              light.color.setHex(colorHex);
            }
            for (const lightHelper of this._lightHelpers) {
              if (!lightHelper) {
                continue;
              }
              const lightHelperMaterial =
                lightHelper.material as THREE.MeshBasicMaterial;
              lightHelperMaterial.color.setHex(colorHex);
            }
          }

          private _setAllLightsIntensity(intensity: float): void {
            this._intensity = Math.max(0, intensity);
            const weights = this._getCascadeIntensityWeights(
              this._activeCascadeCount
            );
            for (let i = 0; i < this._lights.length; i++) {
              const isCascadeActive = i < this._activeCascadeCount;
              const weight =
                isCascadeActive && weights[i] !== undefined
                  ? weights[i]
                  : 0;
              this._lights[i].intensity =
                this._intensity * this._pipelineRealtimeMultiplier * weight;
              this._lights[i].visible = isCascadeActive;
              this._lights[i].target.visible = isCascadeActive;
            }
          }

          private _setShadowCastingEnabled(enabled: boolean): void {
            if (this._shadowCastingEnabled === enabled) {
              return;
            }
            this._shadowCastingEnabled = enabled;
            const shouldCastShadow =
              enabled && this._pipelineAllowsRealtimeShadows;
            for (let i = 0; i < this._lights.length; i++) {
              const light = this._lights[i];
              light.castShadow = shouldCastShadow && i < this._activeCascadeCount;
              if (shouldCastShadow) {
                light.shadow.needsUpdate = true;
              }
            }
            if (shouldCastShadow) {
              this._updateShadowCameraDirtyState();
            }
          }

          private _getClosestShadowMapSize(value: float): integer {
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

          private _clampShadowMapSizeToRenderer(size: integer): integer {
            const safeRendererMax = Math.max(
              512,
              this._maxRendererShadowMapSize
            );
            let clampedSize = 512;
            while (clampedSize * 2 <= safeRendererMax) {
              clampedSize *= 2;
            }
            return Math.max(512, Math.min(size, clampedSize));
          }

          private _computeCascadeMapSize(cascadeIndex: integer): integer {
            const baseSize = this._getClosestShadowMapSize(
              this._shadowMapSize * this._pipelineShadowQualityScale
            );
            const referenceFrustumSize = Math.max(
              64,
              this._cascadeFrustumSizes[0] || this._frustumSize
            );
            const cascadeFrustumSize = Math.max(
              64,
              this._cascadeFrustumSizes[cascadeIndex] || referenceFrustumSize
            );
            const coverageRatio = referenceFrustumSize / cascadeFrustumSize;

            // Keep similar world texel density between cascades while preserving
            // sharper detail on the first cascade.
            const detailBoost =
              this._activeCascadeCount <= 1
                ? 1.55
                : cascadeIndex === 0
                ? 1.35
                : cascadeIndex === 1
                ? 1
                : 0.78;
            const adaptiveSize = Math.max(
              512,
              Math.floor(baseSize * coverageRatio * detailBoost)
            );

            return this._clampShadowMapSizeToRenderer(
              this._getClosestShadowMapSize(adaptiveSize)
            );
          }

          private _computePracticalSplit(
            splitFactor: float,
            nearDistance: float,
            maxDistance: float
          ): float {
            const safeSplitFactor = Math.max(0, Math.min(1, splitFactor));
            const safeNearDistance = Math.max(0.01, nearDistance);
            const safeMaxDistance = Math.max(64, maxDistance);
            const baseLambda = Math.max(0, Math.min(1, this._cascadeSplitLambda));
            const distanceCoverageRatio = Math.max(
              0,
              Math.min(1, safeMaxDistance / Math.max(1, this._frustumSize))
            );
            const qualityPressure =
              this._pipelineShadowQualityScale >= 1
                ? -(this._pipelineShadowQualityScale - 1) * 0.04
                : (1 - this._pipelineShadowQualityScale) * 0.06;
            const cascadePressure =
              this._activeCascadeCount >= 3 ? 0.05 : this._activeCascadeCount === 2 ? 0.02 : 0;
            // Slightly shift split distribution toward logarithmic when distance
            // coverage grows, to preserve close-range detail.
            const adaptiveLambda = Math.max(
              0,
              Math.min(
                1,
                baseLambda +
                  (distanceCoverageRatio - 0.5) * 0.18 +
                  qualityPressure +
                  cascadePressure
              )
            );

            const uniformSplit =
              safeNearDistance +
              (safeMaxDistance - safeNearDistance) * safeSplitFactor;
            const logarithmicSplit =
              safeNearDistance *
              Math.pow(safeMaxDistance / safeNearDistance, safeSplitFactor);

            return (
              adaptiveLambda * logarithmicSplit +
              (1 - adaptiveLambda) * uniformSplit
            );
          }

          private _updateCascadeRanges(layer: gdjs.RuntimeLayer): void {
            const cameraNear = Math.max(
              0.01,
              layer.getCamera3DNearPlaneDistance()
            );
            const cameraFar = Math.max(
              cameraNear + 1,
              layer.getCamera3DFarPlaneDistance()
            );
            const safeMaxShadowDistance = Math.max(
              cameraNear + 1,
              Math.min(this._maxShadowDistance, cameraFar)
            );
            let previousSplit = cameraNear;
            for (
              let cascadeIndex = 0;
              cascadeIndex < this._activeCascadeCount;
              cascadeIndex++
            ) {
              const splitFactor = (cascadeIndex + 1) / this._activeCascadeCount;
              const computedSplit =
                cascadeIndex === this._activeCascadeCount - 1
                  ? safeMaxShadowDistance
                  : this._computePracticalSplit(
                      splitFactor,
                      cameraNear,
                      safeMaxShadowDistance
                    );
              const minimumSplit = previousSplit + 0.01;
              const remainingCascades =
                this._activeCascadeCount - cascadeIndex - 1;
              const maximumSplit =
                safeMaxShadowDistance - Math.max(0, remainingCascades) * 0.01;
              const safeSplit = Math.max(
                minimumSplit,
                Math.min(maximumSplit, computedSplit)
              );
              this._cascadeRanges[cascadeIndex].near =
                cascadeIndex === 0 ? cameraNear : previousSplit;
              this._cascadeRanges[cascadeIndex].far = safeSplit;
              previousSplit = safeSplit;
            }

            if (this._activeCascadeCount > 1) {
              const overlapStrength = Math.max(
                0.04,
                Math.min(
                  0.12,
                  0.08 +
                    (1 - Math.max(0.35, this._pipelineShadowQualityScale)) * 0.04
                )
              );
              for (
                let cascadeIndex = 1;
                cascadeIndex < this._activeCascadeCount;
                cascadeIndex++
              ) {
                const previousRange = this._cascadeRanges[cascadeIndex - 1];
                const currentRange = this._cascadeRanges[cascadeIndex];
                const previousDepth = Math.max(
                  1,
                  previousRange.far - previousRange.near
                );
                const currentDepth = Math.max(
                  1,
                  currentRange.far - currentRange.near
                );
                const overlapDistance = Math.min(
                  Math.max(8, Math.min(previousDepth, currentDepth) * overlapStrength),
                  Math.min(previousDepth, currentDepth) * 0.3
                );
                const halfOverlap = overlapDistance * 0.5;
                previousRange.far = Math.min(
                  safeMaxShadowDistance,
                  previousRange.far + halfOverlap
                );
                currentRange.near = Math.max(cameraNear, currentRange.near - halfOverlap);
                if (previousRange.far < previousRange.near + 0.01) {
                  previousRange.far = previousRange.near + 0.01;
                }
                if (currentRange.near > currentRange.far - 0.01) {
                  currentRange.near = currentRange.far - 0.01;
                }
              }
              this._cascadeRanges[this._activeCascadeCount - 1].far =
                safeMaxShadowDistance;
            }

            for (
              let cascadeIndex = this._activeCascadeCount;
              cascadeIndex < csmCascadeCount;
              cascadeIndex++
            ) {
              this._cascadeRanges[cascadeIndex].near = safeMaxShadowDistance;
              this._cascadeRanges[cascadeIndex].far = safeMaxShadowDistance;
            }
          }

          private _getLayerThreeCamera(
            layer: gdjs.RuntimeLayer
          ): THREE.Camera | null {
            const layerRenderer = layer.getRenderer() as {
              getThreeCamera?: () => THREE.Camera | null;
            };
            if (
              !layerRenderer ||
              typeof layerRenderer.getThreeCamera !== 'function'
            ) {
              return null;
            }
            return layerRenderer.getThreeCamera() || null;
          }

          private _computeCascadeFrustumSize(
            layer: gdjs.RuntimeLayer,
            cascadeIndex: integer
          ): float {
            const range = this._cascadeRanges[cascadeIndex];
            const safeRangeFar = Math.max(range.far, range.near + 1);
            const rangeDepth = Math.max(1, range.far - range.near);

            const cameraHeight = Math.max(1, layer.getCameraHeight());
            let cameraAspect = Math.max(0.1, layer.getCameraWidth() / cameraHeight);
            let fovRad = gdjs.toRad(
              Math.max(1, layer.getInitialCamera3DFieldOfView())
            );
            const threeCamera = this._getLayerThreeCamera(layer);
            if (threeCamera) {
              const perspectiveCamera = threeCamera as THREE.PerspectiveCamera & {
                isPerspectiveCamera?: boolean;
              };
              if (perspectiveCamera.isPerspectiveCamera) {
                const perspectiveAspect = Number(perspectiveCamera.aspect);
                if (Number.isFinite(perspectiveAspect) && perspectiveAspect > 0.01) {
                  cameraAspect = Math.max(0.1, perspectiveAspect);
                }
                const perspectiveFov = Number(perspectiveCamera.fov);
                if (Number.isFinite(perspectiveFov) && perspectiveFov > 0) {
                  fovRad = THREE.MathUtils.degToRad(
                    Math.max(1, Math.min(179, perspectiveFov))
                  );
                }
              } else {
                const orthographicCamera = threeCamera as THREE.OrthographicCamera & {
                  isOrthographicCamera?: boolean;
                };
                if (orthographicCamera.isOrthographicCamera) {
                  const zoom = Math.max(
                    0.0001,
                    Number(orthographicCamera.zoom) || 1
                  );
                  const orthographicWidth = Math.max(
                    1,
                    Math.abs(
                      (Number(orthographicCamera.right) -
                        Number(orthographicCamera.left)) /
                        zoom
                    )
                  );
                  const orthographicHeight = Math.max(
                    1,
                    Math.abs(
                      (Number(orthographicCamera.top) -
                        Number(orthographicCamera.bottom)) /
                        zoom
                    )
                  );
                  const orthographicCoverage = Math.max(
                    orthographicWidth,
                    orthographicHeight
                  );
                  const depthPadding = Math.max(24, rangeDepth * 0.35);

                  const frustumScale = Math.max(0.25, this._frustumSize / 4000);
                  let cascadeScale = 1;
                  if (this._activeCascadeCount === 1) {
                    cascadeScale = 1;
                  } else if (this._activeCascadeCount === 2) {
                    cascadeScale = cascadeIndex === 0 ? 0.9 : 1.08;
                  } else {
                    cascadeScale =
                      cascadeIndex === 0 ? 0.88 : cascadeIndex === 1 ? 1 : 1.14;
                  }

                  return Math.max(
                    64,
                    (orthographicCoverage + depthPadding) *
                      frustumScale *
                      cascadeScale
                  );
                }
              }
            }

            const projectedHalfHeight = Math.tan(fovRad * 0.5) * safeRangeFar;
            const projectedHeight = Math.max(1, projectedHalfHeight * 2);
            const projectedWidth = projectedHeight * cameraAspect;
            const sliceHalfDepth = Math.max(0.5, rangeDepth * 0.5);
            const stabilizingSphereDiameter = Math.sqrt(
              projectedWidth * projectedWidth +
                projectedHeight * projectedHeight +
                4 * sliceHalfDepth * sliceHalfDepth
            );
            const visibleCoverage = Math.max(
              projectedHeight,
              projectedWidth,
              stabilizingSphereDiameter * 0.92
            );
            const depthPadding = Math.max(24, rangeDepth * 0.35);

            // Keep compatibility with the legacy "frustumSize" parameter as a global multiplier.
            const frustumScale = Math.max(0.25, this._frustumSize / 4000);
            let cascadeScale = 1;
            if (this._activeCascadeCount === 1) {
              cascadeScale = 1;
            } else if (this._activeCascadeCount === 2) {
              cascadeScale = cascadeIndex === 0 ? 0.9 : 1.08;
            } else {
              cascadeScale =
                cascadeIndex === 0 ? 0.88 : cascadeIndex === 1 ? 1 : 1.14;
            }

            return Math.max(
              64,
              (visibleCoverage + depthPadding) * frustumScale * cascadeScale
            );
          }

          private _updateShadowCamera(layer: gdjs.RuntimeLayer): void {
            if (!this._shadowCameraDirty) {
              return;
            }
            this._shadowCameraDirty = false;

            this._distanceFromCamera = Math.max(10, this._distanceFromCamera);
            this._frustumSize = Math.max(64, this._frustumSize);
            this._maxShadowDistance = Math.max(64, this._maxShadowDistance);
            this._cascadeSplitLambda = Math.max(
              0,
              Math.min(1, this._cascadeSplitLambda)
            );

            this._updateCascadeRanges(layer);

            const safeDistanceFromCamera = Math.max(
              10,
              this._distanceFromCamera
            );

            for (
              let cascadeIndex = 0;
              cascadeIndex < this._activeCascadeCount;
              cascadeIndex++
            ) {
              const light = this._lights[cascadeIndex];
              const cascadeFrustumSize = this._computeCascadeFrustumSize(
                layer,
                cascadeIndex
              );
              this._cascadeFrustumSizes[cascadeIndex] = cascadeFrustumSize;
              const rangeDepth = Math.max(
                1,
                this._cascadeRanges[cascadeIndex].far -
                  this._cascadeRanges[cascadeIndex].near
              );
              // Tight depth range improves shadow precision and reduces acne.
              const depthExtent = Math.max(
                96,
                rangeDepth * 0.75 +
                  cascadeFrustumSize * 0.32 +
                  safeDistanceFromCamera * 0.05
              );

              light.shadow.camera.near = Math.max(
                0.5,
                safeDistanceFromCamera - depthExtent
              );
              light.shadow.camera.far = safeDistanceFromCamera + depthExtent;
              light.shadow.camera.right = cascadeFrustumSize / 2;
              light.shadow.camera.left = -cascadeFrustumSize / 2;
              light.shadow.camera.top = cascadeFrustumSize / 2;
              light.shadow.camera.bottom = -cascadeFrustumSize / 2;
              light.shadow.camera.updateProjectionMatrix();
              light.shadow.needsUpdate = true;
            }

            for (
              let cascadeIndex = this._activeCascadeCount;
              cascadeIndex < this._lights.length;
              cascadeIndex++
            ) {
              this._cascadeFrustumSizes[cascadeIndex] = 64;
            }
          }

          private _updateShadowMapSize(): void {
            if (!this._shadowMapDirty) {
              return;
            }
            this._shadowMapDirty = false;

            for (
              let cascadeIndex = 0;
              cascadeIndex < this._activeCascadeCount;
              cascadeIndex++
            ) {
              const light = this._lights[cascadeIndex];
              const cascadeMapSize = this._computeCascadeMapSize(cascadeIndex);
              this._cascadeMapSizes[cascadeIndex] = cascadeMapSize;

              light.shadow.mapSize.set(cascadeMapSize, cascadeMapSize);

              // Force recreation of shadow map texture.
              light.shadow.map?.dispose();
              light.shadow.map = null;
              light.shadow.needsUpdate = true;
            }

            for (
              let cascadeIndex = this._activeCascadeCount;
              cascadeIndex < this._lights.length;
              cascadeIndex++
            ) {
              this._cascadeMapSizes[cascadeIndex] = 512;
            }
          }

          private _getEffectiveShadowStabilizationStep(
            cascadeIndex: integer
          ): float {
            if (!this._shadowStabilizationEnabled) {
              return 0;
            }
            if (this._shadowStabilizationStep > 0) {
              return this._shadowStabilizationStep;
            }
            const frustumSize = this._cascadeFrustumSizes[cascadeIndex];
            const shadowMapSize = this._cascadeMapSizes[cascadeIndex];
            const texelWorldSize = frustumSize / Math.max(1, shadowMapSize);
            const cascadeMultiplier =
              cascadeIndex === 0 ? 1 : cascadeIndex === 1 ? 1.35 : 1.8;
            const qualityMultiplier =
              this._pipelineShadowQualityScale < 1
                ? 1 + (1 - this._pipelineShadowQualityScale) * 0.6
                : 1;
            return Math.max(
              0.1,
              texelWorldSize * cascadeMultiplier * qualityMultiplier
            );
          }

          private _getFirstObjectByName(
            target: EffectsTarget,
            objectName: string
          ): gdjs.RuntimeObject | null {
            if (!objectName) {
              return null;
            }
            const objects = target.getRuntimeScene().getObjects(objectName);
            if (!objects || objects.length === 0) {
              return null;
            }
            return objects[0];
          }

          private _getObjectCenterZ(object: gdjs.RuntimeObject): float {
            const object3D = object as gdjs.RuntimeObject & {
              getCenterZInScene?: () => float;
            };
            return typeof object3D.getCenterZInScene === 'function'
              ? object3D.getCenterZInScene()
              : 0;
          }

          private _getObjectRotationX(object: gdjs.RuntimeObject): float {
            const object3D = object as gdjs.RuntimeObject & {
              getRotationX?: () => float;
            };
            return typeof object3D.getRotationX === 'function'
              ? object3D.getRotationX()
              : 0;
          }

          private _getObjectRotationY(object: gdjs.RuntimeObject): float {
            const object3D = object as gdjs.RuntimeObject & {
              getRotationY?: () => float;
            };
            return typeof object3D.getRotationY === 'function'
              ? object3D.getRotationY()
              : 0;
          }

          private _getObjectScaleX(object: gdjs.RuntimeObject): float {
            const scalableObject = object as gdjs.RuntimeObject & {
              getScaleX?: () => float;
            };
            if (typeof scalableObject.getScaleX === 'function') {
              return Math.max(0.0001, Math.abs(scalableObject.getScaleX()));
            }
            return 1;
          }

          private _getObjectScaleY(object: gdjs.RuntimeObject): float {
            const scalableObject = object as gdjs.RuntimeObject & {
              getScaleY?: () => float;
            };
            if (typeof scalableObject.getScaleY === 'function') {
              return Math.max(0.0001, Math.abs(scalableObject.getScaleY()));
            }
            return 1;
          }

          private _getObjectScaleZ(object: gdjs.RuntimeObject): float {
            const scalableObject = object as gdjs.RuntimeObject & {
              getScaleZ?: () => float;
            };
            if (typeof scalableObject.getScaleZ === 'function') {
              return Math.max(0.0001, Math.abs(scalableObject.getScaleZ()));
            }
            return Math.max(
              0.0001,
              (this._getObjectScaleX(object) + this._getObjectScaleY(object)) *
                0.5
            );
          }

          private _getRotatedOffsets(
            object: gdjs.RuntimeObject,
            offsetX: float,
            offsetY: float
          ): [float, float] {
            if (!this._rotateOffsetsWithObjectAngle) {
              return [offsetX, offsetY];
            }
            const angleRad = gdjs.toRad(object.getAngle());
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            return [
              offsetX * cos - offsetY * sin,
              offsetX * sin + offsetY * cos,
            ];
          }

          private _getRotatedOffsets3D(
            object: gdjs.RuntimeObject,
            offsetX: float,
            offsetY: float,
            offsetZ: float
          ): [float, float, float] {
            this._temporaryEuler.set(
              gdjs.toRad(this._getObjectRotationX(object)),
              gdjs.toRad(this._getObjectRotationY(object)),
              gdjs.toRad(object.getAngle()),
              'ZYX'
            );
            this._temporaryOffsetVector.set(offsetX, offsetY, offsetZ);
            this._temporaryOffsetVector.applyEuler(this._temporaryEuler);
            return [
              this._temporaryOffsetVector.x,
              this._temporaryOffsetVector.y,
              this._temporaryOffsetVector.z,
            ];
          }

          private _computeAttachedAnchor(target: gdjs.EffectsTarget): {
            attachedObject: gdjs.RuntimeObject;
            anchorX: float;
            anchorY: float;
            anchorZ: float;
          } | null {
            const attachedObject = this._getFirstObjectByName(
              target,
              this._attachedObjectName
            );
            if (!attachedObject) {
              return null;
            }

            let offsetX = this._attachedOffsetX;
            let offsetY = this._attachedOffsetY;
            let offsetZ = this._attachedOffsetZ;
            if (this._inheritAttachedObjectScale) {
              offsetX *= this._getObjectScaleX(attachedObject);
              offsetY *= this._getObjectScaleY(attachedObject);
              offsetZ *= this._getObjectScaleZ(attachedObject);
            }
            if (this._followAttachedObjectRotation3D) {
              [offsetX, offsetY, offsetZ] = this._getRotatedOffsets3D(
                attachedObject,
                offsetX,
                offsetY,
                offsetZ
              );
            } else if (this._rotateOffsetsWithObjectAngle) {
              [offsetX, offsetY] = this._getRotatedOffsets(
                attachedObject,
                offsetX,
                offsetY
              );
            }

            return {
              attachedObject,
              anchorX: attachedObject.getCenterXInScene() + offsetX,
              anchorY: attachedObject.getCenterYInScene() + offsetY,
              anchorZ: this._getObjectCenterZ(attachedObject) + offsetZ,
            };
          }

          private _computeDirectionalPosition(
            targetX: float,
            targetY: float,
            targetZ: float,
            attachedObject: gdjs.RuntimeObject | null = null
          ): [float, float, float] {
            const [directionX, directionY, directionZ] =
              this._computeLightDirection(attachedObject);
            return [
              targetX + this._distanceFromCamera * directionX,
              targetY + this._distanceFromCamera * directionY,
              targetZ + this._distanceFromCamera * directionZ,
            ];
          }

          private _applyCascadeTransform(
            light: THREE.DirectionalLight,
            targetX: float,
            targetY: float,
            targetZ: float,
            attachedObject: gdjs.RuntimeObject | null = null
          ): void {
            const [lightX, lightY, lightZ] = this._computeDirectionalPosition(
              targetX,
              targetY,
              targetZ,
              attachedObject
            );
            light.position.set(lightX, lightY, lightZ);
            light.target.position.set(targetX, targetY, targetZ);
          }

          private _applyCascadeShadowTuning(cascadeIndex: integer): void {
            const light = this._lights[cascadeIndex];
            const cascadeMapSize = this._cascadeMapSizes[cascadeIndex];
            const cascadeFrustumSize = this._cascadeFrustumSizes[cascadeIndex];
            const cascadeRange = this._cascadeRanges[cascadeIndex];
            const texelWorldSize =
              cascadeFrustumSize / Math.max(1, cascadeMapSize);
            const safeMaxDistance = Math.max(64, this._maxShadowDistance);
            const depthRatio = Math.max(
              0.05,
              Math.min(1, cascadeRange.far / safeMaxDistance)
            );
            const qualityScale = Math.max(
              0.35,
              Math.min(2, this._pipelineShadowQualityScale)
            );
            const qualityBiasMultiplier =
              qualityScale < 1
                ? 1 + (1 - qualityScale) * 0.45
                : 1 / (1 + (qualityScale - 1) * 0.25);
            const automaticBias = Math.max(
              0.00002,
              texelWorldSize * (0.00035 + depthRatio * 0.00055)
            );
            const baseBias = Math.max(this._minimumShadowBias, automaticBias);
            light.shadow.bias =
              -baseBias * qualityBiasMultiplier * (1 + depthRatio * 1.65);

            const baseNormalBias = Math.max(0, this._shadowNormalBias);
            const automaticNormalBias =
              texelWorldSize * (0.012 + depthRatio * 0.028);
            light.shadow.normalBias = Math.max(
              baseNormalBias * (1 + depthRatio * 0.45),
              automaticNormalBias
            );

            const baseRadius = Math.max(0, this._shadowRadius);
            const radiusMultiplier =
              0.8 +
              depthRatio * 0.65 +
              (qualityScale < 1 ? (1 - qualityScale) * 0.4 : 0);
            light.shadow.radius = baseRadius * radiusMultiplier;
          }

          private _applyManualShadowTuning(cascadeIndex: integer): void {
            const light = this._lights[cascadeIndex];
            light.shadow.bias = -Math.max(0, this._minimumShadowBias);
            light.shadow.normalBias = Math.max(0, this._shadowNormalBias);
            light.shadow.radius = Math.max(0, this._shadowRadius);
          }

          private _computeLightDirection(
            attachedObject: gdjs.RuntimeObject | null = null
          ): [float, float, float] {
            const effectiveRotation =
              this._rotation + this._directionRotationOffset;
            const effectiveElevation =
              this._elevation + this._directionElevationOffset;
            let directionX = 0;
            let directionY = 0;
            let directionZ = 1;
            if (this._top === 'Y-') {
              directionX =
                Math.cos(gdjs.toRad(-effectiveRotation + 90)) *
                Math.cos(gdjs.toRad(effectiveElevation));
              directionY = -Math.sin(gdjs.toRad(effectiveElevation));
              directionZ =
                Math.sin(gdjs.toRad(-effectiveRotation + 90)) *
                Math.cos(gdjs.toRad(effectiveElevation));
            } else {
              directionX =
                Math.cos(gdjs.toRad(effectiveRotation)) *
                Math.cos(gdjs.toRad(effectiveElevation));
              directionY =
                Math.sin(gdjs.toRad(effectiveRotation)) *
                Math.cos(gdjs.toRad(effectiveElevation));
              directionZ = Math.sin(gdjs.toRad(effectiveElevation));
            }

            if (
              attachedObject &&
              this._followDirectionWithAttachedObjectRotation3D
            ) {
              this._temporaryEuler.set(
                gdjs.toRad(this._getObjectRotationX(attachedObject)),
                gdjs.toRad(this._getObjectRotationY(attachedObject)),
                gdjs.toRad(attachedObject.getAngle()),
                'ZYX'
              );
              this._temporaryDirectionVector.set(
                directionX,
                directionY,
                directionZ
              );
              this._temporaryDirectionVector.applyEuler(this._temporaryEuler);
              directionX = this._temporaryDirectionVector.x;
              directionY = this._temporaryDirectionVector.y;
              directionZ = this._temporaryDirectionVector.z;
            }

            const directionLength = Math.sqrt(
              directionX * directionX +
                directionY * directionY +
                directionZ * directionZ
            );
            if (directionLength < 0.00001) {
              return [0, 0, 1];
            }
            return [
              directionX / directionLength,
              directionY / directionLength,
              directionZ / directionLength,
            ];
          }

          private _computeLightSpaceBasis(
            attachedObject: gdjs.RuntimeObject | null = null
          ): {
            rightX: float;
            rightY: float;
            rightZ: float;
            upX: float;
            upY: float;
            upZ: float;
            forwardX: float;
            forwardY: float;
            forwardZ: float;
          } {
            const [forwardX, forwardY, forwardZ] =
              this._computeLightDirection(attachedObject);

            // Build a stable orthonormal basis around light direction.
            let referenceUpX = 0;
            let referenceUpY = 0;
            let referenceUpZ = 1;
            if (Math.abs(forwardZ) > 0.97) {
              referenceUpX = 0;
              referenceUpY = 1;
              referenceUpZ = 0;
            }

            let rightX = referenceUpY * forwardZ - referenceUpZ * forwardY;
            let rightY = referenceUpZ * forwardX - referenceUpX * forwardZ;
            let rightZ = referenceUpX * forwardY - referenceUpY * forwardX;
            let rightLength = Math.sqrt(
              rightX * rightX + rightY * rightY + rightZ * rightZ
            );
            if (rightLength < 0.00001) {
              rightX = 1;
              rightY = 0;
              rightZ = 0;
              rightLength = 1;
            }
            rightX /= rightLength;
            rightY /= rightLength;
            rightZ /= rightLength;

            let upX = forwardY * rightZ - forwardZ * rightY;
            let upY = forwardZ * rightX - forwardX * rightZ;
            let upZ = forwardX * rightY - forwardY * rightX;
            const upLength = Math.sqrt(upX * upX + upY * upY + upZ * upZ);
            if (upLength > 0.00001) {
              upX /= upLength;
              upY /= upLength;
              upZ /= upLength;
            } else {
              upX = 0;
              upY = 1;
              upZ = 0;
            }

            return {
              rightX,
              rightY,
              rightZ,
              upX,
              upY,
              upZ,
              forwardX,
              forwardY,
              forwardZ,
            };
          }

          private _stabilizeAnchorInLightSpace(
            x: float,
            y: float,
            z: float,
            step: float,
            basis: {
              rightX: float;
              rightY: float;
              rightZ: float;
              upX: float;
              upY: float;
              upZ: float;
              forwardX: float;
              forwardY: float;
              forwardZ: float;
            }
          ): [float, float, float] {
            if (step <= 0) {
              return [x, y, z];
            }
            const rightCoord =
              x * basis.rightX + y * basis.rightY + z * basis.rightZ;
            const upCoord = x * basis.upX + y * basis.upY + z * basis.upZ;
            const forwardCoord =
              x * basis.forwardX + y * basis.forwardY + z * basis.forwardZ;

            const stabilizedRight = Math.round(rightCoord / step) * step;
            const stabilizedUp = Math.round(upCoord / step) * step;

            return [
              stabilizedRight * basis.rightX +
                stabilizedUp * basis.upX +
                forwardCoord * basis.forwardX,
              stabilizedRight * basis.rightY +
                stabilizedUp * basis.upY +
                forwardCoord * basis.forwardY,
              stabilizedRight * basis.rightZ +
                stabilizedUp * basis.upZ +
                forwardCoord * basis.forwardZ,
            ];
          }

          private _computeShadowFollowAnchor(
            cameraX: float,
            cameraY: float,
            cameraZ: float
          ): [float, float, float] {
            if (!this._hadPreviousCameraPosition) {
              this._hadPreviousCameraPosition = true;
              this._previousCameraX = cameraX;
              this._previousCameraY = cameraY;
              this._previousCameraZ = cameraZ;
              return [cameraX, cameraY, cameraZ];
            }

            const deltaX = cameraX - this._previousCameraX;
            const deltaY = cameraY - this._previousCameraY;
            const deltaZ = cameraZ - this._previousCameraZ;
            const movementLength = Math.sqrt(
              deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
            );
            const safeMaxDistance = Math.max(64, this._maxShadowDistance);
            const adaptiveLead =
              movementLength <= 0
                ? this._shadowFollowLead
                : Math.min(
                    1.4,
                    this._shadowFollowLead + movementLength / safeMaxDistance
                  );

            this._previousCameraX = cameraX;
            this._previousCameraY = cameraY;
            this._previousCameraZ = cameraZ;

            return [
              cameraX + deltaX * adaptiveLead,
              cameraY + deltaY * adaptiveLead,
              cameraZ + deltaZ * adaptiveLead,
            ];
          }

          private _computeShadowAnchor(
            cameraX: float,
            cameraY: float,
            cameraZ: float
          ): [float, float, float] {
            if (this._shadowFollowCamera) {
              return this._computeShadowFollowAnchor(cameraX, cameraY, cameraZ);
            }

            if (!this._staticAnchorInitialized) {
              this._staticAnchorInitialized = true;
              this._staticAnchorX = cameraX;
              this._staticAnchorY = cameraY;
              this._staticAnchorZ = cameraZ;
            }
            return [
              this._staticAnchorX,
              this._staticAnchorY,
              this._staticAnchorZ,
            ];
          }

          private _ensureSoftShadowRenderer(target: gdjs.EffectsTarget): void {
            const runtimeScene = target.getRuntimeScene();
            if (!runtimeScene || !runtimeScene.getGame) {
              return;
            }
            const gameRenderer = runtimeScene.getGame().getRenderer();
            if (!gameRenderer || !(gameRenderer as any).getThreeRenderer) {
              return;
            }
            const threeRenderer = (gameRenderer as any).getThreeRenderer();
            if (!threeRenderer || !threeRenderer.shadowMap) {
              return;
            }
            const rendererMaxTextureSize =
              threeRenderer.capabilities &&
              typeof threeRenderer.capabilities.maxTextureSize === 'number'
                ? threeRenderer.capabilities.maxTextureSize
                : 2048;
            this._maxRendererShadowMapSize = Math.max(
              512,
              rendererMaxTextureSize
            );

            if (
              !this._shadowCastingEnabled ||
              !this._pipelineAllowsRealtimeShadows
            ) {
              return;
            }

            threeRenderer.shadowMap.enabled = true;
            threeRenderer.shadowMap.autoUpdate = true;
            const preferredShadowType = THREE.PCFSoftShadowMap;
            if (threeRenderer.shadowMap.type !== preferredShadowType) {
              threeRenderer.shadowMap.type = preferredShadowType;
            }
          }

          private _applyLightingPipeline(target: gdjs.EffectsTarget): void {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            const pipelineState = getLightingPipelineState(scene);
            this._pipelineRealtimeMultiplier =
              getRealtimeLightingMultiplier(pipelineState);
            this._pipelineWasmSimdActive = !!(
              pipelineState && pipelineState.wasmSimdActive
            );
            this._pipelineWasmSimdAutoTune =
              pipelineState && pipelineState.wasmSimdAutoTune !== undefined
                ? !!pipelineState.wasmSimdAutoTune
                : true;
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
            targetShadowQualityScale = Math.max(
              0.35,
              Math.min(2, targetShadowQualityScale)
            );
            if (
              Math.abs(targetShadowQualityScale - this._pipelineShadowQualityScale) >
              0.001
            ) {
              this._pipelineShadowQualityScale = targetShadowQualityScale;
              this._shadowMapDirty = true;
            }
            this._pipelineAllowsRealtimeShadows = shouldUseRealtimeShadows(
              pipelineState,
              this._pipelineRealtimeMultiplier
            );
            this._refreshActiveCascadeCount();
            this._setAllLightsIntensity(this._intensity);

            const shouldCastShadow =
              this._shadowCastingEnabled && this._pipelineAllowsRealtimeShadows;
            for (let i = 0; i < this._lights.length; i++) {
              const light = this._lights[i];
              const isCascadeActive = i < this._activeCascadeCount;
              const shouldCascadeCastShadow =
                shouldCastShadow && isCascadeActive;
              if (light.castShadow !== shouldCascadeCastShadow) {
                light.castShadow = shouldCascadeCastShadow;
                if (shouldCascadeCastShadow) {
                  light.shadow.needsUpdate = true;
                }
              }
            }

            if (pipelineState) {
              const runtimeScene = target.getRuntimeScene
                ? target.getRuntimeScene()
                : null;
              if (runtimeScene && runtimeScene.getGame) {
                const gameRenderer = runtimeScene.getGame().getRenderer();
                if (gameRenderer && (gameRenderer as any).getThreeRenderer) {
                  const threeRenderer = (gameRenderer as any).getThreeRenderer() as
                    | THREE.WebGLRenderer
                    | null;
                  if (threeRenderer) {
                    const rendererWithLightingMode = threeRenderer as
                      | (THREE.WebGLRenderer & {
                          physicallyCorrectLights?: boolean;
                          useLegacyLights?: boolean;
                        })
                      | null;
                    if (
                      rendererWithLightingMode &&
                      pipelineState.physicallyCorrectLights !== undefined
                    ) {
                      const shouldUsePhysicalLights =
                        !!pipelineState.physicallyCorrectLights;
                      if (
                        typeof rendererWithLightingMode.physicallyCorrectLights ===
                        'boolean'
                      ) {
                        rendererWithLightingMode.physicallyCorrectLights =
                          shouldUsePhysicalLights;
                      }
                      if (
                        typeof rendererWithLightingMode.useLegacyLights ===
                          'boolean'
                      ) {
                        rendererWithLightingMode.useLegacyLights =
                          !shouldUsePhysicalLights;
                      }
                    }
                  }
                }
              }
            }
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
            } else {
              return this.removeEffect(target);
            }
          }
          applyEffect(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            if (!scene) {
              return false;
            }

            for (let i = 0; i < this._lights.length; i++) {
              const light = this._lights[i];
              this._ensureCascadeHelpers(i);
              scene.add(light);
              scene.add(light.target);
            }

            this._hadPreviousCameraPosition = false;
            this._staticAnchorInitialized = false;
            this._isEnabled = true;
            this._applyLightingPipeline(target);
            return true;
          }
          removeEffect(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            if (!scene) {
              return false;
            }

            for (let i = 0; i < this._lights.length; i++) {
              const light = this._lights[i];
              scene.remove(light);
              scene.remove(light.target);
            }

            this._isEnabled = false;
            return true;
          }
          updatePreRender(target: gdjs.EffectsTarget): any {
            if (!target.getRuntimeLayer) {
              return;
            }
            this._applyLightingPipeline(target);
            const layer = target.getRuntimeLayer();
            const cameraX = layer.getCameraX();
            const cameraY = layer.getCameraY();
            const cameraZ = layer.getCameraZ(
              layer.getInitialCamera3DFieldOfView()
            );
            const attachedAnchor = this._computeAttachedAnchor(target);
            const [anchorX, anchorY, anchorZ] = attachedAnchor
              ? [
                  attachedAnchor.anchorX,
                  attachedAnchor.anchorY,
                  attachedAnchor.anchorZ,
                ]
              : this._computeShadowAnchor(cameraX, cameraY, cameraZ);
            const attachedObjectForDirection = attachedAnchor
              ? attachedAnchor.attachedObject
              : null;

            // CSM requires per-cascade cameras and map sizing to be refreshed when settings change.
            this._ensureSoftShadowRenderer(target);
            this._updateShadowCamera(layer);
            this._updateShadowMapSize();
            const lightSpaceBasis = this._computeLightSpaceBasis(
              attachedObjectForDirection
            );

            for (
              let cascadeIndex = 0;
              cascadeIndex < this._activeCascadeCount;
              cascadeIndex++
            ) {
              const light = this._lights[cascadeIndex];
              const stabilizationStep = this._shadowCastingEnabled
                ? this._getEffectiveShadowStabilizationStep(cascadeIndex)
                : 0;
              const [stabilizedX, stabilizedY, stabilizedZ] =
                this._stabilizeAnchorInLightSpace(
                  anchorX,
                  anchorY,
                  anchorZ,
                  stabilizationStep,
                  lightSpaceBasis
                );

              this._applyCascadeTransform(
                light,
                stabilizedX,
                stabilizedY,
                stabilizedZ,
                attachedObjectForDirection
              );

              if (
                this._shadowCastingEnabled &&
                this._pipelineAllowsRealtimeShadows
              ) {
                if (this._shadowAutoTuningEnabled) {
                  this._applyCascadeShadowTuning(cascadeIndex);
                } else {
                  this._applyManualShadowTuning(cascadeIndex);
                }
              }

            }
            this._refreshHelpers();
          }
          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'intensity') {
              this._setAllLightsIntensity(value);
            } else if (parameterName === 'elevation') {
              this._elevation = value;
            } else if (parameterName === 'rotation') {
              this._rotation = value;
            } else if (parameterName === 'attachedOffsetX') {
              this._attachedOffsetX = value;
            } else if (parameterName === 'attachedOffsetY') {
              this._attachedOffsetY = value;
            } else if (parameterName === 'attachedOffsetZ') {
              this._attachedOffsetZ = value;
            } else if (parameterName === 'directionRotationOffset') {
              this._directionRotationOffset = value;
            } else if (parameterName === 'directionElevationOffset') {
              this._directionElevationOffset = value;
            } else if (parameterName === 'distanceFromCamera') {
              this._distanceFromCamera = Math.max(10, value);
              this._shadowCameraDirty = true;
            } else if (parameterName === 'frustumSize') {
              this._frustumSize = Math.max(64, value);
              this._shadowCameraDirty = true;
            } else if (parameterName === 'minimumShadowBias') {
              this._minimumShadowBias = Math.max(0, value);
            } else if (parameterName === 'shadowNormalBias') {
              this._shadowNormalBias = Math.max(0, value);
            } else if (parameterName === 'shadowRadius') {
              this._shadowRadius = Math.max(0, value);
            } else if (parameterName === 'shadowStabilizationStep') {
              this._shadowStabilizationStep = Math.max(0, value);
            } else if (parameterName === 'maxShadowDistance') {
              this._maxShadowDistance = Math.max(64, value);
              this._refreshActiveCascadeCount();
              this._shadowCameraDirty = true;
            } else if (parameterName === 'cascadeSplitLambda') {
              this._cascadeSplitLambda = Math.max(0, Math.min(1, value));
              this._shadowCameraDirty = true;
            } else if (parameterName === 'cascadeCount') {
              this._desiredCascadeCount = this._clampCascadeCount(value);
              this._refreshActiveCascadeCount();
              this._shadowMapDirty = true;
              this._shadowCameraDirty = true;
            } else if (parameterName === 'shadowMapSize') {
              this._shadowMapSize = this._getClosestShadowMapSize(value);
              this._shadowMapDirty = true;
              this._shadowCameraDirty = true;
            } else if (parameterName === 'shadowFollowLead') {
              this._shadowFollowLead = Math.max(0, Math.min(2, value));
            }
          }
          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'intensity') {
              return this._intensity;
            } else if (parameterName === 'elevation') {
              return this._elevation;
            } else if (parameterName === 'rotation') {
              return this._rotation;
            } else if (parameterName === 'attachedOffsetX') {
              return this._attachedOffsetX;
            } else if (parameterName === 'attachedOffsetY') {
              return this._attachedOffsetY;
            } else if (parameterName === 'attachedOffsetZ') {
              return this._attachedOffsetZ;
            } else if (parameterName === 'directionRotationOffset') {
              return this._directionRotationOffset;
            } else if (parameterName === 'directionElevationOffset') {
              return this._directionElevationOffset;
            } else if (parameterName === 'distanceFromCamera') {
              return this._distanceFromCamera;
            } else if (parameterName === 'frustumSize') {
              return this._frustumSize;
            } else if (parameterName === 'minimumShadowBias') {
              return this._minimumShadowBias;
            } else if (parameterName === 'shadowNormalBias') {
              return this._shadowNormalBias;
            } else if (parameterName === 'shadowRadius') {
              return this._shadowRadius;
            } else if (parameterName === 'shadowStabilizationStep') {
              return this._shadowStabilizationStep;
            } else if (parameterName === 'maxShadowDistance') {
              return this._maxShadowDistance;
            } else if (parameterName === 'cascadeSplitLambda') {
              return this._cascadeSplitLambda;
            } else if (parameterName === 'cascadeCount') {
              return this._desiredCascadeCount;
            } else if (parameterName === 'shadowMapSize') {
              return this._shadowMapSize;
            } else if (parameterName === 'shadowFollowLead') {
              return this._shadowFollowLead;
            }
            return 0;
          }
          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'color') {
              this._setAllLightsColor(gdjs.rgbOrHexStringToNumber(value));
            }
            if (parameterName === 'top') {
              this._top = value;
            }
            if (parameterName === 'attachedObject') {
              this._attachedObjectName = value;
              this._hadPreviousCameraPosition = false;
              this._staticAnchorInitialized = false;
            }
            if (parameterName === 'shadowQuality') {
              this._applyShadowQualityPreset(value);
            }
            if (parameterName === 'shadowMapSize') {
              const parsedValue = parseFloat(value);
              if (!isNaN(parsedValue)) {
                this._shadowMapSize =
                  this._getClosestShadowMapSize(parsedValue);
                this._shadowMapDirty = true;
                this._shadowCameraDirty = true;
              }
            }
          }
          updateColorParameter(parameterName: string, value: number): void {
            if (parameterName === 'color') {
              this._setAllLightsColor(value);
            }
          }
          getColorParameter(parameterName: string): number {
            if (parameterName === 'color') {
              return this._colorHex;
            }
            return 0;
          }
          updateBooleanParameter(parameterName: string, value: boolean): void {
            if (parameterName === 'isCastingShadow') {
              this._setShadowCastingEnabled(value);
            } else if (parameterName === 'rotateOffsetsWithObjectAngle') {
              this._rotateOffsetsWithObjectAngle = value;
            } else if (parameterName === 'followAttachedObjectRotation3D') {
              this._followAttachedObjectRotation3D = value;
            } else if (parameterName === 'inheritAttachedObjectScale') {
              this._inheritAttachedObjectScale = value;
            } else if (
              parameterName === 'followDirectionWithAttachedObjectRotation3D'
            ) {
              this._followDirectionWithAttachedObjectRotation3D = value;
            } else if (parameterName === 'shadowStabilization') {
              this._shadowStabilizationEnabled = value;
            } else if (parameterName === 'shadowFollowCamera') {
              this._shadowFollowCamera = value;
              this._hadPreviousCameraPosition = false;
              this._staticAnchorInitialized = false;
            } else if (parameterName === 'shadowAutoTuning') {
              this._shadowAutoTuningEnabled = value;
            } else if (parameterName === 'lightHelper') {
              this._setLightHelperEnabled(value);
            } else if (parameterName === 'shadowHelper') {
              this._setShadowHelperEnabled(value);
            } else if (parameterName === 'adaptiveCascadeCount') {
              this._adaptiveCascadeCount = value;
              this._refreshActiveCascadeCount();
              this._shadowMapDirty = true;
              this._shadowCameraDirty = true;
            }
          }
          getNetworkSyncData(): DirectionalLightFilterNetworkSyncData {
            return {
              i: this._intensity,
              c: this._colorHex,
              e: this._elevation,
              r: this._rotation,
              t: this._top,
              msb: this._minimumShadowBias,
              snb: this._shadowNormalBias,
              sr: this._shadowRadius,
              ss: this._shadowStabilizationEnabled,
              sss: this._shadowStabilizationStep,
              dfc: this._distanceFromCamera,
              fs: this._frustumSize,
              msd: this._maxShadowDistance,
              csl: this._cascadeSplitLambda,
              sms: this._shadowMapSize,
              sfl: this._shadowFollowLead,
              sfc: this._shadowFollowCamera,
              sat: this._shadowAutoTuningEnabled,
              ao: this._attachedObjectName,
              ox: this._attachedOffsetX,
              oy: this._attachedOffsetY,
              oz: this._attachedOffsetZ,
              ro: this._rotateOffsetsWithObjectAngle,
              fr: this._followAttachedObjectRotation3D,
              ia: this._inheritAttachedObjectScale,
              fdr: this._followDirectionWithAttachedObjectRotation3D,
              dro: this._directionRotationOffset,
              deo: this._directionElevationOffset,
              cc: this._desiredCascadeCount,
              acc: this._adaptiveCascadeCount,
              lh: this._lightHelperEnabled,
              sh: this._shadowHelperEnabled,
            };
          }
          updateFromNetworkSyncData(
            syncData: DirectionalLightFilterNetworkSyncData
          ): void {
            this._setAllLightsIntensity(syncData.i);
            this._setAllLightsColor(syncData.c);
            this._elevation = syncData.e;
            this._rotation = syncData.r;
            this._top = syncData.t;
            this._minimumShadowBias = Math.max(0, syncData.msb ?? 0);
            this._shadowNormalBias = Math.max(0, syncData.snb ?? 0.02);
            this._shadowRadius = Math.max(0, syncData.sr ?? 2);
            this._shadowStabilizationEnabled = syncData.ss ?? true;
            this._shadowStabilizationStep = Math.max(0, syncData.sss ?? 0);
            this._distanceFromCamera = Math.max(10, syncData.dfc ?? 1500);
            this._frustumSize = Math.max(64, syncData.fs ?? 4000);
            this._maxShadowDistance = Math.max(64, syncData.msd ?? 2000);
            this._cascadeSplitLambda = Math.max(
              0,
              Math.min(1, syncData.csl ?? 0.78)
            );
            this._shadowMapSize = this._getClosestShadowMapSize(
              syncData.sms ?? 1024
            );
            this._shadowFollowLead = Math.max(
              0,
              Math.min(2, syncData.sfl ?? 0.45)
            );
            this._shadowFollowCamera = syncData.sfc ?? false;
            this._shadowAutoTuningEnabled = syncData.sat ?? true;
            this._attachedObjectName = syncData.ao || '';
            this._attachedOffsetX = syncData.ox ?? 0;
            this._attachedOffsetY = syncData.oy ?? 0;
            this._attachedOffsetZ = syncData.oz ?? 0;
            this._rotateOffsetsWithObjectAngle = syncData.ro ?? false;
            this._followAttachedObjectRotation3D = syncData.fr ?? false;
            this._inheritAttachedObjectScale = syncData.ia ?? false;
            this._followDirectionWithAttachedObjectRotation3D =
              syncData.fdr ?? false;
            this._directionRotationOffset = syncData.dro ?? 0;
            this._directionElevationOffset = syncData.deo ?? 0;
            this._desiredCascadeCount = this._clampCascadeCount(
              syncData.cc ?? csmCascadeCount
            );
            this._adaptiveCascadeCount = syncData.acc ?? true;
            this._setLightHelperEnabled(syncData.lh ?? false);
            this._setShadowHelperEnabled(syncData.sh ?? false);
            this._refreshActiveCascadeCount();
            this._hadPreviousCameraPosition = false;
            this._staticAnchorInitialized = false;
            this._shadowMapDirty = true;
            this._shadowCameraDirty = true;
          }
        })();
      }
    })()
  );
}

