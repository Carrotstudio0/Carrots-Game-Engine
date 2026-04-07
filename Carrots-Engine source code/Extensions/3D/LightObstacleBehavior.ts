namespace gdjs {
  const lightObstacleRefreshIntervalFrames = 15;
  const lightObstacleAppliedKey = '__gdScene3dLightObstacleApplied';
  const lightObstaclePrevCastShadowKey =
    '__gdScene3dLightObstaclePrevCastShadow';
  const lightObstaclePrevReceiveShadowKey =
    '__gdScene3dLightObstaclePrevReceiveShadow';

  type RuntimeObjectWith3DRenderer = gdjs.RuntimeObject & {
    get3DRendererObject?: () => THREE.Object3D | null;
  };

  /**
   * @category Behaviors > 3D
   */
  export class LightObstacleRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _castShadow: boolean;
    private _receiveShadow: boolean;
    private _refreshCounter: number;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);

      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._castShadow =
        behaviorData.castShadow === undefined
          ? true
          : !!behaviorData.castShadow;
      this._receiveShadow =
        behaviorData.receiveShadow === undefined
          ? true
          : !!behaviorData.receiveShadow;
      this._refreshCounter = lightObstacleRefreshIntervalFrames;
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) {
        this.setEnabled(!!behaviorData.enabled);
      }
      if (behaviorData.castShadow !== undefined) {
        this.setCastShadowEnabled(!!behaviorData.castShadow);
      }
      if (behaviorData.receiveShadow !== undefined) {
        this.setReceiveShadowEnabled(!!behaviorData.receiveShadow);
      }
      return true;
    }

    override onCreated(): void {
      this._refreshCounter = lightObstacleRefreshIntervalFrames;
      this._applyShadowState();
    }

    override onActivate(): void {
      this._refreshCounter = lightObstacleRefreshIntervalFrames;
      this._applyShadowState();
    }

    override onDeActivate(): void {
      this._applyShadowState(false);
    }

    override onDestroy(): void {
      this._applyShadowState(false);
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      if (this._refreshCounter >= lightObstacleRefreshIntervalFrames) {
        this._refreshCounter = 0;
        this._applyShadowState();
      } else {
        this._refreshCounter++;
      }
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalizedEnabled = !!enabled;
      if (this._enabled === normalizedEnabled) {
        return;
      }

      this._enabled = normalizedEnabled;
      this._refreshCounter = lightObstacleRefreshIntervalFrames;
      this._applyShadowState();
    }

    isCastShadowEnabled(): boolean {
      return this._castShadow;
    }

    setCastShadowEnabled(castShadow: boolean): void {
      const normalizedCastShadow = !!castShadow;
      if (this._castShadow === normalizedCastShadow) {
        return;
      }

      this._castShadow = normalizedCastShadow;
      this._refreshCounter = lightObstacleRefreshIntervalFrames;
      this._applyShadowState();
    }

    isReceiveShadowEnabled(): boolean {
      return this._receiveShadow;
    }

    setReceiveShadowEnabled(receiveShadow: boolean): void {
      const normalizedReceiveShadow = !!receiveShadow;
      if (this._receiveShadow === normalizedReceiveShadow) {
        return;
      }

      this._receiveShadow = normalizedReceiveShadow;
      this._refreshCounter = lightObstacleRefreshIntervalFrames;
      this._applyShadowState();
    }

    private _getOwner3DObject(): THREE.Object3D | null {
      const owner3D = this.owner as RuntimeObjectWith3DRenderer;
      if (!owner3D || typeof owner3D.get3DRendererObject !== 'function') {
        return null;
      }
      return owner3D.get3DRendererObject() || null;
    }

    private _applyShadowState(forceApply?: boolean): void {
      const object3D = this._getOwner3DObject();
      if (!object3D) {
        return;
      }

      const shouldApply =
        forceApply !== undefined
          ? forceApply
          : this.activated() && this._enabled;

      object3D.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh || !mesh.isMesh) {
          return;
        }

        mesh.userData = mesh.userData || {};
        const hasBeenApplied = !!mesh.userData[lightObstacleAppliedKey];

        if (shouldApply) {
          if (!hasBeenApplied) {
            mesh.userData[lightObstaclePrevCastShadowKey] = !!mesh.castShadow;
            mesh.userData[lightObstaclePrevReceiveShadowKey] =
              !!mesh.receiveShadow;
          }

          mesh.castShadow = this._castShadow;
          mesh.receiveShadow = this._receiveShadow;
          mesh.userData[lightObstacleAppliedKey] = true;
          return;
        }

        if (!hasBeenApplied) {
          return;
        }

        const previousCastShadow = mesh.userData[lightObstaclePrevCastShadowKey];
        const previousReceiveShadow =
          mesh.userData[lightObstaclePrevReceiveShadowKey];
        if (typeof previousCastShadow === 'boolean') {
          mesh.castShadow = previousCastShadow;
        }
        if (typeof previousReceiveShadow === 'boolean') {
          mesh.receiveShadow = previousReceiveShadow;
        }

        delete mesh.userData[lightObstacleAppliedKey];
        delete mesh.userData[lightObstaclePrevCastShadowKey];
        delete mesh.userData[lightObstaclePrevReceiveShadowKey];
      });
    }
  }

  gdjs.registerBehavior(
    'Scene3D::LightObstacle',
    gdjs.LightObstacleRuntimeBehavior
  );
}
