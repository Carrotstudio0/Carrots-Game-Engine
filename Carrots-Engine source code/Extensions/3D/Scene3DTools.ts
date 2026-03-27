namespace gdjs {
  /**
   * @category Core Engine > Events interfacing
   */
  export namespace scene3d {
    const assumedFovIn2D = 45;
    type CameraRotationState = {
      x: float;
      y: float;
    };
    const cameraRotationByLayer = new WeakMap<
      gdjs.RuntimeLayer,
      CameraRotationState
    >();

    const normalizeAngleDegrees = (angle: float): float => {
      if (!Number.isFinite(angle)) {
        return 0;
      }

      let normalizedAngle = angle % 360;
      if (normalizedAngle <= -180) {
        normalizedAngle += 360;
      } else if (normalizedAngle > 180) {
        normalizedAngle -= 360;
      }
      return normalizedAngle;
    };

    const getOrCreateCameraRotationState = (
      layer: gdjs.RuntimeLayer,
      threeCamera: THREE.Camera
    ): CameraRotationState => {
      let rotationState = cameraRotationByLayer.get(layer);
      if (!rotationState) {
        rotationState = {
          x: normalizeAngleDegrees(gdjs.toDegrees(threeCamera.rotation.x)),
          y: normalizeAngleDegrees(gdjs.toDegrees(threeCamera.rotation.y)),
        };
        cameraRotationByLayer.set(layer, rotationState);
      }
      return rotationState;
    };

    const syncCameraRotationStateFromCamera = (
      layer: gdjs.RuntimeLayer,
      threeCamera: THREE.Camera
    ): CameraRotationState => {
      const rotationState = getOrCreateCameraRotationState(layer, threeCamera);
      rotationState.x = normalizeAngleDegrees(gdjs.toDegrees(threeCamera.rotation.x));
      rotationState.y = normalizeAngleDegrees(gdjs.toDegrees(threeCamera.rotation.y));
      return rotationState;
    };

    export namespace camera {
      export const getCameraZ = (
        runtimeScene: RuntimeScene,
        layerName: string,
        cameraIndex: integer
      ): float => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();
        const threeCamera = layerRenderer.getThreeCamera();
        const fov = threeCamera
          ? threeCamera instanceof THREE.OrthographicCamera
            ? null
            : threeCamera.fov
          : assumedFovIn2D;
        return layer.getCameraZ(fov, cameraIndex);
      };

      export const setCameraZ = (
        runtimeScene: RuntimeScene,
        z: float,
        layerName: string,
        cameraIndex: integer
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();
        const threeCamera = layerRenderer.getThreeCamera();
        const fov = threeCamera
          ? threeCamera instanceof THREE.OrthographicCamera
            ? null
            : threeCamera.fov
          : assumedFovIn2D;
        layer.setCameraZ(z, fov, cameraIndex);
      };

      export const getCameraRotationX = (
        runtimeScene: RuntimeScene,
        layerName: string,
        cameraIndex: integer
      ): float => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();

        const threeCamera = layerRenderer.getThreeCamera();
        if (!threeCamera) return 0;
        return getOrCreateCameraRotationState(layer, threeCamera).x;
      };

      export const setCameraRotationX = (
        runtimeScene: RuntimeScene,
        angle: float,
        layerName: string,
        cameraIndex: integer
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();

        const threeCamera = layerRenderer.getThreeCamera();
        if (!threeCamera) return;

        const rotationState = getOrCreateCameraRotationState(layer, threeCamera);
        rotationState.x = Number.isFinite(angle) ? angle : 0;
        threeCamera.rotation.x = gdjs.toRad(rotationState.x);
      };

      export const getCameraRotationY = (
        runtimeScene: RuntimeScene,
        layerName: string,
        cameraIndex: integer
      ): float => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();

        const threeCamera = layerRenderer.getThreeCamera();
        if (!threeCamera) return 0;
        return getOrCreateCameraRotationState(layer, threeCamera).y;
      };

      export const setCameraRotationY = (
        runtimeScene: RuntimeScene,
        angle: float,
        layerName: string,
        cameraIndex: integer
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();

        const threeCamera = layerRenderer.getThreeCamera();
        if (!threeCamera) return;

        const rotationState = getOrCreateCameraRotationState(layer, threeCamera);
        rotationState.y = Number.isFinite(angle) ? angle : 0;
        threeCamera.rotation.y = gdjs.toRad(rotationState.y);
      };

      export const turnCameraTowardObject = (
        runtimeScene: RuntimeScene,
        object: gdjs.RuntimeObject | null,
        layerName: string,
        cameraIndex: integer,
        isStandingOnY: boolean
      ) => {
        if (!object) return;

        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();

        const threeCamera = layerRenderer.getThreeCamera();
        if (!threeCamera) return;

        if (isStandingOnY) {
          threeCamera.up.set(0, 1, 0);
        } else {
          threeCamera.up.set(0, 0, 1);
        }
        threeCamera.lookAt(
          object.getCenterXInScene(),
          -object.getCenterYInScene(),
          //@ts-ignore
          object.getZ ? object.getZ() : 0
        );
        // The layer angle takes over the 3D camera Z rotation.
        layer.setCameraRotation(gdjs.toDegrees(-threeCamera.rotation.z));
        syncCameraRotationStateFromCamera(layer, threeCamera);
      };

      export const turnCameraTowardPosition = (
        runtimeScene: RuntimeScene,
        x: float,
        y: float,
        z: float,
        layerName: string,
        cameraIndex: integer,
        isStandingOnY: boolean
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        const layerRenderer = layer.getRenderer();

        const threeCamera = layerRenderer.getThreeCamera();
        if (!threeCamera) return;

        if (isStandingOnY) {
          threeCamera.up.set(0, 1, 0);
        } else {
          threeCamera.up.set(0, 0, 1);
        }
        threeCamera.lookAt(x, -y, z);
        // The layer angle takes over the 3D camera Z rotation.
        layer.setCameraRotation(gdjs.toDegrees(-threeCamera.rotation.z));
        syncCameraRotationStateFromCamera(layer, threeCamera);
      };

      export const getNearPlane = (
        runtimeScene: RuntimeScene,
        layerName: string,
        cameraIndex: integer
      ): float => {
        const layer = runtimeScene.getLayer(layerName);
        return layer.getCamera3DNearPlaneDistance();
      };

      export const setNearPlane = (
        runtimeScene: RuntimeScene,
        distance: float,
        layerName: string,
        cameraIndex: integer
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        layer.setCamera3DNearPlaneDistance(distance);
      };

      export const getFarPlane = (
        runtimeScene: RuntimeScene,
        layerName: string,
        cameraIndex: integer
      ): float => {
        const layer = runtimeScene.getLayer(layerName);
        return layer.getCamera3DFarPlaneDistance();
      };

      export const setFarPlane = (
        runtimeScene: RuntimeScene,
        distance: float,
        layerName: string,
        cameraIndex: integer
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        layer.setCamera3DFarPlaneDistance(distance);
      };

      export const getFov = (
        runtimeScene: RuntimeScene,
        layerName: string,
        cameraIndex: integer
      ): float => {
        const layer = runtimeScene.getLayer(layerName);
        return layer.getCamera3DFieldOfView();
      };

      export const setFov = (
        runtimeScene: RuntimeScene,
        angle: float,
        layerName: string,
        cameraIndex: integer
      ) => {
        const layer = runtimeScene.getLayer(layerName);
        layer.setCamera3DFieldOfView(angle);
      };

      export type CameraVector3 = {
        x: float;
        y: float;
        z: float;
      };

      export interface FirstPersonCameraRigConfiguration {
        positionResponsiveness: float;
        rotationResponsiveness: float;
        fovResponsiveness: float;
        minPitch: float;
        maxPitch: float;
        eyeHeight: float;
        eyeForward: float;
        eyeSide: float;
        headBobAmplitude: float;
        headBobFrequency: float;
        rollAmount: float;
        baseFov: float;
        sprintFovBoost: float;
        moveFovBoost: float;
      }

      export interface FirstPersonCameraRigState {
        position: CameraVector3;
        yaw: float;
        pitch: float;
        roll: float;
        currentFov: float;
        headBobPhase: float;
      }

      export interface FirstPersonCameraRigUpdateInput {
        deltaTime?: float;
        lookDeltaYaw?: float;
        lookDeltaPitch?: float;
        moveForward?: float;
        moveRight?: float;
        sprintIntensity?: float;
        targetPosition?: CameraVector3;
        targetYaw?: float;
        targetPitch?: float;
        targetRoll?: float;
      }

      export interface FirstPersonCameraRigTargetObjectOptions {
        eyeHeight?: float;
        eyeForward?: float;
        eyeSide?: float;
        useObjectOrientationForTarget?: boolean;
      }

      const clampNumber = (value: float, min: float, max: float): float => {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
      };

      const exponentialBlend = (
        responsiveness: float,
        deltaTime: float
      ): float => {
        if (!Number.isFinite(deltaTime) || deltaTime <= 0) return 1;
        if (!Number.isFinite(responsiveness) || responsiveness <= 0) return 1;
        return 1 - Math.exp(-responsiveness * deltaTime);
      };

      const lerp = (from: float, to: float, blend: float): float =>
        from + (to - from) * blend;

      const lerpAngle = (from: float, to: float, blend: float): float =>
        from + gdjs.evtTools.common.angleDifference(to, from) * blend;

      const getDefaultFirstPersonCameraRigConfiguration =
        (): FirstPersonCameraRigConfiguration => ({
          positionResponsiveness: 16,
          rotationResponsiveness: 20,
          fovResponsiveness: 10,
          minPitch: -85,
          maxPitch: 85,
          eyeHeight: 0,
          eyeForward: 0,
          eyeSide: 0,
          headBobAmplitude: 0,
          headBobFrequency: 2.2,
          rollAmount: 0,
          baseFov: 60,
          sprintFovBoost: 4,
          moveFovBoost: 1.2,
        });

      const cloneCameraVector3 = (vector: CameraVector3): CameraVector3 => ({
        x: vector.x,
        y: vector.y,
        z: vector.z,
      });

      export class FirstPersonCameraRig {
        private readonly _runtimeScene: RuntimeScene;
        private _layerName: string;
        private _cameraIndex: integer;
        private _configuration: FirstPersonCameraRigConfiguration;
        private _state: FirstPersonCameraRigState;
        private _targetPosition: CameraVector3;
        private _hasTargetOrientation = false;
        private _targetYaw = 0;
        private _targetPitch = 0;
        private _targetRoll = 0;

        constructor(
          runtimeScene: RuntimeScene,
          layerName: string = '',
          cameraIndex: integer = 0,
          initialConfiguration: Partial<FirstPersonCameraRigConfiguration> = {}
        ) {
          this._runtimeScene = runtimeScene;
          this._layerName = layerName;
          this._cameraIndex = cameraIndex;

          this._configuration = getDefaultFirstPersonCameraRigConfiguration();
          this.setConfiguration(initialConfiguration);

          this._targetPosition = {
            x: this._getLayer().getCameraX(this._cameraIndex),
            y: this._getLayer().getCameraY(this._cameraIndex),
            z: getCameraZ(this._runtimeScene, this._layerName, this._cameraIndex),
          };

          this._state = {
            position: cloneCameraVector3(this._targetPosition),
            yaw: getCameraRotationY(
              this._runtimeScene,
              this._layerName,
              this._cameraIndex
            ),
            pitch: getCameraRotationX(
              this._runtimeScene,
              this._layerName,
              this._cameraIndex
            ),
            roll: this._getLayer().getCameraRotation(this._cameraIndex),
            currentFov: getFov(this._runtimeScene, this._layerName, this._cameraIndex),
            headBobPhase: 0,
          };
        }

        private _getLayer(): gdjs.RuntimeLayer {
          return this._runtimeScene.getLayer(this._layerName);
        }

        setLayer(layerName: string, cameraIndex: integer = this._cameraIndex): void {
          this._layerName = layerName;
          this._cameraIndex = cameraIndex;
          this.resetFromCurrentCamera();
        }

        setConfiguration(
          partialConfiguration: Partial<FirstPersonCameraRigConfiguration>
        ): void {
          this._configuration = {
            ...this._configuration,
            ...partialConfiguration,
          };
          this._configuration.positionResponsiveness = Math.max(
            0,
            this._configuration.positionResponsiveness
          );
          this._configuration.rotationResponsiveness = Math.max(
            0,
            this._configuration.rotationResponsiveness
          );
          this._configuration.fovResponsiveness = Math.max(
            0,
            this._configuration.fovResponsiveness
          );
          this._configuration.minPitch = clampNumber(
            this._configuration.minPitch,
            -179,
            179
          );
          this._configuration.maxPitch = clampNumber(
            this._configuration.maxPitch,
            -179,
            179
          );
          if (this._configuration.minPitch > this._configuration.maxPitch) {
            const currentMinPitch = this._configuration.minPitch;
            this._configuration.minPitch = this._configuration.maxPitch;
            this._configuration.maxPitch = currentMinPitch;
          }
          this._configuration.headBobAmplitude = Math.max(
            0,
            this._configuration.headBobAmplitude
          );
          this._configuration.headBobFrequency = Math.max(
            0,
            this._configuration.headBobFrequency
          );
          this._configuration.rollAmount = Math.max(
            0,
            this._configuration.rollAmount
          );
          this._configuration.baseFov = clampNumber(
            this._configuration.baseFov,
            1,
            179
          );
          this._configuration.sprintFovBoost = Math.max(
            0,
            this._configuration.sprintFovBoost
          );
          this._configuration.moveFovBoost = Math.max(
            0,
            this._configuration.moveFovBoost
          );
        }

        getConfiguration(): FirstPersonCameraRigConfiguration {
          return { ...this._configuration };
        }

        getState(): FirstPersonCameraRigState {
          return {
            position: cloneCameraVector3(this._state.position),
            yaw: this._state.yaw,
            pitch: this._state.pitch,
            roll: this._state.roll,
            currentFov: this._state.currentFov,
            headBobPhase: this._state.headBobPhase,
          };
        }

        resetFromCurrentCamera(): void {
          const layer = this._getLayer();
          this._state.position = {
            x: layer.getCameraX(this._cameraIndex),
            y: layer.getCameraY(this._cameraIndex),
            z: getCameraZ(this._runtimeScene, this._layerName, this._cameraIndex),
          };
          this._targetPosition = cloneCameraVector3(this._state.position);
          this._state.yaw = getCameraRotationY(
            this._runtimeScene,
            this._layerName,
            this._cameraIndex
          );
          this._state.pitch = getCameraRotationX(
            this._runtimeScene,
            this._layerName,
            this._cameraIndex
          );
          this._state.roll = layer.getCameraRotation(this._cameraIndex);
          this._state.currentFov = getFov(
            this._runtimeScene,
            this._layerName,
            this._cameraIndex
          );
        }

        updateTargetFromObject(
          object: gdjs.RuntimeObject | null,
          options: FirstPersonCameraRigTargetObjectOptions = {}
        ): void {
          if (!object) return;
          const objectWith3DAccessors = object as gdjs.RuntimeObject & {
            getZ?: () => float;
            getRotationX?: () => float;
            getRotationY?: () => float;
          };

          const objectAngle = Number.isFinite(object.getAngle())
            ? object.getAngle()
            : 0;
          const eyeForward =
            options.eyeForward !== undefined
              ? options.eyeForward
              : this._configuration.eyeForward;
          const eyeSide =
            options.eyeSide !== undefined
              ? options.eyeSide
              : this._configuration.eyeSide;
          const eyeHeight =
            options.eyeHeight !== undefined
              ? options.eyeHeight
              : this._configuration.eyeHeight;

          const forwardAngleRad = gdjs.toRad(objectAngle);
          const sideAngleRad = gdjs.toRad(objectAngle + 90);
          this._targetPosition.x =
            object.getCenterXInScene() +
            Math.cos(forwardAngleRad) * eyeForward +
            Math.cos(sideAngleRad) * eyeSide;
          this._targetPosition.y =
            object.getCenterYInScene() +
            Math.sin(forwardAngleRad) * eyeForward +
            Math.sin(sideAngleRad) * eyeSide;
          this._targetPosition.z =
            (typeof objectWith3DAccessors.getZ === 'function'
              ? objectWith3DAccessors.getZ()
              : 0) + eyeHeight;

          if (options.useObjectOrientationForTarget) {
            const objectRotationX =
              typeof objectWith3DAccessors.getRotationX === 'function' &&
              Number.isFinite(objectWith3DAccessors.getRotationX())
                ? objectWith3DAccessors.getRotationX()
                : this._state.yaw;
            const objectRotationY =
              typeof objectWith3DAccessors.getRotationY === 'function' &&
              Number.isFinite(objectWith3DAccessors.getRotationY())
                ? objectWith3DAccessors.getRotationY()
                : 90 - this._state.pitch;

            this._targetYaw = objectRotationX;
            this._targetPitch = clampNumber(
              -objectRotationY + 90,
              this._configuration.minPitch,
              this._configuration.maxPitch
            );
            this._targetRoll = objectAngle + 90;
            this._hasTargetOrientation = true;
          }
        }

        setTargetPosition(position: CameraVector3): void {
          this._targetPosition = cloneCameraVector3(position);
        }

        update(updateInput: FirstPersonCameraRigUpdateInput = {}): void {
          const deltaTime = Number.isFinite(updateInput.deltaTime)
            ? Math.max(0, updateInput.deltaTime as float)
            : Math.max(0, this._runtimeScene.getElapsedTime() / 1000);

          if (updateInput.targetPosition) {
            this._targetPosition = cloneCameraVector3(updateInput.targetPosition);
          }

          const positionBlend = exponentialBlend(
            this._configuration.positionResponsiveness,
            deltaTime
          );
          this._state.position.x = lerp(
            this._state.position.x,
            this._targetPosition.x,
            positionBlend
          );
          this._state.position.y = lerp(
            this._state.position.y,
            this._targetPosition.y,
            positionBlend
          );
          this._state.position.z = lerp(
            this._state.position.z,
            this._targetPosition.z,
            positionBlend
          );

          const lookDeltaYaw = Number.isFinite(updateInput.lookDeltaYaw)
            ? (updateInput.lookDeltaYaw as float)
            : 0;
          const lookDeltaPitch = Number.isFinite(updateInput.lookDeltaPitch)
            ? (updateInput.lookDeltaPitch as float)
            : 0;
          const moveForward = clampNumber(
            Number.isFinite(updateInput.moveForward)
              ? (updateInput.moveForward as float)
              : 0,
            -1,
            1
          );
          const moveRight = clampNumber(
            Number.isFinite(updateInput.moveRight)
              ? (updateInput.moveRight as float)
              : 0,
            -1,
            1
          );
          const sprintIntensity = clampNumber(
            Number.isFinite(updateInput.sprintIntensity)
              ? (updateInput.sprintIntensity as float)
              : 0,
            0,
            1
          );

          const desiredYaw = Number.isFinite(updateInput.targetYaw)
            ? (updateInput.targetYaw as float) + lookDeltaYaw
            : this._hasTargetOrientation
              ? this._targetYaw + lookDeltaYaw
              : this._state.yaw + lookDeltaYaw;
          const desiredPitch = clampNumber(
            Number.isFinite(updateInput.targetPitch)
              ? (updateInput.targetPitch as float) + lookDeltaPitch
              : this._hasTargetOrientation
                ? this._targetPitch + lookDeltaPitch
                : this._state.pitch + lookDeltaPitch,
            this._configuration.minPitch,
            this._configuration.maxPitch
          );
          const desiredRoll = Number.isFinite(updateInput.targetRoll)
            ? (updateInput.targetRoll as float)
            : this._hasTargetOrientation
              ? this._targetRoll
              : this._state.roll;

          const rotationBlend = exponentialBlend(
            this._configuration.rotationResponsiveness,
            deltaTime
          );
          this._state.yaw = lerpAngle(this._state.yaw, desiredYaw, rotationBlend);
          this._state.pitch = clampNumber(
            lerpAngle(this._state.pitch, desiredPitch, rotationBlend),
            this._configuration.minPitch,
            this._configuration.maxPitch
          );
          const rollWithMotion =
            desiredRoll - moveRight * this._configuration.rollAmount;
          this._state.roll = lerpAngle(
            this._state.roll,
            rollWithMotion,
            rotationBlend
          );

          const movementAmount = Math.min(1, Math.hypot(moveForward, moveRight));
          this._state.headBobPhase +=
            deltaTime *
            this._configuration.headBobFrequency *
            (0.2 + 0.8 * movementAmount) *
            (1 + sprintIntensity * 0.35);
          const bobOffset =
            Math.sin(this._state.headBobPhase * Math.PI * 2) *
            this._configuration.headBobAmplitude *
            movementAmount;

          const targetFov =
            this._configuration.baseFov +
            this._configuration.sprintFovBoost * sprintIntensity +
            this._configuration.moveFovBoost * movementAmount;
          this._state.currentFov = clampNumber(
            lerp(
              this._state.currentFov,
              targetFov,
              exponentialBlend(this._configuration.fovResponsiveness, deltaTime)
            ),
            1,
            179
          );

          const layer = this._getLayer();
          layer.setCameraX(this._state.position.x, this._cameraIndex);
          layer.setCameraY(this._state.position.y, this._cameraIndex);
          setCameraZ(
            this._runtimeScene,
            this._state.position.z + bobOffset,
            this._layerName,
            this._cameraIndex
          );
          setCameraRotationX(
            this._runtimeScene,
            this._state.pitch,
            this._layerName,
            this._cameraIndex
          );
          setCameraRotationY(
            this._runtimeScene,
            this._state.yaw,
            this._layerName,
            this._cameraIndex
          );
          layer.setCameraRotation(this._state.roll, this._cameraIndex);
          setFov(
            this._runtimeScene,
            this._state.currentFov,
            this._layerName,
            this._cameraIndex
          );
        }
      }

      const firstPersonCameraRigsByScene = new WeakMap<
        RuntimeScene,
        Map<string, FirstPersonCameraRig>
      >();

      const getCameraRigKey = (layerName: string, cameraIndex: integer): string =>
        `${layerName}::${cameraIndex}`;

      export const getOrCreateFirstPersonCameraRig = (
        runtimeScene: RuntimeScene,
        layerName: string = '',
        cameraIndex: integer = 0,
        initialConfiguration: Partial<FirstPersonCameraRigConfiguration> = {}
      ): FirstPersonCameraRig => {
        let rigsByKey = firstPersonCameraRigsByScene.get(runtimeScene);
        if (!rigsByKey) {
          rigsByKey = new Map<string, FirstPersonCameraRig>();
          firstPersonCameraRigsByScene.set(runtimeScene, rigsByKey);
        }

        const key = getCameraRigKey(layerName, cameraIndex);
        const existingRig = rigsByKey.get(key);
        if (existingRig) {
          if (Object.keys(initialConfiguration).length > 0) {
            existingRig.setConfiguration(initialConfiguration);
          }
          return existingRig;
        }

        const newRig = new FirstPersonCameraRig(
          runtimeScene,
          layerName,
          cameraIndex,
          initialConfiguration
        );
        rigsByKey.set(key, newRig);
        return newRig;
      };

      export const removeFirstPersonCameraRig = (
        runtimeScene: RuntimeScene,
        layerName: string = '',
        cameraIndex: integer = 0
      ): void => {
        const rigsByKey = firstPersonCameraRigsByScene.get(runtimeScene);
        if (!rigsByKey) return;

        rigsByKey.delete(getCameraRigKey(layerName, cameraIndex));
        if (rigsByKey.size === 0) {
          firstPersonCameraRigsByScene.delete(runtimeScene);
        }
      };

      export const clearFirstPersonCameraRigs = (
        runtimeScene: RuntimeScene
      ): void => {
        firstPersonCameraRigsByScene.delete(runtimeScene);
      };
    }

    gdjs.registerRuntimeSceneUnloadedCallback((runtimeScene) => {
      gdjs.scene3d.camera.clearFirstPersonCameraRigs(runtimeScene);
    });
  }
}
