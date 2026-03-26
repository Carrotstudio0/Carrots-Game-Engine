namespace gdjs {
  interface SkyboxFilterNetworkSyncData {
    i: number;
  }
  const sceneBackgroundOverridesUserDataKeyForSkybox =
    '__gdjsSceneBackgroundOverrides';
  type SceneBackgroundOverrideValueForSkybox =
    | THREE.Texture
    | THREE.Color
    | null;
  type SceneBackgroundOverrideEntryForSkybox = {
    ownerId: string;
    value: SceneBackgroundOverrideValueForSkybox;
  };
  type SceneBackgroundOverrideStateForSkybox = {
    baseValue: SceneBackgroundOverrideValueForSkybox;
    entries: SceneBackgroundOverrideEntryForSkybox[];
  };
  let nextScene3DSkyboxBackgroundOverrideId = 1;

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::Skybox',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }
        return new (class implements gdjs.PixiFiltersTools.Filter {
          _cubeTexture: THREE.CubeTexture;
          _pmremGenerator: THREE.PMREMGenerator | null = null;
          _pmremRenderTarget: THREE.WebGLRenderTarget | null = null;
          _appliedEnvironment: THREE.Texture | null = null;
          _oldEnvironment: THREE.Texture | null = null;
          _oldEnvironmentIntensity: number | null = null;
          _backgroundOverrideOwnerId: string;
          _environmentIntensity: number;
          _isEnabled: boolean = false;

          constructor() {
            this._backgroundOverrideOwnerId = `Scene3D::Skybox:${nextScene3DSkyboxBackgroundOverrideId++}`;
            this._cubeTexture = target
              .getRuntimeScene()
              .getGame()
              .getImageManager()
              .getThreeCubeTexture(
                effectData.stringParameters.rightFaceResourceName,
                effectData.stringParameters.leftFaceResourceName,
                effectData.stringParameters.topFaceResourceName,
                effectData.stringParameters.bottomFaceResourceName,
                effectData.stringParameters.frontFaceResourceName,
                effectData.stringParameters.backFaceResourceName
              );
            this._environmentIntensity = Math.max(
              0,
              effectData.doubleParameters.environmentIntensity || 1
            );
          }

          private _getScene(target: EffectsTarget): THREE.Scene | null {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            return scene || null;
          }

          private _getThreeRenderer(
            target: EffectsTarget
          ): THREE.WebGLRenderer | null {
            if (!(target instanceof gdjs.Layer)) {
              return null;
            }
            return target
              .getRuntimeScene()
              .getGame()
              .getRenderer()
              .getThreeRenderer();
          }

          private _disposePmremResources(): void {
            if (this._pmremRenderTarget) {
              this._pmremRenderTarget.dispose();
              this._pmremRenderTarget = null;
            }
            if (this._pmremGenerator) {
              this._pmremGenerator.dispose();
              this._pmremGenerator = null;
            }
          }

          private _buildEnvironmentTexture(
            target: EffectsTarget
          ): THREE.Texture {
            const renderer = this._getThreeRenderer(target);
            if (!renderer) {
              return this._cubeTexture;
            }
            if (!this._pmremGenerator) {
              this._pmremGenerator = new THREE.PMREMGenerator(renderer);
            }
            if (this._pmremRenderTarget) {
              this._pmremRenderTarget.dispose();
              this._pmremRenderTarget = null;
            }
            this._pmremRenderTarget = this._pmremGenerator.fromCubemap(
              this._cubeTexture
            );
            return this._pmremRenderTarget.texture;
          }

          private _applyEnvironmentIntensity(scene: THREE.Scene): void {
            const sceneWithEnvironmentIntensity = scene as THREE.Scene & {
              environmentIntensity?: number;
            };
            if (
              typeof sceneWithEnvironmentIntensity.environmentIntensity ===
              'number'
            ) {
              sceneWithEnvironmentIntensity.environmentIntensity = Math.max(
                0,
                this._environmentIntensity
              );
            }
          }

          private _getBackgroundOverridesState(
            scene: THREE.Scene
          ): SceneBackgroundOverrideStateForSkybox | null {
            const userData = scene.userData as {
              [sceneBackgroundOverridesUserDataKeyForSkybox]?:
                | SceneBackgroundOverrideStateForSkybox
                | undefined;
            };
            return (
              userData[sceneBackgroundOverridesUserDataKeyForSkybox] || null
            );
          }

          private _ensureBackgroundOverridesState(
            scene: THREE.Scene
          ): SceneBackgroundOverrideStateForSkybox {
            const existingState = this._getBackgroundOverridesState(scene);
            if (existingState) {
              return existingState;
            }
            const state: SceneBackgroundOverrideStateForSkybox = {
              baseValue: scene.background,
              entries: [],
            };
            const userData = scene.userData as {
              [sceneBackgroundOverridesUserDataKeyForSkybox]?:
                | SceneBackgroundOverrideStateForSkybox
                | undefined;
            };
            userData[sceneBackgroundOverridesUserDataKeyForSkybox] = state;
            return state;
          }

          private _applyBackgroundOverride(
            scene: THREE.Scene,
            value: SceneBackgroundOverrideValueForSkybox
          ): void {
            const state = this._ensureBackgroundOverridesState(scene);
            const existingIndex = state.entries.findIndex(
              entry => entry.ownerId === this._backgroundOverrideOwnerId
            );
            if (existingIndex !== -1) {
              state.entries.splice(existingIndex, 1);
            }
            state.entries.push({
              ownerId: this._backgroundOverrideOwnerId,
              value,
            });
            scene.background = value;
          }

          private _removeBackgroundOverride(scene: THREE.Scene): void {
            const state = this._getBackgroundOverridesState(scene);
            if (!state) {
              return;
            }
            const existingIndex = state.entries.findIndex(
              entry => entry.ownerId === this._backgroundOverrideOwnerId
            );
            if (existingIndex === -1) {
              return;
            }
            state.entries.splice(existingIndex, 1);

            if (state.entries.length === 0) {
              scene.background = state.baseValue;
              const userData = scene.userData as {
                [sceneBackgroundOverridesUserDataKeyForSkybox]?:
                  | SceneBackgroundOverrideStateForSkybox
                  | undefined;
              };
              delete userData[sceneBackgroundOverridesUserDataKeyForSkybox];
              return;
            }

            scene.background = state.entries[state.entries.length - 1].value;
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
            const scene = this._getScene(target);
            if (!scene) {
              return false;
            }
            if (this._isEnabled) {
              return true;
            }

            this._oldEnvironment = scene.environment;
            const sceneWithEnvironmentIntensity = scene as THREE.Scene & {
              environmentIntensity?: number;
            };
            this._oldEnvironmentIntensity =
              typeof sceneWithEnvironmentIntensity.environmentIntensity ===
              'number'
                ? sceneWithEnvironmentIntensity.environmentIntensity
                : null;

            this._applyBackgroundOverride(scene, this._cubeTexture);
            this._appliedEnvironment = this._buildEnvironmentTexture(target);
            scene.environment = this._appliedEnvironment;
            this._applyEnvironmentIntensity(scene);
            this._isEnabled = true;
            return true;
          }
          removeEffect(target: EffectsTarget): boolean {
            const scene = this._getScene(target);
            if (!scene) {
              return false;
            }
            this._removeBackgroundOverride(scene);

            if (scene.environment === this._appliedEnvironment) {
              scene.environment = this._oldEnvironment;
            }
            if (
              scene.environment === this._oldEnvironment &&
              this._oldEnvironmentIntensity !== null
            ) {
              const sceneWithEnvironmentIntensity = scene as THREE.Scene & {
                environmentIntensity?: number;
              };
              if (
                typeof sceneWithEnvironmentIntensity.environmentIntensity ===
                'number'
              ) {
                sceneWithEnvironmentIntensity.environmentIntensity =
                  this._oldEnvironmentIntensity;
              }
            }

            this._appliedEnvironment = null;
            this._oldEnvironment = null;
            this._oldEnvironmentIntensity = null;
            this._disposePmremResources();
            this._isEnabled = false;
            return true;
          }
          updatePreRender(target: gdjs.EffectsTarget): any {
            if (!this._isEnabled) {
              return;
            }
            const scene = this._getScene(target);
            if (!scene) {
              return;
            }
            if (scene.environment === this._appliedEnvironment) {
              this._applyEnvironmentIntensity(scene);
            }
          }
          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'environmentIntensity') {
              this._environmentIntensity = Math.max(0, value);
            }
          }
          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'environmentIntensity') {
              return this._environmentIntensity;
            }
            return 0;
          }
          updateStringParameter(parameterName: string, value: string): void {}
          updateColorParameter(parameterName: string, value: number): void {}
          getColorParameter(parameterName: string): number {
            return 0;
          }
          updateBooleanParameter(parameterName: string, value: boolean): void {}
          getNetworkSyncData(): SkyboxFilterNetworkSyncData {
            return {
              i: this._environmentIntensity,
            };
          }
          updateFromNetworkSyncData(
            syncData: SkyboxFilterNetworkSyncData
          ): void {
            this._environmentIntensity = Math.max(0, syncData.i);
          }
        })();
      }
    })()
  );
}
