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
    }
  }
}
