namespace gdjs {
  const logger = new gdjs.Logger('In-Game editor');
  const SCENE_TYPES_EXTENSION_NAME = 'CarrotsEngine';
  const SCENE_TYPES_PROPERTY_NAME = 'sceneTypesV1';
  const PROJECT_SCENE_TYPE_PROPERTY_NAME = 'projectSceneTypeV1';
  type RuntimeSceneType = '2d' | '3d' | '2.5d';
  const DEFAULT_RUNTIME_SCENE_TYPE: RuntimeSceneType = '2.5d';

  const parseRuntimeSceneType = (value: unknown): RuntimeSceneType | null => {
    // Legacy compatibility for previous in-progress values.
    if (value === 'ui') return '2d';
    return value === '2d' || value === '3d' || value === '2.5d' ? value : null;
  };

  const getRuntimeProjectSceneType = (
    runtimeGame: RuntimeGame
  ): RuntimeSceneType => {
    const rawProjectSceneType = runtimeGame.getExtensionProperty(
      SCENE_TYPES_EXTENSION_NAME,
      PROJECT_SCENE_TYPE_PROPERTY_NAME
    );
    return (
      parseRuntimeSceneType(rawProjectSceneType) || DEFAULT_RUNTIME_SCENE_TYPE
    );
  };

  const getRuntimeSceneType = (
    runtimeGame: RuntimeGame,
    sceneName: string
  ): RuntimeSceneType => {
    const projectSceneType = getRuntimeProjectSceneType(runtimeGame);
    const rawValue = runtimeGame.getExtensionProperty(
      SCENE_TYPES_EXTENSION_NAME,
      SCENE_TYPES_PROPERTY_NAME
    );
    if (!rawValue) return projectSceneType;

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return projectSceneType;
      }

      const sceneType = parseRuntimeSceneType(
        (parsed as Record<string, unknown>)[sceneName]
      );
      return sceneType || projectSceneType;
    } catch (error) {
      return projectSceneType;
    }
  };

  const doesRuntimeSceneTypeAllow3DObjects = (
    sceneType: RuntimeSceneType
  ): boolean => sceneType !== '2d';

  /**
   * A minimal utility to define DOM elements.
   * Also copied in InGameDebugger.tsx.
   */
  function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: {
      style?: Partial<CSSStyleDeclaration>;
      onClick?: (event: Event) => void;
      [attributeName: string]: any;
    },
    ...nodes: (HTMLElement | string)[]
  ): HTMLElement {
    const node = document.createElement(tag);
    Object.keys(attrs).forEach((key) => {
      if (key === 'style') {
        for (const [styleName, value] of Object.entries(attrs.style!)) {
          node.style[styleName] = value;
        }
      } else if (key === 'onClick') {
        node.addEventListener('click', attrs[key]!);
      } else {
        node.setAttribute(key, '' + attrs[key]);
      }
    });

    node.append(...nodes);
    return node;
  }

  /**
   * Adapt the Three.js TransformControls gizmos so that the axis are in the same direction as in GDevelop.
   * This does not change the way the controls work (notably when dragged), it's only a visual adaptation.
   */
  const patchAxesOnTransformControlsGizmos = (
    controls: THREE_ADDONS.TransformControls
  ) => {
    const gizmoRoot = controls && (controls as any)._gizmo;
    if (!gizmoRoot) return;

    // Flip gizmo (visual), picker (raycast), and helper (guide lines)
    const groupsToFlip = ['gizmo', 'picker', 'helper'];

    // Bake axis reflections into geometry so per-frame handle scaling
    // inside TransformControlsGizmo.updateMatrixWorld() won't undo it.
    const flipY = new THREE.Matrix4().makeScale(1, -1, 1);
    const flipX = new THREE.Matrix4().makeScale(-1, 1, 1);

    // For translate mode: flip Y-axis handles
    const shouldFlipYByName = (name) =>
      name === 'Y' || name === 'XY' || name === 'YZ';

    // For scale mode: flip X-axis handles
    const shouldFlipXByName = (name) =>
      name === 'X' || name === 'XY' || name === 'XZ';

    // Process translate mode (flip Y)
    for (const group of groupsToFlip) {
      const root = gizmoRoot[group] && gizmoRoot[group]['translate'];
      if (!root) continue;

      root.traverse((obj) => {
        if (!obj || !obj.geometry) return;
        const name = obj.name || '';
        if (!shouldFlipYByName(name)) return;

        // Bake the Y flip directly into the geometry
        obj.geometry.applyMatrix4(flipY);

        // Keep raycasting bounds correct after mutation
        if (typeof obj.geometry.computeBoundingBox === 'function') {
          obj.geometry.computeBoundingBox();
        }
        if (typeof obj.geometry.computeBoundingSphere === 'function') {
          obj.geometry.computeBoundingSphere();
        }
      });
    }

    // Process scale mode (flip X)
    for (const group of groupsToFlip) {
      const root = gizmoRoot[group] && gizmoRoot[group]['scale'];
      if (!root) continue;

      root.traverse((obj) => {
        if (!obj || !obj.geometry) return;
        const name = obj.name || '';
        if (!shouldFlipXByName(name)) return;

        // Bake the X flip directly into the geometry
        obj.geometry.applyMatrix4(flipX);

        // Keep raycasting bounds correct after mutation
        if (typeof obj.geometry.computeBoundingBox === 'function') {
          obj.geometry.computeBoundingBox();
        }
        if (typeof obj.geometry.computeBoundingSphere === 'function') {
          obj.geometry.computeBoundingSphere();
        }
      });
    }
  };

  const patchColorsOnTransformControlsGizmos = (
    controls: THREE_ADDONS.TransformControls
  ) => {
    const gizmoRoot = controls && (controls as any)._gizmo;
    if (!gizmoRoot) return;

    const colorMap = {
      x: 0xf53e63,
      y: 0xa4e507,
      z: 0x36a9f5,
      e: 0xffff00,
      xyz: 0xffffff,
      xyze: 0x787878,
      highlight: 0xeeeeee,
    };
    const modes = ['translate', 'rotate', 'scale'];
    const groups = ['gizmo', 'helper'];

    // Helper to determine which color to use based on handle name
    const getColorForHandle = (name) => {
      const nameLower = (name || '').toLowerCase();

      if (nameLower === 'xyze') return colorMap.xyze;
      if (nameLower === 'xyz') return colorMap.xyz;
      if (nameLower === 'e') return colorMap.e;

      // For plane handles (XY, YZ, XZ), use the color of the missing axis
      if (nameLower === 'xy') return colorMap.z;
      if (nameLower === 'yz') return colorMap.x;
      if (nameLower === 'xz') return colorMap.y;

      // Single axis handles
      if (nameLower === 'x' || nameLower.includes('x')) return colorMap.x;
      if (nameLower === 'y' || nameLower.includes('y')) return colorMap.y;
      if (nameLower === 'z' || nameLower.includes('z')) return colorMap.z;

      return null;
    };

    // Apply colors to all gizmo materials
    for (const mode of modes) {
      for (const group of groups) {
        const root = gizmoRoot[group] && gizmoRoot[group][mode];
        if (!root) continue;

        root.traverse((obj) => {
          if (!obj || !obj.material) return;

          const color = getColorForHandle(obj.name);
          if (color === null) return;

          // Update the material color and store it as the base color
          obj.material.color.setHex(color);
          obj.material._color = obj.material.color.clone();
          obj.material._opacity = obj.material.opacity;
        });
      }
    }

    // Patch the gizmo's updateMatrixWorld to use custom highlight color
    if (!gizmoRoot._originalUpdateMatrixWorld) {
      gizmoRoot._originalUpdateMatrixWorld =
        gizmoRoot.updateMatrixWorld.bind(gizmoRoot);
      gizmoRoot._customHighlightColor = colorMap.highlight;

      gizmoRoot.updateMatrixWorld = function (force) {
        // Call original update first
        this._originalUpdateMatrixWorld(force);

        // Override the highlight color if an axis is selected
        if (this.enabled && this.axis) {
          const modes = ['translate', 'rotate', 'scale'];
          const groups = ['gizmo', 'helper'];

          for (const mode of modes) {
            for (const group of groups) {
              const root = this[group] && this[group][mode];
              if (!root) continue;

              root.traverse((obj) => {
                if (!obj || !obj.material) return;

                // Check if this handle should be highlighted
                const shouldHighlight =
                  obj.name === this.axis ||
                  this.axis.split('').some((a) => obj.name === a);

                if (shouldHighlight) {
                  // Apply custom highlight color
                  obj.material.color.setHex(this._customHighlightColor);
                  obj.material.opacity = 1.0;
                }
              });
            }
          }
        }
      };
    } else {
      // Update the stored highlight color if already patched
      gizmoRoot._customHighlightColor = colorMap.highlight;
    }
  };

  function patchNegativeAxisHandlesOnTransformControlsGizmos(
    controls: THREE_ADDONS.TransformControls
  ) {
    const gizmo = (controls as any)._gizmo;
    if (!gizmo) return;

    // Helper function to remove specific children from gizmo groups
    function removeNegativeHandles(gizmoGroup, mode) {
      if (!gizmoGroup || !gizmoGroup.children) return;

      const toRemove: Array<THREE.Mesh> = [];
      const seenAxes = { X: [], Y: [], Z: [] };

      // First pass: catalog all children by axis
      gizmoGroup.children.forEach((child) => {
        if (child.name === 'X' || child.name === 'Y' || child.name === 'Z') {
          seenAxes[child.name].push(child);
        }
      });

      // Second pass: mark negative handles for removal
      Object.keys(seenAxes).forEach((axisName) => {
        const axisChildren = seenAxes[axisName];

        if (mode === 'translate' && axisChildren.length >= 2) {
          // In translate: [positive arrow at index 0, negative arrow at index 1, line at index 2]
          // Remove the negative arrow (index 1)
          toRemove.push(axisChildren[1]);
        } else if (mode === 'scale' && axisChildren.length >= 3) {
          // In scale: [negative cube at index 0, line at index 1, positive cube at index 2]
          // Remove the negative cube (index 2)
          toRemove.push(axisChildren[0]);
        }
      });

      // Remove marked children
      toRemove.forEach((child) => {
        gizmoGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material && Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      });
    }

    // Only process the visual gizmos, NOT the pickers (which handle interaction)
    if (gizmo.gizmo && gizmo.gizmo['translate']) {
      removeNegativeHandles(gizmo.gizmo['translate'], 'translate');
    }

    if (gizmo.gizmo && gizmo.gizmo['scale']) {
      removeNegativeHandles(gizmo.gizmo['scale'], 'scale');
    }

    // Keep the pickers intact for interaction - they're invisible anyway
  }

  const getSvgIconUrl = (game: RuntimeGame, resourceName: string) => {
    const resource = game.getResourceLoader().getResource(resourceName);
    if (!resource) return '';
    return game.getResourceLoader().getFullUrl(resource.file);
  };

  const LEFT_KEY = 37;
  const UP_KEY = 38;
  const RIGHT_KEY = 39;
  const DOWN_KEY = 40;
  const ALT_KEY = 18;
  const DEL_KEY = 46;
  const BACKSPACE_KEY = 8;
  const LEFT_ALT_KEY = gdjs.InputManager.getLocationAwareKeyCode(ALT_KEY, 1);
  const RIGHT_ALT_KEY = gdjs.InputManager.getLocationAwareKeyCode(ALT_KEY, 2);
  const SHIFT_KEY = 16;
  const LEFT_SHIFT_KEY = gdjs.InputManager.getLocationAwareKeyCode(
    SHIFT_KEY,
    1
  );
  const RIGHT_SHIFT_KEY = gdjs.InputManager.getLocationAwareKeyCode(
    SHIFT_KEY,
    2
  );
  const SPACE_KEY = 32;
  const CTRL_KEY = 17;
  const LEFT_CTRL_KEY = gdjs.InputManager.getLocationAwareKeyCode(CTRL_KEY, 1);
  const RIGHT_CTRL_KEY = gdjs.InputManager.getLocationAwareKeyCode(CTRL_KEY, 2);
  const LEFT_META_KEY = gdjs.InputManager.getLocationAwareKeyCode(91, 1);
  const RIGHT_META_KEY = gdjs.InputManager.getLocationAwareKeyCode(93, 2);
  const W_KEY = 87;
  const A_KEY = 65;
  const C_KEY = 67;
  const S_KEY = 83;
  const D_KEY = 68;
  const Q_KEY = 81;
  const R_KEY = 82;
  const E_KEY = 69;
  const F_KEY = 70;
  const G_KEY = 71;
  const H_KEY = 72;
  const I_KEY = 73;
  const J_KEY = 74;
  const L_KEY = 76;
  const O_KEY = 79;
  const V_KEY = 86;
  const X_KEY = 88;
  const Y_KEY = 89;
  const Z_KEY = 90;
  const ESC_KEY = 27;
  const EQUAL_KEY = 187;
  const MINUS_KEY = 189;
  const KEY_DIGIT_1 = 49;
  const KEY_DIGIT_2 = 50;
  const KEY_DIGIT_3 = 51;
  const ROTATION_SNAP_DEGREES = 15;
  const SCALE_SNAP_STEP = 0.1;
  const DEFAULT_TRANSLATION_SNAP_STEP = 16;
  const TRANSLATION_SNAP_STEP_MIN = 0.1;
  const TRANSLATION_SNAP_STEP_MAX = 4096;
  const ROTATION_SNAP_DEGREES_MIN = 1;
  const ROTATION_SNAP_DEGREES_MAX = 180;
  const SCALE_SNAP_STEP_MIN = 0.01;
  const SCALE_SNAP_STEP_MAX = 10;

  const exceptionallyGetKeyCodeFromLocationAwareKeyCode = (
    locationAwareKeyCode: number
  ): number => {
    return locationAwareKeyCode % 1000;
  };

  // See same factors in `newIDE/app/src/Utils/ZoomUtils.js`.
  const zoomInFactor = Math.pow(2, (2 * 1) / 16);
  const zoomOutFactor = Math.pow(2, (-2 * 1) / 16);

  const instanceStateFlag = {
    selected: 1,
    locked: 2,
    hovered: 4,
  };
  const instanceWireframeColor = {
    [instanceStateFlag.hovered]: '#54daff',
    [instanceStateFlag.selected]: '#f2a63c',
    [instanceStateFlag.selected | instanceStateFlag.hovered]: '#ffd200',
    [instanceStateFlag.locked | instanceStateFlag.hovered]: '#b02715',
    [instanceStateFlag.locked | instanceStateFlag.selected]: '#b87f7f',
    [instanceStateFlag.locked |
    instanceStateFlag.selected |
    instanceStateFlag.hovered]: '#f51e02',
  };

  const editorCameraFov = 45;
  const cameraRotationSpeedPerPixel = 0.28;
  const cameraMaxInputDeltaPerFrame = 260;
  const orbitCameraMinElevation = -45;
  const orbitCameraMaxElevation = 175;
  const freeCameraMinElevation = -175;
  const freeCameraMaxElevation = 175;
  const freeCameraMoveSpeedMultiplierMin = 0.05;
  const freeCameraMoveSpeedMultiplierMax = 64;
  const freeCameraSpeedWheelStepDivisor = 512;
  const freeCameraBaseMoveSpeedPerFrameAt60Fps = 14;
  const freeCameraFastMoveSpeedPerFrameAt60Fps = 96;
  const freeCameraMoveAccelerationResponsiveness = 22;
  const freeCameraMoveDecelerationResponsiveness = 34;
  const cameraLookInputResponsiveness = 55;
  const cameraDistanceResponsiveness = 24;
  const cameraFloatEpsilon = 0.0001;
  const pointerLockReleaseGracePeriodMs = 100;
  const absoluteVerticalMovementVector = new THREE.Vector3(0, 0, 1);
  const professional3DViewRotationAngle = 35;
  const professional3DViewElevationAngle = 32;
  const professional3DViewDistanceScale = 1.28;

  const normalizeCameraAngleDegrees = (angle: float): float => {
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

  const clampCameraElevationDegrees = (
    elevationAngle: float,
    minElevation: float,
    maxElevation: float
  ): float => {
    if (!Number.isFinite(elevationAngle)) {
      return (minElevation + maxElevation) / 2;
    }
    return gdjs.evtTools.common.clamp(
      elevationAngle,
      minElevation,
      maxElevation
    );
  };

  const sanitizeCameraInputDelta = (delta: float): float => {
    if (!Number.isFinite(delta)) {
      return 0;
    }
    return gdjs.evtTools.common.clamp(
      delta,
      -cameraMaxInputDeltaPerFrame,
      cameraMaxInputDeltaPerFrame
    );
  };

  const getFrameDeltaTimeInSeconds = (runtimeGame: gdjs.RuntimeGame): float => {
    const currentScene = runtimeGame.getSceneStack().getCurrentScene();
    if (currentScene && typeof currentScene.getElapsedTime === 'function') {
      const elapsedTimeInSeconds = currentScene.getElapsedTime() / 1000;
      if (Number.isFinite(elapsedTimeInSeconds) && elapsedTimeInSeconds > 0) {
        return elapsedTimeInSeconds;
      }
    }

    // In editor mode, the scene can be paused and report 0 elapsed time.
    return 1 / 60;
  };

  const getFrameRateCompensationFactor = (deltaTimeInSeconds: float): float => {
    if (!Number.isFinite(deltaTimeInSeconds) || deltaTimeInSeconds <= 0) {
      return 1;
    }
    return deltaTimeInSeconds * 60;
  };

  const getResponsivenessBlend = (
    responsiveness: float,
    deltaTimeInSeconds: float
  ): float => {
    if (
      !Number.isFinite(responsiveness) ||
      responsiveness <= 0 ||
      !Number.isFinite(deltaTimeInSeconds) ||
      deltaTimeInSeconds <= 0
    ) {
      return 1;
    }
    return 1 - Math.exp(-responsiveness * deltaTimeInSeconds);
  };

  const smoothToward = (
    currentValue: float,
    targetValue: float,
    responsiveness: float,
    deltaTimeInSeconds: float
  ): float =>
    currentValue +
    (targetValue - currentValue) *
      getResponsivenessBlend(responsiveness, deltaTimeInSeconds);

  /** @category In-Game Editor */
  export type InGameEditorSettings = {
    theme: {
      iconButtonSelectedBackgroundColor: string;
      iconButtonSelectedColor: string;
      toolbarBackgroundColor: string;
      toolbarSeparatorColor: string;
      textColorPrimary: string;
    };
    mobile3DJoystickEnabled?: boolean;
  };

  const defaultInGameEditorSettings: InGameEditorSettings = {
    theme: {
      iconButtonSelectedBackgroundColor: 'black',
      iconButtonSelectedColor: 'black',
      toolbarBackgroundColor: 'black',
      toolbarSeparatorColor: 'black',
      textColorPrimary: 'black',
    },
    mobile3DJoystickEnabled: true,
  };

  let hasWindowFocus = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      hasWindowFocus = true;
    });
    window.addEventListener('blur', () => {
      hasWindowFocus = false;
    });
  }

  function isDefined<T>(value: T | null | undefined): value is NonNullable<T> {
    return value !== null && value !== undefined;
  }

  type Mobile3DCameraJoystickState = {
    moveX: float;
    moveY: float;
    lookX: float;
    lookY: float;
    hasInput: boolean;
  };

  const mobileJoystickPadSize = 108;
  const mobileJoystickThumbSize = 42;
  const mobileJoystickTravelRadius = 34;
  const mobileJoystickDeadZone = 0.08;

  class Mobile3DCameraJoystickOverlay {
    private _parent: HTMLElement | null = null;
    private _root: HTMLDivElement | null = null;
    private _leftPad: HTMLDivElement | null = null;
    private _leftThumb: HTMLDivElement | null = null;
    private _rightPad: HTMLDivElement | null = null;
    private _rightThumb: HTMLDivElement | null = null;
    private _leftPointerId: integer | null = null;
    private _rightPointerId: integer | null = null;
    private _isVisible = false;
    private _state: Mobile3DCameraJoystickState = {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      hasInput: false,
    };

    render(parent: HTMLElement): void {
      if (!this._root) {
        this._createRoot();
      }
      if (!this._root) return;

      if (this._parent !== parent || this._root.parentElement !== parent) {
        this._parent = parent;
        parent.appendChild(this._root);
      }

      this._root.style.display = this._isVisible ? 'block' : 'none';
    }

    dispose(): void {
      this._clearPointersAndCenterThumbs();
      this._root?.remove();
      this._root = null;
      this._parent = null;
      this._leftPad = null;
      this._leftThumb = null;
      this._rightPad = null;
      this._rightThumb = null;
    }

    setVisible(visible: boolean): void {
      this._isVisible = visible;
      if (!visible) {
        this._clearPointersAndCenterThumbs();
      }
      if (this._root) {
        this._root.style.display = this._isVisible ? 'block' : 'none';
      }
    }

    getState(): Mobile3DCameraJoystickState {
      return { ...this._state };
    }

    private _setStateForSide(
      side: 'left' | 'right',
      normalizedX: float,
      normalizedY: float
    ): void {
      if (side === 'left') {
        this._state.moveX = normalizedX;
        this._state.moveY = -normalizedY;
      } else {
        this._state.lookX = normalizedX;
        this._state.lookY = -normalizedY;
      }
      this._state.hasInput =
        Math.abs(this._state.moveX) > 0.01 ||
        Math.abs(this._state.moveY) > 0.01 ||
        Math.abs(this._state.lookX) > 0.01 ||
        Math.abs(this._state.lookY) > 0.01;
    }

    private _resetSide(side: 'left' | 'right'): void {
      this._setStateForSide(side, 0, 0);
      if (side === 'left') {
        this._leftPointerId = null;
        this._updateThumb('left', 0, 0);
      } else {
        this._rightPointerId = null;
        this._updateThumb('right', 0, 0);
      }
    }

    private _updateThumb(
      side: 'left' | 'right',
      normalizedX: float,
      normalizedY: float
    ): void {
      const thumb = side === 'left' ? this._leftThumb : this._rightThumb;
      if (!thumb) return;

      const offsetX = normalizedX * mobileJoystickTravelRadius;
      const offsetY = normalizedY * mobileJoystickTravelRadius;
      thumb.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }

    private _updateFromClientPosition(
      side: 'left' | 'right',
      clientX: number,
      clientY: number
    ): void {
      const pad = side === 'left' ? this._leftPad : this._rightPad;
      if (!pad) return;

      const rect = pad.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rawX = (clientX - centerX) / mobileJoystickTravelRadius;
      const rawY = (clientY - centerY) / mobileJoystickTravelRadius;
      const length = Math.sqrt(rawX * rawX + rawY * rawY);
      const clampFactor = length > 1 ? 1 / length : 1;
      let normalizedX = rawX * clampFactor;
      let normalizedY = rawY * clampFactor;
      const clampedLength = Math.sqrt(
        normalizedX * normalizedX + normalizedY * normalizedY
      );

      if (clampedLength < mobileJoystickDeadZone) {
        normalizedX = 0;
        normalizedY = 0;
      }

      this._setStateForSide(side, normalizedX, normalizedY);
      this._updateThumb(side, normalizedX, normalizedY);
    }

    private _clearPointersAndCenterThumbs(): void {
      this._leftPointerId = null;
      this._rightPointerId = null;
      this._setStateForSide('left', 0, 0);
      this._setStateForSide('right', 0, 0);
      this._updateThumb('left', 0, 0);
      this._updateThumb('right', 0, 0);
    }

    private _createRoot(): void {
      const root = document.createElement('div');
      root.style.position = 'absolute';
      root.style.left = '0';
      root.style.top = '0';
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.pointerEvents = 'none';
      root.style.zIndex = '8';
      root.style.display = this._isVisible ? 'block' : 'none';

      const left = this._createPad('left', 'Move');
      const right = this._createPad('right', 'Look');

      this._leftPad = left.pad;
      this._leftThumb = left.thumb;
      this._rightPad = right.pad;
      this._rightThumb = right.thumb;

      root.appendChild(left.pad);
      root.appendChild(right.pad);
      this._root = root;
    }

    private _createPad(
      side: 'left' | 'right',
      label: string
    ): { pad: HTMLDivElement; thumb: HTMLDivElement } {
      const pad = document.createElement('div');
      pad.style.position = 'absolute';
      pad.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 14px)';
      if (side === 'left') {
        pad.style.left = 'calc(env(safe-area-inset-left, 0px) + 14px)';
      } else {
        pad.style.right = 'calc(env(safe-area-inset-right, 0px) + 14px)';
      }
      pad.style.width = `${mobileJoystickPadSize}px`;
      pad.style.height = `${mobileJoystickPadSize}px`;
      pad.style.borderRadius = '999px';
      pad.style.background = 'rgba(14, 18, 17, 0.34)';
      pad.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      pad.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)';
      pad.style.backdropFilter = 'blur(2px)';
      pad.style.touchAction = 'none';
      pad.style.pointerEvents = 'auto';
      pad.style.userSelect = 'none';

      const thumb = document.createElement('div');
      thumb.style.position = 'absolute';
      thumb.style.left = '50%';
      thumb.style.top = '50%';
      thumb.style.width = `${mobileJoystickThumbSize}px`;
      thumb.style.height = `${mobileJoystickThumbSize}px`;
      thumb.style.borderRadius = '999px';
      thumb.style.transform = 'translate(-50%, -50%)';
      thumb.style.background = 'rgba(255, 177, 92, 0.3)';
      thumb.style.border = '1px solid rgba(255, 210, 154, 0.72)';
      thumb.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.24)';
      thumb.style.pointerEvents = 'none';

      const labelElement = document.createElement('div');
      labelElement.textContent = label;
      labelElement.style.position = 'absolute';
      labelElement.style.left = '50%';
      labelElement.style.bottom = '-18px';
      labelElement.style.transform = 'translateX(-50%)';
      labelElement.style.fontFamily = 'sans-serif';
      labelElement.style.fontSize = '10px';
      labelElement.style.letterSpacing = '0.03em';
      labelElement.style.textTransform = 'uppercase';
      labelElement.style.color = 'rgba(255, 255, 255, 0.72)';
      labelElement.style.pointerEvents = 'none';

      const handlePointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (side === 'left') {
          if (this._leftPointerId !== null) return;
          this._leftPointerId = event.pointerId;
        } else {
          if (this._rightPointerId !== null) return;
          this._rightPointerId = event.pointerId;
        }

        try {
          pad.setPointerCapture(event.pointerId);
        } catch (_) {}
        this._updateFromClientPosition(side, event.clientX, event.clientY);
      };

      const handlePointerMove = (event: PointerEvent) => {
        const trackedPointerId =
          side === 'left' ? this._leftPointerId : this._rightPointerId;
        if (trackedPointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        this._updateFromClientPosition(side, event.clientX, event.clientY);
      };

      const handlePointerEnd = (event: PointerEvent) => {
        const trackedPointerId =
          side === 'left' ? this._leftPointerId : this._rightPointerId;
        if (trackedPointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        this._resetSide(side);
        try {
          pad.releasePointerCapture(event.pointerId);
        } catch (_) {}
      };

      pad.addEventListener('pointerdown', handlePointerDown);
      pad.addEventListener('pointermove', handlePointerMove);
      pad.addEventListener('pointerup', handlePointerEnd);
      pad.addEventListener('pointercancel', handlePointerEnd);
      pad.addEventListener('pointerleave', handlePointerEnd);

      pad.appendChild(thumb);
      pad.appendChild(labelElement);

      return { pad, thumb };
    }
  }

  type Point3D = [float, float, float];

  type RuntimeObjectWith3D = RuntimeObject &
    Base3DHandler &
    Resizable &
    Scalable &
    Flippable & {
      getCenterZInScene(): float;
    };

  const is3D = (object: gdjs.RuntimeObject): object is RuntimeObjectWith3D => {
    return gdjs.Base3DHandler.is3D(object);
  };

  type AABB3D = {
    min: Point3D;
    max: Point3D;
  };

  type SelectionTransformValues = {
    axis: string | null;
    is3D: boolean;
    position: { x: float; y: float; z: float };
    rotation: { x: float; y: float; z: float };
    scale: { x: float; y: float; z: float };
  };

  type BoneControlData = {
    object: gdjs.RuntimeObject;
    bone: THREE.Bone;
    helper: ObjectSkeletonHelper;
  };

  type Object3DWithBoneControlData = THREE.Object3D & {
    gdjsBoneControlData?: BoneControlData | null;
  };

  type BoneControlHandle = THREE.Mesh & {
    gdjsRuntimeObject?: gdjs.RuntimeObject;
    gdjsBoneControlData?: BoneControlData | null;
  };

  type IKTargetMode = 'bone' | 'position';

  type IKChainSettings = {
    name: string;
    enabled: boolean;
    effectorBoneName: string;
    targetMode: IKTargetMode;
    targetBoneName: string;
    targetPosition: Point3D;
    linkBoneNames: string[];
    iterationCount: number;
    blendFactor: number;
    minAngle: number;
    maxAngle: number;
    targetTolerance: number;
  };

  type IKConfigurableObject = gdjs.RuntimeObject & {
    configureIKChain: (
      chainName: string,
      effectorBoneName: string,
      targetBoneName: string,
      linkBoneNames: string,
      iterationCount: number,
      blendFactor: number,
      minAngle: number,
      maxAngle: number
    ) => void;
    setIKTargetPosition: (
      chainName: string,
      targetX: number,
      targetY: number,
      targetZ: number
    ) => void;
    setIKTargetBone: (chainName: string, targetBoneName: string) => void;
    setIKEnabled: (chainName: string, enabled: boolean) => void;
    setIKIterationCount: (chainName: string, iterationCount: number) => void;
    setIKBlendFactor: (chainName: string, blendFactor: number) => void;
    setIKAngleLimits: (
      chainName: string,
      minAngleDegrees: number,
      maxAngleDegrees: number
    ) => void;
    setIKTargetTolerance: (chainName: string, tolerance: number) => void;
    setIKGizmosEnabled: (enabled: boolean) => void;
    areIKGizmosEnabled: () => boolean;
    removeIKChain: (chainName: string) => void;
    clearIKChains: () => void;
    getIKChainNames: () => string[];
    getIKChainSettings: (chainName: string) => IKChainSettings | null;
    getIKBoneNames: () => string[];
    exportIKChainsToJSON: () => string;
    importIKChainsFromJSON: (json: string, clearExisting: boolean) => void;
    saveIKPose: (poseName: string) => void;
    applyIKPose: (poseName: string) => void;
    removeIKPose: (poseName: string) => void;
    clearIKPoses: () => void;
    hasIKPose: (poseName: string) => boolean;
    getIKPoseCount: () => number;
    getIKPoseNames: () => string[];
    exportIKPosesToJSON: () => string;
    importIKPosesFromJSON: (json: string, clearExisting: boolean) => void;
    pinIKTargetToCurrentEffector: (chainName: string) => void;
    pinAllIKTargetsToCurrentEffectors: () => void;
  };

  const isIKConfigurableObject = (
    object: gdjs.RuntimeObject | null
  ): object is IKConfigurableObject => {
    if (!object) return false;
    const candidate = object as any;
    return (
      typeof candidate.configureIKChain === 'function' &&
      typeof candidate.getIKChainNames === 'function' &&
      typeof candidate.getIKChainSettings === 'function' &&
      typeof candidate.getIKBoneNames === 'function'
    );
  };

  const defaultEffectsData: EffectData[] = [
    {
      effectType: 'Scene3D::HemisphereLight',
      name: 'Default Light for in-game editor',
      doubleParameters: { elevation: 45, intensity: 1, rotation: 0 },
      stringParameters: {
        groundColor: '64;64;64',
        skyColor: '255;255;255',
        top: 'Y-',
      },
      booleanParameters: {},
    },
  ];

  const isControlOrCmdPressed = (inputManager: gdjs.InputManager) => {
    // On macOS, meta key (Apple/Command key) acts as Control key on Windows/Linux.
    return (
      inputManager.isKeyPressed(LEFT_CTRL_KEY) ||
      inputManager.isKeyPressed(RIGHT_CTRL_KEY) ||
      inputManager.isKeyPressed(LEFT_META_KEY) ||
      inputManager.isKeyPressed(RIGHT_META_KEY)
    );
  };

  const isAltPressed = (inputManager: gdjs.InputManager) => {
    return (
      inputManager.isKeyPressed(LEFT_ALT_KEY) ||
      inputManager.isKeyPressed(RIGHT_ALT_KEY)
    );
  };

  const isShiftPressed = (inputManager: gdjs.InputManager) => {
    return (
      inputManager.isKeyPressed(LEFT_SHIFT_KEY) ||
      inputManager.isKeyPressed(RIGHT_SHIFT_KEY)
    );
  };

  const isControlPressedOnly = (inputManager: gdjs.InputManager) => {
    return (
      isControlOrCmdPressed(inputManager) &&
      !isShiftPressed(inputManager) &&
      !isAltPressed(inputManager)
    );
  };

  const isControlPlusShiftPressedOnly = (inputManager: gdjs.InputManager) => {
    return (
      isControlOrCmdPressed(inputManager) &&
      isShiftPressed(inputManager) &&
      !isAltPressed(inputManager)
    );
  };

  const isSpacePressed = (inputManager: gdjs.InputManager) =>
    inputManager.isKeyPressed(SPACE_KEY);

  const shouldDeleteSelection = (inputManager: gdjs.InputManager) => {
    return (
      inputManager.isKeyPressed(DEL_KEY) ||
      inputManager.isKeyPressed(BACKSPACE_KEY)
    );
  };

  const pressAndReleaseForClickDuration = 200;
  const timeBetweenClicksForDoubleClick = 400;

  /** Get the identifiers of the touches that are currently active, without the mouse. */
  const getCurrentTouchIdentifiers = (inputManager: gdjs.InputManager) => {
    return inputManager
      .getAllTouchIdentifiers()
      .slice()
      .filter((id) => id !== gdjs.InputManager.MOUSE_TOUCH_ID) // Exclude mouse touch
      .sort((a, b) => a - b); // Ensure stable order to help comparisons.
  };

  const getTouchesCentroid = (inputManager: gdjs.InputManager) => {
    const ids = getCurrentTouchIdentifiers(inputManager);
    if (ids.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < ids.length; i++) {
      sx += inputManager.getTouchX(ids[i]);
      sy += inputManager.getTouchY(ids[i]);
    }
    return { x: sx / ids.length, y: sy / ids.length };
  };

  const getTouchesDistance = (inputManager: gdjs.InputManager) => {
    const ids = getCurrentTouchIdentifiers(inputManager);
    if (ids.length === 0) return 0;
    return Math.hypot(
      inputManager.getTouchX(ids[0]) - inputManager.getTouchX(ids[1]),
      inputManager.getTouchY(ids[0]) - inputManager.getTouchY(ids[1])
    );
  };

  const areSameTouchesSet = (ids1: Array<integer>, ids2: Array<integer>) => {
    if (ids1.length !== ids2.length) return false;
    for (let i = 0; i < ids1.length; i++) {
      if (ids1[i] !== ids2[i]) return false;
    }
    return true;
  };

  const freeCameraSwitchKeys = [
    LEFT_KEY,
    RIGHT_KEY,
    UP_KEY,
    DOWN_KEY,
    W_KEY,
    S_KEY,
    A_KEY,
    D_KEY,
    Q_KEY,
    E_KEY,
  ];
  const shouldSwitchToFreeCamera = (inputManager: gdjs.InputManager) =>
    inputManager.isMouseButtonPressed(1) &&
    !isControlOrCmdPressed(inputManager) &&
    !isAltPressed(inputManager) &&
    freeCameraSwitchKeys.some((key) => inputManager.isKeyPressed(key));

  const snap = (value: float, size: float, offset: float) =>
    size ? offset + size * Math.round((value - offset) / size) : value;

  class Selection {
    private _selectedObjects: Array<gdjs.RuntimeObject> = [];

    add(object: gdjs.RuntimeObject) {
      if (!this._selectedObjects.includes(object)) {
        this._selectedObjects.push(object);
      }
    }

    addAll(objects: RuntimeObject[]) {
      for (const object of objects) {
        this.add(object);
      }
    }

    clear() {
      this._selectedObjects = [];
    }

    toggle(object: gdjs.RuntimeObject) {
      const index = this._selectedObjects.indexOf(object);
      if (index < 0) {
        this._selectedObjects.push(object);
      } else {
        this._selectedObjects.splice(index, 1);
      }
    }

    getSelectedObjects() {
      return this._selectedObjects;
    }

    getLastSelectedObject(options?: {
      ignoreIf: (object: gdjs.RuntimeObject) => boolean;
    }): gdjs.RuntimeObject | null {
      if (options && options.ignoreIf) {
        for (let i = this._selectedObjects.length - 1; i >= 0; i--) {
          const object = this._selectedObjects[i];
          if (!options.ignoreIf(object)) {
            return object;
          }
        }
        return null;
      }

      return this._selectedObjects[this._selectedObjects.length - 1] || null;
    }

    getAABB(): AABB3D | null {
      let aabb: AABB3D | null = null;
      for (const object of this._selectedObjects) {
        if (is3D(object)) {
          const aabb2D = object.getAABB();
          const minZ = object.getUnrotatedAABBMinZ();
          const maxZ = object.getUnrotatedAABBMaxZ();
          if (aabb) {
            aabb.min[0] = Math.min(aabb.min[0], aabb2D.min[0]);
            aabb.min[1] = Math.min(aabb.min[1], aabb2D.min[1]);
            aabb.min[2] = Math.min(aabb.min[2], minZ);
            aabb.max[0] = Math.max(aabb.max[0], aabb2D.max[0]);
            aabb.max[1] = Math.max(aabb.max[1], aabb2D.max[1]);
            aabb.max[2] = Math.max(aabb.max[2], maxZ);
          } else {
            aabb = {
              min: [aabb2D.min[0], aabb2D.min[1], minZ],
              max: [aabb2D.max[0], aabb2D.max[1], maxZ],
            };
          }
        }
      }
      return aabb;
    }
  }

  class ObjectMover {
    private editor: InGameEditor;
    private _changeHappened = false;
    private startTime = 0;

    constructor(editor: InGameEditor) {
      this.editor = editor;
    }

    _objectInitialPositions: Map<
      gdjs.RuntimeObject,
      {
        x: float;
        y: float;
        z: float;
        rotationX: float;
        rotationY: float;
        angle: float;
        width: float;
        height: float;
        depth: float;
      }
    > = new Map();

    startMove({ skipClickGuard = false }: { skipClickGuard?: boolean } = {}) {
      this._changeHappened = false;
      this._objectInitialPositions.clear();
      this.startTime = skipClickGuard ? 0 : Date.now();
    }

    endMove(): boolean {
      const changeHappened = this._changeHappened;
      this._objectInitialPositions.clear();
      this._changeHappened = false;
      return changeHappened;
    }

    move(
      selectedObjects: Array<gdjs.RuntimeObject>,
      movement: {
        translationX: float;
        translationY: float;
        translationZ: float;
        rotationX: float;
        rotationY: float;
        rotationZ: float;
        scaleX: float;
        scaleY: float;
        scaleZ: float;
      }
    ) {
      if (Date.now() - this.startTime < 150) {
        // Avoid miss-clicks gizmo dragging point to change object positions.
        return;
      }
      selectedObjects.forEach((object) => {
        if (this.editor.isInstanceLocked(object)) {
          return;
        }

        this._changeHappened =
          this._changeHappened ||
          movement.translationX !== 0 ||
          movement.translationY !== 0 ||
          movement.translationZ !== 0 ||
          movement.rotationX !== 0 ||
          movement.rotationY !== 0 ||
          movement.rotationZ !== 0 ||
          movement.scaleX !== 1 ||
          movement.scaleY !== 1 ||
          movement.scaleZ !== 1;

        let initialPosition = this._objectInitialPositions.get(object);
        if (!initialPosition) {
          initialPosition = is3D(object)
            ? {
                x: object.getX(),
                y: object.getY(),
                z: object.getZ(),
                rotationX: object.getRotationX(),
                rotationY: object.getRotationY(),
                angle: object.getAngle(),
                width: object.getWidth(),
                height: object.getHeight(),
                depth: object.getDepth(),
              }
            : {
                x: object.getX(),
                y: object.getY(),
                z: 0,
                rotationX: 0,
                rotationY: 0,
                angle: object.getAngle(),
                width: object.getWidth(),
                height: object.getHeight(),
                depth: 0,
              };
          this._objectInitialPositions.set(object, initialPosition);
        }
        object.setX(Math.round(initialPosition.x + movement.translationX));
        object.setY(Math.round(initialPosition.y + movement.translationY));
        object.setAngle(
          gdjs.evtTools.common.mod(
            Math.round(initialPosition.angle + movement.rotationZ),
            360
          )
        );
        if (movement.scaleX !== 1) {
          object.setWidth(
            Math.round(initialPosition.width * Math.abs(movement.scaleX))
          );
        }
        if (movement.scaleY !== 1) {
          object.setHeight(
            Math.round(initialPosition.height * Math.abs(movement.scaleY))
          );
        }
        if (is3D(object)) {
          object.setZ(Math.round(initialPosition.z + movement.translationZ));
          object.setRotationX(
            gdjs.evtTools.common.mod(
              Math.round(initialPosition.rotationX + movement.rotationX),
              360
            )
          );
          object.setRotationY(
            gdjs.evtTools.common.mod(
              Math.round(initialPosition.rotationY + movement.rotationY),
              360
            )
          );
          if (movement.scaleZ !== 1) {
            object.setDepth(
              Math.round(initialPosition.depth * Math.abs(movement.scaleZ))
            );
          }
        }
      });
    }
  }

  const getCameraForwardVector = (threeCamera: THREE.Camera) => {
    // Make sure camera's matrixWorld is up-to-date (usually is, but good practice).
    threeCamera.updateMatrixWorld();

    // threeCamera.matrixWorld is a 4x4. In Three.js, the columns correspond to:
    //   [ right.x,   up.x,    forwardNeg.x,  pos.x
    //     right.y,   up.y,    forwardNeg.y,  pos.y
    //     right.z,   up.z,    forwardNeg.z,  pos.z
    //     0,         0,       0,             1     ]
    //
    // By default, a Three.js camera looks down the -Z axis, so the "forward" axis
    // in the matrix is actually the negative Z column. We'll call it "forward" below.
    const elements = threeCamera.matrixWorld.elements;

    // Local forward axis in world space (note we take the negative of that column).
    const forward = new THREE.Vector3(-elements[8], elements[9], -elements[10]);

    // Normalize it, just in case (they should generally be unit vectors).
    forward.normalize();

    return { forward };
  };

  /** @category In-Game Editor */
  export class InGameEditor {
    private _editorId: string = '';
    private _runtimeGame: RuntimeGame;
    private _currentScene: gdjs.RuntimeScene | null = null;
    private _currentSceneType: RuntimeSceneType = DEFAULT_RUNTIME_SCENE_TYPE;
    private _editedInstanceContainer: gdjs.RuntimeInstanceContainer | null =
      null;
    private _editedInstanceDataList: InstanceData[] = [];
    private _editedLayerDataList: LayerData[] = [];
    private _selectedLayerName: string = '';
    private _innerArea: AABB3D | null = null;
    private _threeInnerArea: THREE.Object3D | null = null;
    private _unregisterContextLostListener: (() => void) | null = null;
    private _tempVector2d: THREE.Vector2 = new THREE.Vector2();
    private _raycaster: THREE.Raycaster = new THREE.Raycaster();

    private _isVisible = true;
    private _timeSinceLastInteraction = 0;
    private _isFirstFrame = true;

    private _editorCamera;

    /** Keep track of the focus to know if the game was blurred since the last frame. */
    private _windowHadFocus = true;

    // The controls shown to manipulate the selection.
    private _selectionControls: {
      object: gdjs.RuntimeObject;
      boneControl: BoneControlData | null;
      dummyThreeObject: THREE.Object3D;
      threeTransformControls: THREE_ADDONS.TransformControls;
    } | null = null;
    private _transformControlsMode: 'translate' | 'rotate' | 'scale' =
      'translate';
    private _transformControlsSpace: 'local' | 'world' = 'local';
    private _isTranslationSnapEnabled = true;
    private _isRotationSnapEnabled = false;
    private _isScaleSnapEnabled = false;
    private _translationSnapStep = DEFAULT_TRANSLATION_SNAP_STEP;
    private _isTranslationSnapStepManuallyChanged = false;
    private _rotationSnapDegrees = ROTATION_SNAP_DEGREES;
    private _scaleSnapStep = SCALE_SNAP_STEP;
    private _lastSelectedTransformAxis: string | null = null;
    private _lastAppliedTransformControlsSettings: {
      controls: THREE_ADDONS.TransformControls;
      mode: 'translate' | 'rotate' | 'scale';
      space: 'local' | 'world';
      translationSnap: number | null;
      rotationSnap: number | null;
      scaleSnap: number | null;
    } | null = null;
    private _skipCameraMovementThisFrame = false;
    private _editorGrid: EditorGrid;
    private _selectionControlsMovementTotalDelta: {
      translationX: float;
      translationY: float;
      translationZ: float;
      rotationX: float;
      rotationY: float;
      rotationZ: float;
      scaleX: float;
      scaleY: float;
      scaleZ: float;
    } | null = null;
    private _hasSelectionActuallyMoved = false;
    private _isTransformControlsHovered = false;
    private _wasMovingSelectionLastFrame = false;

    private _selectionBox: THREE_ADDONS.SelectionBox | null = null;
    private _selectionBoxElement: HTMLDivElement;
    private _selectionBoxStartCursorX: float = 0;
    private _selectionBoxStartCursorY: float = 0;

    // The selected objects.
    private _selection = new Selection();
    private _selectionBoxes: Map<RuntimeObject, ObjectSelectionBoxHelper> =
      new Map();
    private _skeletonHelpers: Map<RuntimeObject, ObjectSkeletonHelper> =
      new Map();
    private _boneControlUnderCursor: BoneControlData | null = null;
    private _selectedBoneControl: BoneControlData | null = null;
    private _isIKModeEnabled = false;
    private _objectMover = new ObjectMover(this);

    private _wasMouseLeftButtonPressed = false;
    private _wasMouseRightButtonPressed = false;
    private _wasMouseMiddleButtonPressed = false;
    private _pressedOriginalCursorX: float = 0;
    private _pressedOriginalCursorY: float = 0;
    private _previousCursorX: float = 0;
    private _previousCursorY: float = 0;
    private _pressedRightButtonTime: number = 0;
    private _pressedMiddleButtonTime: number = 0;
    private _lastPointerLockMousePressTime: number = 0;
    private _shouldReleasePressedKeysOnFocusRecovery: boolean = false;

    private _lastClickOnObjectUnderCursor: {
      object: gdjs.RuntimeObject | null;
      time: number;
    } = {
      object: null,
      time: 0,
    };

    // Dragged new object:
    private _draggedNewObject: gdjs.RuntimeObject | null = null;
    private _draggedSelectedObject: gdjs.RuntimeObject | null = null;
    private _draggedSelectedObjectInitialX: float = 0;
    private _draggedSelectedObjectInitialY: float = 0;
    private _draggedSelectedObjectInitialZ: float = 0;
    private _draggedSelectedObjectTotalDelta: {
      translationX: float;
      translationY: float;
      translationZ: float;
      rotationX: float;
      rotationY: float;
      rotationZ: float;
      scaleX: float;
      scaleY: float;
      scaleZ: float;
    } = {
      translationX: 0,
      translationY: 0,
      translationZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    };
    private _instancesEditorSettings: InstancesEditorSettings | null = null;
    private _toolbar: Toolbar;
    private _mobile3DCameraJoystick: Mobile3DCameraJoystickOverlay;
    private _ikSettingsPanel: IKSettingsPanel;
    private _inGameEditorSettings: InGameEditorSettings;

    constructor(
      game: RuntimeGame,
      projectData: ProjectData,
      inGameEditorSettings: InGameEditorSettings | null
    ) {
      this._runtimeGame = game;
      this._editorCamera = new EditorCamera(this);
      this._editorGrid = new EditorGrid(this);

      this._selectionBoxElement = document.createElement('div');
      this._selectionBoxElement.style.position = 'fixed';
      this._selectionBoxElement.style.backgroundColor = '#f2a63c44';
      this._selectionBoxElement.style.border = '1px solid #f2a63c';

      this._inGameEditorSettings =
        inGameEditorSettings || defaultInGameEditorSettings;

      this._toolbar = new Toolbar({
        getTransformControlsMode: () => this._getTransformControlsMode(),
        setTransformControlsMode: (mode: 'translate' | 'rotate' | 'scale') =>
          this._setTransformControlsMode(mode),
        getTransformControlsSpace: () => this._getTransformControlsSpace(),
        toggleTransformControlsSpace: () =>
          this._toggleTransformControlsSpace(),
        isTranslationSnapEnabled: () => this._isTranslationSnapEnabled,
        isRotationSnapEnabled: () => this._isRotationSnapEnabled,
        isScaleSnapEnabled: () => this._isScaleSnapEnabled,
        getTranslationSnapStep: () => this._translationSnapStep,
        getRotationSnapDegrees: () => this._rotationSnapDegrees,
        getScaleSnapStep: () => this._scaleSnapStep,
        toggleTranslationSnap: () => this._toggleTransformSnap('translation'),
        toggleRotationSnap: () => this._toggleTransformSnap('rotation'),
        toggleScaleSnap: () => this._toggleTransformSnap('scale'),
        decreaseTranslationSnapStep: (event?: MouseEvent) =>
          this._handleTranslationStepButtonClick(-1, event),
        increaseTranslationSnapStep: (event?: MouseEvent) =>
          this._handleTranslationStepButtonClick(1, event),
        decreaseRotationSnapDegrees: (event?: MouseEvent) =>
          this._handleRotationStepButtonClick(-1, event),
        increaseRotationSnapDegrees: (event?: MouseEvent) =>
          this._handleRotationStepButtonClick(1, event),
        decreaseScaleSnapStep: (event?: MouseEvent) =>
          this._handleScaleStepButtonClick(-1, event),
        increaseScaleSnapStep: (event?: MouseEvent) =>
          this._handleScaleStepButtonClick(1, event),
        focusOnSelection: () => this._focusOnSelection(),
        switchToFreeCamera: () => this._getEditorCamera().switchToFreeCamera(),
        switchToOrbitCamera: () =>
          this._getEditorCamera().switchToOrbitAroundZ0(4000),
        isFreeCamera: () => this._getEditorCamera().isFreeCamera(),
        isIKModeEnabled: () => this._isIKModeEnabled,
        toggleIKMode: () => this._toggleIKMode(),
        hasIKTargetSelection: () => this._canEnableIKModeForSelection(),
        getSvgIconUrl: (iconName: string) => getSvgIconUrl(game, iconName),
        hasSelection: () => this._selection.getSelectedObjects().length > 0,
        hasSelectionControlsShown: () => !!this._selectionControls,
        hasEditableSelection: () => this._hasEditableSelection(),
        getSelectionTransformValues: () => this._getSelectionTransformValues(),
      });
      this._mobile3DCameraJoystick = new Mobile3DCameraJoystickOverlay();
      this._ikSettingsPanel = new IKSettingsPanel({
        getActiveIKObject: () => this._getActiveIKObject(),
        getSelectedBoneName: () =>
          this._selectedBoneControl
            ? this._selectedBoneControl.bone.name
            : null,
        isIKModeEnabled: () => this._isIKModeEnabledForSelection(),
        setIKModeEnabled: (enabled: boolean) => this._setIKModeEnabled(enabled),
        persistIKState: (
          objectName: string,
          ikChainsJson: string,
          ikPosesJson: string
        ) =>
          this._persistIKStateToObjectConfiguration(
            objectName,
            ikChainsJson,
            ikPosesJson
          ),
      });

      this._applyInGameEditorSettings();
      this.onProjectDataChange(projectData);

      // Uncomment to get access to the runtime game from the console and do
      // testing.
      // window.globalRuntimeGameForTesting = game;
    }

    private _setupWebGLContextLostListener(): void {
      const canvas = this._runtimeGame.getRenderer().getCanvas();
      if (!canvas) return;

      const handleContextLost = (event: Event) => {
        console.warn('WebGL context lost, notifying the editor...');

        // Prevent to restore the context, and prefer to let the editor handle this
        // to restart from a clean state.
        event.preventDefault();

        const debuggerClient = this._runtimeGame._debuggerClient;
        if (debuggerClient) {
          debuggerClient.sendGraphicsContextLost();
        }
      };

      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('contextlost', handleContextLost);
      this._unregisterContextLostListener = () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('contextlost', handleContextLost);
      };
    }

    dispose(): void {
      if (this._unregisterContextLostListener) {
        this._unregisterContextLostListener();
        this._unregisterContextLostListener = null;
      }
      this._mobile3DCameraJoystick.dispose();
      this._ikSettingsPanel.dispose();
    }

    private _applyInGameEditorSettings() {
      if (typeof document === 'undefined') return;

      const rootElement = document.documentElement;
      if (!rootElement) return;

      rootElement.style.setProperty(
        '--in-game-editor-theme-icon-button-selected-background-color',
        this._inGameEditorSettings.theme.iconButtonSelectedBackgroundColor
      );
      rootElement.style.setProperty(
        '--in-game-editor-theme-icon-button-selected-color',
        this._inGameEditorSettings.theme.iconButtonSelectedColor
      );
      rootElement.style.setProperty(
        '--in-game-editor-theme-toolbar-background-color',
        this._inGameEditorSettings.theme.toolbarBackgroundColor
      );
      rootElement.style.setProperty(
        '--in-game-editor-theme-toolbar-separator-color',
        this._inGameEditorSettings.theme.toolbarSeparatorColor
      );
      rootElement.style.setProperty(
        '--in-game-editor-theme-text-color-primary',
        this._inGameEditorSettings.theme.textColorPrimary
      );
    }

    setInGameEditorSettings(inGameEditorSettings: InGameEditorSettings) {
      this._inGameEditorSettings = {
        ...this._inGameEditorSettings,
        ...inGameEditorSettings,
      };
      this._applyInGameEditorSettings();
    }

    getRuntimeGame() {
      return this._runtimeGame;
    }

    getMobile3DCameraJoystickState(): Mobile3DCameraJoystickState {
      return this._mobile3DCameraJoystick.getState();
    }

    private _isLikelyTouchDevice(): boolean {
      if (typeof navigator === 'undefined' || typeof window === 'undefined') {
        return false;
      }
      const maxTouchPoints =
        typeof navigator.maxTouchPoints === 'number'
          ? navigator.maxTouchPoints
          : 0;
      const hasCoarsePointer =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      const hasTouchEvent = 'ontouchstart' in window;
      const userAgent = (navigator.userAgent || '').toLowerCase();
      const hasMobileUserAgent =
        /android|iphone|ipad|ipod|mobile|tablet/.test(userAgent);

      return (
        (maxTouchPoints > 0 && hasCoarsePointer) ||
        hasTouchEvent ||
        hasMobileUserAgent
      );
    }

    private _shouldShowMobile3DCameraJoystick(): boolean {
      return (
        this._inGameEditorSettings.mobile3DJoystickEnabled !== false &&
        this._isLikelyTouchDevice() &&
        doesRuntimeSceneTypeAllow3DObjects(this._currentSceneType)
      );
    }

    onProjectDataChange(projectData: ProjectData): void {
      this.setEffectsHiddenInEditor(
        !!projectData.properties.areEffectsHiddenInEditor
      );
    }

    onLayersDataChange(
      layersData: Array<LayerData>,
      areEffectsHiddenInEditor: boolean
    ): void {
      for (const layerData of layersData) {
        // Camera controls don't work in orthographic.
        if (layerData.cameraType === 'orthographic') {
          layerData.cameraType = 'perspective';
        }
        layerData.camera3DFieldOfView = editorCameraFov;
        // Force 2D and 3D objects to be visible on any layer.
        layerData.renderingType = '2d+3d';
        if (areEffectsHiddenInEditor) {
          if (layerData.effects !== defaultEffectsData) {
            layerData._hiddenEffects = layerData.effects;
            layerData.effects = defaultEffectsData;
          }
        } else {
          if (layerData._hiddenEffects) {
            layerData.effects = layerData._hiddenEffects;
          }
        }
      }
    }

    /**
     * Modify the layer data accordingly.
     * `gdjs.HotReloader.hotReloadRuntimeSceneLayers` must be run for the
     * changes to be applied.
     */
    setEffectsHiddenInEditor(areEffectsHiddenInEditor: boolean) {
      const projectData = this._runtimeGame.getGameData();
      projectData.properties.areEffectsHiddenInEditor =
        areEffectsHiddenInEditor;
      for (const layoutData of projectData.layouts) {
        this.onLayersDataChange(layoutData.layers, areEffectsHiddenInEditor);
      }
    }

    areEffectsHidden(): boolean {
      return !!this._runtimeGame.getGameData().properties
        .areEffectsHiddenInEditor;
    }

    getEditorId(): string {
      return this._editorId;
    }

    getEditedInstanceDataList(): InstanceData[] {
      return this._editedInstanceDataList;
    }

    getEditedLayerDataList(): LayerData[] {
      return this._editedLayerDataList;
    }

    getEditedInstanceContainer(): gdjs.RuntimeInstanceContainer | null {
      return this._editedInstanceContainer;
    }

    getCurrentScene(): gdjs.RuntimeScene | null {
      return this._currentScene;
    }

    /**
     * Return the layer to be used for camera calculus.
     * @see getEditorLayer
     */
    private getCameraLayer(layerName: string): gdjs.RuntimeLayer | null {
      // When the edited container is a custom object,
      // only a base layer exists and `getLayer` falls back on it.
      return this._currentScene ? this._currentScene.getLayer(layerName) : null;
    }

    /**
     * Return the layer which contains the objects.
     * @see getCameraLayer
     */
    private getEditorLayer(layerName: string): gdjs.RuntimeLayer | null {
      return this._editedInstanceContainer
        ? this._editedInstanceContainer.getLayer(layerName)
        : null;
    }

    /**
     * Called by the RuntimeGame when the game resolution is changed.
     * Useful to notify scene and layers that resolution is changed, as they
     * might be caching it.
     */
    onGameResolutionResized() {
      if (!this._currentScene) {
        return;
      }
      this._currentScene.onGameResolutionResized();
    }

    async switchToSceneOrVariant(
      editorId: string | null,
      sceneName: string | null,
      externalLayoutName: string | null,
      eventsBasedObjectType: string | null,
      eventsBasedObjectVariantName: string | null,
      editorCamera3D: EditorCameraState | null
    ) {
      if (this._currentScene) {
        this._currentScene.unloadScene();
        this._currentScene = null;
      }
      this._currentSceneType = DEFAULT_RUNTIME_SCENE_TYPE;
      // The 3D scene is rebuilt and the inner area marker is lost in the process.
      this._threeInnerArea = null;
      this._innerArea = null;
      this._selectedLayerName = '';
      // Clear any reference to `RuntimeObject` from the unloaded scene.
      this._selectionBoxes.clear();
      this._skeletonHelpers.forEach((helper) => {
        helper.removeFromParent();
      });
      this._skeletonHelpers.clear();
      this._boneControlUnderCursor = null;
      this._selectedBoneControl = null;
      this._isIKModeEnabled = false;
      this._selectionControls = null;
      this._draggedNewObject = null;
      this._draggedSelectedObject = null;
      const selectedObjectIds = this._selection
        .getSelectedObjects()
        .map((object) => object.persistentUuid)
        .filter(Boolean) as Array<string>;

      let editedLayerDataList: Array<LayerData> = [];
      let editedInstanceDataList: Array<InstanceData> = [];
      if (eventsBasedObjectType) {
        this._currentSceneType = DEFAULT_RUNTIME_SCENE_TYPE;
        const eventsBasedObjectVariantData =
          this._runtimeGame.getEventsBasedObjectVariantData(
            eventsBasedObjectType,
            eventsBasedObjectVariantName || ''
          );
        if (eventsBasedObjectVariantData) {
          editedLayerDataList = eventsBasedObjectVariantData.layers;
          editedInstanceDataList = eventsBasedObjectVariantData.instances;
          await this._runtimeGame._resourcesLoader.loadResources(
            eventsBasedObjectVariantData.usedResources.map(
              (resource) => resource.name
            ),
            () => {}
          );
          const sceneAndCustomObject = this._createSceneWithCustomObject(
            eventsBasedObjectType,
            eventsBasedObjectVariantName || ''
          );
          if (sceneAndCustomObject) {
            const { scene, customObjectInstanceContainer } =
              sceneAndCustomObject;
            this._currentScene = scene;
            this._editedInstanceContainer = customObjectInstanceContainer;
          }
          this.setInstancesEditorSettings(
            eventsBasedObjectVariantData.editionSettings
          );
          this._innerArea = eventsBasedObjectVariantData._initialInnerArea;
        } else {
          console.warn(
            `Couldn't find any variant named "${eventsBasedObjectVariantName || ''}" for ${eventsBasedObjectType}`
          );
        }
      } else if (sceneName) {
        this._currentSceneType = getRuntimeSceneType(this._runtimeGame, sceneName);
        await this._runtimeGame.loadFirstAssetsAndStartBackgroundLoading(
          sceneName,
          () => {}
        );
        // Load the new one
        const sceneAndExtensionsData =
          this._runtimeGame.getSceneAndExtensionsData(sceneName);
        const newScene = new gdjs.RuntimeScene(this._runtimeGame);
        newScene.loadFromScene(sceneAndExtensionsData, {
          skipCreatingInstances: !!externalLayoutName,
        });

        // Optionally create the objects from an external layout.
        if (externalLayoutName) {
          const externalLayoutData =
            this._runtimeGame.getExternalLayoutData(externalLayoutName);
          if (externalLayoutData) {
            newScene.createObjectsFrom(
              externalLayoutData.instances,
              0,
              0,
              0,
              /*trackByPersistentUuid=*/
              true
            );
            this.setInstancesEditorSettings(externalLayoutData.editionSettings);
          }
        } else {
          this.setInstancesEditorSettings(
            sceneAndExtensionsData!.sceneData.uiSettings
          );
        }
        this._currentScene = newScene;
        this._editedInstanceContainer = newScene;
        if (sceneAndExtensionsData) {
          editedLayerDataList = sceneAndExtensionsData.sceneData.layers;
        }
        if (externalLayoutName) {
          const externalLayoutData =
            this._runtimeGame.getExternalLayoutData(externalLayoutName);
          if (externalLayoutData) {
            editedInstanceDataList = externalLayoutData.instances;
          }
        } else {
          const sceneAndExtensionsData =
            this._runtimeGame.getSceneAndExtensionsData(sceneName);
          if (sceneAndExtensionsData) {
            editedInstanceDataList = sceneAndExtensionsData.sceneData.instances;
          }
        }
      } else {
        this._currentSceneType = DEFAULT_RUNTIME_SCENE_TYPE;
        console.warn('eventsBasedObjectType or sceneName must be set.');
      }
      this._editedInstanceDataList = editedInstanceDataList;
      this._editedLayerDataList = editedLayerDataList;
      this._editorId = editorId || '';
      if (editorCamera3D) {
        this.restoreCameraState(editorCamera3D);
      } else {
        // TODO Get the visibleScreenArea from the editor.
        this.zoomToInitialPosition({
          minX: 0.15,
          minY: 0.15,
          maxX: 0.85,
          maxY: 0.85,
        });
      }

      // Update initialRuntimeGameStatus so that a hard reload
      // will come back to the same state, and so that we can check later
      // if the game is already on the state that is being requested.
      this._runtimeGame.getAdditionalOptions().initialRuntimeGameStatus = {
        isPaused: this._runtimeGame.isPaused(),
        isInGameEdition: this._runtimeGame.isInGameEdition(),
        sceneName: sceneName,
        injectedExternalLayoutName: externalLayoutName,
        skipCreatingInstancesFromScene: !!externalLayoutName,
        eventsBasedObjectType,
        eventsBasedObjectVariantName,
        editorId,
      };

      // Try to keep object selection in case the same scene is reloaded.
      this.setSelectedObjects(selectedObjectIds);
      this._isFirstFrame = true;
    }

    private _createSceneWithCustomObject(
      eventsBasedObjectType: string,
      eventsBasedObjectVariantName: string
    ): {
      scene: gdjs.RuntimeScene;
      customObjectInstanceContainer: gdjs.CustomRuntimeObjectInstanceContainer;
    } | null {
      const eventsBasedObjectData = this._runtimeGame.getEventsBasedObjectData(
        eventsBasedObjectType
      );
      if (!eventsBasedObjectData) {
        logger.error(
          `A CustomRuntimeObject was open in editor referring to an non existing events based object data with type "${eventsBasedObjectType}".`
        );
        return null;
      }

      const scene = new gdjs.RuntimeScene(this._runtimeGame);
      scene.loadFromScene({
        sceneData: {
          variables: [],
          instances: [
            {
              angle: 0,
              customSize: false,
              height: 0,
              layer: '',
              name: 'Object',
              persistentUuid: '12345678-1234-1234-1234-123456789abc',
              width: 0,
              x: 0,
              y: 0,
              zOrder: 1,
              numberProperties: [],
              stringProperties: [],
              initialVariables: [],
              locked: false,
            },
          ],
          objects: [
            {
              name: 'Object',
              type: eventsBasedObjectType,
              //@ts-ignore
              variant: eventsBasedObjectVariantName,
              content: {},
              variables: [],
              // Add all capabilities just in case events need them.
              behaviors: [
                {
                  name: 'Animation',
                  type: 'AnimatableCapability::AnimatableBehavior',
                },
                { name: 'Effect', type: 'EffectCapability::EffectBehavior' },
                {
                  name: 'Flippable',
                  type: 'FlippableCapability::FlippableBehavior',
                },
                {
                  name: 'Object3D',
                  type: 'Scene3D::Base3DBehavior',
                },
                {
                  name: 'Opacity',
                  type: 'OpacityCapability::OpacityBehavior',
                },
                {
                  name: 'Resizable',
                  type: 'ResizableCapability::ResizableBehavior',
                },
                {
                  name: 'Scale',
                  type: 'ScalableCapability::ScalableBehavior',
                },
                {
                  name: 'Text',
                  type: 'TextContainerCapability::TextContainerBehavior',
                },
              ],
              effects: [],
            },
          ],
          layers: [
            {
              ambientLightColorB: 200,
              ambientLightColorG: 200,
              ambientLightColorR: 200,
              camera3DFarPlaneDistance: 10000,
              camera3DFieldOfView: 45,
              camera3DNearPlaneDistance: 3,
              followBaseLayerCamera: false,
              isLightingLayer: false,
              name: '',
              renderingType: '2d+3d',
              visibility: true,
              cameras: [
                {
                  defaultSize: true,
                  defaultViewport: true,
                  height: 0,
                  viewportBottom: 1,
                  viewportLeft: 0,
                  viewportRight: 1,
                  viewportTop: 0,
                  width: 0,
                },
              ],
              effects: [
                {
                  effectType: 'Scene3D::HemisphereLight',
                  name: '3D Light',
                  doubleParameters: {
                    elevation: 45,
                    intensity: 1,
                    rotation: 0,
                  },
                  stringParameters: {
                    groundColor: '64;64;64',
                    skyColor: '255;255;255',
                    top: 'Y-',
                  },
                  booleanParameters: {},
                },
              ],
            },
          ],
          r: 32,
          v: 32,
          b: 32,
          mangledName: 'FakeSceneForCustomObject',
          name: eventsBasedObjectData.name,
          stopSoundsOnStartup: true,
          title: '',
          behaviorsSharedData: [
            {
              name: 'Text',
              type: 'TextContainerCapability::TextContainerBehavior',
            },
          ],
          usedResources: [],
        },
        usedExtensionsWithVariablesData:
          this._runtimeGame.getGameData().eventsFunctionsExtensions,
      });
      const objects = scene.getObjects('Object');
      const object = objects ? objects[0] : null;
      if (!object) {
        return null;
      }
      const customObject = object as gdjs.CustomRuntimeObject;
      if (!customObject._instanceContainer) {
        return null;
      }
      return {
        scene,
        customObjectInstanceContainer: customObject._instanceContainer,
      };
    }

    updateInnerArea(
      areaMinX: float,
      areaMinY: float,
      areaMinZ: float,
      areaMaxX: float,
      areaMaxY: float,
      areaMaxZ: float
    ) {
      if (!this._innerArea) {
        return;
      }
      // This only works because `this._innerArea` is the same instance as the
      // one used by custom object instances.
      this._innerArea.min[0] = areaMinX;
      this._innerArea.min[1] = areaMinY;
      this._innerArea.min[2] = areaMinZ;
      this._innerArea.max[0] = areaMaxX;
      this._innerArea.max[1] = areaMaxY;
      this._innerArea.max[2] = areaMaxZ;
    }

    setSelectedLayerName(layerName: string): void {
      this._selectedLayerName = layerName;
    }

    setInstancesEditorSettings(
      instancesEditorSettings: InstancesEditorSettings
    ) {
      this._instancesEditorSettings = instancesEditorSettings;
      this._isTranslationSnapEnabled = !!instancesEditorSettings.snap;
      this._editorGrid.setSettings(instancesEditorSettings);
      this._setTranslationSnapStep(
        this._editorGrid.getSmallestSnapStep(),
        true
      );
      if (this._selectionControls) {
        this._applyTransformControlsSettings(
          this._selectionControls.threeTransformControls
        );
      }
    }

    updateInstancesEditorSettings(
      instancesEditorSettings: InstancesEditorSettings
    ) {
      if (this._instancesEditorSettings) {
        Object.assign(this._instancesEditorSettings, instancesEditorSettings);
      } else {
        this._instancesEditorSettings = instancesEditorSettings;
      }
      if (instancesEditorSettings.snap !== undefined) {
        this._isTranslationSnapEnabled = !!instancesEditorSettings.snap;
      }
      this._editorGrid.setSettings(instancesEditorSettings);
      if (!this._isTranslationSnapStepManuallyChanged) {
        this._setTranslationSnapStep(
          this._editorGrid.getSmallestSnapStep(),
          true
        );
      }
      if (this._selectionControls) {
        this._applyTransformControlsSettings(
          this._selectionControls.threeTransformControls
        );
      }
    }

    private _getTempVector2d(x: float, y: float): THREE.Vector2 {
      this._tempVector2d.x = x;
      this._tempVector2d.y = y;
      return this._tempVector2d;
    }

    zoomToInitialPosition(visibleScreenArea: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }) {
      if (this._innerArea) {
        this.zoomToFitArea(
          {
            minX: this._innerArea.min[0],
            minY: this._innerArea.min[1],
            minZ: this._innerArea.min[2],
            maxX: this._innerArea.max[0],
            maxY: this._innerArea.max[1],
            maxZ: this._innerArea.max[2],
          },
          visibleScreenArea,
          0.1
        );
      } else {
        this.zoomToFitArea(
          {
            minX: 0,
            minY: 0,
            minZ: 0,
            maxX: this._runtimeGame.getOriginalWidth(),
            maxY: this._runtimeGame.getOriginalHeight(),
            maxZ: 0,
          },
          visibleScreenArea,
          0.1
        );
      }
    }

    zoomToFitContent(visibleScreenArea: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }) {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      this.zoomToFitObjects(
        editedInstanceContainer.getAdhocListOfAllInstances(),
        visibleScreenArea,
        0.01
      );
    }

    zoomToFitSelection(visibleScreenArea: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }) {
      this.zoomToFitObjects(
        this._selection.getSelectedObjects(),
        visibleScreenArea,
        0.2
      );
    }

    zoomToFitObjects(
      objects: Array<RuntimeObject>,
      visibleScreenArea: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      },
      margin: float
    ) {
      this._getEditorCamera().zoomToFitObjects(
        objects,
        visibleScreenArea,
        margin
      );
    }

    zoomToFitArea(
      sceneArea: {
        minX: number;
        minY: number;
        minZ: number;
        maxX: number;
        maxY: number;
        maxZ: number;
      },
      visibleScreenArea: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      },
      margin: float
    ) {
      if (!this._currentScene) return;
      const viewPreset: EditorCameraViewPreset =
        this._currentSceneType === '3d' ? 'perspective' : 'topdown';
      this._getEditorCamera().zoomToFitArea(
        sceneArea,
        visibleScreenArea,
        margin,
        viewPreset
      );
      this._getEditorCamera().switchToFreeCamera();
    }

    zoomBy(zoomFactor: float) {
      if (!this._currentScene) return;
      this._getEditorCamera().zoomBy(zoomFactor);
    }

    setZoom(zoom: float) {
      if (!this._currentScene) return;
      this._getEditorCamera().setZoom(zoom);
    }

    getSelectionAABB(): AABB3D | null {
      return this._selection.getAABB();
    }

    setSelectedObjects(persistentUuids: Array<string>) {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      const persistentUuidsSet = new Set<string>(persistentUuids);
      const selectedObjectsMap = new Map<string, gdjs.RuntimeObject>();
      for (const object of editedInstanceContainer.getAdhocListOfAllInstances()) {
        if (
          object.persistentUuid &&
          persistentUuidsSet.has(object.persistentUuid)
        ) {
          // We can't add the object to the selection directly because they
          // would be out of order.
          selectedObjectsMap.set(object.persistentUuid, object);
        }
      }
      this._selection.clear();
      for (const instanceUuid of persistentUuids) {
        const object = selectedObjectsMap.get(instanceUuid);
        if (object) {
          this._selection.add(object);
        }
      }
      // Send back default instances sizes.
      this._sendSelectionUpdate({ isSendingBackSelectionForDefaultSize: true });
    }

    centerViewOnLastSelectedInstance() {
      if (!this._currentScene) return;

      const object = this._selection.getLastSelectedObject();
      if (!object) {
        return;
      }

      this._getEditorCamera().switchToOrbitAroundObject(object);
    }

    private _focusOnSelection() {
      // TODO Use the center of the AABB of the whole selection instead
      const selectedObject = this._selection.getLastSelectedObject();
      if (!selectedObject) {
        return;
      }
      this._getEditorCamera().switchToOrbitAroundObject(selectedObject);
    }

    private _handleCameraMovement() {
      const inputManager = this._runtimeGame.getInputManager();
      const currentScene = this._currentScene;
      if (!currentScene) return;

      const selectedObject = this._selection.getLastSelectedObject();
      if (inputManager.isKeyPressed(F_KEY) && selectedObject) {
        this._focusOnSelection();
      }

      if (!this._skipCameraMovementThisFrame) {
        if (
          !this._getEditorCamera().isFreeCamera() &&
          shouldSwitchToFreeCamera(inputManager)
        ) {
          this._getEditorCamera().switchToFreeCamera();
        }
        this._getEditorCamera().step();
      }

      const layerNames = [];
      currentScene.getAllLayerNames(layerNames);
      layerNames.forEach((layerName) => {
        const layer = currentScene.getLayer(layerName);

        this._getEditorCamera().updateCamera(currentScene, layer);
      });
    }

    moveSelectionUnderCursor() {
      if (!this._currentScene) return;

      const cursor = this._getCursorIn3D(this._selection.getSelectedObjects());
      if (!cursor) {
        return;
      }
      const [cursorX, cursorY, cursorZ] = cursor;

      let minX = Number.MAX_VALUE;
      let minY = Number.MAX_VALUE;
      let minZ = Number.MAX_VALUE;
      let maxX = Number.MIN_VALUE;
      let maxY = Number.MIN_VALUE;
      for (const object of this._selection.getSelectedObjects()) {
        minX = Math.min(minX, object.getAABBLeft());
        minY = Math.min(minY, object.getAABBTop());
        if (is3D(object)) {
          minZ = Math.min(minZ, object.getUnrotatedAABBMinZ());
        }
        maxX = Math.max(maxX, object.getAABBRight());
        maxY = Math.max(maxY, object.getAABBBottom());
      }
      const deltaX = cursorX - (maxX + minX) / 2;
      const deltaY = cursorY - (maxY + minY) / 2;
      const deltaZ = cursorZ - minZ;
      for (const object of this._selection.getSelectedObjects()) {
        object.setX(object.getX() + deltaX);
        object.setY(object.getY() + deltaY);
        if (is3D(object)) {
          object.setZ(object.getZ() + deltaZ);
        }
      }
      this._sendSelectionUpdate({ hasSelectedObjectBeenModified: true });
    }

    private _shouldDragSelectedObject(): boolean {
      const inputManager = this._runtimeGame.getInputManager();
      return (
        isControlOrCmdPressed(inputManager) &&
        (!this._selectionControls ||
          !this._selectionControls.threeTransformControls.dragging)
      );
    }

    private _handleSelectedObjectDragging(): void {
      const inputManager = this._runtimeGame.getInputManager();

      // Always check first if we should end an existing drag.
      if (
        this._draggedSelectedObject &&
        (inputManager.isMouseButtonReleased(0) ||
          !this._shouldDragSelectedObject())
      ) {
        this._draggedSelectedObject = null;
        const changeHappened = this._objectMover.endMove();
        this._sendSelectionUpdate({
          hasSelectedObjectBeenModified: changeHappened,
        });
      }

      // Inspect then if a drag should be started or continued.
      if (!this._shouldDragSelectedObject()) {
        // We can early return as the rest is not applicable (we've already checked
        // if a drag should be ended).
        return;
      }
      if (!this._currentScene) return;
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      if (
        inputManager.isMouseButtonPressed(0) &&
        !this._draggedSelectedObject
      ) {
        // Start a new drag.
        let object = this.getObjectUnderCursor();
        if (object && this._selection.getSelectedObjects().includes(object)) {
          if (isControlOrCmdPressed(inputManager)) {
            object = this._duplicateSelectedObjects(object);
            if (!object) {
              return;
            }
          }
          this._draggedSelectedObject = object;
          this._draggedSelectedObjectInitialX = object.getX();
          this._draggedSelectedObjectInitialY = object.getY();
          this._draggedSelectedObjectInitialZ = is3D(object)
            ? object.getZ()
            : 0;
          this._objectMover.startMove();
        }
      }

      // Continue an existing drag.
      if (!this._draggedSelectedObject) {
        return;
      }

      let isIntersectionFound = false;
      let intersectionX: float = 0;
      let intersectionY: float = 0;
      let intersectionZ: float = 0;
      if (is3D(this._draggedSelectedObject)) {
        const cursor = this._getCursorIn3D(
          this._selection.getSelectedObjects()
        );
        if (cursor) {
          isIntersectionFound = true;
          [intersectionX, intersectionY, intersectionZ] = cursor;
        }
      } else {
        const projectedCursor = this._getProjectedCursor();
        if (projectedCursor) {
          isIntersectionFound = true;
          [intersectionX, intersectionY] = projectedCursor;
        }
      }
      if (isIntersectionFound) {
        this._editorGrid.setNormal('Z');
        this._editorGrid.setPosition(
          intersectionX,
          intersectionY,
          intersectionZ
        );
        const cameraLayer = this.getCameraLayer(
          this._draggedSelectedObject.getLayer()
        );
        const threeScene = cameraLayer
          ? cameraLayer.getRenderer().getThreeScene()
          : null;
        if (threeScene) {
          this._editorGrid.setTreeScene(threeScene);
        }
        this._editorGrid.setVisible(true);
        if (this._editorGrid.isSnappingEnabled(inputManager)) {
          // Snap the resulting object position, not the cursor, to preserve
          // the click offset and avoid objects jumping to the cursor.
          const newObjX =
            this._draggedSelectedObjectInitialX +
            (intersectionX - this._draggedSelectedObjectInitialX);
          const newObjY =
            this._draggedSelectedObjectInitialY +
            (intersectionY - this._draggedSelectedObjectInitialY);
          const snappedX = this._editorGrid.getSnappedX(newObjX);
          const snappedY = this._editorGrid.getSnappedY(newObjY);
          this._draggedSelectedObjectTotalDelta.translationX =
            snappedX - this._draggedSelectedObjectInitialX;
          this._draggedSelectedObjectTotalDelta.translationY =
            snappedY - this._draggedSelectedObjectInitialY;
        } else {
          this._draggedSelectedObjectTotalDelta.translationX =
            intersectionX - this._draggedSelectedObjectInitialX;
          this._draggedSelectedObjectTotalDelta.translationY =
            intersectionY - this._draggedSelectedObjectInitialY;
        }
        this._draggedSelectedObjectTotalDelta.translationZ =
          intersectionZ - this._draggedSelectedObjectInitialZ;
      } else {
        this._draggedSelectedObjectTotalDelta.translationX = 0;
        this._draggedSelectedObjectTotalDelta.translationY = 0;
        this._draggedSelectedObjectTotalDelta.translationZ = 0;
      }
      this._objectMover.move(
        this._selection.getSelectedObjects(),
        this._draggedSelectedObjectTotalDelta
      );
    }

    private _duplicateSelectedObjects(
      objectUnderCursor: gdjs.RuntimeObject
    ): gdjs.RuntimeObject | null {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return null;
      let newObjectUnderCursor: gdjs.RuntimeObject | null = null;
      const addedObjects: Array<gdjs.RuntimeObject> = [];
      for (const selectedObject of this._selection.getSelectedObjects()) {
        const newObject = editedInstanceContainer.createObject(
          selectedObject.getName()
        );
        if (!newObject) return null;
        newObject.persistentUuid = gdjs.makeUuid();
        newObject.setLayer(selectedObject.getLayer());
        newObject.setX(selectedObject.getX());
        newObject.setY(selectedObject.getY());
        newObject.setAngle(selectedObject.getAngle());
        newObject.setWidth(selectedObject.getWidth());
        newObject.setHeight(selectedObject.getHeight());
        if (is3D(newObject) && is3D(selectedObject)) {
          newObject.setZ(selectedObject.getZ());
          newObject.setRotationX(selectedObject.getRotationX());
          newObject.setRotationY(selectedObject.getRotationY());
          newObject.setDepth(selectedObject.getDepth());
        }
        addedObjects.push(newObject);
        if (selectedObject === objectUnderCursor) {
          newObjectUnderCursor = newObject;
        }
      }
      this._selection.clear();
      this._selection.addAll(addedObjects);
      this._sendSelectionUpdate({
        addedObjects,
      });
      return newObjectUnderCursor;
    }

    private _handleSelectionMovement() {
      // Finished moving the selection.
      if (
        this._wasMovingSelectionLastFrame &&
        !this._selectionControlsMovementTotalDelta
      ) {
        const changeHappened = this._objectMover.endMove();
        this._sendSelectionUpdate({
          hasSelectedObjectBeenModified: changeHappened,
        });
      }

      // Start moving the selection.
      if (
        !this._wasMovingSelectionLastFrame &&
        this._selectionControlsMovementTotalDelta
      ) {
        this._objectMover.startMove();
      }

      // Move the selection.
      if (this._selectionControlsMovementTotalDelta) {
        this._objectMover.move(
          this._selection.getSelectedObjects(),
          this._selectionControlsMovementTotalDelta
        );
      }
    }

    private _updateSelectionBox() {
      const inputManager = this._runtimeGame.getInputManager();
      const runtimeGame = this._runtimeGame;
      const threeRenderer = runtimeGame.getRenderer().getThreeRenderer();
      if (!threeRenderer) return;
      const currentScene = this._currentScene;
      if (!currentScene) return;
      const editedInstanceContainer = this._editedInstanceContainer;
      if (!editedInstanceContainer) return;
      const cameraLayer = this.getCameraLayer('');
      if (!cameraLayer) return;

      const runtimeLayerRender = cameraLayer.getRenderer();
      const threeCamera = runtimeLayerRender.getThreeCamera();
      const threeScene = runtimeLayerRender.getThreeScene();
      if (!threeCamera || !threeScene) return;

      const cursorX = inputManager.getCursorX();
      const cursorY = inputManager.getCursorY();

      const touchIds = getCurrentTouchIdentifiers(inputManager);
      const hasMultipleTouches = touchIds.length >= 2;

      if (
        inputManager.isMouseButtonPressed(0) &&
        !this._shouldDragSelectedObject() &&
        !isAltPressed(inputManager) &&
        !isSpacePressed(inputManager) &&
        !hasMultipleTouches
      ) {
        if (this._wasMouseLeftButtonPressed && this._selectionBox) {
          this._selectionBox.endPoint.set(
            this._getNormalizedScreenX(cursorX),
            this._getNormalizedScreenY(cursorY),
            0.5
          );
          const minX = Math.min(this._selectionBoxStartCursorX, cursorX);
          const minY = Math.min(this._selectionBoxStartCursorY, cursorY);
          const maxX = Math.max(this._selectionBoxStartCursorX, cursorX);
          const maxY = Math.max(this._selectionBoxStartCursorY, cursorY);
          this._selectionBoxElement.style.left = minX + 'px';
          this._selectionBoxElement.style.top = minY + 'px';
          this._selectionBoxElement.style.width = maxX - minX + 'px';
          this._selectionBoxElement.style.height = maxY - minY + 'px';
        } else {
          this._selectionBox = new THREE_ADDONS.SelectionBox(
            threeCamera,
            threeScene
          );
          this._selectionBox.startPoint.set(
            this._getNormalizedScreenX(cursorX),
            this._getNormalizedScreenY(cursorY),
            0.5
          );
          const domElementContainer = runtimeGame
            .getRenderer()
            .getDomElementContainer();
          if (domElementContainer) {
            this._selectionBoxElement.style.left = cursorX + 'px';
            this._selectionBoxElement.style.top = cursorY + 'px';
            this._selectionBoxElement.style.width = '0px';
            this._selectionBoxElement.style.height = '0px';
            domElementContainer.appendChild(this._selectionBoxElement);
          }
          this._selectionBoxStartCursorX = cursorX;
          this._selectionBoxStartCursorY = cursorY;
        }
      }
      if (
        (inputManager.isMouseButtonReleased(0) ||
          this._hasSelectionActuallyMoved) &&
        this._selectionBox
      ) {
        if (
          !this._selectionBox.endPoint.equals(this._selectionBox.startPoint) &&
          !this._hasSelectionActuallyMoved &&
          !hasMultipleTouches
        ) {
          // Selection rectangle ended.

          const objects = new Set<gdjs.RuntimeObject>();
          for (const selectThreeObject of this._selectionBox.select()) {
            // TODO Select the object if all its meshes are inside the rectangle
            // instead of if any is.
            const object = this._getObject3D(selectThreeObject);
            if (object) {
              objects.add(object);
            }
          }
          if (!isShiftPressed(inputManager)) {
            this._selection.clear();
          }
          const layer = this.getEditorLayer(this._selectedLayerName);
          if (layer && layer.isVisible() && !layer._initialLayerData.isLocked) {
            for (const object of objects) {
              if (!this.isInstanceSealed(object)) {
                this._selection.add(object);
              }
            }
          }
          this._sendSelectionUpdate();
        } else {
          // Selection rectangle was discarded.
        }
        this._selectionBox = null;
        const domElementContainer = runtimeGame
          .getRenderer()
          .getDomElementContainer();
        if (domElementContainer) {
          domElementContainer.removeChild(this._selectionBoxElement);
        }
      }
    }

    private _handleSelection({
      objectUnderCursor,
    }: {
      objectUnderCursor: gdjs.RuntimeObject | null;
    }) {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      const inputManager = this._runtimeGame.getInputManager();

      if (shouldDeleteSelection(inputManager)) {
        const removedObjects = this._selection.getSelectedObjects();
        removedObjects.forEach((object) => {
          object.deleteFromScene();
        });
        this._selection.clear();
        this._selectedBoneControl = null;
        this._sendSelectionUpdate({
          removedObjects,
        });
      }

      if (inputManager.wasKeyJustPressed(ESC_KEY)) {
        this._selection.clear();
        this._selectedBoneControl = null;
        this._sendSelectionUpdate();
      }

      // Left click: select the object under the cursor.
      if (
        !this._isTransformControlsHovered &&
        !isAltPressed(inputManager) &&
        inputManager.isMouseButtonReleased(0) &&
        this._hasCursorStayedStillWhilePressed({ toleranceRadius: 10 })
      ) {
        const shiftPressed = isShiftPressed(inputManager);
        const selectedBoneObject = this._selectedBoneControl
          ? this._selectedBoneControl.object
          : null;
        const shouldKeepCurrentBoneSelection =
          !shiftPressed &&
          this._isIKModeEnabledForSelection() &&
          !!this._selectedBoneControl &&
          (!objectUnderCursor || objectUnderCursor === selectedBoneObject);

        if (!shiftPressed && !shouldKeepCurrentBoneSelection) {
          this._selection.clear();
          this._selectedBoneControl = null;
        }
        let objectToEdit: gdjs.RuntimeObject | null = null;
        const boneControlUnderCursor = this._boneControlUnderCursor;
        if (objectUnderCursor) {
          const layer = this.getEditorLayer(objectUnderCursor.getLayer());
          if (
            layer &&
            !layer._initialLayerData.isLocked &&
            !this.isInstanceSealed(objectUnderCursor)
          ) {
            if (
              shouldKeepCurrentBoneSelection &&
              objectUnderCursor === selectedBoneObject
            ) {
              // Keep current IK target selection on miss-click around the same object.
            } else {
              this._selection.toggle(objectUnderCursor);
            }
          }

          if (
            this._lastClickOnObjectUnderCursor.object === objectUnderCursor &&
            Date.now() - this._lastClickOnObjectUnderCursor.time <
              timeBetweenClicksForDoubleClick
          ) {
            // Double click on the same object: edit the object.
            objectToEdit = objectUnderCursor;

            this._lastClickOnObjectUnderCursor = {
              object: null,
              time: 0,
            };
          } else {
            this._lastClickOnObjectUnderCursor = {
              object: objectUnderCursor,
              time: Date.now(),
            };
          }
        }
        if (
          this._isIKModeEnabledForSelection() &&
          boneControlUnderCursor &&
          this._selection
            .getSelectedObjects()
            .includes(boneControlUnderCursor.object)
        ) {
          this._selectedBoneControl = boneControlUnderCursor;
        } else if (!shiftPressed && !shouldKeepCurrentBoneSelection) {
          this._selectedBoneControl = null;
        }
        this._sendSelectionUpdate({
          objectToEdit,
        });
      }
    }

    private _updateSelectionOutline({
      objectUnderCursor,
    }: {
      objectUnderCursor: gdjs.RuntimeObject | null;
    }) {
      if (!this._currentScene) return;

      const selectedObjects = this._selection.getSelectedObjects();

      // Add/update boxes for selected objects
      selectedObjects.forEach((object) =>
        this._createBoundingBoxIfNeeded(object)
      );
      if (
        objectUnderCursor &&
        !this._selectionBoxes.has(objectUnderCursor) &&
        !this.isInstanceSealed(objectUnderCursor)
      ) {
        this._createBoundingBoxIfNeeded(objectUnderCursor);
      }

      // Remove boxes for deselected objects
      this._selectionBoxes.forEach((box, object) => {
        const isHovered =
          object === objectUnderCursor && !this._isTransformControlsHovered;
        const isInSelection = selectedObjects.includes(object);
        if (!isInSelection && !isHovered) {
          box.removeFromParent();
          this._selectionBoxes.delete(object);
        } else {
          const isLocked = this.isInstanceLocked(object);

          const color =
            instanceWireframeColor[
              (isLocked || !is3D(object) ? instanceStateFlag.locked : 0) |
                (isInSelection ? instanceStateFlag.selected : 0) |
                (isHovered ? instanceStateFlag.hovered : 0)
            ] || '#aaaaaa';

          box.setColor(color);
        }
      });

      this._selectionBoxes.forEach((box) => {
        box.update();
      });

      this._updateSkeletonHelpers({
        selectedObjects,
      });
    }

    private _createBoundingBoxIfNeeded(object: RuntimeObject): void {
      if (this._selectionBoxes.has(object)) {
        return;
      }
      const currentScene = this._currentScene;
      if (!currentScene) return;

      const objectLayer = this.getEditorLayer(object.getLayer());
      if (!objectLayer) return;

      const threeGroup = objectLayer.getRenderer().getThreeGroup();
      if (!threeGroup) return;

      const objectBoxHelper = new ObjectSelectionBoxHelper(object);
      threeGroup.add(objectBoxHelper.container);
      this._selectionBoxes.set(object, objectBoxHelper);
    }

    private _updateSkeletonHelpers({
      selectedObjects,
    }: {
      selectedObjects: Array<gdjs.RuntimeObject>;
    }): void {
      if (!this._isIKModeEnabledForSelection()) {
        if (this._selectedBoneControl) {
          this._selectedBoneControl = null;
        }
        this._skeletonHelpers.forEach((helper) => {
          helper.removeFromParent();
        });
        this._skeletonHelpers.clear();
        return;
      }

      const helpersToKeep = new Set<gdjs.RuntimeObject>();

      selectedObjects.forEach((object) => {
        if (this._createSkeletonHelperIfNeeded(object)) {
          helpersToKeep.add(object);
        }
      });

      const skeletonHelpersToRemove: RuntimeObject[] = [];
      this._skeletonHelpers.forEach((helper, object) => {
        if (!helpersToKeep.has(object)) {
          skeletonHelpersToRemove.push(object);
        } else {
          helper.setColor(
            selectedObjects.includes(object) ? '#f2a63c' : '#4ca3ff'
          );
          const highlightedBone =
            this._selectedBoneControl &&
            this._selectedBoneControl.object === object
              ? this._selectedBoneControl.bone
              : this._boneControlUnderCursor &&
                  this._boneControlUnderCursor.object === object
                ? this._boneControlUnderCursor.bone
                : null;
          helper.setActiveBone(highlightedBone);
          try {
            helper.update();
          } catch (error) {
            logger.warn(
              'Failed to update IK skeleton helper for object "',
              object.getName(),
              '". Removing helper.',
              error
            );
            skeletonHelpersToRemove.push(object);
          }
        }
      });
      skeletonHelpersToRemove.forEach((object) => {
        const helper = this._skeletonHelpers.get(object);
        if (!helper) return;
        helper.removeFromParent();
        this._skeletonHelpers.delete(object);
      });

      if (
        this._selectedBoneControl &&
        !helpersToKeep.has(this._selectedBoneControl.object)
      ) {
        this._selectedBoneControl = null;
      }
    }

    private _createSkeletonHelperIfNeeded(object: RuntimeObject): boolean {
      if (this._skeletonHelpers.has(object)) {
        return true;
      }
      const currentScene = this._currentScene;
      if (!currentScene || !is3D(object)) return false;

      const objectLayer = this.getEditorLayer(object.getLayer());
      if (!objectLayer) return false;

      const threeGroup = objectLayer.getRenderer().getThreeGroup();
      if (!threeGroup) return false;

      const skeletonHelper = new ObjectSkeletonHelper(object);
      if (!skeletonHelper.hasBones()) {
        skeletonHelper.removeFromParent();
        return false;
      }

      threeGroup.add(skeletonHelper.container);
      skeletonHelper.syncContainerWithWorldSpace();
      this._skeletonHelpers.set(object, skeletonHelper);
      return true;
    }

    private _getTransformControlsMode(): 'translate' | 'rotate' | 'scale' {
      return this._transformControlsMode;
    }

    private _getTransformControlsSpace(): 'local' | 'world' {
      return this._transformControlsSpace;
    }

    private _setTransformControlsSpace(space: 'local' | 'world'): void {
      if (this._transformControlsSpace === space) {
        return;
      }
      this._transformControlsSpace = space;
      if (!this._selectionControls) {
        return;
      }
      this._applyTransformControlsSettings(
        this._selectionControls.threeTransformControls
      );
    }

    private _toggleTransformControlsSpace(): void {
      this._setTransformControlsSpace(
        this._transformControlsSpace === 'local' ? 'world' : 'local'
      );
    }

    private _hasBones(object: RuntimeObject): boolean {
      if (!is3D(object)) return false;

      const threeObject = object.get3DRendererObject();
      if (!threeObject) return false;

      let hasBones = false;
      threeObject.traverse((child) => {
        if ((child as any).isBone) {
          hasBones = true;
        }
      });
      return hasBones;
    }

    private _getActiveIKObject(): IKConfigurableObject | null {
      const selectedBoneObject = this._selectedBoneControl
        ? this._selectedBoneControl.object
        : null;
      if (isIKConfigurableObject(selectedBoneObject)) {
        return selectedBoneObject;
      }

      const lastSelectedObject = this._selection.getLastSelectedObject();
      if (isIKConfigurableObject(lastSelectedObject)) {
        return lastSelectedObject;
      }

      const selectedObjects = this._selection.getSelectedObjects();
      for (let i = selectedObjects.length - 1; i >= 0; i--) {
        const selectedObject = selectedObjects[i];
        if (isIKConfigurableObject(selectedObject)) {
          return selectedObject;
        }
      }

      return null;
    }

    private _canEnableIKModeForSelection(): boolean {
      const selectedObjects = this._selection.getSelectedObjects();
      return selectedObjects.some((object) => this._hasBones(object));
    }

    private _isIKModeEnabledForSelection(): boolean {
      return this._isIKModeEnabled && this._canEnableIKModeForSelection();
    }

    private _setIKModeEnabled(enabled: boolean): void {
      const normalizedEnabled = !!enabled;
      if (this._isIKModeEnabled === normalizedEnabled) return;

      this._isIKModeEnabled = normalizedEnabled;
      this._boneControlUnderCursor = null;
      this._selectedBoneControl = null;
      if (!normalizedEnabled) {
        this._skeletonHelpers.forEach((helper) => {
          helper.removeFromParent();
        });
        this._skeletonHelpers.clear();
      }
      this._forceUpdateSelectionControls();
    }

    private _toggleIKMode(): void {
      if (!this._isIKModeEnabled && !this._canEnableIKModeForSelection()) {
        return;
      }
      this._setIKModeEnabled(!this._isIKModeEnabled);
    }

    private _syncIKModeWithSelection(): void {
      if (this._isIKModeEnabled && !this._canEnableIKModeForSelection()) {
        this._setIKModeEnabled(false);
      }
    }

    private _setTransformSnapEnabled(
      snapType: 'translation' | 'rotation' | 'scale',
      isEnabled: boolean
    ): void {
      const normalizedIsEnabled = !!isEnabled;
      const currentValue =
        snapType === 'translation'
          ? this._isTranslationSnapEnabled
          : snapType === 'rotation'
            ? this._isRotationSnapEnabled
            : this._isScaleSnapEnabled;
      if (currentValue === normalizedIsEnabled) {
        return;
      }

      if (snapType === 'translation') {
        this._isTranslationSnapEnabled = normalizedIsEnabled;
      } else if (snapType === 'rotation') {
        this._isRotationSnapEnabled = normalizedIsEnabled;
      } else {
        this._isScaleSnapEnabled = normalizedIsEnabled;
      }
      if (!this._selectionControls) {
        return;
      }
      this._applyTransformControlsSettings(
        this._selectionControls.threeTransformControls
      );
    }

    private _toggleTransformSnap(
      snapType: 'translation' | 'rotation' | 'scale'
    ): void {
      const currentValue =
        snapType === 'translation'
          ? this._isTranslationSnapEnabled
          : snapType === 'rotation'
            ? this._isRotationSnapEnabled
            : this._isScaleSnapEnabled;
      this._setTransformSnapEnabled(snapType, !currentValue);
    }

    private _clamp(value: number, min: number, max: number): number {
      return Math.min(Math.max(value, min), max);
    }

    private _round(value: number, decimals: number): number {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    }

    private _setTranslationSnapStep(step: number, fromGrid = false): void {
      const nextStep = this._round(
        this._clamp(step, TRANSLATION_SNAP_STEP_MIN, TRANSLATION_SNAP_STEP_MAX),
        2
      );
      const nextIsManuallyChanged = !fromGrid;
      const hasStepChanged =
        Math.abs(nextStep - this._translationSnapStep) > 0.0001;
      const hasManualFlagChanged =
        this._isTranslationSnapStepManuallyChanged !== nextIsManuallyChanged;

      if (!hasStepChanged && !hasManualFlagChanged) {
        return;
      }

      this._translationSnapStep = nextStep;
      this._isTranslationSnapStepManuallyChanged = nextIsManuallyChanged;
      if (hasStepChanged && this._selectionControls) {
        this._applyTransformControlsSettings(
          this._selectionControls.threeTransformControls
        );
      }
    }

    private _changeTranslationSnapStep(direction: -1 | 1): void {
      const increment =
        this._translationSnapStep >= 10
          ? 1
          : this._translationSnapStep >= 1
            ? 0.5
            : 0.1;
      this._setTranslationSnapStep(
        this._translationSnapStep + direction * increment
      );
    }

    private _setRotationSnapDegrees(degrees: number): void {
      const nextDegrees = this._round(
        this._clamp(
          degrees,
          ROTATION_SNAP_DEGREES_MIN,
          ROTATION_SNAP_DEGREES_MAX
        ),
        1
      );
      if (Math.abs(nextDegrees - this._rotationSnapDegrees) <= 0.0001) {
        return;
      }

      this._rotationSnapDegrees = nextDegrees;
      if (this._selectionControls) {
        this._applyTransformControlsSettings(
          this._selectionControls.threeTransformControls
        );
      }
    }

    private _changeRotationSnapDegrees(direction: -1 | 1): void {
      const increment = this._rotationSnapDegrees >= 45 ? 5 : 1;
      this._setRotationSnapDegrees(
        this._rotationSnapDegrees + direction * increment
      );
    }

    private _setScaleSnapStep(step: number): void {
      const nextStep = this._round(
        this._clamp(step, SCALE_SNAP_STEP_MIN, SCALE_SNAP_STEP_MAX),
        2
      );
      if (Math.abs(nextStep - this._scaleSnapStep) <= 0.0001) {
        return;
      }

      this._scaleSnapStep = nextStep;
      if (this._selectionControls) {
        this._applyTransformControlsSettings(
          this._selectionControls.threeTransformControls
        );
      }
    }

    private _changeScaleSnapStep(direction: -1 | 1): void {
      const increment = this._scaleSnapStep >= 0.5 ? 0.1 : 0.05;
      this._setScaleSnapStep(this._scaleSnapStep + direction * increment);
    }

    private _hasEditableSelection(): boolean {
      return this._selection
        .getSelectedObjects()
        .some(
          (object) =>
            !this.isInstanceLocked(object) && !this.isInstanceSealed(object)
        );
    }

    private _shouldAdjustSnapStepFromToolbar(event?: MouseEvent): boolean {
      if (event && event.shiftKey) return true;
      return !this._hasEditableSelection();
    }

    private _getNudgeAxis(defaultAxis: string): string {
      const axis =
        (this._selectionControls &&
          this._selectionControls.threeTransformControls.axis) ||
        this._lastSelectedTransformAxis;
      if (
        axis &&
        (axis.includes('X') || axis.includes('Y') || axis.includes('Z'))
      ) {
        return axis;
      }
      return defaultAxis;
    }

    private _applyNudgeMovement(movement: {
      translationX: float;
      translationY: float;
      translationZ: float;
      rotationX: float;
      rotationY: float;
      rotationZ: float;
      scaleX: float;
      scaleY: float;
      scaleZ: float;
    }): void {
      const selectedObjects = this._selection
        .getSelectedObjects()
        .filter(
          (object) =>
            !this.isInstanceLocked(object) && !this.isInstanceSealed(object)
        );
      if (!selectedObjects.length) return;

      this._objectMover.startMove({ skipClickGuard: true });
      this._objectMover.move(selectedObjects, movement);
      const changeHappened = this._objectMover.endMove();
      if (changeHappened) {
        this._sendSelectionUpdate({ hasSelectedObjectBeenModified: true });
      }
    }

    private _nudgeSelectionTranslation(direction: -1 | 1): void {
      const axis = this._getNudgeAxis('X');
      let isMovingOnX = axis.includes('X');
      let isMovingOnY = axis.includes('Y');
      let isMovingOnZ = axis.includes('Z');
      if (!isMovingOnX && !isMovingOnY && !isMovingOnZ) {
        isMovingOnX = true;
      }

      const step = this._translationSnapStep;
      this._applyNudgeMovement({
        translationX: isMovingOnX ? step * direction : 0,
        translationY: isMovingOnY ? step * direction : 0,
        translationZ: isMovingOnZ ? step * direction : 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      });
    }

    private _nudgeSelectionRotation(direction: -1 | 1): void {
      const axis = this._getNudgeAxis('Z');
      let rotateX = axis.includes('X');
      let rotateY = axis.includes('Y');
      let rotateZ = axis.includes('Z');
      if (!rotateX && !rotateY && !rotateZ) {
        rotateZ = true;
      }

      const step = this._rotationSnapDegrees;
      this._applyNudgeMovement({
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: rotateX ? step * direction : 0,
        rotationY: rotateY ? step * direction : 0,
        rotationZ: rotateZ ? step * direction : 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      });
    }

    private _nudgeSelectionScale(direction: -1 | 1): void {
      const axis = this._getNudgeAxis('XYZ');
      let scaleX = axis.includes('X');
      let scaleY = axis.includes('Y');
      let scaleZ = axis.includes('Z');
      if (!scaleX && !scaleY && !scaleZ) {
        scaleX = true;
        scaleY = true;
        scaleZ = true;
      }

      const factor = Math.max(0.01, 1 + direction * this._scaleSnapStep);
      this._applyNudgeMovement({
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: scaleX ? factor : 1,
        scaleY: scaleY ? factor : 1,
        scaleZ: scaleZ ? factor : 1,
      });
    }

    private _handleTranslationStepButtonClick(
      direction: -1 | 1,
      event?: MouseEvent
    ): void {
      if (this._shouldAdjustSnapStepFromToolbar(event)) {
        this._changeTranslationSnapStep(direction);
        return;
      }
      this._nudgeSelectionTranslation(direction);
    }

    private _handleRotationStepButtonClick(
      direction: -1 | 1,
      event?: MouseEvent
    ): void {
      if (this._shouldAdjustSnapStepFromToolbar(event)) {
        this._changeRotationSnapDegrees(direction);
        return;
      }
      this._nudgeSelectionRotation(direction);
    }

    private _handleScaleStepButtonClick(
      direction: -1 | 1,
      event?: MouseEvent
    ): void {
      if (this._shouldAdjustSnapStepFromToolbar(event)) {
        this._changeScaleSnapStep(direction);
        return;
      }
      this._nudgeSelectionScale(direction);
    }

    private _getSelectionTransformValues(): SelectionTransformValues | null {
      const selectedObject = this._selection.getLastSelectedObject({
        ignoreIf: (object) =>
          this.isInstanceLocked(object) || this.isInstanceSealed(object),
      });
      if (!selectedObject) return null;

      const isObject3D = is3D(selectedObject);
      const x = selectedObject.getX();
      const y = selectedObject.getY();
      const z = isObject3D ? selectedObject.getZ() : 0;
      const rotationX = isObject3D ? selectedObject.getRotationX() : 0;
      const rotationY = isObject3D ? selectedObject.getRotationY() : 0;
      const rotationZ = selectedObject.getAngle();
      const width = selectedObject.getWidth();
      const height = selectedObject.getHeight();
      const depth = isObject3D ? selectedObject.getDepth() : 0;
      const defaultWidth = selectedObject.getOriginalWidth() || 1;
      const defaultHeight = selectedObject.getOriginalHeight() || 1;
      const defaultDepth = isObject3D
        ? selectedObject.getOriginalDepth() || 1
        : 1;

      const scaleX = defaultWidth ? width / defaultWidth : 1;
      const scaleY = defaultHeight ? height / defaultHeight : 1;
      const scaleZ = isObject3D ? (defaultDepth ? depth / defaultDepth : 1) : 1;

      const axis =
        (this._selectionControls &&
          this._selectionControls.threeTransformControls.axis) ||
        this._lastSelectedTransformAxis;

      return {
        axis,
        is3D: isObject3D,
        position: { x, y, z },
        rotation: { x: rotationX, y: rotationY, z: rotationZ },
        scale: { x: scaleX, y: scaleY, z: scaleZ },
      };
    }

    private _isSnapEnabledForCurrentFrame(
      isEnabledByDefault: boolean,
      inputManager: gdjs.InputManager
    ): boolean {
      // Alt temporarily inverts snap settings while dragging.
      return isEnabledByDefault !== isAltPressed(inputManager);
    }

    private _isTranslationSnapEnabledForCurrentFrame(
      inputManager: gdjs.InputManager
    ): boolean {
      return this._isSnapEnabledForCurrentFrame(
        this._isTranslationSnapEnabled,
        inputManager
      );
    }

    private _applyTransformControlsSettings(
      threeTransformControls: THREE_ADDONS.TransformControls,
      inputManager?: gdjs.InputManager
    ): void {
      const activeInputManager =
        inputManager || this._runtimeGame.getInputManager();
      const shouldSnapRotation = this._isSnapEnabledForCurrentFrame(
        this._isRotationSnapEnabled,
        activeInputManager
      );
      const rotationSnap =
        this._transformControlsMode === 'rotate' && shouldSnapRotation
          ? gdjs.toRad(this._rotationSnapDegrees)
          : null;

      const shouldSnapScale = this._isSnapEnabledForCurrentFrame(
        this._isScaleSnapEnabled,
        activeInputManager
      );
      const scaleSnap =
        this._transformControlsMode === 'scale' && shouldSnapScale
          ? this._scaleSnapStep
          : null;

      const shouldSnapTranslation =
        this._isTranslationSnapEnabledForCurrentFrame(activeInputManager);
      const translationSnapStep = shouldSnapTranslation
        ? this._translationSnapStep
        : null;

      const lastAppliedSettings = this._lastAppliedTransformControlsSettings;
      if (
        lastAppliedSettings &&
        lastAppliedSettings.controls === threeTransformControls &&
        lastAppliedSettings.mode === this._transformControlsMode &&
        lastAppliedSettings.space === this._transformControlsSpace &&
        lastAppliedSettings.translationSnap === translationSnapStep &&
        lastAppliedSettings.rotationSnap === rotationSnap &&
        lastAppliedSettings.scaleSnap === scaleSnap
      ) {
        return;
      }

      const transformControls = threeTransformControls as any;
      if (typeof transformControls.setMode === 'function') {
        transformControls.setMode(this._transformControlsMode);
      } else {
        threeTransformControls.mode = this._transformControlsMode;
      }

      if (typeof transformControls.setSpace === 'function') {
        transformControls.setSpace(this._transformControlsSpace);
      } else {
        transformControls.space = this._transformControlsSpace;
      }

      if (typeof transformControls.setRotationSnap === 'function') {
        transformControls.setRotationSnap(rotationSnap);
      } else {
        transformControls.rotationSnap = rotationSnap;
      }

      if (typeof transformControls.setScaleSnap === 'function') {
        transformControls.setScaleSnap(scaleSnap);
      } else {
        transformControls.scaleSnap = scaleSnap;
      }

      if (typeof transformControls.setTranslationSnap === 'function') {
        transformControls.setTranslationSnap(translationSnapStep);
      } else {
        transformControls.translationSnap = translationSnapStep;
      }

      this._lastAppliedTransformControlsSettings = {
        controls: threeTransformControls,
        mode: this._transformControlsMode,
        space: this._transformControlsSpace,
        translationSnap: translationSnapStep,
        rotationSnap,
        scaleSnap,
      };
    }

    private _setTransformControlsMode(
      mode: 'translate' | 'rotate' | 'scale'
    ): void {
      if (this._transformControlsMode === mode) {
        return;
      }
      this._transformControlsMode = mode;
      if (!this._selectionControls) {
        return;
      }
      const { threeTransformControls, dummyThreeObject } =
        this._selectionControls;
      this._applyTransformControlsSettings(threeTransformControls);
      if (this._selectionControls.boneControl) {
        this._updateDummyLocation(
          dummyThreeObject,
          this._selectionControls.object,
          threeTransformControls,
          this._selectionControls.boneControl
        );
        return;
      }

      const lastEditableSelectedObject = this._selection.getLastSelectedObject({
        ignoreIf: (object) =>
          this.isInstanceLocked(object) || this.isInstanceSealed(object),
      });
      if (!lastEditableSelectedObject) {
        return;
      }
      const threeObject = lastEditableSelectedObject.get3DRendererObject();
      if (!threeObject) {
        return;
      }
      dummyThreeObject.rotation.copy(threeObject.rotation);
      if (this._transformControlsMode === 'rotate') {
        dummyThreeObject.rotation.y = -dummyThreeObject.rotation.y;
        dummyThreeObject.rotation.z = -dummyThreeObject.rotation.z;
      }
    }

    private _forceUpdateSelectionControls() {
      if (this._selectionControls) {
        this._removeSelectionControls();
      }
      this._updateSelectionControls();
    }

    private _updateSelectionControls() {
      const inputManager = this._runtimeGame.getInputManager();
      const currentScene = this._currentScene;
      if (!currentScene) return;

      const touchIds = getCurrentTouchIdentifiers(inputManager);
      const hasMultipleTouches = touchIds.length >= 2;

      // Selection controls are shown on the last object that can be manipulated
      // (and if none, selection controls are not shown).
      const lastEditableSelectedObject = this._selection.getLastSelectedObject({
        ignoreIf: (object) =>
          this.isInstanceLocked(object) || this.isInstanceSealed(object),
      });
      const selectedObjects = this._selection.getSelectedObjects();
      const isIKModeEnabledForSelection = this._isIKModeEnabledForSelection();
      const activeBoneControl =
        isIKModeEnabledForSelection &&
        this._selectedBoneControl &&
        selectedObjects.includes(this._selectedBoneControl.object) &&
        !this.isInstanceLocked(this._selectedBoneControl.object) &&
        !this.isInstanceSealed(this._selectedBoneControl.object)
          ? this._selectedBoneControl
          : null;
      if (!activeBoneControl && this._selectedBoneControl) {
        this._selectedBoneControl = null;
      }
      const transformTargetObject = activeBoneControl
        ? activeBoneControl.object
        : lastEditableSelectedObject;

      // Space or multiple touches will hide the selection controls as they are
      // used to move the camera.
      const shouldHideSelectionControls =
        isSpacePressed(inputManager) || hasMultipleTouches;

      // Remove the selection controls if the last selected object has changed
      // or if nothing movable is selected.
      if (
        this._selectionControls &&
        (!transformTargetObject ||
          (transformTargetObject &&
            this._selectionControls.object !== transformTargetObject) ||
          this._selectionControls.boneControl !== activeBoneControl ||
          this._shouldDragSelectedObject() ||
          shouldHideSelectionControls)
      ) {
        this._removeSelectionControls();
      }

      // Create the selection controls on the last object that can be manipulated.
      if (
        transformTargetObject &&
        !this._selectionControls &&
        !this._shouldDragSelectedObject() &&
        !shouldHideSelectionControls &&
        transformTargetObject.get3DRendererObject()
      ) {
        const cameraLayer = this.getCameraLayer(
          transformTargetObject.getLayer()
        );
        if (cameraLayer) {
          const runtimeLayerRender = cameraLayer
            ? cameraLayer.getRenderer()
            : null;
          const threeCamera = runtimeLayerRender
            ? runtimeLayerRender.getThreeCamera()
            : null;
          const threeScene = runtimeLayerRender
            ? runtimeLayerRender.getThreeScene()
            : null;
          if (threeCamera && threeScene) {
            // Create and attach the transform controls. It is attached to a dummy object
            // to avoid the controls to directly move the runtime object (we handle this
            // manually).
            const threeTransformControls = new THREE_ADDONS.TransformControls(
              threeCamera,
              this._runtimeGame.getRenderer().getCanvas() || undefined
            );
            patchAxesOnTransformControlsGizmos(threeTransformControls);
            patchColorsOnTransformControlsGizmos(threeTransformControls);
            patchNegativeAxisHandlesOnTransformControlsGizmos(
              threeTransformControls
            );

            threeTransformControls.rotation.order = 'ZYX';
            threeTransformControls.scale.y = -1;
            this._applyTransformControlsSettings(
              threeTransformControls,
              inputManager
            );
            threeTransformControls.traverse((obj) => {
              // To be detected correctly by OutlinePass.
              // @ts-ignore
              obj.isTransformControls = true;
            });

            // The dummy object is an invisible object that is the one moved by the transform
            // controls.
            const dummyThreeObject = new THREE.Object3D();
            this._updateDummyLocation(
              dummyThreeObject,
              transformTargetObject,
              threeTransformControls,
              activeBoneControl
            );
            threeScene.add(dummyThreeObject);

            threeTransformControls.attach(dummyThreeObject);
            threeScene.add(threeTransformControls);

            // Keep track of the movement so the editor can apply it to the selection.
            let initialObjectX = 0;
            let initialObjectY = 0;
            let initialObjectZ = 0;
            const initialDummyPosition = new THREE.Vector3();
            const initialDummyRotation = new THREE.Euler();
            const initialDummyScale = new THREE.Vector3();
            threeTransformControls.addEventListener('change', (e) => {
              if (activeBoneControl) {
                if (!threeTransformControls.dragging) {
                  this._selectionControlsMovementTotalDelta = null;
                  this._updateDummyLocation(
                    dummyThreeObject,
                    transformTargetObject,
                    threeTransformControls,
                    activeBoneControl
                  );
                  return;
                }
                this._applyDummyLocationToBone(
                  dummyThreeObject,
                  activeBoneControl.bone
                );
                this._selectionControlsMovementTotalDelta = null;
                this._hasSelectionActuallyMoved = true;
                return;
              }

              if (!threeTransformControls.dragging) {
                this._selectionControlsMovementTotalDelta = null;

                this._updateDummyLocation(
                  dummyThreeObject,
                  transformTargetObject,
                  threeTransformControls,
                  null
                );
                // Reset the initial position to the current position, so that
                // it's ready to be dragged again.
                initialObjectX = transformTargetObject.getX();
                initialObjectY = transformTargetObject.getY();
                initialObjectZ = is3D(transformTargetObject)
                  ? transformTargetObject.getZ()
                  : 0;
                initialDummyPosition.copy(dummyThreeObject.position);
                initialDummyRotation.copy(dummyThreeObject.rotation);
                initialDummyScale.copy(dummyThreeObject.scale);
                return;
              }

              let translationX =
                dummyThreeObject.position.x - initialDummyPosition.x;
              let translationY =
                dummyThreeObject.position.y - initialDummyPosition.y;
              let translationZ =
                dummyThreeObject.position.z - initialDummyPosition.z;
              if (
                this._transformControlsMode === 'translate' &&
                threeTransformControls.axis
              ) {
                if (threeTransformControls.axis === 'XYZ') {
                  // We need to override the translation vector because
                  // `threeTransformControls` don't know that the selection
                  // must be excluded when looking for the cursor position.
                  let isIntersectionFound = false;
                  let intersectionX: float = 0;
                  let intersectionY: float = 0;
                  let intersectionZ: float = 0;
                  if (is3D(transformTargetObject)) {
                    const cursor = this._getCursorIn3D(
                      this._selection.getSelectedObjects()
                    );
                    if (cursor) {
                      isIntersectionFound = true;
                      [intersectionX, intersectionY, intersectionZ] = cursor;
                    }
                  } else {
                    const projectedCursor = this._getProjectedCursor();
                    if (projectedCursor) {
                      isIntersectionFound = true;
                      [intersectionX, intersectionY] = projectedCursor;
                    }
                  }
                  if (isIntersectionFound) {
                    translationX = intersectionX - initialObjectX;
                    translationY = intersectionY - initialObjectY;
                    translationZ = intersectionZ - initialObjectZ;
                  } else {
                    translationX = 0;
                    translationY = 0;
                    translationZ = 0;
                  }
                }
                const isMovingOnX = threeTransformControls.axis.includes('X');
                const isMovingOnY = threeTransformControls.axis.includes('Y');
                const isMovingOnZ = threeTransformControls.axis.includes('Z');
                if (
                  this._isTranslationSnapEnabledForCurrentFrame(inputManager)
                ) {
                  const translationSnapStep = this._translationSnapStep;
                  if (isMovingOnX) {
                    translationX =
                      this._editorGrid.getSnappedXWithStep(
                        initialObjectX + translationX,
                        translationSnapStep
                      ) - initialObjectX;
                  }
                  if (isMovingOnY) {
                    translationY =
                      this._editorGrid.getSnappedYWithStep(
                        initialObjectY + translationY,
                        translationSnapStep
                      ) - initialObjectY;
                  }
                  if (isMovingOnZ) {
                    translationZ =
                      this._editorGrid.getSnappedZWithStep(
                        initialObjectZ + translationZ,
                        translationSnapStep
                      ) - initialObjectZ;
                  }
                }
              }
              // 0.2 = 20% of the movement speed (Three.js transform controls scaling is too fast)
              const scaleDamping =
                threeTransformControls.axis &&
                threeTransformControls.axis.length === 1
                  ? 1
                  : 0.2;
              this._selectionControlsMovementTotalDelta = {
                translationX,
                translationY,
                translationZ,
                rotationX: gdjs.toDegrees(
                  dummyThreeObject.rotation.x - initialDummyRotation.x
                ),
                rotationY: -gdjs.toDegrees(
                  dummyThreeObject.rotation.y - initialDummyRotation.y
                ),
                rotationZ: -gdjs.toDegrees(
                  dummyThreeObject.rotation.z - initialDummyRotation.z
                ),
                scaleX:
                  1 +
                  (dummyThreeObject.scale.x / initialDummyScale.x - 1) *
                    scaleDamping,
                scaleY:
                  1 +
                  (dummyThreeObject.scale.y / initialDummyScale.y - 1) *
                    scaleDamping,
                scaleZ:
                  1 +
                  (dummyThreeObject.scale.z / initialDummyScale.z - 1) *
                    scaleDamping,
              };

              this._hasSelectionActuallyMoved =
                this._hasSelectionActuallyMoved ||
                !dummyThreeObject.position.equals(initialDummyPosition) ||
                !dummyThreeObject.rotation.equals(initialDummyRotation) ||
                !dummyThreeObject.scale.equals(initialDummyScale);
            });

            this._selectionControls = {
              object: transformTargetObject,
              boneControl: activeBoneControl,
              dummyThreeObject,
              threeTransformControls,
            };
          }
        }
      }

      if (
        transformTargetObject &&
        this._selectionControls &&
        !this._draggedNewObject &&
        !this._draggedSelectedObject
      ) {
        const { threeTransformControls, boneControl, dummyThreeObject } =
          this._selectionControls;
        this._applyTransformControlsSettings(
          threeTransformControls,
          inputManager
        );

        // Update the grid.
        const axis = threeTransformControls.axis;
        if (axis) {
          this._lastSelectedTransformAxis = axis;
        }
        if (axis) {
          const isMovingOnX = axis ? axis.includes('X') : false;
          const isMovingOnY = axis ? axis.includes('Y') : false;
          const isMovingOnZ = axis ? axis.includes('Z') : false;
          let gridNormal: 'X' | 'Y' | 'Z' = 'Z';
          if (isMovingOnZ) {
            if (!isMovingOnX && !isMovingOnY) {
              // Choose the plan that faces the camera.
              const cameraRotation = Math.abs(
                gdjs.evtTools.common.angleDifference(
                  this._editorCamera.getCameraRotation(),
                  0
                )
              );
              if (cameraRotation <= 45 || cameraRotation > 135) {
                gridNormal = 'Y';
              } else {
                gridNormal = 'X';
              }
            } else if (!isMovingOnX) {
              gridNormal = 'X';
            } else if (!isMovingOnY) {
              gridNormal = 'Y';
            }
          }
          this._editorGrid.setNormal(gridNormal);
        }
        this._editorGrid.setPosition(
          boneControl
            ? dummyThreeObject.position.x
            : transformTargetObject.getX(),
          boneControl
            ? dummyThreeObject.position.y
            : transformTargetObject.getY(),
          boneControl
            ? dummyThreeObject.position.z
            : is3D(transformTargetObject)
              ? transformTargetObject.getZ()
              : 0
        );
        const cameraLayer = this.getCameraLayer(
          transformTargetObject.getLayer()
        );
        const threeScene = cameraLayer
          ? cameraLayer.getRenderer().getThreeScene()
          : null;
        if (threeScene) {
          this._editorGrid.setTreeScene(threeScene);
        }
        this._editorGrid.setVisible(
          this._transformControlsMode === 'translate'
        );
      }
    }

    private _updateDummyLocation(
      dummyThreeObject: THREE.Object3D,
      lastEditableSelectedObject: gdjs.RuntimeObject,
      threeTransformControls: THREE_ADDONS.TransformControls,
      boneControl: BoneControlData | null = null
    ) {
      if (boneControl) {
        const { bone } = boneControl;
        bone.updateMatrixWorld(true);
        const worldPosition = new THREE.Vector3();
        bone.getWorldPosition(worldPosition);
        if (dummyThreeObject.parent) {
          dummyThreeObject.parent.worldToLocal(worldPosition);
        }
        dummyThreeObject.position.copy(worldPosition);

        const worldQuaternion = new THREE.Quaternion();
        bone.getWorldQuaternion(worldQuaternion);
        if (dummyThreeObject.parent) {
          const parentWorldQuaternion = new THREE.Quaternion();
          dummyThreeObject.parent.getWorldQuaternion(parentWorldQuaternion);
          dummyThreeObject.quaternion
            .copy(parentWorldQuaternion.invert())
            .multiply(worldQuaternion);
        } else {
          dummyThreeObject.quaternion.copy(worldQuaternion);
        }
        dummyThreeObject.scale.set(1, 1, 1);
        return;
      }

      const threeObject = lastEditableSelectedObject.get3DRendererObject();
      if (!threeObject) return;
      dummyThreeObject.position.copy(threeObject.position);
      dummyThreeObject.rotation.copy(threeObject.rotation);
      dummyThreeObject.scale.copy(threeObject.scale);
      if (this._transformControlsMode === 'rotate') {
        // This is only done for the rotate mode because it messes with the
        // orientation of the scale mode.
        dummyThreeObject.rotation.y = -dummyThreeObject.rotation.y;
        dummyThreeObject.rotation.z = -dummyThreeObject.rotation.z;

        dummyThreeObject.position.set(
          lastEditableSelectedObject.getCenterXInScene(),
          lastEditableSelectedObject.getCenterYInScene(),
          is3D(lastEditableSelectedObject)
            ? lastEditableSelectedObject.getCenterZInScene()
            : 0
        );
      } else {
        dummyThreeObject.position.set(
          lastEditableSelectedObject.getX(),
          lastEditableSelectedObject.getY(),
          is3D(lastEditableSelectedObject)
            ? lastEditableSelectedObject.getZ()
            : 0
        );
      }
    }

    private _applyDummyLocationToBone(
      dummyThreeObject: THREE.Object3D,
      bone: THREE.Bone
    ) {
      const parent = bone.parent;
      const dummyWorldPosition = new THREE.Vector3();
      const dummyWorldQuaternion = new THREE.Quaternion();
      dummyThreeObject.getWorldPosition(dummyWorldPosition);
      dummyThreeObject.getWorldQuaternion(dummyWorldQuaternion);

      if (!parent) {
        bone.position.copy(dummyWorldPosition);
        bone.quaternion.copy(dummyWorldQuaternion);
        bone.updateMatrixWorld(true);
        return;
      }

      const parentWorldQuaternion = new THREE.Quaternion();
      const parentWorldQuaternionInverse = new THREE.Quaternion();
      const localPosition = new THREE.Vector3();
      parent.getWorldQuaternion(parentWorldQuaternion);
      parentWorldQuaternionInverse.copy(parentWorldQuaternion).invert();

      localPosition.copy(dummyWorldPosition);
      parent.worldToLocal(localPosition);
      bone.position.copy(localPosition);

      bone.quaternion
        .copy(parentWorldQuaternionInverse)
        .multiply(dummyWorldQuaternion);
      bone.updateMatrixWorld(true);
    }

    private _removeSelectionControls(): void {
      if (!this._selectionControls) {
        return;
      }
      this._selectionControls.threeTransformControls.detach();
      this._selectionControls.threeTransformControls.removeFromParent();
      this._selectionControls.dummyThreeObject.removeFromParent();
      this._editorGrid.setVisible(false);
      this._selectionControls = null;
      this._lastAppliedTransformControlsSettings = null;
      this._lastSelectedTransformAxis = null;
    }

    activate(enable: boolean) {
      if (enable) {
        // Nothing to do.
      } else {
        this._runtimeGame.getSoundManager().unmuteEverything('in-game-editor');
        this._removeSelectionControls();
        this._ikSettingsPanel.hide();

        // Cleanup selection boxes
        this._selectionBoxes.forEach((box) => {
          box.removeFromParent();
        });
        this._selectionBoxes.clear();
        this._skeletonHelpers.forEach((helper) => {
          helper.removeFromParent();
        });
        this._skeletonHelpers.clear();
        this._boneControlUnderCursor = null;
        this._selectedBoneControl = null;
        this._isIKModeEnabled = false;
      }
    }

    setVisibleStatus(visible: boolean) {
      this._isVisible = visible;
    }

    private _sendSelectionUpdate(options?: {
      hasSelectedObjectBeenModified?: boolean;
      isSendingBackSelectionForDefaultSize?: boolean;
      addedObjects?: Array<gdjs.RuntimeObject>;
      removedObjects?: Array<gdjs.RuntimeObject>;
      objectToEdit?: gdjs.RuntimeObject | null;
    }) {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;

      const getPersistentUuidsFromObjects = (
        objects: Array<gdjs.RuntimeObject>
      ): Array<InstancePersistentUuidData> =>
        objects
          .map((object) => {
            if (!object.persistentUuid) return null;

            return { persistentUuid: object.persistentUuid };
          })
          .filter(isDefined);

      const getSelectedInstances = (
        objects: Array<gdjs.RuntimeObject>
      ): Array<InstancePersistentUuidData> =>
        objects
          .map((object) => {
            if (!object.persistentUuid) {
              return null;
            }
            return {
              persistentUuid: object.persistentUuid,
              defaultWidth: object.getOriginalWidth(),
              defaultHeight: object.getOriginalHeight(),
              defaultDepth: is3D(object)
                ? object.getOriginalDepth()
                : undefined,
            };
          })
          .filter(isDefined);

      const updatedInstances =
        options && options.hasSelectedObjectBeenModified
          ? this._selection
              .getSelectedObjects()
              .map((object) => this.getInstanceDataFromRuntimeObject(object))
              .filter(isDefined)
          : [];

      const addedInstances =
        options && options.addedObjects
          ? options.addedObjects
              .map((object) => this.getInstanceDataFromRuntimeObject(object))
              .filter(isDefined)
          : [];

      const removedInstances =
        options && options.removedObjects ? options.removedObjects : [];

      this._removeInstances(removedInstances);
      this._updateInstances(updatedInstances);
      this._addInstances(addedInstances);

      debuggerClient.sendInstanceChanges({
        isSendingBackSelectionForDefaultSize: options
          ? options.isSendingBackSelectionForDefaultSize || false
          : false,
        updatedInstances,
        addedInstances,
        selectedInstances: getSelectedInstances(
          this._selection.getSelectedObjects()
        ),
        removedInstances: getPersistentUuidsFromObjects(removedInstances),
        objectNameToEdit:
          options && options.objectToEdit
            ? options.objectToEdit.getName()
            : null,
      });
    }

    private getInstanceDataFromRuntimeObject(
      runtimeObject: gdjs.RuntimeObject
    ): InstanceData | null {
      if (is3D(runtimeObject)) {
        if (!runtimeObject.persistentUuid) return null;

        const width = runtimeObject.getWidth();
        const height = runtimeObject.getHeight();
        const depth = runtimeObject.getDepth();
        const defaultWidth = runtimeObject.getOriginalWidth();
        const defaultHeight = runtimeObject.getOriginalHeight();
        const defaultDepth = runtimeObject.getOriginalDepth();

        const oldData = this._getInstanceData(runtimeObject.persistentUuid);
        const parentObject = runtimeObject.getParentObject();
        const instanceData: InstanceData = {
          name: runtimeObject.getName(),
          zOrder: runtimeObject.getZOrder(),
          persistentUuid: runtimeObject.persistentUuid,
          parentPersistentUuid: parentObject
            ? parentObject.persistentUuid || ''
            : '',
          inheritRotation: runtimeObject.inheritRotation(),
          inheritScale: runtimeObject.inheritScale(),
          x: runtimeObject.getX(),
          y: runtimeObject.getY(),
          z: runtimeObject.getZ(),
          layer: runtimeObject.getLayer(),
          angle: runtimeObject.getAngle(),
          rotationY: runtimeObject.getRotationY(),
          rotationX: runtimeObject.getRotationX(),
          customSize: width !== defaultWidth || height !== defaultHeight,
          width,
          height,
          depth: depth === defaultDepth ? undefined : depth,
          locked: oldData ? oldData.locked : false,
          sealed: oldData ? oldData.sealed : false,
          // TODO: how to transmit/should we transmit other properties?
          numberProperties: [],
          stringProperties: [],
          initialVariables: [],
          // @ts-ignore
          defaultWidth,
          defaultHeight,
          defaultDepth,
        };

        if (parentObject) {
          instanceData.localX = runtimeObject.getLocalX();
          instanceData.localY = runtimeObject.getLocalY();
          instanceData.localZ = runtimeObject.getLocalZ();
          instanceData.localAngle = runtimeObject.getLocalAngle();
          instanceData.localRotationX = runtimeObject.getLocalRotationX();
          instanceData.localRotationY = runtimeObject.getLocalRotationY();
          instanceData.localScaleX = runtimeObject.getLocalScaleX();
          instanceData.localScaleY = runtimeObject.getLocalScaleY();
        }

        return instanceData;
      } else {
        // TODO: handle 2D objects/instances.
        return null;
      }
    }

    private _removeInstances(
      removedInstances: Array<{ persistentUuid: string | null }>
    ) {
      for (const removedInstance of removedInstances) {
        // TODO: Might be worth indexing instances data
        const instanceIndex = this._editedInstanceDataList.findIndex(
          (instance) =>
            instance.persistentUuid === removedInstance.persistentUuid
        );
        if (instanceIndex >= 0) {
          this._editedInstanceDataList.splice(instanceIndex, 1);
        }
      }
    }

    private _updateInstances(updatedInstances: Array<InstanceData>) {
      for (const updatedInstance of updatedInstances) {
        const oldInstance = this._getInstanceData(
          updatedInstance.persistentUuid
        );
        if (oldInstance) {
          gdjs.HotReloader.assignOrDelete(oldInstance, updatedInstance, [
            // These are never modified by the InGameEditor, so don't update them:
            'initialVariables',
            'numberProperties',
            'stringProperties',
          ]);
        }
      }
    }

    private _getInstanceData(
      persistentUuid: string | null
    ): InstanceData | null {
      // TODO: Might be worth indexing instances data
      return persistentUuid
        ? this._editedInstanceDataList.find(
            (instanceData) => instanceData.persistentUuid === persistentUuid
          ) || null
        : null;
    }

    isInstanceLocked(object: gdjs.RuntimeObject): boolean {
      const instanceData = this._getInstanceData(object.persistentUuid);
      return !!instanceData && !!instanceData.locked;
    }

    isInstanceSealed(object: gdjs.RuntimeObject): boolean {
      const instanceData = this._getInstanceData(object.persistentUuid);
      return !!instanceData && !!instanceData.sealed;
    }

    private _addInstances(addedInstances: Array<InstanceData>) {
      for (const addedInstance of addedInstances) {
        this._editedInstanceDataList.push(addedInstance);
      }
    }

    private _updateInnerAreaOutline(): void {
      if (!this._currentScene) return;

      const layer = this.getCameraLayer('');
      if (!layer) {
        return;
      }
      const threeGroup = layer.getRenderer().getThreeGroup();
      if (!threeGroup) {
        return;
      }
      if (!this._threeInnerArea) {
        const boxMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            alphaTest: 1,
          })
        );
        boxMesh.position.x = 0.5;
        boxMesh.position.y = 0.5;
        boxMesh.position.z = 0.5;
        const box = new THREE.BoxHelper(boxMesh, '#444444');
        box.rotation.order = 'ZYX';
        //box.material.depthTest = false;
        box.material.fog = false;
        const container = new THREE.Group();
        container.rotation.order = 'ZYX';
        container.add(box);
        threeGroup.add(container);
        this._threeInnerArea = container;
      }
      const threeInnerArea = this._threeInnerArea;
      if (this._innerArea) {
        const innerArea = this._innerArea;
        threeInnerArea.scale.x = innerArea.max[0] - innerArea.min[0];
        threeInnerArea.scale.y = innerArea.max[1] - innerArea.min[1];
        threeInnerArea.scale.z = innerArea.max[2] - innerArea.min[2];
        threeInnerArea.position.x = innerArea.min[0];
        threeInnerArea.position.y = innerArea.min[1];
        threeInnerArea.position.z = innerArea.min[2];
      } else {
        threeInnerArea.scale.x = this._runtimeGame.getOriginalWidth();
        threeInnerArea.scale.y = this._runtimeGame.getOriginalHeight();
        threeInnerArea.scale.z = 0.01;
        threeInnerArea.position.x = 0;
        threeInnerArea.position.y = 0;
        threeInnerArea.position.z = 0;
      }
    }

    private _handleContextMenu() {
      const inputManager = this._runtimeGame.getInputManager();
      const renderer = this._runtimeGame.getRenderer();
      const isClick =
        Date.now() - this._pressedRightButtonTime <=
        pressAndReleaseForClickDuration;
      const cursorStayedStill = this._hasCursorStayedStillWhilePressed({
        toleranceRadius: 8,
      });
      const wasUsingCameraNavigationKeys = freeCameraSwitchKeys.some(
        (key) =>
          inputManager.isKeyPressed(key) || inputManager.wasKeyJustPressed(key)
      );
      if (
        inputManager.isMouseButtonReleased(1) &&
        isClick &&
        cursorStayedStill &&
        !wasUsingCameraNavigationKeys &&
        !renderer.isPointerLocked()
      ) {
        this._sendOpenContextMenu(
          inputManager.getCursorX(),
          inputManager.getCursorY()
        );
      }
    }

    private _hasCursorStayedStillWhilePressed({
      toleranceRadius,
    }: {
      toleranceRadius: float;
    }) {
      const inputManager = this._runtimeGame.getInputManager();
      const deltaX = Math.abs(
        this._pressedOriginalCursorX - inputManager.getCursorX()
      );
      const deltaY = Math.abs(
        this._pressedOriginalCursorY - inputManager.getCursorY()
      );
      return (
        deltaX * deltaX + deltaY * deltaY <= toleranceRadius * toleranceRadius
      );
    }

    private _sendOpenContextMenu(cursorX: float, cursorY: float) {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;

      debuggerClient.sendOpenContextMenu(cursorX, cursorY);
    }

    private _handleShortcuts() {
      const inputManager = this._runtimeGame.getInputManager();
      let alreadyHandledShortcut = false;
      if (isControlPressedOnly(inputManager)) {
        // Note: use `wasKeyJustPressed` instead of `wasKeyReleased` to avoid
        // macOS stealing the key release ("key up") information
        // when the "Meta" key is pressed.
        if (inputManager.wasKeyJustPressed(Z_KEY)) {
          this._sendUndo();
          alreadyHandledShortcut = true;
        } else if (inputManager.wasKeyJustPressed(Y_KEY)) {
          this._sendRedo();
          alreadyHandledShortcut = true;
        } else if (inputManager.wasKeyJustPressed(C_KEY)) {
          this._sendCopy();
          alreadyHandledShortcut = true;
        } else if (inputManager.wasKeyJustPressed(V_KEY)) {
          this._sendPaste();
          alreadyHandledShortcut = true;
        } else if (inputManager.wasKeyJustPressed(X_KEY)) {
          this._sendCut();
          alreadyHandledShortcut = true;
        }
      }
      if (isControlPlusShiftPressedOnly(inputManager)) {
        if (inputManager.wasKeyJustPressed(Z_KEY)) {
          this._sendRedo();
          alreadyHandledShortcut = true;
        }
      }

      // Send the shortcut to the editor (as the iframe does not bubble up
      // the event to the parent window).
      if (!alreadyHandledShortcut) {
        this._forwardShortcutsToEditor(inputManager);
      }
    }

    private _sendUndo() {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;
      debuggerClient.sendUndo();
    }

    private _sendRedo() {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;
      debuggerClient.sendRedo();
    }

    private _sendCopy() {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;
      debuggerClient.sendCopy();
    }

    private _sendPaste() {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;
      debuggerClient.sendPaste();
    }

    private _sendCut() {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient) return;
      debuggerClient.sendCut();
    }

    private _forwardShortcutsToEditor(inputManager: gdjs.InputManager) {
      const isCtrlPressed =
        inputManager.isKeyPressed(LEFT_CTRL_KEY) ||
        inputManager.isKeyPressed(RIGHT_CTRL_KEY);
      const isMetaPressed =
        inputManager.isKeyPressed(LEFT_META_KEY) ||
        inputManager.isKeyPressed(RIGHT_META_KEY);
      const isShiftKeyPressed = isShiftPressed(inputManager);
      const isAltKeyPressed = isAltPressed(inputManager);

      if (
        !isCtrlPressed &&
        !isMetaPressed &&
        !isAltKeyPressed &&
        !isShiftKeyPressed
      ) {
        return;
      }

      for (const locationAwareKeyCode of this._runtimeGame
        .getInputManager()
        .exceptionallyGetAllJustPressedKeys()) {
        const keyCode =
          exceptionallyGetKeyCodeFromLocationAwareKeyCode(locationAwareKeyCode);

        const debuggerClient = this._runtimeGame._debuggerClient;
        if (debuggerClient) {
          debuggerClient.sendKeyboardShortcut({
            keyCode,
            metaKey: isMetaPressed,
            ctrlKey: isCtrlPressed,
            altKey: isAltKeyPressed,
            shiftKey: isShiftKeyPressed,
          });
        }
      }
    }

    cancelDragNewInstance() {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      if (this._draggedNewObject) {
        this._draggedNewObject.deleteFromScene();
        this._draggedNewObject = null;
      }
      this._editorGrid.setVisible(false);
    }

    dragNewInstance({
      name,
      dropped,
      isAltPressed,
    }: {
      name: string;
      dropped: boolean;
      isAltPressed: boolean;
    }) {
      const currentScene = this._currentScene;
      if (!currentScene) return;
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      const selectedLayer = this.getEditorLayer(this._selectedLayerName);
      if (!selectedLayer) return;

      const inputManager = this._runtimeGame.getInputManager();

      if (this._draggedNewObject && this._draggedNewObject.getName() !== name) {
        this._draggedNewObject.deleteFromScene();
        this._draggedNewObject = null;
      }

      if (!this._draggedNewObject) {
        if (!doesRuntimeSceneTypeAllow3DObjects(this._currentSceneType)) {
          return;
        }
        const newObject = editedInstanceContainer.createObject(name);
        if (!newObject) return;
        if (!is3D(newObject)) {
          editedInstanceContainer.markObjectForDeletion(newObject);
          return;
        }
        newObject.persistentUuid = gdjs.makeUuid();
        newObject.setLayer(selectedLayer.getName());
        this._draggedNewObject = newObject;
      }

      // We don't update the object position when it's dropped because it makes
      // the object shift a bit.
      // It seems that newIDE doesn't send the last cursor position even when
      // the cursor stay still for several frames. The right position is only
      // sent it when the object is dropped which make the shift.
      // To reproduce the issue:
      // - remove the `if`
      // - drag the object vertically very fast
      // - stay still
      // - drop the object
      if (!dropped) {
        let isCursorFound = false;
        let cursorX = 0;
        let cursorY = 0;
        let cursorZ = 0;
        if (is3D(this._draggedNewObject)) {
          const cursor = this._getCursorIn3D([this._draggedNewObject]);
          if (cursor) {
            [cursorX, cursorY, cursorZ] = cursor;
            isCursorFound = true;
          }
        } else {
          const projectedCursor = this._getProjectedCursor();
          if (projectedCursor) {
            [cursorX, cursorY] = projectedCursor;
            isCursorFound = true;
          }
        }
        if (isCursorFound) {
          this._editorGrid.setNormal('Z');
          this._editorGrid.setPosition(cursorX, cursorY, cursorZ);
          const cameraLayer = this.getCameraLayer(
            this._draggedNewObject.getLayer()
          );
          const threeScene = cameraLayer
            ? cameraLayer.getRenderer().getThreeScene()
            : null;
          if (threeScene) {
            this._editorGrid.setTreeScene(threeScene);
          }
          this._editorGrid.setVisible(true);
          if (this._editorGrid.isSnappingEnabled(inputManager, isAltPressed)) {
            cursorX = this._editorGrid.getSnappedX(cursorX);
            cursorY = this._editorGrid.getSnappedY(cursorY);
          }
          // TODO The object Z should be changed according to the new X and Y
          // to match the ground.
          this._draggedNewObject.setX(Math.round(cursorX));
          this._draggedNewObject.setY(Math.round(cursorY));
          // We don't round on Z because if cubes are stacked and there depth
          // is not round it would leave an interstice between them.
          if (is3D(this._draggedNewObject)) {
            this._draggedNewObject.setZ(cursorZ);
          }
        }
      }

      if (dropped) {
        if (this._draggedNewObject) {
          const isLayer3D = selectedLayer.getRenderer().getThreeGroup();
          if (isLayer3D) {
            const cameraX = selectedLayer.getCameraX();
            const cameraY = selectedLayer.getCameraY();
            const cameraZ = getCameraZ(
              currentScene,
              selectedLayer.getName(),
              0
            );

            const closestIntersect = this._getClosestIntersectionUnderCursor([
              this._draggedNewObject,
            ]);
            if (closestIntersect && !is3D(this._draggedNewObject)) {
              // Avoid to create a 2D object hidden under a 3D one.
              this.cancelDragNewInstance();
              return;
            }

            let cursorX: float;
            let cursorY: float;
            let cursorZ: float;
            if (closestIntersect) {
              cursorX = closestIntersect.point.x;
              cursorY = -closestIntersect.point.y;
              cursorZ = closestIntersect.point.z;
            } else {
              const projectedCursor = this._getProjectedCursor();
              if (!projectedCursor) {
                // Avoid to create an object behind the camera when it's dropped over the horizon.
                this.cancelDragNewInstance();
                return;
              }
              cursorX = projectedCursor[0];
              cursorY = projectedCursor[1];
              cursorZ = 0;
            }

            const cursorDistance = Math.hypot(
              cursorX - cameraX,
              cursorY - cameraY,
              cursorZ - cameraZ
            );
            if (
              cursorDistance >
              selectedLayer.getInitialCamera3DFarPlaneDistance()
            ) {
              // Avoid to create an object outside of the rendered area.
              this.cancelDragNewInstance();
              return;
            }
          }
          this._sendSelectionUpdate({
            addedObjects: [this._draggedNewObject],
          });
        }

        this._draggedNewObject = null;
        return;
      }
    }

    /**
     * @returns The cursor projected on the plane Z = 0 or `null` if the cursor is in the sky.
     */
    _getProjectedCursor(): FloatPoint | null {
      const currentScene = this._currentScene;
      if (!currentScene) return null;

      const layer = this.getCameraLayer('');
      if (!layer) {
        return null;
      }

      const cameraX = layer.getCameraX();
      const cameraY = layer.getCameraY();
      const cameraZ = getCameraZ(currentScene, layer.getName(), 0);

      const cursorX = gdjs.evtTools.input.getCursorX(
        currentScene,
        layer.getName(),
        0
      );
      const cursorY = gdjs.evtTools.input.getCursorY(
        currentScene,
        layer.getName(),
        0
      );

      const deltaX = cursorX - cameraX;
      const deltaY = cursorY - cameraY;
      const deltaZ = 0 - cameraZ;

      const threeCamera = layer.getRenderer().getThreeCamera();
      if (!threeCamera) {
        return [cursorX, cursorY];
      }
      const { forward } = getCameraForwardVector(threeCamera);
      // It happens when the cursor is over the horizon and projected on the plane Z = 0.
      const isCursorBehindTheCamera =
        forward.dot(new THREE.Vector3(deltaX, deltaY, deltaZ)) < 1;
      if (isCursorBehindTheCamera) {
        return null;
      }
      return [cursorX, cursorY];
    }

    reloadInstances(instances: Array<InstanceData>) {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      const runtimeObjectsByPersistentUuid: Record<string, gdjs.RuntimeObject> =
        {};
      const runtimeObjectsToUpdate: Array<{
        runtimeObject: gdjs.RuntimeObject;
        instance: InstanceData;
      }> = [];

      // TODO: Might be worth indexing instances data and runtime objects by their
      // persistentUuid (See HotReloader.indexByPersistentUuid).
      editedInstanceContainer
        .getAdhocListOfAllInstances()
        .forEach((runtimeObject) => {
          if (runtimeObject.persistentUuid) {
            runtimeObjectsByPersistentUuid[runtimeObject.persistentUuid] =
              runtimeObject;
          }
          const instance = instances.find(
            (instance) =>
              instance.persistentUuid === runtimeObject.persistentUuid
          );
          if (instance) {
            runtimeObjectsToUpdate.push({ runtimeObject, instance });
            runtimeObject.setX(instance.x);
            runtimeObject.setY(instance.y);
            if (instance.customSize) {
              runtimeObject.setWidth(instance.width);
              runtimeObject.setHeight(instance.height);
            } else {
              runtimeObject.setWidth(runtimeObject.getOriginalWidth());
              runtimeObject.setHeight(runtimeObject.getOriginalHeight());
            }
            runtimeObject.setAngle(instance.angle);
            runtimeObject.setLayer(instance.layer);
            if (is3D(runtimeObject)) {
              runtimeObject.setZ(instance.z === undefined ? 0 : instance.z);
              runtimeObject.setRotationX(
                instance.rotationX == undefined ? 0 : instance.rotationX
              );
              runtimeObject.setRotationY(
                instance.rotationY == undefined ? 0 : instance.rotationY
              );
              runtimeObject.setDepth(
                instance.depth == undefined
                  ? runtimeObject.getOriginalDepth()
                  : instance.depth
              );
            }
          }
        });

      runtimeObjectsToUpdate.forEach(({ runtimeObject, instance }) => {
        runtimeObject.applyHierarchicalInstanceData(
          instance,
          runtimeObjectsByPersistentUuid
        );
        runtimeObject.extraInitializationFromInitialInstance(instance);
      });
      this._updateInstances(instances);
      this._forceUpdateSelectionControls();
    }

    addInstances(instances: Array<InstanceData>) {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      editedInstanceContainer.createObjectsFrom(instances, 0, 0, 0, true);
      this._addInstances(instances);
    }

    deleteSelection() {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return;

      this._removeInstances(this._selection.getSelectedObjects());
      for (const object of this._selection.getSelectedObjects()) {
        object.deleteFromScene();
      }
      this._selection.clear();
    }

    private _getClosestIntersectionUnderCursor(
      excludedObjects?: Array<gdjs.RuntimeObject>
    ): THREE.Intersection | null {
      const runtimeGame = this._runtimeGame;
      const isIKModeEnabledForSelection = this._isIKModeEnabledForSelection();
      const firstIntersectsByLayer: {
        [layerName: string]: null | {
          intersect: THREE.Intersection;
        };
      } = {};
      const cursorX = runtimeGame.getInputManager().getCursorX();
      const cursorY = runtimeGame.getInputManager().getCursorY();

      const layerNames = [];
      const currentScene = this._currentScene;
      const threeRenderer = runtimeGame.getRenderer().getThreeRenderer();
      if (!currentScene || !threeRenderer) return null;

      // Only check layer 0, on which Three.js objects are by default,
      // and move selection boxes + dragged object to layer 1 so they
      // are not considered by raycasting.
      this._raycaster.layers.set(0);
      this._selectionBoxes.forEach((box) => box.setLayer(1));
      const excludedSkeletonHelpers: ObjectSkeletonHelper[] = [];
      if (this._threeInnerArea) {
        for (const child of this._threeInnerArea.children) {
          child.layers.set(1);
        }
      }
      if (excludedObjects) {
        for (const excludedObject of excludedObjects) {
          if (is3D(excludedObject)) {
            const draggedRendererObject = excludedObject.get3DRendererObject();
            if (draggedRendererObject) {
              draggedRendererObject.layers.set(1);
              draggedRendererObject.traverse((object) => object.layers.set(1));
            }
          }
          const skeletonHelper = this._skeletonHelpers.get(excludedObject);
          if (skeletonHelper) {
            skeletonHelper.setLayer(1);
            excludedSkeletonHelpers.push(skeletonHelper);
          }
        }
      }

      currentScene.getAllLayerNames(layerNames);
      layerNames.forEach((layerName) => {
        const runtimeLayerRender = currentScene
          .getLayer(layerName)
          .getRenderer();
        const threeCamera = runtimeLayerRender.getThreeCamera();
        const threeGroup = runtimeLayerRender.getThreeGroup();
        if (!threeCamera || !threeGroup) return;

        // Note that raycasting is done by Three.js, which means it could slow down
        // if lots of 3D objects are shown. We consider that if this needs improvements,
        // this must be handled by the game engine culling
        const normalizedDeviceCoordinates = this._getTempVector2d(
          this._getNormalizedScreenX(cursorX),
          this._getNormalizedScreenY(cursorY)
        );
        this._raycaster.setFromCamera(normalizedDeviceCoordinates, threeCamera);
        const intersects = this._raycaster.intersectObjects(
          threeGroup.children,
          true
        );
        let firstFallbackIntersect: THREE.Intersection | null = null;
        let firstSelectableIntersect: THREE.Intersection | null = null;
        let firstBoneIntersect: THREE.Intersection | null = null;
        for (const intersect of intersects) {
          const intersectObject = intersect.object as THREE.Object3D & {
            isTransformControls?: boolean;
          };
          if (intersectObject.isTransformControls) {
            continue;
          }

          if (!firstFallbackIntersect) {
            firstFallbackIntersect = intersect;
          }

          if (
            isIKModeEnabledForSelection &&
            !firstBoneIntersect &&
            this._getBoneControlData(intersectObject)
          ) {
            firstBoneIntersect = intersect;
          }

          if (!firstSelectableIntersect && this._getObject3D(intersectObject)) {
            firstSelectableIntersect = intersect;
          }

          if (
            firstSelectableIntersect &&
            (!isIKModeEnabledForSelection || firstBoneIntersect)
          ) {
            break;
          }
        }
        const firstIntersect =
          (isIKModeEnabledForSelection && firstBoneIntersect) ||
          firstSelectableIntersect ||
          firstFallbackIntersect;
        if (!firstIntersect) return;

        firstIntersectsByLayer[layerName] = {
          intersect: firstIntersect,
        };
      });

      // Reset selection boxes layers so they are properly displayed.
      this._selectionBoxes.forEach((box) => box.setLayer(0));
      excludedSkeletonHelpers.forEach((helper) => helper.setLayer(0));
      if (this._threeInnerArea) {
        for (const child of this._threeInnerArea.children) {
          child.layers.set(0);
        }
      }
      // Also reset the layer of the object being added.
      if (excludedObjects) {
        for (const excludedObject of excludedObjects) {
          if (is3D(excludedObject)) {
            const draggedRendererObject = excludedObject.get3DRendererObject();
            if (draggedRendererObject) {
              draggedRendererObject.layers.set(0);
              draggedRendererObject.traverse((object) => object.layers.set(0));
            }
          }
        }
      }

      let closestIntersect: THREE.Intersection | null = null;
      for (const intersect of Object.values(firstIntersectsByLayer)) {
        if (
          intersect &&
          (!closestIntersect ||
            intersect.intersect.distance < closestIntersect.distance)
        ) {
          closestIntersect = intersect.intersect;
        }
      }

      return closestIntersect;
    }

    private _getCursorIn3D(
      excludedObjects?: Array<gdjs.RuntimeObject>
    ): Point3D | null {
      const closestIntersect =
        this._getClosestIntersectionUnderCursor(excludedObjects);
      if (closestIntersect) {
        return [
          closestIntersect.point.x,
          -closestIntersect.point.y,
          closestIntersect.point.z,
        ];
      }
      const projectedCursor = this._getProjectedCursor();
      if (!projectedCursor) {
        return null;
      }
      return [projectedCursor[0], projectedCursor[1], 0];
    }

    private _getNormalizedScreenX(x: float): float {
      return (x / this._runtimeGame.getGameResolutionWidth()) * 2 - 1;
    }

    private _getNormalizedScreenY(y: float): float {
      return -(y / this._runtimeGame.getGameResolutionHeight()) * 2 + 1;
    }

    getObjectUnderCursor(): gdjs.RuntimeObject | null {
      const closestIntersect = this._getClosestIntersectionUnderCursor();
      if (!closestIntersect) {
        this._boneControlUnderCursor = null;
        const editedInstanceContainer = this.getEditedInstanceContainer();
        if (!editedInstanceContainer) {
          return null;
        }
        const cursor = this._getCursorIn3D();
        if (!cursor || cursor[2] !== 0) {
          return null;
        }
        let topObject2D: gdjs.RuntimeObject | null = null;
        let topLayer: gdjs.RuntimeLayer | null = null;
        let topLayerIndex = 0;
        for (const object of editedInstanceContainer.getAdhocListOfAllInstances()) {
          if (is3D(object) || !object.cursorOnObject()) {
            continue;
          }
          const layer = editedInstanceContainer.getLayer(object.getLayer());
          const layerIndex =
            editedInstanceContainer._orderedLayers.indexOf(layer);
          if (
            !topObject2D ||
            layerIndex > topLayerIndex ||
            (layer === topLayer && object.getZOrder() > topObject2D.getZOrder())
          ) {
            topObject2D = object;
            topLayer = layer;
            topLayerIndex = layerIndex;
          }
        }
        return topObject2D;
      }
      this._boneControlUnderCursor = this._isIKModeEnabledForSelection()
        ? this._getBoneControlData(closestIntersect.object)
        : null;
      return this._getObject3D(closestIntersect.object);
    }

    private _getObject3D(
      initialThreeObject: THREE.Object3D
    ): gdjs.RuntimeObject | null {
      const editedInstanceContainer = this.getEditedInstanceContainer();
      if (!editedInstanceContainer) return null;

      // Walk back up the object hierarchy to find the runtime object.
      // We sadly need to do that because the intersection can be found on a Mesh or other
      // child Three.js object, instead of the one exposed by the gdjs.RuntimeObject.
      let threeObject: THREE.Object3D | null = initialThreeObject;
      while (threeObject) {
        const runtimeObject: gdjs.RuntimeObject | null =
          // @ts-ignore
          threeObject.gdjsRuntimeObject;
        if (runtimeObject) {
          let rootRuntimeObject = runtimeObject;
          while (
            rootRuntimeObject.getInstanceContainer() instanceof
              gdjs.CustomRuntimeObjectInstanceContainer &&
            rootRuntimeObject.getInstanceContainer() !== editedInstanceContainer
          ) {
            rootRuntimeObject = (
              rootRuntimeObject.getInstanceContainer() as gdjs.CustomRuntimeObjectInstanceContainer
            ).getOwner();
          }
          return rootRuntimeObject;
        }
        threeObject = threeObject.parent || null;
      }
      return null;
    }

    private _getBoneControlData(
      initialThreeObject: THREE.Object3D
    ): BoneControlData | null {
      let threeObject: THREE.Object3D | null = initialThreeObject;
      while (threeObject) {
        const boneControlData = (threeObject as Object3DWithBoneControlData)
          .gdjsBoneControlData;
        if (boneControlData) {
          return boneControlData;
        }
        threeObject = threeObject.parent || null;
      }
      return null;
    }

    getCameraState(): EditorCameraState {
      return this._getEditorCamera().getCameraState();
    }

    restoreCameraState(editorCamera3D: EditorCameraState) {
      this._getEditorCamera().restoreCameraState(editorCamera3D);
    }

    private _updateMouseCursor() {
      const mouseCursor = this._getEditorCamera().getRequestedMouseCursor();

      const canvas = this._runtimeGame.getRenderer().getCanvas();
      if (canvas) {
        canvas.style.cursor = mouseCursor || 'default';
      }
    }

    private _handleTransformControlsMode() {
      const inputManager = this._runtimeGame.getInputManager();
      let wasHandledByLetterShortcut = false;
      const canUseLetterShortcuts =
        !!this._selectionControls &&
        !isControlOrCmdPressed(inputManager) &&
        !isShiftPressed(inputManager) &&
        !isAltPressed(inputManager) &&
        !inputManager.isMouseButtonPressed(1);

      if (canUseLetterShortcuts && inputManager.wasKeyJustPressed(W_KEY)) {
        this._setTransformControlsMode('translate');
        wasHandledByLetterShortcut = true;
      } else if (
        canUseLetterShortcuts &&
        inputManager.wasKeyJustPressed(E_KEY)
      ) {
        this._setTransformControlsMode('rotate');
        wasHandledByLetterShortcut = true;
      } else if (
        canUseLetterShortcuts &&
        inputManager.wasKeyJustPressed(R_KEY)
      ) {
        this._setTransformControlsMode('scale');
        wasHandledByLetterShortcut = true;
      } else if (inputManager.wasKeyJustPressed(KEY_DIGIT_1)) {
        this._setTransformControlsMode('translate');
      } else if (inputManager.wasKeyJustPressed(KEY_DIGIT_2)) {
        this._setTransformControlsMode('rotate');
      } else if (inputManager.wasKeyJustPressed(KEY_DIGIT_3)) {
        this._setTransformControlsMode('scale');
      }

      if (canUseLetterShortcuts && inputManager.wasKeyJustPressed(L_KEY)) {
        this._toggleTransformControlsSpace();
        wasHandledByLetterShortcut = true;
      } else if (
        canUseLetterShortcuts &&
        inputManager.wasKeyJustPressed(G_KEY)
      ) {
        this._toggleTransformSnap('translation');
        wasHandledByLetterShortcut = true;
      } else if (
        canUseLetterShortcuts &&
        inputManager.wasKeyJustPressed(H_KEY)
      ) {
        this._toggleTransformSnap('rotation');
        wasHandledByLetterShortcut = true;
      } else if (
        canUseLetterShortcuts &&
        inputManager.wasKeyJustPressed(J_KEY)
      ) {
        this._toggleTransformSnap('scale');
        wasHandledByLetterShortcut = true;
      }
      if (canUseLetterShortcuts && inputManager.wasKeyJustPressed(I_KEY)) {
        this._toggleIKMode();
        wasHandledByLetterShortcut = true;
      }

      if (wasHandledByLetterShortcut) {
        // Avoid mode switches to also trigger camera moves in the same frame.
        this._skipCameraMovementThisFrame = true;
      }
    }

    private _handlePointerLock() {
      const inputManager = this._runtimeGame.getInputManager();
      const renderer = this._runtimeGame.getRenderer();
      const now = Date.now();
      const isRightButtonPressed = inputManager.isMouseButtonPressed(1);
      const isMiddleButtonPressed = inputManager.isMouseButtonPressed(2);
      if (isRightButtonPressed || isMiddleButtonPressed) {
        this._lastPointerLockMousePressTime = now;
      }

      // Request pointer lock when right or middle button is pressed,
      // but only after the delay to ensure it's not a click.
      if (
        (isRightButtonPressed &&
          now - this._pressedRightButtonTime >
            pressAndReleaseForClickDuration) ||
        (isMiddleButtonPressed &&
          now - this._pressedMiddleButtonTime > pressAndReleaseForClickDuration)
      ) {
        renderer.requestPointerLock('in-game-editor');
      }

      // Exit pointer lock as soon as we can.
      if (!isRightButtonPressed && !isMiddleButtonPressed) {
        const isInsideReleaseGracePeriod =
          now - this._lastPointerLockMousePressTime <
          pointerLockReleaseGracePeriodMs;
        if (renderer.isPointerLocked() && !isInsideReleaseGracePeriod) {
          renderer.exitPointerLock('in-game-editor');
        }
      }
    }

    updateTargetFramerate(elapsedTime: float) {
      const inputManager = this._runtimeGame.getInputManager();
      if (
        inputManager.anyKeyPressed() ||
        inputManager.anyMouseButtonPressed() ||
        inputManager.getAllTouchIdentifiers().length > 0 ||
        inputManager.getMouseWheelDelta() !== 0 ||
        inputManager.getMouseWheelDeltaX() !== 0 ||
        inputManager.getMouseWheelDeltaZ() !== 0
      ) {
        this._timeSinceLastInteraction = 0;
      }
      if (this._draggedNewObject) {
        this._timeSinceLastInteraction = 0;
      }
      this._timeSinceLastInteraction += elapsedTime;

      // Adapt the framerate to avoid consuming too much CPU when the editor is not visible
      // or not interacted with.
      if (!this._isVisible) {
        this._runtimeGame.setMaximumFps(0.3);
      } else {
        if (this._timeSinceLastInteraction > 1000) {
          this._runtimeGame.setMaximumFps(10);
        } else {
          this._runtimeGame.setMaximumFps(120);
        }
      }
    }

    updateAndRender() {
      if (!this._unregisterContextLostListener) {
        this._setupWebGLContextLostListener();
      }

      const objectUnderCursor: gdjs.RuntimeObject | null =
        this.getObjectUnderCursor();

      this._runtimeGame.getSoundManager().muteEverything('in-game-editor');

      const inputManager = this._runtimeGame.getInputManager();
      this._skipCameraMovementThisFrame = false;
      const renderer = this._runtimeGame.getRenderer();
      const isInCameraInteractionMode =
        renderer.isPointerLocked() ||
        inputManager.isMouseButtonPressed(1) ||
        inputManager.isMouseButtonPressed(2);

      // Ensure we don't keep keys considered as pressed if the editor is blurred.
      if (!hasWindowFocus && this._windowHadFocus) {
        if (isInCameraInteractionMode) {
          this._shouldReleasePressedKeysOnFocusRecovery = true;
        } else {
          inputManager.releaseAllPressedKeys();
        }
      }
      if (
        hasWindowFocus &&
        !this._windowHadFocus &&
        this._shouldReleasePressedKeysOnFocusRecovery &&
        !isInCameraInteractionMode
      ) {
        inputManager.releaseAllPressedKeys();
        this._shouldReleasePressedKeysOnFocusRecovery = false;
      }
      this._windowHadFocus = hasWindowFocus;

      // Update the state of the mouse/cursor for this frame.
      const mouseLeftButtonJustPressed =
        !this._wasMouseLeftButtonPressed &&
        inputManager.isMouseButtonPressed(0);
      const mouseRightButtonJustPressed =
        !this._wasMouseRightButtonPressed &&
        inputManager.isMouseButtonPressed(1);
      const mouseMiddleButtonJustPressed =
        !this._wasMouseMiddleButtonPressed &&
        inputManager.isMouseButtonPressed(2);
      if (mouseLeftButtonJustPressed || mouseRightButtonJustPressed) {
        this._pressedOriginalCursorX = inputManager.getCursorX();
        this._pressedOriginalCursorY = inputManager.getCursorY();
      }
      if (mouseRightButtonJustPressed) {
        this._pressedRightButtonTime = Date.now();
      }
      if (mouseMiddleButtonJustPressed) {
        this._pressedMiddleButtonTime = Date.now();
      }

      // Note: don't add more logic here. Instead, create a new method
      // to handle what you need, possibly with a dedicated class to abstract it.

      if (!this._selectionControls) {
        this._isTransformControlsHovered = false;
      } else if (
        this._previousCursorX !== inputManager.getMouseX() ||
        this._previousCursorY !== inputManager.getMouseY()
      ) {
        this._isTransformControlsHovered =
          !!this._selectionControls.threeTransformControls.axis;
      }

      this._handlePointerLock();
      this._handleTransformControlsMode();
      this._handleCameraMovement();
      this._handleSelectedObjectDragging();
      this._handleSelectionMovement();
      this._updateSelectionBox();
      this._handleSelection({ objectUnderCursor });
      this._syncIKModeWithSelection();
      this._updateSelectionOutline({ objectUnderCursor });
      // Custom objects only update their position at the end of the frame
      // because they don't override position setters like built-in objects do.
      // Since the instance position is not yet set when `onCreated` is called,
      // they will be at (0; 0; 0) during the 1st step.
      // When they are selected and `switchToSceneOrVariant` has just been
      // called, it avoid to put the control at (0; 0; 0).
      if (!this._isFirstFrame) {
        this._updateSelectionControls();
      }
      this._updateInnerAreaOutline();
      this._handleContextMenu();
      this._handleShortcuts();
      this._updateMouseCursor();

      const domElementContainer = this._runtimeGame
        .getRenderer()
        .getDomElementContainer();
      if (domElementContainer) {
        this._mobile3DCameraJoystick.setVisible(
          this._shouldShowMobile3DCameraJoystick()
        );
        this._mobile3DCameraJoystick.render(domElementContainer);
        this._toolbar.render(domElementContainer);
        this._ikSettingsPanel.render(domElementContainer);
      } else {
        this._mobile3DCameraJoystick.setVisible(false);
      }

      // Prepare state of the mouse/cursor for the next frame.
      this._wasMovingSelectionLastFrame =
        !!this._selectionControlsMovementTotalDelta;
      if (!this._selectionControlsMovementTotalDelta) {
        this._hasSelectionActuallyMoved = false;
      }
      this._wasMouseLeftButtonPressed = inputManager.isMouseButtonPressed(0);
      this._wasMouseRightButtonPressed = inputManager.isMouseButtonPressed(1);
      this._wasMouseMiddleButtonPressed = inputManager.isMouseButtonPressed(2);
      this._previousCursorX = inputManager.getMouseX();
      this._previousCursorY = inputManager.getMouseY();

      if (this._currentScene) {
        this._currentScene._updateObjectsForInGameEditor();
        this._currentScene.render();
      }

      this._isFirstFrame = false;
    }

    private _getEditorCamera(): EditorCamera {
      return this._editorCamera;
    }

    private _persistIKStateToObjectConfiguration(
      objectName: string,
      ikChainsJson: string,
      ikPosesJson: string
    ): void {
      const debuggerClient = this._runtimeGame._debuggerClient;
      if (!debuggerClient || !objectName) {
        return;
      }

      debuggerClient.sendObjectConfigurationChanges({
        objectName,
        updatedProperties: {
          ikChainsJson,
          ikPosesJson,
        },
      });
    }
  }

  class IKSettingsPanel {
    private _parent: HTMLElement | null = null;
    private _root: HTMLDivElement | null = null;
    private _elements: {
      objectLabel: HTMLSpanElement;
      chainCountLabel: HTMLSpanElement;
      modeCheckbox: HTMLInputElement;
      chainSelect: HTMLSelectElement;
      createChainFromSelectedButton: HTMLButtonElement;
      chainNameInput: HTMLInputElement;
      effectorSelect: HTMLSelectElement;
      targetModeSelect: HTMLSelectElement;
      targetBoneSelect: HTMLSelectElement;
      targetPositionRow: HTMLDivElement;
      targetXInput: HTMLInputElement;
      targetYInput: HTMLInputElement;
      targetZInput: HTMLInputElement;
      linksInput: HTMLInputElement;
      iterationsInput: HTMLInputElement;
      blendInput: HTMLInputElement;
      minAngleInput: HTMLInputElement;
      maxAngleInput: HTMLInputElement;
      toleranceInput: HTMLInputElement;
      chainEnabledCheckbox: HTMLInputElement;
      gizmosCheckbox: HTMLInputElement;
      poseSelect: HTMLSelectElement;
      poseNameInput: HTMLInputElement;
      poseCountLabel: HTMLSpanElement;
      jsonTextarea: HTMLTextAreaElement;
      statusLabel: HTMLDivElement;
      applyChainButton: HTMLButtonElement;
      removeChainButton: HTMLButtonElement;
      clearChainsButton: HTMLButtonElement;
      setEffectorFromSelectedButton: HTMLButtonElement;
      setTargetFromSelectedButton: HTMLButtonElement;
      pinChainButton: HTMLButtonElement;
      pinAllButton: HTMLButtonElement;
      savePoseButton: HTMLButtonElement;
      applyPoseButton: HTMLButtonElement;
      removePoseButton: HTMLButtonElement;
      clearPosesButton: HTMLButtonElement;
      exportJsonButton: HTMLButtonElement;
      importReplaceButton: HTMLButtonElement;
      importMergeButton: HTMLButtonElement;
    } | null = null;
    private _getActiveIKObject: () => IKConfigurableObject | null;
    private _getSelectedBoneName: () => string | null;
    private _isIKModeEnabled: () => boolean;
    private _setIKModeEnabled: (enabled: boolean) => void;
    private _persistIKState: (
      objectName: string,
      ikChainsJson: string,
      ikPosesJson: string
    ) => void;
    private _activeObject: IKConfigurableObject | null = null;
    private _selectedChainName = '';
    private _lastChainSignature = '';
    private _lastBoneSignature = '';
    private _lastPoseSignature = '';
    private _isSyncingFormValues = false;
    private _statusTimeout: number | null = null;
    private _persistTimeout: number | null = null;
    private _lastPersistedObjectName = '';
    private _lastPersistedIKChainsJson = '';
    private _lastPersistedIKPosesJson = '';

    constructor({
      getActiveIKObject,
      getSelectedBoneName,
      isIKModeEnabled,
      setIKModeEnabled,
      persistIKState,
    }: {
      getActiveIKObject: () => IKConfigurableObject | null;
      getSelectedBoneName: () => string | null;
      isIKModeEnabled: () => boolean;
      setIKModeEnabled: (enabled: boolean) => void;
      persistIKState: (
        objectName: string,
        ikChainsJson: string,
        ikPosesJson: string
      ) => void;
    }) {
      this._getActiveIKObject = getActiveIKObject;
      this._getSelectedBoneName = getSelectedBoneName;
      this._isIKModeEnabled = isIKModeEnabled;
      this._setIKModeEnabled = setIKModeEnabled;
      this._persistIKState = persistIKState;

      this._addOrUpdateStyle();
    }

    dispose() {
      if (this._statusTimeout !== null) {
        window.clearTimeout(this._statusTimeout);
        this._statusTimeout = null;
      }
      if (this._persistTimeout !== null) {
        window.clearTimeout(this._persistTimeout);
        this._persistTimeout = null;
      }
      if (this._root) {
        this._root.remove();
      }
      this._root = null;
      this._elements = null;
      this._parent = null;
      this._activeObject = null;
      this._selectedChainName = '';
      this._lastChainSignature = '';
      this._lastBoneSignature = '';
      this._lastPoseSignature = '';
    }

    hide() {
      if (this._root) {
        this._root.style.display = 'none';
      }
    }

    private _addOrUpdateStyle() {
      const styleId = 'InGameEditor-IKPanel-Style';
      let styleElement = document.getElementById(
        styleId
      ) as HTMLStyleElement | null;
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = `
        .InGameEditor-IKPanel-Root {
          position: absolute;
          top: max(46px, calc(env(safe-area-inset-top) + 46px));
          right: max(6px, env(safe-area-inset-right));
          z-index: 16;
          pointer-events: none;
          padding: 0 10px;
        }
        .InGameEditor-IKPanel-Card {
          width: min(420px, calc(100vw - 20px));
          max-height: calc(100vh - 60px);
          overflow: auto;
          pointer-events: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.22)),
            rgba(7, 14, 18, 0.9);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.36);
          backdrop-filter: blur(6px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          color: var(--in-game-editor-theme-text-color-primary);
          font-family: inherit;
        }
        .InGameEditor-IKPanel-Header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .InGameEditor-IKPanel-Subtle {
          font-size: 11px;
          opacity: 0.78;
          text-transform: none;
          letter-spacing: 0;
          font-weight: 600;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
        }
        .InGameEditor-IKPanel-Section {
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(0, 0, 0, 0.2);
        }
        .InGameEditor-IKPanel-SectionTitle {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .InGameEditor-IKPanel-Hint {
          font-size: 12px;
          line-height: 1.45;
          opacity: 0.82;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
        }
        .InGameEditor-IKPanel-Row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .InGameEditor-IKPanel-Label {
          min-width: 82px;
          font-size: 12px;
          opacity: 0.92;
        }
        .InGameEditor-IKPanel-Input,
        .InGameEditor-IKPanel-Select,
        .InGameEditor-IKPanel-Textarea {
          flex: 1;
          min-width: 0;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.3);
          color: var(--in-game-editor-theme-text-color-primary);
          font-size: 13px;
        }
        .InGameEditor-IKPanel-Grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .InGameEditor-IKPanel-Grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .InGameEditor-IKPanel-Button {
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          min-height: 34px;
          padding: 7px 10px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--in-game-editor-theme-text-color-primary);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .InGameEditor-IKPanel-Button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }
        .InGameEditor-IKPanel-Button-Primary {
          background: rgba(76, 163, 255, 0.22);
          border-color: rgba(76, 163, 255, 0.48);
        }
        .InGameEditor-IKPanel-Button:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .InGameEditor-IKPanel-Checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          user-select: none;
        }
        .InGameEditor-IKPanel-Textarea {
          min-height: 92px;
          resize: vertical;
          line-height: 1.35;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
        }
        .InGameEditor-IKPanel-Details {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 8px;
        }
        .InGameEditor-IKPanel-Details > summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          opacity: 0.88;
          list-style: none;
        }
        .InGameEditor-IKPanel-Details > summary::-webkit-details-marker {
          display: none;
        }
        .InGameEditor-IKPanel-DetailsContent {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }
        .InGameEditor-IKPanel-Status {
          min-height: 18px;
          font-size: 11px;
          opacity: 0.86;
        }
        .InGameEditor-IKPanel-Status[data-is-error="1"] {
          color: #ff9b9b;
          opacity: 1;
        }
      `;
    }

    private _setStatus(message: string, isError = false) {
      if (!this._elements) return;
      this._elements.statusLabel.textContent = message;
      this._elements.statusLabel.dataset.isError = isError ? '1' : '0';
      if (this._statusTimeout !== null) {
        window.clearTimeout(this._statusTimeout);
      }
      if (!message) {
        this._statusTimeout = null;
        return;
      }
      this._statusTimeout = window.setTimeout(() => {
        if (this._elements) {
          this._elements.statusLabel.textContent = '';
          this._elements.statusLabel.dataset.isError = '0';
        }
        this._statusTimeout = null;
      }, 2500);
    }

    private _parseNumber(
      input: HTMLInputElement,
      fallbackValue: number
    ): number {
      const parsedValue = Number(input.value);
      return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
    }

    private _chainSignature(chainNames: string[]): string {
      return chainNames.join('\n');
    }

    private _setFieldValueIfNotFocused(
      input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
      value: string,
      force = false
    ) {
      if (!input) return;
      if (!force && document.activeElement === input) {
        return;
      }
      if (input.value !== value) {
        input.value = value;
      }
    }

    private _syncSelectOptions(
      select: HTMLSelectElement,
      options: string[],
      configuration?: {
        allowEmptyOption?: boolean;
        emptyOptionLabel?: string;
      }
    ) {
      const allowEmptyOption = configuration && configuration.allowEmptyOption;
      const emptyOptionLabel =
        (configuration && configuration.emptyOptionLabel) || 'None';
      const normalizedOptions = allowEmptyOption
        ? ['', ...options]
        : options.slice();
      let shouldRebuildOptions =
        select.options.length !== normalizedOptions.length;
      if (!shouldRebuildOptions) {
        for (let index = 0; index < normalizedOptions.length; index++) {
          if (select.options[index].value !== normalizedOptions[index]) {
            shouldRebuildOptions = true;
            break;
          }
        }
      }
      if (!shouldRebuildOptions) {
        return;
      }

      const previousValue = select.value;
      select.innerHTML = '';
      if (allowEmptyOption) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = emptyOptionLabel;
        select.appendChild(emptyOption);
      }
      options.forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
      });
      if (
        previousValue &&
        Array.from(select.options).some(
          (option) => option.value === previousValue
        )
      ) {
        select.value = previousValue;
      }
    }

    private _updateTargetInputsVisibility() {
      if (!this._elements) return;
      const isPositionMode =
        this._elements.targetModeSelect.value === ('position' as IKTargetMode);
      this._elements.targetBoneSelect.disabled = isPositionMode;
      this._elements.setTargetFromSelectedButton.disabled = isPositionMode;
      this._elements.targetPositionRow.style.display = isPositionMode
        ? 'grid'
        : 'none';
    }

    private _applyCurrentChainSettingsToForm(force = false) {
      if (!this._elements || !this._activeObject) return;
      const chainName = this._selectedChainName;
      if (!chainName) {
        this._updateTargetInputsVisibility();
        return;
      }
      const chainSettings = this._activeObject.getIKChainSettings(chainName);
      if (!chainSettings) {
        this._updateTargetInputsVisibility();
        return;
      }

      this._isSyncingFormValues = true;
      this._setFieldValueIfNotFocused(
        this._elements.chainNameInput,
        chainSettings.name,
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.effectorSelect,
        chainSettings.effectorBoneName,
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.targetModeSelect,
        chainSettings.targetMode,
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.targetBoneSelect,
        chainSettings.targetBoneName || '',
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.targetXInput,
        String(chainSettings.targetPosition[0]),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.targetYInput,
        String(chainSettings.targetPosition[1]),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.targetZInput,
        String(chainSettings.targetPosition[2]),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.linksInput,
        chainSettings.linkBoneNames.join(', '),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.iterationsInput,
        String(chainSettings.iterationCount),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.blendInput,
        String(chainSettings.blendFactor),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.minAngleInput,
        String(chainSettings.minAngle),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.maxAngleInput,
        String(chainSettings.maxAngle),
        force
      );
      this._setFieldValueIfNotFocused(
        this._elements.toleranceInput,
        String(chainSettings.targetTolerance),
        force
      );
      this._elements.chainEnabledCheckbox.checked = !!chainSettings.enabled;
      this._isSyncingFormValues = false;
      this._updateTargetInputsVisibility();
    }

    private _withActiveObject(
      callback: (activeObject: IKConfigurableObject) => void
    ): boolean {
      const activeObject = this._getActiveIKObject();
      if (!activeObject) {
        this._setStatus('Select a 3D model with bones first.', true);
        return false;
      }
      this._activeObject = activeObject;
      try {
        callback(activeObject);
      } catch (error) {
        logger.error('IK panel action failed.', error);
        this._setStatus('IK operation failed.', true);
        return false;
      }
      return true;
    }

    private _persistCurrentIKState(force = false) {
      const activeObject = this._activeObject || this._getActiveIKObject();
      if (!activeObject) {
        return;
      }

      const objectName = activeObject.getName();
      const ikChainsJson = activeObject.exportIKChainsToJSON();
      const ikPosesJson = activeObject.exportIKPosesToJSON();
      const hasChanged =
        objectName !== this._lastPersistedObjectName ||
        ikChainsJson !== this._lastPersistedIKChainsJson ||
        ikPosesJson !== this._lastPersistedIKPosesJson;
      if (!hasChanged && !force) {
        return;
      }

      const persistNow = () => {
        this._persistTimeout = null;
        this._persistIKState(objectName, ikChainsJson, ikPosesJson);
        this._lastPersistedObjectName = objectName;
        this._lastPersistedIKChainsJson = ikChainsJson;
        this._lastPersistedIKPosesJson = ikPosesJson;
      };

      if (force) {
        if (this._persistTimeout !== null) {
          window.clearTimeout(this._persistTimeout);
          this._persistTimeout = null;
        }
        persistNow();
        return;
      }

      if (this._persistTimeout !== null) {
        return;
      }
      this._persistTimeout = window.setTimeout(persistNow, 180);
    }

    private _getChainNameFromForm(options?: {
      requireExistingChain?: boolean;
    }): string | null {
      if (!this._elements) return null;
      const chainName = (
        this._elements.chainNameInput.value.trim() ||
        this._elements.chainSelect.value.trim() ||
        this._selectedChainName
      ).trim();
      if (!chainName) {
        return null;
      }
      if (
        options &&
        options.requireExistingChain &&
        this._activeObject &&
        !this._activeObject.getIKChainNames().includes(chainName)
      ) {
        return null;
      }
      return chainName;
    }

    private _applyChainFromForm(options?: {
      skipStatus?: boolean;
      pinToCurrentEffector?: boolean;
    }) {
      if (!this._elements) return;
      const chainName = this._getChainNameFromForm();
      if (!chainName) {
        if (!(options && options.skipStatus)) {
          this._setStatus('Chain name is required.', true);
        }
        return;
      }
      const effectorBoneName = this._elements.effectorSelect.value.trim();
      if (!effectorBoneName) {
        if (!(options && options.skipStatus)) {
          this._setStatus('Choose an effector bone.', true);
        }
        return;
      }

      const targetMode =
        this._elements.targetModeSelect.value === 'position'
          ? ('position' as IKTargetMode)
          : ('bone' as IKTargetMode);
      const targetBoneName = this._elements.targetBoneSelect.value.trim();
      if (targetMode === 'bone' && !targetBoneName) {
        if (!(options && options.skipStatus)) {
          this._setStatus(
            'Choose a target bone or switch to position mode.',
            true
          );
        }
        return;
      }

      const fallbackSettings =
        this._activeObject &&
        this._activeObject.getIKChainSettings(
          this._selectedChainName || chainName
        );
      const iterationCount = Math.max(
        1,
        Math.round(
          this._parseNumber(
            this._elements.iterationsInput,
            fallbackSettings ? fallbackSettings.iterationCount : 12
          )
        )
      );
      const blendFactor = Math.max(
        0,
        Math.min(
          1,
          this._parseNumber(
            this._elements.blendInput,
            fallbackSettings ? fallbackSettings.blendFactor : 1
          )
        )
      );
      let minAngle = Math.max(
        0,
        this._parseNumber(
          this._elements.minAngleInput,
          fallbackSettings ? fallbackSettings.minAngle : 0
        )
      );
      let maxAngle = Math.max(
        0,
        this._parseNumber(
          this._elements.maxAngleInput,
          fallbackSettings ? fallbackSettings.maxAngle : 180
        )
      );
      if (maxAngle > 0 && minAngle > maxAngle) {
        const temp = minAngle;
        minAngle = maxAngle;
        maxAngle = temp;
      }
      const targetTolerance = Math.max(
        0.00001,
        this._parseNumber(
          this._elements.toleranceInput,
          fallbackSettings ? fallbackSettings.targetTolerance : 0.002
        )
      );
      const targetX = this._parseNumber(
        this._elements.targetXInput,
        fallbackSettings ? fallbackSettings.targetPosition[0] : 0
      );
      const targetY = this._parseNumber(
        this._elements.targetYInput,
        fallbackSettings ? fallbackSettings.targetPosition[1] : 0
      );
      const targetZ = this._parseNumber(
        this._elements.targetZInput,
        fallbackSettings ? fallbackSettings.targetPosition[2] : 0
      );

      const links = this._elements.linksInput.value.trim();
      const chainEnabled = this._elements.chainEnabledCheckbox.checked;
      const gizmosEnabled = this._elements.gizmosCheckbox.checked;

      const hasApplied = this._withActiveObject((activeObject) => {
        activeObject.configureIKChain(
          chainName,
          effectorBoneName,
          targetMode === 'bone' ? targetBoneName : '',
          links,
          iterationCount,
          blendFactor,
          minAngle,
          maxAngle
        );
        if (targetMode === 'bone') {
          activeObject.setIKTargetBone(chainName, targetBoneName);
        } else {
          activeObject.setIKTargetPosition(
            chainName,
            targetX,
            targetY,
            targetZ
          );
        }
        activeObject.setIKEnabled(chainName, chainEnabled);
        activeObject.setIKIterationCount(chainName, iterationCount);
        activeObject.setIKBlendFactor(chainName, blendFactor);
        activeObject.setIKAngleLimits(chainName, minAngle, maxAngle);
        activeObject.setIKTargetTolerance(chainName, targetTolerance);
        activeObject.setIKGizmosEnabled(gizmosEnabled);
        if (options && options.pinToCurrentEffector) {
          activeObject.pinIKTargetToCurrentEffector(chainName);
        }
      });
      if (!hasApplied) {
        return;
      }

      this._selectedChainName = chainName;
      this._lastChainSignature = '';
      this._persistCurrentIKState(options ? !!options.skipStatus : false);
      if (!(options && options.skipStatus)) {
        this._setStatus(`Applied chain "${chainName}".`);
      }
      this._applyCurrentChainSettingsToForm(true);
    }

    private _removeCurrentChain() {
      const chainName = this._getChainNameFromForm({
        requireExistingChain: true,
      });
      if (!chainName) {
        this._setStatus('Select an existing chain to remove.', true);
        return;
      }

      if (
        !this._withActiveObject((activeObject) => {
          activeObject.removeIKChain(chainName);
        })
      ) {
        return;
      }

      this._selectedChainName = '';
      this._lastChainSignature = '';
      this._persistCurrentIKState(true);
      this._setStatus(`Removed chain "${chainName}".`);
    }

    private _clearChains() {
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.clearIKChains();
        })
      ) {
        return;
      }
      this._selectedChainName = '';
      this._lastChainSignature = '';
      this._persistCurrentIKState(true);
      this._setStatus('Cleared all IK chains.');
    }

    private _createChainFromSelectedBone() {
      if (!this._elements) return;
      const selectedBoneName = this._getSelectedBoneName();
      if (!selectedBoneName) {
        this._setStatus('Select a bone handle first.', true);
        return;
      }

      this._elements.effectorSelect.value = selectedBoneName;
      if (!this._elements.chainNameInput.value.trim()) {
        this._elements.chainNameInput.value = `chain_${selectedBoneName}`;
      }
      this._elements.targetModeSelect.value = 'position';
      this._updateTargetInputsVisibility();
      this._applyChainFromForm({
        pinToCurrentEffector: true,
      });
    }

    private _setEffectorFromSelectedBone() {
      if (!this._elements) return;
      const selectedBoneName = this._getSelectedBoneName();
      if (!selectedBoneName) {
        this._setStatus('Select a bone handle first.', true);
        return;
      }
      const hasBoneOption = Array.from(
        this._elements.effectorSelect.options
      ).some((option) => option.value === selectedBoneName);
      if (!hasBoneOption) {
        this._setStatus('Selected bone is not part of this model.', true);
        return;
      }
      this._elements.effectorSelect.value = selectedBoneName;
      if (!this._elements.chainNameInput.value.trim()) {
        this._elements.chainNameInput.value = `chain_${selectedBoneName}`;
      }
      this._applyChainFromForm({
        skipStatus: true,
      });
      this._setStatus(`Effector set to "${selectedBoneName}".`);
    }

    private _setTargetFromSelectedBone() {
      if (!this._elements) return;
      const selectedBoneName = this._getSelectedBoneName();
      if (!selectedBoneName) {
        this._setStatus('Select a bone handle first.', true);
        return;
      }
      const hasBoneOption = Array.from(
        this._elements.targetBoneSelect.options
      ).some((option) => option.value === selectedBoneName);
      if (!hasBoneOption) {
        this._setStatus('Selected bone is not part of this model.', true);
        return;
      }
      this._elements.targetModeSelect.value = 'bone';
      this._elements.targetBoneSelect.value = selectedBoneName;
      this._updateTargetInputsVisibility();
      this._applyChainFromForm({
        skipStatus: true,
      });
      this._setStatus(`Target set to "${selectedBoneName}".`);
    }

    private _pinCurrentChain() {
      const chainName = this._getChainNameFromForm({
        requireExistingChain: true,
      });
      if (!chainName) {
        this._setStatus('Select an existing chain to pin.', true);
        return;
      }
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.pinIKTargetToCurrentEffector(chainName);
        })
      ) {
        return;
      }
      this._persistCurrentIKState(true);
      this._setStatus(`Pinned "${chainName}" target to current effector.`);
    }

    private _pinAllChains() {
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.pinAllIKTargetsToCurrentEffectors();
        })
      ) {
        return;
      }
      this._persistCurrentIKState(true);
      this._setStatus('Pinned all IK targets to current effectors.');
    }

    private _savePose() {
      if (!this._elements) return;
      const poseName = this._elements.poseNameInput.value.trim();
      if (!poseName) {
        this._setStatus('Pose name is required.', true);
        return;
      }
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.saveIKPose(poseName);
        })
      ) {
        return;
      }
      this._persistCurrentIKState(true);
      this._setStatus(`Saved pose "${poseName}".`);
    }

    private _applyPose() {
      if (!this._elements) return;
      const poseName = this._elements.poseNameInput.value.trim();
      if (!poseName) {
        this._setStatus('Pose name is required.', true);
        return;
      }
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.applyIKPose(poseName);
        })
      ) {
        return;
      }
      this._setStatus(`Applied pose "${poseName}".`);
    }

    private _removePose() {
      if (!this._elements) return;
      const poseName = this._elements.poseNameInput.value.trim();
      if (!poseName) {
        this._setStatus('Pose name is required.', true);
        return;
      }
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.removeIKPose(poseName);
        })
      ) {
        return;
      }
      this._persistCurrentIKState(true);
      this._setStatus(`Removed pose "${poseName}".`);
    }

    private _clearPoses() {
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.clearIKPoses();
        })
      ) {
        return;
      }
      this._persistCurrentIKState(true);
      this._setStatus('Cleared all poses.');
    }

    private _exportPosesToJson() {
      if (!this._elements) return;
      if (
        !this._withActiveObject((activeObject) => {
          this._elements!.jsonTextarea.value =
            activeObject.exportIKPosesToJSON();
        })
      ) {
        return;
      }
      this._setStatus('Exported poses to JSON.');
    }

    private _importPosesFromJson(clearExisting: boolean) {
      if (!this._elements) return;
      const json = this._elements.jsonTextarea.value.trim();
      if (!json) {
        this._setStatus('Paste JSON before importing.', true);
        return;
      }
      if (
        !this._withActiveObject((activeObject) => {
          activeObject.importIKPosesFromJSON(json, clearExisting);
        })
      ) {
        return;
      }
      this._persistCurrentIKState(true);
      this._setStatus(
        clearExisting
          ? 'Imported poses (replaced existing).'
          : 'Imported poses (merged).'
      );
    }

    private _createRootIfNeeded() {
      if (this._root) return;

      const makeInput = (type = 'text', placeholder = ''): HTMLInputElement => {
        const input = h('input', {
          class: 'InGameEditor-IKPanel-Input',
          type,
          placeholder,
        }) as HTMLInputElement;
        return input;
      };
      const makeSelect = (): HTMLSelectElement =>
        h('select', {
          class: 'InGameEditor-IKPanel-Select',
        }) as HTMLSelectElement;
      const makeButton = (label: string): HTMLButtonElement =>
        h(
          'button',
          {
            class: 'InGameEditor-IKPanel-Button',
            type: 'button',
          },
          label
        ) as HTMLButtonElement;
      const makeSection = (title: string): HTMLDivElement =>
        h(
          'div',
          {
            class: 'InGameEditor-IKPanel-Section',
          },
          h('div', { class: 'InGameEditor-IKPanel-SectionTitle' }, title)
        ) as HTMLDivElement;
      const makeRow = (
        label: string,
        ...children: HTMLElement[]
      ): HTMLDivElement =>
        h(
          'div',
          {
            class: 'InGameEditor-IKPanel-Row',
          },
          h('div', { class: 'InGameEditor-IKPanel-Label' }, label),
          ...children
        ) as HTMLDivElement;

      const root = h('div', {
        class: 'InGameEditor-IKPanel-Root',
      }) as HTMLDivElement;
      const card = h('div', {
        class: 'InGameEditor-IKPanel-Card',
      }) as HTMLDivElement;
      root.appendChild(card);
      this._root = root;

      const objectLabel = h(
        'span',
        { class: 'InGameEditor-IKPanel-Subtle' },
        ''
      ) as HTMLSpanElement;
      const chainCountLabel = h(
        'span',
        { class: 'InGameEditor-IKPanel-Subtle' },
        '0 chains'
      ) as HTMLSpanElement;
      const poseCountLabel = h(
        'span',
        { class: 'InGameEditor-IKPanel-Subtle' },
        '0 poses'
      ) as HTMLSpanElement;
      card.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Header' },
          h('span', {}, 'IK Rig'),
          objectLabel
        )
      );
      card.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Hint' },
          'Select a skinned 3D model, click a bone, then create a chain. Moving the IK target updates the preview immediately, stays saved on the object, and saved poses now restore both bones and IK targets.'
        )
      );

      const modeCheckbox = h('input', {
        type: 'checkbox',
      }) as HTMLInputElement;
      card.appendChild(
        h(
          'label',
          { class: 'InGameEditor-IKPanel-Checkbox' },
          modeCheckbox,
          h('span', {}, 'Enable IK mode')
        )
      );

      const chainSection = makeSection('Chains');
      card.appendChild(chainSection);
      chainSection.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Header' },
          h('span', {}, 'Active Chain'),
          chainCountLabel
        )
      );
      const chainSelect = makeSelect();
      const createChainFromSelectedButton = makeButton('New from selected');
      createChainFromSelectedButton.classList.add(
        'InGameEditor-IKPanel-Button-Primary'
      );
      const removeChainButton = makeButton('Remove');
      const clearChainsButton = makeButton('Clear all');
      const chainNameInput = makeInput('text', 'chain_name');
      chainSection.appendChild(makeRow('Select', chainSelect));
      chainSection.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Grid-3' },
          createChainFromSelectedButton,
          removeChainButton,
          clearChainsButton
        )
      );
      chainSection.appendChild(makeRow('Name', chainNameInput));

      const effectorSelect = makeSelect();
      const setEffectorFromSelectedButton = makeButton('From selected');
      chainSection.appendChild(
        makeRow('Effector', effectorSelect, setEffectorFromSelectedButton)
      );

      const targetModeSelect = makeSelect();
      const targetModeBoneOption = document.createElement('option');
      targetModeBoneOption.value = 'bone';
      targetModeBoneOption.textContent = 'Bone';
      targetModeSelect.appendChild(targetModeBoneOption);
      const targetModePositionOption = document.createElement('option');
      targetModePositionOption.value = 'position';
      targetModePositionOption.textContent = 'Position';
      targetModeSelect.appendChild(targetModePositionOption);
      chainSection.appendChild(makeRow('Target', targetModeSelect));

      const targetBoneSelect = makeSelect();
      const setTargetFromSelectedButton = makeButton('From selected');
      chainSection.appendChild(
        makeRow('Target Bone', targetBoneSelect, setTargetFromSelectedButton)
      );

      const targetXInput = makeInput('number');
      targetXInput.step = '0.01';
      targetXInput.placeholder = 'X';
      const targetYInput = makeInput('number');
      targetYInput.step = '0.01';
      targetYInput.placeholder = 'Y';
      const targetZInput = makeInput('number');
      targetZInput.step = '0.01';
      targetZInput.placeholder = 'Z';
      const targetPositionRow = h(
        'div',
        {
          class: 'InGameEditor-IKPanel-Grid-3',
        },
        targetXInput,
        targetYInput,
        targetZInput
      ) as HTMLDivElement;
      chainSection.appendChild(makeRow('Target Pos', targetPositionRow));

      const linksInput = makeInput('text', 'upperarm, forearm');

      const iterationsInput = makeInput('number');
      iterationsInput.min = '1';
      iterationsInput.step = '1';
      const blendInput = makeInput('number');
      blendInput.min = '0';
      blendInput.max = '1';
      blendInput.step = '0.01';

      const minAngleInput = makeInput('number');
      minAngleInput.min = '0';
      minAngleInput.max = '180';
      minAngleInput.step = '1';
      const maxAngleInput = makeInput('number');
      maxAngleInput.min = '0';
      maxAngleInput.max = '180';
      maxAngleInput.step = '1';
      const toleranceInput = makeInput('number');
      toleranceInput.min = '0';
      toleranceInput.step = '0.0001';

      const chainEnabledCheckbox = h('input', {
        type: 'checkbox',
      }) as HTMLInputElement;
      const gizmosCheckbox = h('input', {
        type: 'checkbox',
      }) as HTMLInputElement;
      chainSection.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Row' },
          h(
            'label',
            { class: 'InGameEditor-IKPanel-Checkbox' },
            chainEnabledCheckbox,
            h('span', {}, 'Chain enabled')
          ),
          h(
            'label',
            { class: 'InGameEditor-IKPanel-Checkbox' },
            gizmosCheckbox,
            h('span', {}, 'Show gizmos')
          )
        )
      );

      const applyChainButton = makeButton('Apply chain');
      const pinChainButton = makeButton('Pin chain target');
      const pinAllButton = makeButton('Pin all targets');
      chainSection.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Grid-2' },
          pinChainButton,
          pinAllButton
        )
      );
      const advancedChainDetails = h(
        'details',
        { class: 'InGameEditor-IKPanel-Details' },
        h('summary', {}, 'Advanced chain options')
      ) as HTMLDetailsElement;
      const advancedChainContent = h('div', {
        class: 'InGameEditor-IKPanel-DetailsContent',
      }) as HTMLDivElement;
      advancedChainDetails.appendChild(advancedChainContent);
      advancedChainContent.appendChild(makeRow('Links', linksInput));
      advancedChainContent.appendChild(
        makeRow(
          'Solver',
          h(
            'div',
            { class: 'InGameEditor-IKPanel-Grid-2' },
            iterationsInput,
            blendInput
          )
        )
      );
      advancedChainContent.appendChild(
        makeRow(
          'Limits',
          h(
            'div',
            { class: 'InGameEditor-IKPanel-Grid-3' },
            minAngleInput,
            maxAngleInput,
            toleranceInput
          )
        )
      );
      advancedChainContent.appendChild(applyChainButton);
      chainSection.appendChild(advancedChainDetails);

      const poseSection = makeSection('Poses');
      card.appendChild(poseSection);
      poseSection.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Header' },
          h('span', {}, 'Library'),
          poseCountLabel
        )
      );
      const poseSelect = makeSelect();
      poseSection.appendChild(makeRow('Saved', poseSelect));
      const poseNameInput = makeInput('text', 'pose_name');
      poseSection.appendChild(makeRow('Pose', poseNameInput));
      const savePoseButton = makeButton('Save pose');
      const applyPoseButton = makeButton('Apply pose');
      const removePoseButton = makeButton('Remove pose');
      const clearPosesButton = makeButton('Clear poses');
      poseSection.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Grid-2' },
          savePoseButton,
          applyPoseButton,
          removePoseButton,
          clearPosesButton
        )
      );

      const jsonTextarea = h('textarea', {
        class: 'InGameEditor-IKPanel-Textarea',
        placeholder: 'IK pose JSON...',
      }) as HTMLTextAreaElement;
      const exportJsonButton = makeButton('Export JSON');
      const importReplaceButton = makeButton('Import (replace)');
      const importMergeButton = makeButton('Import (merge)');
      const advancedPoseDetails = h(
        'details',
        { class: 'InGameEditor-IKPanel-Details' },
        h('summary', {}, 'Pose JSON import/export')
      ) as HTMLDetailsElement;
      const advancedPoseContent = h('div', {
        class: 'InGameEditor-IKPanel-DetailsContent',
      }) as HTMLDivElement;
      advancedPoseDetails.appendChild(advancedPoseContent);
      advancedPoseContent.appendChild(jsonTextarea);
      advancedPoseContent.appendChild(
        h(
          'div',
          { class: 'InGameEditor-IKPanel-Grid-3' },
          exportJsonButton,
          importReplaceButton,
          importMergeButton
        )
      );
      poseSection.appendChild(advancedPoseDetails);

      const statusLabel = h(
        'div',
        { class: 'InGameEditor-IKPanel-Status', 'data-is-error': '0' },
        ''
      ) as HTMLDivElement;
      card.appendChild(statusLabel);

      this._elements = {
        objectLabel,
        chainCountLabel,
        modeCheckbox,
        chainSelect,
        createChainFromSelectedButton,
        chainNameInput,
        effectorSelect,
        targetModeSelect,
        targetBoneSelect,
        targetPositionRow,
        targetXInput,
        targetYInput,
        targetZInput,
        linksInput,
        iterationsInput,
        blendInput,
        minAngleInput,
        maxAngleInput,
        toleranceInput,
        chainEnabledCheckbox,
        gizmosCheckbox,
        poseSelect,
        poseNameInput,
        poseCountLabel,
        jsonTextarea,
        statusLabel,
        applyChainButton,
        removeChainButton,
        clearChainsButton,
        setEffectorFromSelectedButton,
        setTargetFromSelectedButton,
        pinChainButton,
        pinAllButton,
        savePoseButton,
        applyPoseButton,
        removePoseButton,
        clearPosesButton,
        exportJsonButton,
        importReplaceButton,
        importMergeButton,
      };

      const stopEvent = (event: Event) => {
        event.stopPropagation();
      };
      [
        'pointerdown',
        'pointerup',
        'mousedown',
        'mouseup',
        'click',
        'dblclick',
        'contextmenu',
        'wheel',
      ].forEach((eventName) => {
        root.addEventListener(eventName, stopEvent);
      });

      modeCheckbox.addEventListener('change', () => {
        this._setIKModeEnabled(modeCheckbox.checked);
      });
      chainSelect.addEventListener('change', () => {
        if (this._isSyncingFormValues) return;
        this._selectedChainName = chainSelect.value.trim();
        this._setFieldValueIfNotFocused(
          chainNameInput,
          this._selectedChainName,
          true
        );
        this._applyCurrentChainSettingsToForm(true);
      });
      const applyChainLive = () => {
        if (this._isSyncingFormValues) return;
        this._applyChainFromForm({
          skipStatus: true,
        });
      };
      const applyChainNameFromInput = () => {
        if (this._isSyncingFormValues) return;
        this._applyChainFromForm();
      };
      chainNameInput.addEventListener('blur', applyChainNameFromInput);
      chainNameInput.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter') {
          event.preventDefault();
          applyChainNameFromInput();
        }
      });
      targetModeSelect.addEventListener('change', () => {
        this._updateTargetInputsVisibility();
        applyChainLive();
      });
      effectorSelect.addEventListener('change', applyChainLive);
      targetBoneSelect.addEventListener('change', applyChainLive);
      targetXInput.addEventListener('change', applyChainLive);
      targetYInput.addEventListener('change', applyChainLive);
      targetZInput.addEventListener('change', applyChainLive);
      linksInput.addEventListener('change', applyChainLive);
      iterationsInput.addEventListener('change', applyChainLive);
      blendInput.addEventListener('change', applyChainLive);
      minAngleInput.addEventListener('change', applyChainLive);
      maxAngleInput.addEventListener('change', applyChainLive);
      toleranceInput.addEventListener('change', applyChainLive);
      chainEnabledCheckbox.addEventListener('change', applyChainLive);
      gizmosCheckbox.addEventListener('change', applyChainLive);

      createChainFromSelectedButton.addEventListener('click', () =>
        this._createChainFromSelectedBone()
      );
      applyChainButton.addEventListener('click', () =>
        this._applyChainFromForm()
      );
      removeChainButton.addEventListener('click', () =>
        this._removeCurrentChain()
      );
      clearChainsButton.addEventListener('click', () => this._clearChains());
      setEffectorFromSelectedButton.addEventListener('click', () =>
        this._setEffectorFromSelectedBone()
      );
      setTargetFromSelectedButton.addEventListener('click', () =>
        this._setTargetFromSelectedBone()
      );
      pinChainButton.addEventListener('click', () => this._pinCurrentChain());
      pinAllButton.addEventListener('click', () => this._pinAllChains());

      savePoseButton.addEventListener('click', () => this._savePose());
      applyPoseButton.addEventListener('click', () => this._applyPose());
      removePoseButton.addEventListener('click', () => this._removePose());
      clearPosesButton.addEventListener('click', () => this._clearPoses());
      poseSelect.addEventListener('change', () => {
        if (this._isSyncingFormValues) return;
        this._setFieldValueIfNotFocused(
          poseNameInput,
          poseSelect.value.trim(),
          true
        );
      });
      exportJsonButton.addEventListener('click', () =>
        this._exportPosesToJson()
      );
      importReplaceButton.addEventListener('click', () =>
        this._importPosesFromJson(true)
      );
      importMergeButton.addEventListener('click', () =>
        this._importPosesFromJson(false)
      );
    }

    render(parent: HTMLElement) {
      this._createRootIfNeeded();
      if (!this._root || !this._elements) return;

      if (this._parent !== parent || this._root.parentElement !== parent) {
        this._root.remove();
        parent.appendChild(this._root);
        this._parent = parent;
      }

      const activeObject = this._getActiveIKObject();
      const isIKModeEnabled = this._isIKModeEnabled();
      this._elements.modeCheckbox.checked = isIKModeEnabled;
      if (!isIKModeEnabled || !activeObject) {
        this._activeObject = null;
        this._root.style.display = 'none';
        return;
      }

      this._root.style.display = 'block';
      const hasObjectChanged = activeObject !== this._activeObject;
      if (hasObjectChanged) {
        this._selectedChainName = '';
        this._lastChainSignature = '';
        this._lastBoneSignature = '';
        this._lastPoseSignature = '';
        this._setStatus('');
      }
      this._activeObject = activeObject;
      this._elements.objectLabel.textContent = activeObject.getName();

      const chainNames = activeObject.getIKChainNames();
      const chainSignature = this._chainSignature(chainNames);
      const hasChainListChanged =
        hasObjectChanged || chainSignature !== this._lastChainSignature;
      if (hasChainListChanged) {
        this._lastChainSignature = chainSignature;
        this._syncSelectOptions(this._elements.chainSelect, chainNames, {
          allowEmptyOption: true,
          emptyOptionLabel: 'Select chain',
        });
      }

      if (
        this._selectedChainName &&
        !chainNames.includes(this._selectedChainName)
      ) {
        this._selectedChainName = '';
      }
      if (!this._selectedChainName && chainNames.length > 0) {
        this._selectedChainName = chainNames[0];
      }

      if (this._selectedChainName) {
        this._setFieldValueIfNotFocused(
          this._elements.chainSelect,
          this._selectedChainName,
          true
        );
      } else if (this._elements.chainSelect.value) {
        this._selectedChainName = this._elements.chainSelect.value;
      }

      const boneNames = activeObject.getIKBoneNames();
      const boneSignature = this._chainSignature(boneNames);
      if (hasObjectChanged || boneSignature !== this._lastBoneSignature) {
        this._lastBoneSignature = boneSignature;
        this._syncSelectOptions(this._elements.effectorSelect, boneNames, {
          allowEmptyOption: true,
          emptyOptionLabel: 'Select bone',
        });
        this._syncSelectOptions(this._elements.targetBoneSelect, boneNames, {
          allowEmptyOption: true,
          emptyOptionLabel: 'Select bone',
        });
      }

      this._elements.chainCountLabel.textContent = `${chainNames.length} chains`;
      const poseNames = activeObject.getIKPoseNames();
      const poseSignature = this._chainSignature(poseNames);
      if (hasObjectChanged || poseSignature !== this._lastPoseSignature) {
        this._lastPoseSignature = poseSignature;
        this._syncSelectOptions(this._elements.poseSelect, poseNames, {
          allowEmptyOption: true,
          emptyOptionLabel: 'Select pose',
        });
      }
      this._elements.poseCountLabel.textContent = `${poseNames.length} poses`;
      this._elements.gizmosCheckbox.checked =
        !!activeObject.areIKGizmosEnabled();

      this._applyCurrentChainSettingsToForm(
        hasObjectChanged || hasChainListChanged
      );

      const hasSelectedChain =
        !!this._selectedChainName &&
        chainNames.includes(this._selectedChainName);
      const selectedBoneName = this._getSelectedBoneName();
      this._elements.createChainFromSelectedButton.disabled = !selectedBoneName;
      this._elements.setEffectorFromSelectedButton.disabled = !selectedBoneName;
      this._elements.removeChainButton.disabled = !hasSelectedChain;
      this._elements.clearChainsButton.disabled = chainNames.length === 0;
      this._elements.pinChainButton.disabled = !hasSelectedChain;
      this._elements.applyChainButton.disabled =
        !this._elements.chainNameInput.value.trim() ||
        !this._elements.effectorSelect.value.trim();
      const poseName = this._elements.poseNameInput.value.trim();
      this._setFieldValueIfNotFocused(
        this._elements.poseSelect,
        poseNames.includes(poseName) ? poseName : '',
        true
      );
      this._elements.applyPoseButton.disabled = !poseName;
      this._elements.removePoseButton.disabled = !poseName;
      this._elements.clearPosesButton.disabled = poseNames.length === 0;
      this._persistCurrentIKState();
    }
  }

  class Toolbar {
    private _renderedElements: {
      container: HTMLDivElement;
      moveButton: HTMLButtonElement;
      rotateButton: HTMLButtonElement;
      scaleButton: HTMLButtonElement;
      ikModeButton: HTMLButtonElement;
      spaceButton: HTMLButtonElement;
      spaceButtonLabel: HTMLSpanElement;
      translationSnapButton: HTMLButtonElement;
      translationSnapDecreaseButton: HTMLButtonElement;
      translationSnapIncreaseButton: HTMLButtonElement;
      translationSnapValueLabel: HTMLSpanElement;
      rotationSnapButton: HTMLButtonElement;
      rotationSnapDecreaseButton: HTMLButtonElement;
      rotationSnapIncreaseButton: HTMLButtonElement;
      rotationSnapValueLabel: HTMLSpanElement;
      scaleSnapButton: HTMLButtonElement;
      scaleSnapDecreaseButton: HTMLButtonElement;
      scaleSnapIncreaseButton: HTMLButtonElement;
      scaleSnapValueLabel: HTMLSpanElement;
      focusButton: HTMLButtonElement;
      freeCameraButton: HTMLButtonElement;
      orbitCameraButton: HTMLButtonElement;
    } | null = null;
    private _parent: HTMLElement | null = null;
    private _getTransformControlsMode: () => 'translate' | 'rotate' | 'scale';
    private _setTransformControlsMode: (
      mode: 'translate' | 'rotate' | 'scale'
    ) => void;
    private _getTransformControlsSpace: () => 'local' | 'world';
    private _toggleTransformControlsSpace: () => void;
    private _isTranslationSnapEnabled: () => boolean;
    private _isRotationSnapEnabled: () => boolean;
    private _isScaleSnapEnabled: () => boolean;
    private _getTranslationSnapStep: () => number;
    private _getRotationSnapDegrees: () => number;
    private _getScaleSnapStep: () => number;
    private _toggleTranslationSnap: () => void;
    private _toggleRotationSnap: () => void;
    private _toggleScaleSnap: () => void;
    private _decreaseTranslationSnapStep: (event?: MouseEvent) => void;
    private _increaseTranslationSnapStep: (event?: MouseEvent) => void;
    private _decreaseRotationSnapDegrees: (event?: MouseEvent) => void;
    private _increaseRotationSnapDegrees: (event?: MouseEvent) => void;
    private _decreaseScaleSnapStep: (event?: MouseEvent) => void;
    private _increaseScaleSnapStep: (event?: MouseEvent) => void;
    private _focusOnSelection: () => void;
    private _switchToFreeCamera: () => void;
    private _switchToOrbitCamera: () => void;
    private _isFreeCamera: () => boolean;
    private _isIKModeEnabled: () => boolean;
    private _toggleIKMode: () => void;
    private _hasIKTargetSelection: () => boolean;
    private _getSvgIconUrl: (iconName: string) => string;
    private _hasSelection: () => boolean;
    private _hasSelectionControlsShown: () => boolean;
    private _hasEditableSelection: () => boolean;
    private _getSelectionTransformValues: () => SelectionTransformValues | null;

    private addOrUpdateToolbarStyle() {
      const id = 'InGameEditor-Toolbar-Style';

      let styleElement = document.getElementById(id);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'InGameEditor-Toolbar-Style';
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = `
        .InGameEditor-Toolbar-Centering-Container {
          position: absolute;
          left: 0;
          right: 0;
          top: max(4px, env(safe-area-inset-top));
          z-index: 15;
          width: 100%;
          padding: 0 6px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          transition: transform 0.1s ease-in-out;
        }
        .InGameEditor-Toolbar-Container {
          --in-game-editor-toolbar-scale: 0.88;
          --in-game-editor-toolbar-button-size: calc(28px * var(--in-game-editor-toolbar-scale));
          --in-game-editor-toolbar-icon-size: calc(18px * var(--in-game-editor-toolbar-scale));
          --in-game-editor-toolbar-step-button-width: calc(17px * var(--in-game-editor-toolbar-scale));
          --in-game-editor-toolbar-text-button-min-width: calc(38px * var(--in-game-editor-toolbar-scale));
          --in-game-editor-toolbar-snap-button-min-width: calc(48px * var(--in-game-editor-toolbar-scale));
          position: relative;
          pointer-events: auto;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          max-width: min(calc(100% - 10px), 1120px);
          width: fit-content;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          top: 0;
          border-radius: calc(12px * var(--in-game-editor-toolbar-scale));
          padding: calc(5px * var(--in-game-editor-toolbar-scale))
            calc(8px * var(--in-game-editor-toolbar-scale));
          gap: calc(7px * var(--in-game-editor-toolbar-scale));
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .InGameEditor-Toolbar-Container::-webkit-scrollbar {
          display: none;
        }
        .InGameEditor-Toolbar-Group {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: calc(6px * var(--in-game-editor-toolbar-scale));
        }
        .InGameEditor-Toolbar-Group-Label {
          color: var(--in-game-editor-theme-text-color-primary);
          opacity: 0.76;
          font-size: calc(10px * var(--in-game-editor-toolbar-scale));
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          line-height: 1;
          padding: 0 2px;
          user-select: none;
          pointer-events: none;
        }
        .InGameEditor-Toolbar-Container-Background {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(0, 0, 0, 0.14)
          ), var(--in-game-editor-theme-toolbar-background-color);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: calc(12px * var(--in-game-editor-toolbar-scale));
          backdrop-filter: blur(6px);
          z-index: -1;
        }
        .InGameEditor-Toolbar-Button {
          width: var(--in-game-editor-toolbar-button-size);
          height: var(--in-game-editor-toolbar-button-size);
          border-radius: calc(8px * var(--in-game-editor-toolbar-scale));
          border: 1px solid transparent;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: transparent;
          transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
        }
        .InGameEditor-Toolbar-Button-Icon {
          width: var(--in-game-editor-toolbar-icon-size);
          height: var(--in-game-editor-toolbar-icon-size);
          display:inline-block;
          background-color: var(--in-game-editor-theme-text-color-primary);
        }
        .InGameEditor-Toolbar-Button-Text {
          width: auto;
          min-width: var(--in-game-editor-toolbar-text-button-min-width);
          padding: 0 calc(8px * var(--in-game-editor-toolbar-scale));
        }
        .InGameEditor-Toolbar-SnapControl {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: calc(2px * var(--in-game-editor-toolbar-scale));
        }
        .InGameEditor-Toolbar-Button-Step {
          width: var(--in-game-editor-toolbar-step-button-width);
          height: var(--in-game-editor-toolbar-button-size);
          border-radius: calc(6px * var(--in-game-editor-toolbar-scale));
          font-size: calc(11px * var(--in-game-editor-toolbar-scale));
          font-weight: 700;
          color: var(--in-game-editor-theme-text-color-primary);
        }
        .InGameEditor-Toolbar-Button-Snap {
          min-width: var(--in-game-editor-toolbar-snap-button-min-width);
          height: var(--in-game-editor-toolbar-button-size);
          padding: calc(2px * var(--in-game-editor-toolbar-scale))
            calc(7px * var(--in-game-editor-toolbar-scale));
          flex-direction: column;
          gap: calc(2px * var(--in-game-editor-toolbar-scale));
        }
        .InGameEditor-Toolbar-Button-Label {
          color: var(--in-game-editor-theme-text-color-primary);
          font-size: calc(10px * var(--in-game-editor-toolbar-scale));
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          line-height: 1;
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
        }
        .InGameEditor-Toolbar-Button-Value {
          color: var(--in-game-editor-theme-text-color-primary);
          font-size: calc(9px * var(--in-game-editor-toolbar-scale));
          opacity: 0.85;
          font-weight: 700;
          line-height: 1;
          user-select: none;
          pointer-events: none;
        }
        .InGameEditor-Toolbar-Button:hover:not(.InGameEditor-Toolbar-Button-Active):not(.InGameEditor-Toolbar-Button-Disabled) {
          background-color: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.24);
        }
        .InGameEditor-Toolbar-Button-Active {
          background-color: var(--in-game-editor-theme-icon-button-selected-background-color);
          border-color: rgba(255, 255, 255, 0.32);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15),
                      0 0 8px 0 rgba(100, 180, 255, 0.15);
        }
        .InGameEditor-Toolbar-Button-Active .InGameEditor-Toolbar-Button-Icon {
          background-color: var(--in-game-editor-theme-icon-button-selected-color);
        }
        .InGameEditor-Toolbar-Button-Active .InGameEditor-Toolbar-Button-Label {
          color: var(--in-game-editor-theme-icon-button-selected-color);
        }
        .InGameEditor-Toolbar-Button-Active .InGameEditor-Toolbar-Button-Value {
          color: var(--in-game-editor-theme-icon-button-selected-color);
          opacity: 1;
        }
        .InGameEditor-Toolbar-Button-Shortcut {
          position: absolute;
          bottom: calc(1px * var(--in-game-editor-toolbar-scale));
          right: calc(1px * var(--in-game-editor-toolbar-scale));
          font-size: calc(8px * var(--in-game-editor-toolbar-scale));
          font-weight: 700;
          line-height: 1;
          color: rgba(255, 255, 255, 0.45);
          background: rgba(0, 0, 0, 0.35);
          border-radius: calc(3px * var(--in-game-editor-toolbar-scale));
          padding: calc(1px * var(--in-game-editor-toolbar-scale)) calc(3px * var(--in-game-editor-toolbar-scale));
          pointer-events: none;
          user-select: none;
        }
        .InGameEditor-Toolbar-Button-Active .InGameEditor-Toolbar-Button-Shortcut {
          color: rgba(255, 255, 255, 0.7);
          background: rgba(0, 0, 0, 0.5);
        }
        .InGameEditor-Toolbar-Button {
          position: relative;
        }
        .InGameEditor-Toolbar-Button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.85);
          outline-offset: 1px;
        }
        .InGameEditor-Toolbar-Button-Disabled,
        .InGameEditor-Toolbar-Button:disabled {
          opacity: 0.45;
          border-color: transparent;
          cursor: default;
          transform: none;
        }
        .InGameEditor-Toolbar-Button-Disabled:hover,
        .InGameEditor-Toolbar-Button:disabled:hover {
          background-color: transparent;
        }
        .InGameEditor-Toolbar-Divider {
          width: 1px;
          height: calc(28px * var(--in-game-editor-toolbar-scale));
          opacity: 0.7;
          background-color: var(--in-game-editor-theme-toolbar-separator-color);
        }
        @media (max-width: 1320px) {
          .InGameEditor-Toolbar-Container {
            --in-game-editor-toolbar-scale: 0.82;
          }
        }
        @media (max-width: 1080px) {
          .InGameEditor-Toolbar-Container {
            --in-game-editor-toolbar-scale: 0.76;
          }
        }
        @media (max-width: 840px) {
          .InGameEditor-Toolbar-Container {
            --in-game-editor-toolbar-scale: 0.7;
          }
          .InGameEditor-Toolbar-Centering-Container {
            padding: 0 3px;
          }
          .InGameEditor-Toolbar-Group-Label {
            display: none;
          }
        }
      `;
    }

    private _formatSnapValue(value: number): string {
      if (!Number.isFinite(value)) return '0';
      if (Math.abs(value - Math.round(value)) < 0.0001) {
        return String(Math.round(value));
      }
      return value.toFixed(2).replace(/\.?0+$/, '');
    }

    private _setButtonDisabled(
      button: HTMLButtonElement,
      disabled: boolean
    ): void {
      button.disabled = disabled;
      button.classList.toggle('InGameEditor-Toolbar-Button-Disabled', disabled);
    }

    constructor({
      getTransformControlsMode,
      setTransformControlsMode,
      getTransformControlsSpace,
      toggleTransformControlsSpace,
      isTranslationSnapEnabled,
      isRotationSnapEnabled,
      isScaleSnapEnabled,
      getTranslationSnapStep,
      getRotationSnapDegrees,
      getScaleSnapStep,
      toggleTranslationSnap,
      toggleRotationSnap,
      toggleScaleSnap,
      decreaseTranslationSnapStep,
      increaseTranslationSnapStep,
      decreaseRotationSnapDegrees,
      increaseRotationSnapDegrees,
      decreaseScaleSnapStep,
      increaseScaleSnapStep,
      focusOnSelection,
      switchToFreeCamera,
      switchToOrbitCamera,
      isFreeCamera,
      isIKModeEnabled,
      toggleIKMode,
      hasIKTargetSelection,
      getSvgIconUrl,
      hasSelection,
      hasSelectionControlsShown,
      hasEditableSelection,
      getSelectionTransformValues,
    }: {
      getTransformControlsMode: () => 'translate' | 'rotate' | 'scale';
      setTransformControlsMode: (
        mode: 'translate' | 'rotate' | 'scale'
      ) => void;
      getTransformControlsSpace: () => 'local' | 'world';
      toggleTransformControlsSpace: () => void;
      isTranslationSnapEnabled: () => boolean;
      isRotationSnapEnabled: () => boolean;
      isScaleSnapEnabled: () => boolean;
      getTranslationSnapStep: () => number;
      getRotationSnapDegrees: () => number;
      getScaleSnapStep: () => number;
      toggleTranslationSnap: () => void;
      toggleRotationSnap: () => void;
      toggleScaleSnap: () => void;
      decreaseTranslationSnapStep: (event?: MouseEvent) => void;
      increaseTranslationSnapStep: (event?: MouseEvent) => void;
      decreaseRotationSnapDegrees: (event?: MouseEvent) => void;
      increaseRotationSnapDegrees: (event?: MouseEvent) => void;
      decreaseScaleSnapStep: (event?: MouseEvent) => void;
      increaseScaleSnapStep: (event?: MouseEvent) => void;
      focusOnSelection: () => void;
      switchToFreeCamera: () => void;
      switchToOrbitCamera: () => void;
      isFreeCamera: () => boolean;
      isIKModeEnabled: () => boolean;
      toggleIKMode: () => void;
      hasIKTargetSelection: () => boolean;
      getSvgIconUrl: (iconName: string) => string;
      hasSelection: () => boolean;
      hasSelectionControlsShown: () => boolean;
      hasEditableSelection: () => boolean;
      getSelectionTransformValues: () => SelectionTransformValues | null;
    }) {
      this._getTransformControlsMode = getTransformControlsMode;
      this._setTransformControlsMode = setTransformControlsMode;
      this._getTransformControlsSpace = getTransformControlsSpace;
      this._toggleTransformControlsSpace = toggleTransformControlsSpace;
      this._isTranslationSnapEnabled = isTranslationSnapEnabled;
      this._isRotationSnapEnabled = isRotationSnapEnabled;
      this._isScaleSnapEnabled = isScaleSnapEnabled;
      this._getTranslationSnapStep = getTranslationSnapStep;
      this._getRotationSnapDegrees = getRotationSnapDegrees;
      this._getScaleSnapStep = getScaleSnapStep;
      this._toggleTranslationSnap = toggleTranslationSnap;
      this._toggleRotationSnap = toggleRotationSnap;
      this._toggleScaleSnap = toggleScaleSnap;
      this._decreaseTranslationSnapStep = decreaseTranslationSnapStep;
      this._increaseTranslationSnapStep = increaseTranslationSnapStep;
      this._decreaseRotationSnapDegrees = decreaseRotationSnapDegrees;
      this._increaseRotationSnapDegrees = increaseRotationSnapDegrees;
      this._decreaseScaleSnapStep = decreaseScaleSnapStep;
      this._increaseScaleSnapStep = increaseScaleSnapStep;
      this._focusOnSelection = focusOnSelection;
      this._switchToFreeCamera = switchToFreeCamera;
      this._switchToOrbitCamera = switchToOrbitCamera;
      this._isFreeCamera = isFreeCamera;
      this._isIKModeEnabled = isIKModeEnabled;
      this._toggleIKMode = toggleIKMode;
      this._hasIKTargetSelection = hasIKTargetSelection;
      this._getSvgIconUrl = getSvgIconUrl;
      this._hasSelection = hasSelection;
      this._hasSelectionControlsShown = hasSelectionControlsShown;
      this._hasEditableSelection = hasEditableSelection;
      this._getSelectionTransformValues = getSelectionTransformValues;

      this.addOrUpdateToolbarStyle();
    }

    render(parent: HTMLElement) {
      if (this._renderedElements && this._parent !== parent) {
        this._renderedElements.container.remove();
        this._renderedElements = null;
      }
      this._parent = parent;

      const makeIcon = ({ svgIconUrl }: { svgIconUrl: string }) => (
        <span
          class="InGameEditor-Toolbar-Button-Icon"
          style={{
            '-webkit-mask-image': `url('${svgIconUrl}')`,
            '-webkit-mask-position': 'center',
            '-webkit-mask-repeat': 'no-repeat',
            '-webkit-mask-size': 'var(--in-game-editor-toolbar-icon-size)',
            'mask-image': `url('${svgIconUrl}')`,
            'mask-position': 'center',
            'mask-repeat': 'no-repeat',
            'mask-size': 'var(--in-game-editor-toolbar-icon-size)',
          }}
        ></span>
      );

      if (!this._renderedElements) {
        const container = (
          <div class="InGameEditor-Toolbar-Centering-Container">
            <div class="InGameEditor-Toolbar-Container">
              <div class="InGameEditor-Toolbar-Container-Background" />
              <div class="InGameEditor-Toolbar-Group">
                <span class="InGameEditor-Toolbar-Group-Label">Camera</span>
                <button
                  class="InGameEditor-Toolbar-Button"
                  id="free-camera-button"
                  onClick={this._switchToFreeCamera}
                  title="Free camera mode"
                >
                  {makeIcon({
                    svgIconUrl: this._getSvgIconUrl(
                      'InGameEditor-FreeCameraIcon'
                    ),
                  })}
                </button>
                <button
                  class="InGameEditor-Toolbar-Button"
                  id="orbit-camera-button"
                  onClick={this._switchToOrbitCamera}
                  title="Orbit camera mode"
                >
                  {makeIcon({
                    svgIconUrl: this._getSvgIconUrl(
                      'InGameEditor-OrbitCameraIcon'
                    ),
                  })}
                </button>
              </div>
              <div class="InGameEditor-Toolbar-Divider" />
              <div class="InGameEditor-Toolbar-Group">
                <span class="InGameEditor-Toolbar-Group-Label">Transform</span>
                <button
                  class="InGameEditor-Toolbar-Button"
                  id="move-button"
                  onClick={() => this._setTransformControlsMode('translate')}
                  title="Move (translate) selection (W / 1)"
                >
                  {makeIcon({
                    svgIconUrl: this._getSvgIconUrl('InGameEditor-MoveIcon'),
                  })}
                  <span class="InGameEditor-Toolbar-Button-Shortcut">W</span>
                </button>
                <button
                  class="InGameEditor-Toolbar-Button"
                  id="rotate-button"
                  onClick={() => this._setTransformControlsMode('rotate')}
                  title="Rotate selection (E / 2)"
                >
                  {makeIcon({
                    svgIconUrl: this._getSvgIconUrl('InGameEditor-RotateIcon'),
                  })}
                  <span class="InGameEditor-Toolbar-Button-Shortcut">E</span>
                </button>
                <button
                  class="InGameEditor-Toolbar-Button"
                  id="scale-button"
                  onClick={() => this._setTransformControlsMode('scale')}
                  title="Resize selection (R / 3)"
                >
                  {makeIcon({
                    svgIconUrl: this._getSvgIconUrl('InGameEditor-ResizeIcon'),
                  })}
                  <span class="InGameEditor-Toolbar-Button-Shortcut">R</span>
                </button>
                <button
                  class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Text"
                  id="ik-mode-button"
                  onClick={this._toggleIKMode}
                  title="Toggle IK mode for bone posing (I)"
                >
                  <span class="InGameEditor-Toolbar-Button-Label">IK</span>
                  <span class="InGameEditor-Toolbar-Button-Shortcut">I</span>
                </button>
              </div>
              <div class="InGameEditor-Toolbar-Divider" />
              <div class="InGameEditor-Toolbar-Group">
                <span class="InGameEditor-Toolbar-Group-Label">Space/Snap</span>
                <button
                  class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Text"
                  id="space-button"
                  onClick={this._toggleTransformControlsSpace}
                  title="Toggle Local/World transform space (L)"
                >
                  <span class="InGameEditor-Toolbar-Button-Label">Local</span>
                  <span class="InGameEditor-Toolbar-Button-Shortcut">L</span>
                </button>
                <div class="InGameEditor-Toolbar-SnapControl">
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Step"
                    id="translation-snap-decrease-button"
                    onClick={this._decreaseTranslationSnapStep}
                    title="Decrease position snap step"
                  >
                    <span class="InGameEditor-Toolbar-Button-Value">-</span>
                  </button>
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Text InGameEditor-Toolbar-Button-Snap"
                    id="translation-snap-button"
                    onClick={this._toggleTranslationSnap}
                    title="Toggle position snap (G)"
                  >
                    <span class="InGameEditor-Toolbar-Button-Label">Pos</span>
                    <span
                      class="InGameEditor-Toolbar-Button-Value"
                      id="translation-snap-value"
                    >
                      16
                    </span>
                  </button>
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Step"
                    id="translation-snap-increase-button"
                    onClick={this._increaseTranslationSnapStep}
                    title="Increase position snap step"
                  >
                    <span class="InGameEditor-Toolbar-Button-Value">+</span>
                  </button>
                </div>
                <div class="InGameEditor-Toolbar-SnapControl">
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Step"
                    id="rotation-snap-decrease-button"
                    onClick={this._decreaseRotationSnapDegrees}
                    title="Decrease rotation snap step"
                  >
                    <span class="InGameEditor-Toolbar-Button-Value">-</span>
                  </button>
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Text InGameEditor-Toolbar-Button-Snap"
                    id="rotation-snap-button"
                    onClick={this._toggleRotationSnap}
                    title="Toggle rotation snap (H)"
                  >
                    <span class="InGameEditor-Toolbar-Button-Label">Rot</span>
                    <span
                      class="InGameEditor-Toolbar-Button-Value"
                      id="rotation-snap-value"
                    >
                      15 deg
                    </span>
                  </button>
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Step"
                    id="rotation-snap-increase-button"
                    onClick={this._increaseRotationSnapDegrees}
                    title="Increase rotation snap step"
                  >
                    <span class="InGameEditor-Toolbar-Button-Value">+</span>
                  </button>
                </div>
                <div class="InGameEditor-Toolbar-SnapControl">
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Step"
                    id="scale-snap-decrease-button"
                    onClick={this._decreaseScaleSnapStep}
                    title="Decrease scale snap step"
                  >
                    <span class="InGameEditor-Toolbar-Button-Value">-</span>
                  </button>
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Text InGameEditor-Toolbar-Button-Snap"
                    id="scale-snap-button"
                    onClick={this._toggleScaleSnap}
                    title="Toggle scale snap (J)"
                  >
                    <span class="InGameEditor-Toolbar-Button-Label">Scale</span>
                    <span
                      class="InGameEditor-Toolbar-Button-Value"
                      id="scale-snap-value"
                    >
                      0.1
                    </span>
                  </button>
                  <button
                    class="InGameEditor-Toolbar-Button InGameEditor-Toolbar-Button-Step"
                    id="scale-snap-increase-button"
                    onClick={this._increaseScaleSnapStep}
                    title="Increase scale snap step"
                  >
                    <span class="InGameEditor-Toolbar-Button-Value">+</span>
                  </button>
                </div>
              </div>
              <div class="InGameEditor-Toolbar-Divider" />
              <div class="InGameEditor-Toolbar-Group">
                <span class="InGameEditor-Toolbar-Group-Label">Focus</span>
                <button
                  class="InGameEditor-Toolbar-Button"
                  id="focus-button"
                  onClick={this._focusOnSelection}
                  title="Focus on selection (F)"
                >
                  {makeIcon({
                    svgIconUrl: this._getSvgIconUrl('InGameEditor-FocusIcon'),
                  })}
                  <span class="InGameEditor-Toolbar-Button-Shortcut">F</span>
                </button>
              </div>
            </div>
          </div>
        );
        this._parent.appendChild(container);

        this._renderedElements = {
          container,
          moveButton: container.querySelector('#move-button')!,
          rotateButton: container.querySelector('#rotate-button')!,
          scaleButton: container.querySelector('#scale-button')!,
          ikModeButton: container.querySelector('#ik-mode-button')!,
          spaceButton: container.querySelector('#space-button')!,
          spaceButtonLabel: container.querySelector(
            '#space-button .InGameEditor-Toolbar-Button-Label'
          )!,
          translationSnapButton: container.querySelector(
            '#translation-snap-button'
          )!,
          translationSnapDecreaseButton: container.querySelector(
            '#translation-snap-decrease-button'
          )!,
          translationSnapIncreaseButton: container.querySelector(
            '#translation-snap-increase-button'
          )!,
          translationSnapValueLabel: container.querySelector(
            '#translation-snap-value'
          )!,
          rotationSnapButton: container.querySelector('#rotation-snap-button')!,
          rotationSnapDecreaseButton: container.querySelector(
            '#rotation-snap-decrease-button'
          )!,
          rotationSnapIncreaseButton: container.querySelector(
            '#rotation-snap-increase-button'
          )!,
          rotationSnapValueLabel: container.querySelector(
            '#rotation-snap-value'
          )!,
          scaleSnapButton: container.querySelector('#scale-snap-button')!,
          scaleSnapDecreaseButton: container.querySelector(
            '#scale-snap-decrease-button'
          )!,
          scaleSnapIncreaseButton: container.querySelector(
            '#scale-snap-increase-button'
          )!,
          scaleSnapValueLabel: container.querySelector('#scale-snap-value')!,
          focusButton: container.querySelector('#focus-button')!,
          freeCameraButton: container.querySelector('#free-camera-button')!,
          orbitCameraButton: container.querySelector('#orbit-camera-button')!,
        };
      }

      const hasSelection = this._hasSelection();
      this._renderedElements.container.style.display = hasSelection
        ? 'flex'
        : 'none';
      if (!hasSelection) {
        return;
      }

      const hasSelectionControls = this._hasSelectionControlsShown();
      const hasEditableSelection = this._hasEditableSelection();
      const hasIKTargetSelection = this._hasIKTargetSelection();
      const isIKModeEnabled = this._isIKModeEnabled();

      this._renderedElements.container.tabIndex = 0;
      this._renderedElements.container.style.transform = 'translateY(0)';

      const transformControlsMode = this._getTransformControlsMode();
      const transformControlsSpace = this._getTransformControlsSpace();
      const translationSnapStep = this._getTranslationSnapStep();
      const rotationSnapDegrees = this._getRotationSnapDegrees();
      const scaleSnapStep = this._getScaleSnapStep();
      const canDecreaseTranslationSnap =
        hasEditableSelection ||
        translationSnapStep > TRANSLATION_SNAP_STEP_MIN + 0.0001;
      const canIncreaseTranslationSnap =
        hasEditableSelection ||
        translationSnapStep < TRANSLATION_SNAP_STEP_MAX - 0.0001;
      const canDecreaseRotationSnap =
        hasEditableSelection ||
        rotationSnapDegrees > ROTATION_SNAP_DEGREES_MIN + 0.0001;
      const canIncreaseRotationSnap =
        hasEditableSelection ||
        rotationSnapDegrees < ROTATION_SNAP_DEGREES_MAX - 0.0001;
      const canDecreaseScaleSnap =
        hasEditableSelection || scaleSnapStep > SCALE_SNAP_STEP_MIN + 0.0001;
      const canIncreaseScaleSnap =
        hasEditableSelection || scaleSnapStep < SCALE_SNAP_STEP_MAX - 0.0001;

      this._setButtonDisabled(this._renderedElements.freeCameraButton, false);
      this._setButtonDisabled(this._renderedElements.orbitCameraButton, false);
      this._setButtonDisabled(this._renderedElements.moveButton, false);
      this._setButtonDisabled(this._renderedElements.rotateButton, false);
      this._setButtonDisabled(this._renderedElements.scaleButton, false);
      this._setButtonDisabled(
        this._renderedElements.ikModeButton,
        !hasIKTargetSelection
      );
      this._setButtonDisabled(this._renderedElements.spaceButton, false);
      this._setButtonDisabled(
        this._renderedElements.translationSnapButton,
        false
      );
      this._setButtonDisabled(this._renderedElements.rotationSnapButton, false);
      this._setButtonDisabled(this._renderedElements.scaleSnapButton, false);
      this._setButtonDisabled(
        this._renderedElements.focusButton,
        !hasSelectionControls
      );
      this._setButtonDisabled(
        this._renderedElements.translationSnapDecreaseButton,
        !canDecreaseTranslationSnap
      );
      this._setButtonDisabled(
        this._renderedElements.translationSnapIncreaseButton,
        !canIncreaseTranslationSnap
      );
      this._setButtonDisabled(
        this._renderedElements.rotationSnapDecreaseButton,
        !canDecreaseRotationSnap
      );
      this._setButtonDisabled(
        this._renderedElements.rotationSnapIncreaseButton,
        !canIncreaseRotationSnap
      );
      this._setButtonDisabled(
        this._renderedElements.scaleSnapDecreaseButton,
        !canDecreaseScaleSnap
      );
      this._setButtonDisabled(
        this._renderedElements.scaleSnapIncreaseButton,
        !canIncreaseScaleSnap
      );
      this._renderedElements.freeCameraButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        this._isFreeCamera()
      );
      this._renderedElements.orbitCameraButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        !this._isFreeCamera()
      );
      this._renderedElements.moveButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        transformControlsMode === 'translate'
      );
      this._renderedElements.rotateButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        transformControlsMode === 'rotate'
      );
      this._renderedElements.scaleButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        transformControlsMode === 'scale'
      );
      this._renderedElements.ikModeButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        isIKModeEnabled
      );
      this._renderedElements.spaceButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        transformControlsSpace === 'world'
      );
      this._renderedElements.translationSnapButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        this._isTranslationSnapEnabled()
      );
      this._renderedElements.rotationSnapButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        this._isRotationSnapEnabled()
      );
      this._renderedElements.scaleSnapButton.classList.toggle(
        'InGameEditor-Toolbar-Button-Active',
        this._isScaleSnapEnabled()
      );
      this._renderedElements.spaceButtonLabel.textContent =
        transformControlsSpace === 'local' ? 'Local' : 'World';
      const translationSnapText = this._formatSnapValue(translationSnapStep);
      const rotationSnapText = this._formatSnapValue(rotationSnapDegrees);
      const scaleSnapText = this._formatSnapValue(scaleSnapStep);
      const selectionValues = this._getSelectionTransformValues();
      const formatValues = (values: number[]) =>
        values.map((value) => this._formatSnapValue(value)).join(',');
      const getAxisForDisplay = (axis: string | null, fallback: string) => {
        if (
          axis &&
          (axis.includes('X') || axis.includes('Y') || axis.includes('Z'))
        ) {
          return axis;
        }
        return fallback;
      };
      const getDisplayedPositionText = () => {
        if (!selectionValues) return translationSnapText;
        const axis = getAxisForDisplay(selectionValues.axis, 'X');
        const values: number[] = [];
        if (axis.includes('X')) values.push(selectionValues.position.x);
        if (axis.includes('Y')) values.push(selectionValues.position.y);
        if (axis.includes('Z')) values.push(selectionValues.position.z);
        if (!values.length) values.push(selectionValues.position.x);
        return formatValues(values);
      };
      const getDisplayedRotationText = () => {
        if (!selectionValues) return rotationSnapText;
        const axis = getAxisForDisplay(selectionValues.axis, 'Z');
        const values: number[] = [];
        if (axis.includes('X')) values.push(selectionValues.rotation.x);
        if (axis.includes('Y')) values.push(selectionValues.rotation.y);
        if (axis.includes('Z')) values.push(selectionValues.rotation.z);
        if (!values.length) values.push(selectionValues.rotation.z);
        return formatValues(values);
      };
      const getDisplayedScaleText = () => {
        if (!selectionValues) return scaleSnapText;
        const fallbackAxis = selectionValues.is3D ? 'XYZ' : 'XY';
        const axis = getAxisForDisplay(selectionValues.axis, fallbackAxis);
        const values: number[] = [];
        if (axis.includes('X')) values.push(selectionValues.scale.x);
        if (axis.includes('Y')) values.push(selectionValues.scale.y);
        if (selectionValues.is3D && axis.includes('Z')) {
          values.push(selectionValues.scale.z);
        }
        if (!values.length) values.push(selectionValues.scale.x);
        return formatValues(values);
      };
      const translationSnapMinText = this._formatSnapValue(
        TRANSLATION_SNAP_STEP_MIN
      );
      const translationSnapMaxText = this._formatSnapValue(
        TRANSLATION_SNAP_STEP_MAX
      );
      const rotationSnapMinText = this._formatSnapValue(
        ROTATION_SNAP_DEGREES_MIN
      );
      const rotationSnapMaxText = this._formatSnapValue(
        ROTATION_SNAP_DEGREES_MAX
      );
      const scaleSnapMinText = this._formatSnapValue(SCALE_SNAP_STEP_MIN);
      const scaleSnapMaxText = this._formatSnapValue(SCALE_SNAP_STEP_MAX);
      this._renderedElements.translationSnapValueLabel.textContent =
        getDisplayedPositionText();
      this._renderedElements.rotationSnapValueLabel.textContent = `${getDisplayedRotationText()} deg`;
      this._renderedElements.scaleSnapValueLabel.textContent =
        getDisplayedScaleText();
      this._renderedElements.translationSnapButton.title = `Toggle position snap (G) - Step: ${translationSnapText}`;
      this._renderedElements.rotationSnapButton.title = `Toggle rotation snap (H) - Step: ${rotationSnapText} deg`;
      this._renderedElements.scaleSnapButton.title = `Toggle scale snap (J) - Step: ${scaleSnapText}`;
      this._renderedElements.ikModeButton.title = hasIKTargetSelection
        ? isIKModeEnabled
          ? 'IK mode enabled. Click bone handles to pose (I).'
          : 'Toggle IK mode for bone posing (I)'
        : 'Select a skinned 3D model to enable IK mode';
      this._renderedElements.focusButton.title = hasSelectionControls
        ? 'Focus on selection (F)'
        : 'Select an object to enable focus';
      if (hasEditableSelection) {
        this._renderedElements.translationSnapDecreaseButton.title = `Nudge position by -${translationSnapText}. Shift+click to decrease snap step.`;
        this._renderedElements.translationSnapIncreaseButton.title = `Nudge position by +${translationSnapText}. Shift+click to increase snap step.`;
        this._renderedElements.rotationSnapDecreaseButton.title = `Nudge rotation by -${rotationSnapText} deg. Shift+click to decrease snap step.`;
        this._renderedElements.rotationSnapIncreaseButton.title = `Nudge rotation by +${rotationSnapText} deg. Shift+click to increase snap step.`;
        this._renderedElements.scaleSnapDecreaseButton.title = `Nudge scale by -${scaleSnapText}. Shift+click to decrease snap step.`;
        this._renderedElements.scaleSnapIncreaseButton.title = `Nudge scale by +${scaleSnapText}. Shift+click to increase snap step.`;
      } else {
        this._renderedElements.translationSnapDecreaseButton.title =
          canDecreaseTranslationSnap
            ? `Decrease position snap step (current: ${translationSnapText})`
            : `Position snap step is already at minimum (${translationSnapMinText})`;
        this._renderedElements.translationSnapIncreaseButton.title =
          canIncreaseTranslationSnap
            ? `Increase position snap step (current: ${translationSnapText})`
            : `Position snap step is already at maximum (${translationSnapMaxText})`;
        this._renderedElements.rotationSnapDecreaseButton.title =
          canDecreaseRotationSnap
            ? `Decrease rotation snap step (current: ${rotationSnapText} deg)`
            : `Rotation snap step is already at minimum (${rotationSnapMinText} deg)`;
        this._renderedElements.rotationSnapIncreaseButton.title =
          canIncreaseRotationSnap
            ? `Increase rotation snap step (current: ${rotationSnapText} deg)`
            : `Rotation snap step is already at maximum (${rotationSnapMaxText} deg)`;
        this._renderedElements.scaleSnapDecreaseButton.title =
          canDecreaseScaleSnap
            ? `Decrease scale snap step (current: ${scaleSnapText})`
            : `Scale snap step is already at minimum (${scaleSnapMinText})`;
        this._renderedElements.scaleSnapIncreaseButton.title =
          canIncreaseScaleSnap
            ? `Increase scale snap step (current: ${scaleSnapText})`
            : `Scale snap step is already at maximum (${scaleSnapMaxText})`;
      }
    }
  }

  class EditorGrid {
    editor: gdjs.InGameEditor;
    gridHelper: THREE.GridHelper;
    isVisible = true;
    normal: 'Z' | 'Y' | 'X' = 'Z';
    position = new THREE.Vector3();

    isForcefullyHidden = true;
    gridWidth: float = 0;
    gridHeight: float = 0;
    gridDepth: float = 0;
    gridOffsetX: float = 0;
    gridOffsetY: float = 0;
    gridOffsetZ: float = 0;
    gridColor: integer = 0;
    gridAlpha: float = 1;
    isSnappingEnabledByDefault = false;
    threeScene: THREE.Scene | null = null;

    constructor(editor: gdjs.InGameEditor) {
      this.editor = editor;
      this.gridHelper = new THREE.GridHelper();
    }

    setSettings(instancesEditorSettings: InstancesEditorSettings): void {
      this.isForcefullyHidden = !instancesEditorSettings.grid;
      this.gridWidth = instancesEditorSettings.gridWidth || 0;
      this.gridHeight = instancesEditorSettings.gridHeight || 0;
      this.gridDepth =
        instancesEditorSettings.gridDepth === undefined
          ? 32
          : instancesEditorSettings.gridDepth;
      this.gridOffsetX = instancesEditorSettings.gridOffsetX || 0;
      this.gridOffsetY = instancesEditorSettings.gridOffsetY || 0;
      this.gridOffsetZ = instancesEditorSettings.gridOffsetZ || 0;
      this.gridColor = instancesEditorSettings.gridColor;
      this.gridAlpha = instancesEditorSettings.gridAlpha;
      this.isSnappingEnabledByDefault = instancesEditorSettings.snap;
      this.rebuildGrid();
    }

    private rebuildGrid(): void {
      this.gridHelper.removeFromParent();
      this.gridHelper.dispose();
      this.gridHelper = new THREE.GridHelper(
        10,
        10,
        this.gridColor,
        this.gridColor
      );
      this.gridHelper.material.transparent = true;
      this.gridHelper.material.opacity = this.gridAlpha;
      this.gridHelper.rotation.order = 'ZYX';
      this.updateVisibility();
      this.updateLocation();
      if (this.threeScene) {
        this.threeScene.add(this.gridHelper);
      }
    }

    private updateLocation() {
      const { gridWidth, gridHeight, gridDepth } = this;
      const { x, y, z } = this.position;
      if (this.normal === 'X') {
        this.gridHelper.rotation.set(0, 0, Math.PI / 2);
        this.gridHelper.scale.set(gridWidth, 1, gridDepth || 0);
        this.gridHelper.position.set(
          x,
          this.getSnappedY(y),
          this.getSnappedZ(z)
        );
      } else if (this.normal === 'Y') {
        this.gridHelper.rotation.set(0, 0, 0);
        this.gridHelper.scale.set(gridHeight, 1, gridDepth || 0);
        this.gridHelper.position.set(
          this.getSnappedX(x),
          y,
          this.getSnappedZ(z)
        );
      } else {
        this.gridHelper.rotation.set(Math.PI / 2, 0, 0);
        this.gridHelper.scale.set(gridWidth, 1, gridHeight);
        this.gridHelper.position.set(
          this.getSnappedX(x),
          this.getSnappedY(y),
          z
        );
      }
    }

    setTreeScene(threeScene: THREE.Scene): void {
      this.threeScene = threeScene;
      this.gridHelper.removeFromParent();
      threeScene.add(this.gridHelper);
    }

    setVisible(isVisible: boolean): void {
      this.isVisible = isVisible;
      this.updateVisibility();
    }

    private updateVisibility(): void {
      this.gridHelper.visible = this.isVisible && !this.isForcefullyHidden;
    }

    setNormal(normal: 'X' | 'Y' | 'Z') {
      this.normal = normal;
      if (this.normal === 'X') {
        this.gridHelper.rotation.set(0, 0, Math.PI / 2);
      } else if (this.normal === 'Y') {
        this.gridHelper.rotation.set(0, 0, 0);
      } else {
        this.gridHelper.rotation.set(Math.PI / 2, 0, 0);
      }
      this.updateLocation();
    }

    setPosition(x: float, y: float, z: float): void {
      this.position.set(x, y, z);
      this.updateLocation();
    }

    getSnappedX(x: float): float {
      const { gridWidth } = this;
      const snapStep = gridWidth || this.getSmallestSnapStep();
      return this.getSnappedXWithStep(x, snapStep);
    }

    getSnappedXWithStep(x: float, snapStep: number): float {
      return snap(x, snapStep, this.gridOffsetX);
    }

    getSnappedY(y: float): float {
      const { gridHeight } = this;
      const snapStep = gridHeight || this.getSmallestSnapStep();
      return this.getSnappedYWithStep(y, snapStep);
    }

    getSnappedYWithStep(y: float, snapStep: number): float {
      return snap(y, snapStep, this.gridOffsetY);
    }

    getSnappedZ(z: float): float {
      const { gridDepth } = this;
      const snapStep = gridDepth || this.getSmallestSnapStep();
      return this.getSnappedZWithStep(z, snapStep);
    }

    getSnappedZWithStep(z: float, snapStep: number): float {
      return snap(z, snapStep, this.gridOffsetZ);
    }

    getSmallestSnapStep(): number {
      const candidates = [this.gridWidth, this.gridHeight, this.gridDepth]
        .filter((value) => value > 0)
        .sort((a, b) => a - b);
      return candidates.length > 0
        ? candidates[0]
        : DEFAULT_TRANSLATION_SNAP_STEP;
    }

    isSnappingEnabled(
      inputManager: gdjs.InputManager,
      considerAltPressed?: boolean
    ): boolean {
      const altPressed =
        considerAltPressed === undefined
          ? isAltPressed(inputManager)
          : considerAltPressed;
      return this.isSnappingEnabledByDefault !== altPressed;
    }
  }

  /** @category In-Game Editor */
  export type EditorCameraState = {
    cameraMode: 'free' | 'orbit';
    positionX: float;
    positionY: float;
    positionZ: float;
    rotationAngle: float;
    elevationAngle: float;
    distance: float;
  };
  type EditorCameraViewPreset = 'topdown' | 'perspective';

  class EditorCamera implements CameraControl {
    editor: gdjs.InGameEditor;
    orbitCameraControl: OrbitCameraControl;
    freeCameraControl: FreeCameraControl;
    private _hasChanged = false;
    private _hadChanged = false;
    private _mouseCursor: string | null = null;

    constructor(editor: gdjs.InGameEditor) {
      this.editor = editor;
      this.orbitCameraControl = new OrbitCameraControl(this);
      this.freeCameraControl = new FreeCameraControl(this);
      this.orbitCameraControl.setEnabled(false);
    }

    isFreeCamera(): boolean {
      return this.freeCameraControl.isEnabled();
    }

    private getActiveCamera() {
      return this.isFreeCamera()
        ? this.freeCameraControl
        : this.orbitCameraControl;
    }

    getRequestedMouseCursor(): string | null {
      return this._mouseCursor;
    }

    switchToOrbitAroundObject(object: gdjs.RuntimeObject): void {
      this.switchToOrbitAroundPosition(
        object.getCenterXInScene(),
        object.getCenterYInScene(),
        is3D(object) ? object.getUnrotatedAABBMinZ() : 0
      );
      this.onHasCameraChanged();
    }

    switchToOrbitAroundPosition(
      targetX: float,
      targetY: float,
      targetZ: float
    ): void {
      this.orbitCameraControl.target.x = targetX;
      this.orbitCameraControl.target.y = targetY;
      this.orbitCameraControl.target.z = targetZ;
      if (this.freeCameraControl.isEnabled()) {
        this.orbitCameraControl.rotationAngle =
          this.freeCameraControl.rotationAngle;
        this.orbitCameraControl.elevationAngle =
          this.freeCameraControl.elevationAngle;
      }
      this.orbitCameraControl.setEnabled(true);
      this.freeCameraControl.setEnabled(false);
      this.onHasCameraChanged();
    }

    switchToOrbitAroundZ0(maxDistance: number): void {
      if (this.freeCameraControl.isEnabled()) {
        // Match orientation and orbit from the current free camera position.
        this.orbitCameraControl.rotationAngle =
          this.freeCameraControl.rotationAngle;
        this.orbitCameraControl.elevationAngle =
          this.freeCameraControl.elevationAngle;
        this.orbitCameraControl.orbitFromPositionAroundZ0(
          this.freeCameraControl.position.x,
          this.freeCameraControl.position.y,
          this.freeCameraControl.position.z,
          maxDistance
        );
      }

      this.orbitCameraControl.setEnabled(true);
      this.freeCameraControl.setEnabled(false);
      this.onHasCameraChanged();
    }

    switchToFreeCamera(): void {
      this.orbitCameraControl.setEnabled(false);
      this.freeCameraControl.setEnabled(true);

      this.freeCameraControl.position.x = this.orbitCameraControl.getCameraX();
      this.freeCameraControl.position.y = this.orbitCameraControl.getCameraY();
      this.freeCameraControl.position.z = this.orbitCameraControl.getCameraZ();
      this.freeCameraControl.rotationAngle =
        this.orbitCameraControl.rotationAngle;
      this.freeCameraControl.elevationAngle =
        this.orbitCameraControl.elevationAngle;
      this.onHasCameraChanged();
    }

    resetRotationToTopDown(): void {
      this.orbitCameraControl.resetRotationToTopDown();
      this.freeCameraControl.resetRotationToTopDown();
      this.onHasCameraChanged();
    }

    setOrbitDistance(distance: number): void {
      this.orbitCameraControl.setDistance(distance);
    }

    step(): void {
      const runtimeGame = this.editor.getRuntimeGame();
      const inputManager = runtimeGame.getInputManager();

      const touchIds = getCurrentTouchIdentifiers(inputManager);
      const touchCount = touchIds.length;
      const mobileJoystickState = this.editor.getMobile3DCameraJoystickState();

      this._mouseCursor = null;
      // Alt + mouse emulates orbit controls of most 3D engines.
      const isAltOrbitPressed =
        isAltPressed(inputManager) &&
        (inputManager.isMouseButtonPressed(0) ||
          inputManager.isMouseButtonPressed(1) ||
          inputManager.isMouseButtonPressed(2));
      if (isAltOrbitPressed) {
        this._mouseCursor = 'grab';
        if (this.isFreeCamera()) {
          const selectionAABB = this.editor.getSelectionAABB();
          if (selectionAABB) {
            this.switchToOrbitAroundPosition(
              (selectionAABB.min[0] + selectionAABB.max[0]) / 2,
              (selectionAABB.min[1] + selectionAABB.max[1]) / 2,
              (selectionAABB.min[2] + selectionAABB.max[2]) / 2
            );
          } else {
            const maxDistance = 4000; // Large enough to orbit quickly on most parts of a level.
            this.switchToOrbitAroundZ0(maxDistance);
          }
        }
      }
      // Always allow to use Space+click to switch to free camera and pan.
      // Display a grab cursor to indicate that.
      if (isSpacePressed(inputManager)) {
        this._mouseCursor = 'grab';

        // Switch to pan if space + left click is used.
        if (inputManager.isMouseButtonPressed(0) && !this.isFreeCamera()) {
          this.switchToFreeCamera();
        }
      }
      // Also switch to pan if shift + wheel click is used.
      if (
        isShiftPressed(inputManager) &&
        inputManager.isMouseButtonPressed(2) &&
        !this.isFreeCamera()
      ) {
        this.switchToFreeCamera();
      }
      // Shift to orbit if just mouse wheel click is used
      if (
        !isShiftPressed(inputManager) &&
        inputManager.isMouseButtonPressed(2) &&
        this.isFreeCamera()
      ) {
        const maxDistance = 4000; // Large enough to orbit quickly on most parts of a level.
        this.switchToOrbitAroundZ0(maxDistance);
      }
      if (mobileJoystickState.hasInput && !this.isFreeCamera()) {
        this.switchToFreeCamera();
      }
      // With touches, 2 touches will always pan/zoom the camera with the free camera.
      if (touchCount === 2 && !this.isFreeCamera()) {
        this.switchToFreeCamera();
      }
      // With touches, 3 touches will orbit around the point "in front of the camera".
      if (
        (touchCount === 3 || inputManager.isKeyPressed(O_KEY)) &&
        this.isFreeCamera()
      ) {
        const maxDistance = 4000; // Large enough to orbit quickly on most parts of a level.
        this.switchToOrbitAroundZ0(maxDistance);
      }

      this.orbitCameraControl.step();
      this.freeCameraControl.step();

      if (this._hadChanged && !this._hasChanged) {
        this._sendCameraState();
      }
      this._hadChanged = this._hasChanged;
      this._hasChanged = false;
    }

    onHasCameraChanged() {
      this._hasChanged = true;
    }

    updateCamera(currentScene: RuntimeScene, layer: RuntimeLayer): void {
      this.getActiveCamera().updateCamera(currentScene, layer);
    }

    zoomBy(zoomInFactor: float): void {
      this.getActiveCamera().zoomBy(zoomInFactor);
      this.onHasCameraChanged();
    }

    setZoom(zoom: float): void {
      const distance = this._getCameraZFromZoom(zoom);
      this.switchToOrbitAroundPosition(this.getAnchorX(), this.getAnchorY(), 0);
      this.resetRotationToTopDown();
      this.setOrbitDistance(distance);
      this.onHasCameraChanged();
    }

    getAnchorX(): float {
      return this.getActiveCamera().getAnchorX();
    }
    getAnchorY(): float {
      return this.getActiveCamera().getAnchorY();
    }
    getAnchorZ(): float {
      return this.getActiveCamera().getAnchorZ();
    }

    zoomToInitialPosition(visibleScreenArea: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }) {
      const runtimeGame = this.editor.getRuntimeGame();
      this.zoomToFitArea(
        {
          minX: 0,
          minY: 0,
          minZ: 0,
          maxX: runtimeGame.getOriginalWidth(),
          maxY: runtimeGame.getOriginalHeight(),
          maxZ: 0,
        },
        visibleScreenArea,
        0.1
      );
    }

    zoomToFitObjects(
      objects: Array<RuntimeObject>,
      visibleScreenArea: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      },
      margin: float
    ) {
      if (objects.length === 0) {
        const runtimeGame = this.editor.getRuntimeGame();
        this.zoomToFitArea(
          {
            minX: 0,
            minY: 0,
            minZ: 0,
            maxX: runtimeGame.getOriginalWidth(),
            maxY: runtimeGame.getOriginalHeight(),
            maxZ: 0,
          },
          visibleScreenArea,
          0.1
        );
      }
      let minX = Number.MAX_VALUE;
      let minY = Number.MAX_VALUE;
      let minZ = Number.MAX_VALUE;
      let maxX = Number.MIN_VALUE;
      let maxY = Number.MIN_VALUE;
      let maxZ = Number.MIN_VALUE;
      for (const object of objects) {
        const aabb = object.getAABB();
        minX = Math.min(minX, aabb.min[0]);
        minY = Math.min(minY, aabb.min[1]);
        minZ = Math.min(minZ, is3D(object) ? object.getUnrotatedAABBMinZ() : 0);
        maxX = Math.max(maxX, aabb.max[0]);
        maxY = Math.max(maxY, aabb.max[1]);
        maxZ = Math.max(maxZ, is3D(object) ? object.getUnrotatedAABBMaxZ() : 0);
      }
      this.zoomToFitArea(
        {
          minX,
          minY,
          minZ,
          maxX,
          maxY,
          maxZ,
        },
        visibleScreenArea,
        margin
      );
    }

    zoomToFitArea(
      sceneArea: {
        minX: number;
        minY: number;
        minZ: number;
        maxX: number;
        maxY: number;
        maxZ: number;
      },
      visibleScreenArea: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      },
      margin: float,
      viewPreset: EditorCameraViewPreset = 'topdown'
    ) {
      const sceneAreaWidth = sceneArea.maxX - sceneArea.minX;
      const sceneAreaHeight = sceneArea.maxY - sceneArea.minY;

      const runtimeGame = this.editor.getRuntimeGame();
      const renderedWidth = runtimeGame.getGameResolutionWidth();
      const renderedHeight = runtimeGame.getGameResolutionHeight();
      const editorWidth =
        (visibleScreenArea.maxX - visibleScreenArea.minX) * renderedWidth;
      const editorHeight =
        (visibleScreenArea.maxY - visibleScreenArea.minY) * renderedHeight;
      const isContentWider =
        editorWidth * sceneAreaHeight < sceneAreaWidth * editorHeight;
      const zoom =
        (1 - 2 * margin) *
        (isContentWider
          ? editorWidth / sceneAreaWidth
          : editorHeight / sceneAreaHeight);
      const distance = this._getCameraZFromZoom(zoom);

      const sceneAreaCenterX = (sceneArea.maxX + sceneArea.minX) / 2;
      const sceneAreaCenterY = (sceneArea.maxY + sceneArea.minY) / 2;

      this.switchToOrbitAroundPosition(
        sceneAreaCenterX,
        sceneAreaCenterY,
        sceneArea.minZ
      );
      if (viewPreset === 'perspective') {
        this.orbitCameraControl.rotationAngle = professional3DViewRotationAngle;
        this.orbitCameraControl.elevationAngle =
          professional3DViewElevationAngle;
        this.setOrbitDistance(distance * professional3DViewDistanceScale);
      } else {
        this.resetRotationToTopDown();
        this.setOrbitDistance(distance);
      }
      this.onHasCameraChanged();
    }

    /**
     * Get the camera center Z position.
     *
     * @param zoom The camera zoom.
     * @return The z position of the camera
     */
    _getCameraZFromZoom = (zoom: float): float => {
      const runtimeGame = this.editor.getRuntimeGame();
      // Set the camera so that it displays the whole PixiJS plane, as if it was a 2D rendering.
      // The Z position is computed by taking the half height of the displayed rendering,
      // and using the angle of the triangle defined by the field of view to compute the length
      // of the triangle defining the distance between the camera and the rendering plane.
      return (
        (0.5 * runtimeGame.getGameResolutionHeight()) /
        zoom /
        Math.tan(0.5 * gdjs.toRad(editorCameraFov))
      );
    };

    getCameraRotation(): float {
      return this.getActiveCamera().rotationAngle;
    }

    getCameraState(): EditorCameraState {
      return this.getActiveCamera()._getCameraState();
    }

    restoreCameraState(cameraState: EditorCameraState) {
      if (cameraState.cameraMode === 'free') {
        this.orbitCameraControl.setEnabled(false);
        this.freeCameraControl.setEnabled(true);
        this.freeCameraControl._restoreCameraState(cameraState);
      } else {
        this.freeCameraControl.setEnabled(false);
        this.orbitCameraControl.setEnabled(true);
        this.orbitCameraControl._restoreCameraState(cameraState);
      }
      this.onHasCameraChanged();
    }

    private _sendCameraState() {
      const runtimeGame = this.editor.getRuntimeGame();
      const debuggerClient = runtimeGame._debuggerClient;
      if (!debuggerClient) return;
      debuggerClient.sendCameraState(this.getCameraState());
    }
  }

  interface CameraControl {
    step(): void;
    updateCamera(currentScene: RuntimeScene, layer: RuntimeLayer): void;
    zoomBy(zoomInFactor: float): void;
    resetRotationToTopDown(): void;
    getAnchorX(): float;
    getAnchorY(): float;
    getAnchorZ(): float;
  }

  class OrbitCameraControl implements CameraControl {
    private _editorCamera: EditorCamera;
    target: THREE.Vector3 = new THREE.Vector3();
    rotationAngle: float = 0;
    elevationAngle: float = 90;
    distance: float = 800;
    private _targetDistance: float = 800;
    private _isEnabled: boolean = true;
    private _smoothedRotationInputX = 0;
    private _smoothedRotationInputY = 0;

    private _lastCursorX: float = 0;
    private _lastCursorY: float = 0;
    private _wasMouseLeftButtonPressed = false;
    private _wasMouseRightButtonPressed = false;
    private _wasMouseMiddleButtonPressed = false;

    private _gestureActiveTouchIds: Array<integer> = [];
    private _gestureLastCentroidX: float = 0;
    private _gestureLastCentroidY: float = 0;

    constructor(editorCamera: EditorCamera) {
      this._editorCamera = editorCamera;
      this._sanitizeAngles();
      this._synchronizeDistanceTargetWithDistance();
    }

    isEnabled(): boolean {
      return this._isEnabled;
    }

    setEnabled(isEnabled: boolean): void {
      this._isEnabled = isEnabled;
      if (!isEnabled) {
        this._smoothedRotationInputX = 0;
        this._smoothedRotationInputY = 0;
      }
      this._editorCamera.onHasCameraChanged();
    }

    private _sanitizeAngles(): void {
      this.rotationAngle = normalizeCameraAngleDegrees(this.rotationAngle);
      this.elevationAngle = clampCameraElevationDegrees(
        this.elevationAngle,
        orbitCameraMinElevation,
        orbitCameraMaxElevation
      );
    }

    private _synchronizeDistanceTargetWithDistance(): void {
      this.distance = Math.max(10, this.distance);
      this._targetDistance = this.distance;
    }

    step(): void {
      const runtimeGame = this._editorCamera.editor.getRuntimeGame();
      const inputManager = runtimeGame.getInputManager();
      const renderer = runtimeGame.getRenderer();
      const deltaTimeInSeconds = getFrameDeltaTimeInSeconds(runtimeGame);
      const isLeftButtonPressed = inputManager.isMouseButtonPressed(0);
      const isRightButtonPressed = inputManager.isMouseButtonPressed(1);
      const isMiddleButtonPressed = inputManager.isMouseButtonPressed(2);

      if (this._isEnabled) {
        // Use movement deltas when pointer is locked, otherwise use cursor position delta.
        const xDelta = sanitizeCameraInputDelta(
          renderer.isPointerLocked()
            ? inputManager.getMouseMovementX()
            : inputManager.getCursorX() - this._lastCursorX
        );
        const yDelta = sanitizeCameraInputDelta(
          renderer.isPointerLocked()
            ? inputManager.getMouseMovementY()
            : inputManager.getCursorY() - this._lastCursorY
        );
        this._smoothedRotationInputX = smoothToward(
          this._smoothedRotationInputX,
          xDelta,
          cameraLookInputResponsiveness,
          deltaTimeInSeconds
        );
        this._smoothedRotationInputY = smoothToward(
          this._smoothedRotationInputY,
          yDelta,
          cameraLookInputResponsiveness,
          deltaTimeInSeconds
        );
        const isAlt = isAltPressed(inputManager);

        if (
          // Alt + left click: orbit around pivot.
          (isAlt &&
            isLeftButtonPressed &&
            this._wasMouseLeftButtonPressed &&
            (xDelta !== 0 || yDelta !== 0)) ||
          // Right click or middle click without Alt: keep legacy orbit behavior.
          (!isAlt &&
            ((isRightButtonPressed && this._wasMouseRightButtonPressed) ||
              (isMiddleButtonPressed && this._wasMouseMiddleButtonPressed)) &&
            (xDelta !== 0 || yDelta !== 0))
        ) {
          this.rotationAngle +=
            this._smoothedRotationInputX * cameraRotationSpeedPerPixel;
          this.elevationAngle +=
            this._smoothedRotationInputY * cameraRotationSpeedPerPixel;
          this._sanitizeAngles();
          this._editorCamera.onHasCameraChanged();
        } else if (
          // Alt + middle click: pan target in camera plane.
          isAlt &&
          isMiddleButtonPressed &&
          this._wasMouseMiddleButtonPressed &&
          (xDelta !== 0 || yDelta !== 0)
        ) {
          const [forwardX, forwardY, forwardZ] = this._getCameraForwardVector();
          const forward = new THREE.Vector3(forwardX, forwardY, forwardZ);
          const worldUp = new THREE.Vector3(0, 0, 1);
          const right = new THREE.Vector3().crossVectors(worldUp, forward);
          if (right.lengthSq() < 1e-6) {
            right.set(1, 0, 0);
          } else {
            right.normalize();
          }
          const up = new THREE.Vector3()
            .crossVectors(forward, right)
            .normalize();

          const panSpeed = Math.max(0.1, this.distance * 0.0025);
          const panRightScale = -xDelta * panSpeed;
          const panUpScale = yDelta * panSpeed;
          this.target.x += right.x * panRightScale + up.x * panUpScale;
          this.target.y += right.y * panRightScale + up.y * panUpScale;
          this.target.z += right.z * panRightScale + up.z * panUpScale;
          this._editorCamera.onHasCameraChanged();
        } else if (
          // Alt + right click: dolly zoom.
          isAlt &&
          isRightButtonPressed &&
          this._wasMouseRightButtonPressed &&
          yDelta !== 0
        ) {
          this._targetDistance = Math.max(
            10,
            this._targetDistance * Math.pow(2, yDelta / 200)
          );
          this._editorCamera.onHasCameraChanged();
        }

        // Mouse wheel: zoom.
        const wheelDeltaY = inputManager.getMouseWheelDelta();
        if (wheelDeltaY !== 0) {
          this._targetDistance = Math.max(
            10,
            this._targetDistance * Math.pow(2, -wheelDeltaY / 512)
          );
          this._editorCamera.onHasCameraChanged();
        }

        // Movement with keyboard: zoom in/out.
        if (isControlOrCmdPressed(inputManager)) {
          if (inputManager.wasKeyJustPressed(EQUAL_KEY)) {
            this.zoomBy(zoomInFactor);
          } else if (inputManager.wasKeyJustPressed(MINUS_KEY)) {
            this.zoomBy(zoomOutFactor);
          }
        }

        // Touch gestures
        const touchIds = getCurrentTouchIdentifiers(inputManager);
        const touchCount = touchIds.length;

        if (touchCount === 0) {
          this._gestureActiveTouchIds = [];
        } else if (!areSameTouchesSet(this._gestureActiveTouchIds, touchIds)) {
          // Start or reinitialize gesture tracking
          this._gestureActiveTouchIds = touchIds.slice();
          if (touchCount === 3) {
            const centroid3 = getTouchesCentroid(inputManager);
            this._gestureLastCentroidX = centroid3.x;
            this._gestureLastCentroidY = centroid3.y;
          }
        } else {
          // Process ongoing gesture
          if (touchCount === 3) {
            // Three-finger rotation:
            // - adjust elevation angle from vertical movement of centroid
            // - adjust rotation angle from horizontal movement of centroid
            const centroid3 = getTouchesCentroid(inputManager);
            const dx3 = centroid3.x - this._gestureLastCentroidX;
            const dy3 = centroid3.y - this._gestureLastCentroidY;
            if (dx3 !== 0) {
              this.rotationAngle +=
                sanitizeCameraInputDelta(dx3) * cameraRotationSpeedPerPixel;
              this._sanitizeAngles();
              this._editorCamera.onHasCameraChanged();
            }
            if (dy3 !== 0) {
              this.elevationAngle +=
                sanitizeCameraInputDelta(dy3) * cameraRotationSpeedPerPixel;
              this._sanitizeAngles();
              this._editorCamera.onHasCameraChanged();
            }
            this._gestureLastCentroidX = centroid3.x;
            this._gestureLastCentroidY = centroid3.y;
          }
        }

        this._targetDistance = Math.max(10, this._targetDistance);
        const previousDistance = this.distance;
        this.distance = smoothToward(
          this.distance,
          this._targetDistance,
          cameraDistanceResponsiveness,
          deltaTimeInSeconds
        );
        if (Math.abs(this.distance - previousDistance) > cameraFloatEpsilon) {
          this._editorCamera.onHasCameraChanged();
        }
      } else {
        // Reset gesture tracking when camera control is disabled.
        this._gestureActiveTouchIds = [];
      }

      this._wasMouseLeftButtonPressed = isLeftButtonPressed;
      this._wasMouseRightButtonPressed = isRightButtonPressed;
      this._wasMouseMiddleButtonPressed = isMiddleButtonPressed;
      this._lastCursorX = inputManager.getCursorX();
      this._lastCursorY = inputManager.getCursorY();
    }

    getAnchorX(): float {
      return this.target.x;
    }

    getAnchorY(): float {
      return this.target.y;
    }

    getAnchorZ(): float {
      return this.target.z;
    }

    private _getCameraForwardVector(): Point3D {
      // Camera forward (from camera toward where it looks), unit length.
      const cosYaw = Math.cos(gdjs.toRad(this.rotationAngle + 90));
      const sinYaw = Math.sin(gdjs.toRad(this.rotationAngle + 90));
      const cosEl = Math.cos(gdjs.toRad(this.elevationAngle));
      const sinEl = Math.sin(gdjs.toRad(this.elevationAngle));

      const fwdX = -cosYaw * cosEl;
      const fwdY = -sinYaw * cosEl;
      const fwdZ = -sinEl;

      return [fwdX, fwdY, fwdZ];
    }

    getCameraX(): float {
      const [fwdX, ,] = this._getCameraForwardVector();
      return this.target.x - this.distance * fwdX;
    }

    getCameraY(): float {
      const [, fwdY] = this._getCameraForwardVector();
      return this.target.y - this.distance * fwdY;
    }

    getCameraZ(): float {
      const [, , fwdZ] = this._getCameraForwardVector();
      return this.target.z - this.distance * fwdZ;
    }

    orbitFromPositionAroundZ0(
      x: float,
      y: float,
      z: float,
      targetMaxDistance: float
    ): void {
      const [fwdX, fwdY, fwdZ] = this._getCameraForwardVector();

      // Intersect ray P(t) = camera position + t * forward with plane z = 0:
      // z + t*fwdZ = 0 => t = -z / fwdZ
      let tPlane: number | null = null;
      if (Math.abs(fwdZ) > 1e-6) {
        const t = -z / fwdZ;
        // Only keep intersections "in front" of the camera
        if (t > 0) tPlane = t;
      }

      // Choose distance along the ray:
      // - If there is a valid intersection within targetMaxDistance, use it
      // - Otherwise, clamp to targetMaxDistance
      const distance =
        tPlane !== null && tPlane <= targetMaxDistance
          ? tPlane
          : targetMaxDistance;

      // Target point = point ahead of camera along forward by distance
      this.target.x = x + fwdX * distance;
      this.target.y = y + fwdY * distance;
      this.target.z = z + fwdZ * distance;

      // Distance so that orbit camera stays exactly at the specified position
      this.distance = distance;
      this._synchronizeDistanceTargetWithDistance();
      this._sanitizeAngles();
    }

    updateCamera(currentScene: RuntimeScene, layer: RuntimeLayer): void {
      this._sanitizeAngles();
      this.distance = Math.max(10, this.distance);
      this._targetDistance = Math.max(10, this._targetDistance);
      const layerName = layer.getName();
      layer.setCameraX(this.getCameraX());
      layer.setCameraY(this.getCameraY());
      setCameraZ(currentScene, this.getCameraZ(), layerName, 0);
      setCameraRotationX(currentScene, 90 - this.elevationAngle, layerName, 0);
      setCameraRotationY(currentScene, 0, layerName, 0);
      layer.setCameraRotation(this.rotationAngle);
    }

    zoomBy(zoomFactor: float): void {
      // The distance is proportional to the inverse of the zoom.
      if (!Number.isFinite(zoomFactor) || zoomFactor === 0) {
        return;
      }
      this._targetDistance = Math.max(10, this._targetDistance / zoomFactor);
      this._editorCamera.onHasCameraChanged();
    }

    setDistance(distance: float): void {
      this.distance = Math.max(10, distance);
      this._targetDistance = this.distance;
      this._editorCamera.onHasCameraChanged();
    }

    resetRotationToTopDown(): void {
      this.rotationAngle = 0;
      this.elevationAngle = 90;
      this._sanitizeAngles();
      this._editorCamera.onHasCameraChanged();
    }

    _getCameraState(): EditorCameraState {
      return {
        cameraMode: 'orbit',
        positionX: this.target.x,
        positionY: this.target.y,
        positionZ: this.target.z,
        rotationAngle: this.rotationAngle,
        elevationAngle: this.elevationAngle,
        distance: this.distance,
      };
    }

    _restoreCameraState(cameraState: EditorCameraState): void {
      if (cameraState.cameraMode !== 'orbit') {
        return;
      }
      this.target.x = cameraState.positionX;
      this.target.y = cameraState.positionY;
      this.target.z = cameraState.positionZ;
      this.rotationAngle = cameraState.rotationAngle;
      this.elevationAngle = cameraState.elevationAngle;
      this.distance = cameraState.distance;
      this._sanitizeAngles();
      this._synchronizeDistanceTargetWithDistance();
      this._editorCamera.onHasCameraChanged();
    }
  }

  class FreeCameraControl implements CameraControl {
    private _editorCamera: EditorCamera;
    position: THREE.Vector3 = new THREE.Vector3();
    rotationAngle: float = 0;
    elevationAngle: float = 30;
    private _isEnabled: boolean = true;
    private _euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'ZYX');
    private _rotationMatrix: THREE.Matrix4 = new THREE.Matrix4();
    private _smoothedRotationInputX = 0;
    private _smoothedRotationInputY = 0;
    private _moveSpeedMultiplier = 1;
    private _movementIntentVector: THREE.Vector3 = new THREE.Vector3();
    private _smoothedMovementVector: THREE.Vector3 = new THREE.Vector3();

    private _lastCursorX: float = 0;
    private _lastCursorY: float = 0;
    private _wasMouseRightButtonPressed = false;

    // Touch gesture state
    private _gestureActiveTouchIds: Array<integer> = [];
    private _gestureLastCentroidX: float = 0;
    private _gestureLastCentroidY: float = 0;
    private _gestureLastDistance: float = 0;

    constructor(editorCamera: EditorCamera) {
      this._editorCamera = editorCamera;
      this._sanitizeAngles();
    }

    isEnabled(): boolean {
      return this._isEnabled;
    }

    setEnabled(isEnabled: boolean): void {
      this._isEnabled = isEnabled;
      if (!isEnabled) {
        this._smoothedRotationInputX = 0;
        this._smoothedRotationInputY = 0;
        this._smoothedMovementVector.set(0, 0, 0);
      }
      this._editorCamera.onHasCameraChanged();
    }

    private _sanitizeAngles(): void {
      this.rotationAngle = normalizeCameraAngleDegrees(this.rotationAngle);
      this.elevationAngle = clampCameraElevationDegrees(
        this.elevationAngle,
        freeCameraMinElevation,
        freeCameraMaxElevation
      );
    }

    step(): void {
      const runtimeGame = this._editorCamera.editor.getRuntimeGame();
      const inputManager = runtimeGame.getInputManager();
      const renderer = runtimeGame.getRenderer();
      const deltaTimeInSeconds = getFrameDeltaTimeInSeconds(runtimeGame);
      const frameRateCompensationFactor =
        getFrameRateCompensationFactor(deltaTimeInSeconds);
      const isRightButtonPressed = inputManager.isMouseButtonPressed(1);
      const mobileJoystickState =
        this._editorCamera.editor.getMobile3DCameraJoystickState();
      const hasVirtualMoveInput =
        Math.abs(mobileJoystickState.moveX) > 0.01 ||
        Math.abs(mobileJoystickState.moveY) > 0.01;
      const hasVirtualLookInput =
        Math.abs(mobileJoystickState.lookX) > 0.01 ||
        Math.abs(mobileJoystickState.lookY) > 0.01;
      const isFreelookActive =
        isRightButtonPressed ||
        renderer.isPointerLocked() ||
        hasVirtualMoveInput ||
        hasVirtualLookInput;
      if (this._isEnabled) {
        this._sanitizeAngles();
        const { right, up, forward } = this.getCameraVectors();

        const moveCameraByVector = (vector: THREE.Vector3, scale: number) => {
          this.position.x += vector.x * scale;
          this.position.y += vector.y * scale;
          this.position.z += vector.z * scale;
          this._editorCamera.onHasCameraChanged();
        };
        const xDelta = sanitizeCameraInputDelta(
          (renderer.isPointerLocked()
            ? inputManager.getMouseMovementX()
            : inputManager.getCursorX() - this._lastCursorX) +
            mobileJoystickState.lookX * 18
        );
        const yDelta = sanitizeCameraInputDelta(
          (renderer.isPointerLocked()
            ? inputManager.getMouseMovementY()
            : inputManager.getCursorY() - this._lastCursorY) -
            mobileJoystickState.lookY * 18
        );
        this._smoothedRotationInputX = smoothToward(
          this._smoothedRotationInputX,
          xDelta,
          cameraLookInputResponsiveness,
          deltaTimeInSeconds
        );
        this._smoothedRotationInputY = smoothToward(
          this._smoothedRotationInputY,
          yDelta,
          cameraLookInputResponsiveness,
          deltaTimeInSeconds
        );

        // Mouse wheel:
        // - Default behavior: zoom forward/backward, even during right-click freelook.
        // - Alt + wheel: adjust fly speed multiplier.
        const wheelDeltaY = inputManager.getMouseWheelDelta();
        if (wheelDeltaY !== 0) {
          if (
            isFreelookActive &&
            isAltPressed(inputManager) &&
            !isControlOrCmdPressed(inputManager)
          ) {
            this._moveSpeedMultiplier = gdjs.evtTools.common.clamp(
              this._moveSpeedMultiplier *
                Math.pow(2, -wheelDeltaY / freeCameraSpeedWheelStepDivisor),
              freeCameraMoveSpeedMultiplierMin,
              freeCameraMoveSpeedMultiplierMax
            );
          } else {
            moveCameraByVector(forward, wheelDeltaY);
          }
        }

        // Touch gestures
        const touchIds = getCurrentTouchIdentifiers(inputManager);
        const touchCount = touchIds.length;

        if (touchCount === 0) {
          this._gestureActiveTouchIds = [];
        } else if (!areSameTouchesSet(this._gestureActiveTouchIds, touchIds)) {
          // Start or reinitialize gesture tracking
          this._gestureActiveTouchIds = touchIds.slice();
          if (touchCount === 2) {
            const centroid = getTouchesCentroid(inputManager);
            this._gestureLastCentroidX = centroid.x;
            this._gestureLastCentroidY = centroid.y;
            this._gestureLastDistance = getTouchesDistance(inputManager);
          }
        } else {
          // Process ongoing gesture
          if (touchCount === 2) {
            // Pan: move on the camera plane by centroid delta
            const centroid = getTouchesCentroid(inputManager);
            const dx = sanitizeCameraInputDelta(
              (centroid.x - this._gestureLastCentroidX) * 5
            );
            const dy = sanitizeCameraInputDelta(
              (centroid.y - this._gestureLastCentroidY) * 5
            );
            if (dx !== 0 || dy !== 0) {
              moveCameraByVector(up, dy);
              moveCameraByVector(right, -dx);
              this._gestureLastCentroidX = centroid.x;
              this._gestureLastCentroidY = centroid.y;
            }

            // Pinch: zoom forward/backward based on distance delta
            const dist = getTouchesDistance(inputManager);
            const pinchDelta = sanitizeCameraInputDelta(
              (dist - this._gestureLastDistance) * 10
            );
            if (pinchDelta !== 0) {
              moveCameraByVector(forward, pinchDelta);
              this._gestureLastDistance = dist;
            }
          }
        }

        // Movement with the keyboard while right mouse is held:
        // arrow keys (camera plane) + WASD ("FPS move") + Q/E for absolute up/down.
        const moveSpeedPerFrameAt60Fps =
          (isShiftPressed(inputManager)
            ? freeCameraFastMoveSpeedPerFrameAt60Fps
            : freeCameraBaseMoveSpeedPerFrameAt60Fps) *
          this._moveSpeedMultiplier;
        const moveSpeed =
          moveSpeedPerFrameAt60Fps * frameRateCompensationFactor;

        const movementIntent = this._movementIntentVector;
        movementIntent.set(0, 0, 0);
        if (
          isFreelookActive &&
          !isControlOrCmdPressed(inputManager) &&
          !isAltPressed(inputManager)
        ) {
          if (inputManager.isKeyPressed(LEFT_KEY)) {
            movementIntent.addScaledVector(right, -1);
          }
          if (inputManager.isKeyPressed(RIGHT_KEY)) {
            movementIntent.addScaledVector(right, 1);
          }
          if (inputManager.isKeyPressed(UP_KEY)) {
            movementIntent.addScaledVector(up, 1);
          }
          if (inputManager.isKeyPressed(DOWN_KEY)) {
            movementIntent.addScaledVector(up, -1);
          }
          // Forward/back
          if (inputManager.isKeyPressed(W_KEY)) {
            movementIntent.addScaledVector(forward, 1);
          }
          if (inputManager.isKeyPressed(S_KEY)) {
            movementIntent.addScaledVector(forward, -1);
          }

          // Left/right (strafe)
          if (inputManager.isKeyPressed(A_KEY)) {
            movementIntent.addScaledVector(right, -1);
          }
          if (inputManager.isKeyPressed(D_KEY)) {
            movementIntent.addScaledVector(right, 1);
          }

          // Up/down should stay aligned to the scene vertical axis like Unity/Godot,
          // otherwise raising the camera becomes skewed when the camera is pitched.
          if (inputManager.isKeyPressed(Q_KEY)) {
            movementIntent.addScaledVector(absoluteVerticalMovementVector, -1);
          }
          if (inputManager.isKeyPressed(E_KEY)) {
            movementIntent.addScaledVector(absoluteVerticalMovementVector, 1);
          }
          if (hasVirtualMoveInput) {
            movementIntent.addScaledVector(right, mobileJoystickState.moveX);
            movementIntent.addScaledVector(forward, mobileJoystickState.moveY);
          }
        }

        if (movementIntent.lengthSq() > 0) {
          movementIntent.normalize().multiplyScalar(moveSpeed);
        }
        const movementResponsiveness =
          movementIntent.lengthSq() > 0
            ? freeCameraMoveAccelerationResponsiveness
            : freeCameraMoveDecelerationResponsiveness;
        this._smoothedMovementVector.x = smoothToward(
          this._smoothedMovementVector.x,
          movementIntent.x,
          movementResponsiveness,
          deltaTimeInSeconds
        );
        this._smoothedMovementVector.y = smoothToward(
          this._smoothedMovementVector.y,
          movementIntent.y,
          movementResponsiveness,
          deltaTimeInSeconds
        );
        this._smoothedMovementVector.z = smoothToward(
          this._smoothedMovementVector.z,
          movementIntent.z,
          movementResponsiveness,
          deltaTimeInSeconds
        );
        if (this._smoothedMovementVector.lengthSq() > cameraFloatEpsilon) {
          moveCameraByVector(this._smoothedMovementVector, 1);
        }

        // Movement with keyboard: zoom in/out.
        if (isControlOrCmdPressed(inputManager)) {
          if (inputManager.wasKeyJustPressed(EQUAL_KEY)) {
            this.zoomBy(zoomInFactor);
          } else if (inputManager.wasKeyJustPressed(MINUS_KEY)) {
            this.zoomBy(zoomOutFactor);
          }
        }

        // Space + click: move the camera on its plane.
        // Shift + Wheel click: same.
        if (
          (isSpacePressed(inputManager) &&
            inputManager.isMouseButtonPressed(0)) ||
          (isShiftPressed(inputManager) && inputManager.isMouseButtonPressed(2))
        ) {
          moveCameraByVector(up, yDelta);
          moveCameraByVector(right, -xDelta);
        }

        // Right click: rotate the camera.
        const canRotateFromMouseDrag =
          renderer.isPointerLocked() ||
          this._wasMouseRightButtonPressed ||
          hasVirtualLookInput;
        if (
          isFreelookActive &&
          // The camera should not move the 1st frame when not pointer locked.
          canRotateFromMouseDrag &&
          (xDelta !== 0 || yDelta !== 0)
        ) {
          this.rotationAngle +=
            this._smoothedRotationInputX * cameraRotationSpeedPerPixel;
          this.elevationAngle +=
            this._smoothedRotationInputY * cameraRotationSpeedPerPixel;
          this._sanitizeAngles();
          this._editorCamera.onHasCameraChanged();
        }
      } else {
        // Reset gesture tracking when camera control is disabled.
        this._gestureActiveTouchIds = [];
      }
      this._wasMouseRightButtonPressed = isRightButtonPressed;
      this._lastCursorX = inputManager.getCursorX();
      this._lastCursorY = inputManager.getCursorY();
    }

    moveForward(distanceDelta: number) {
      const { forward } = this.getCameraVectors();

      const moveCameraByVector = (vector: THREE.Vector3, scale: number) => {
        this.position.x += vector.x * scale;
        this.position.y += vector.y * scale;
        this.position.z += vector.z * scale;
        this._editorCamera.onHasCameraChanged();
      };

      moveCameraByVector(forward, distanceDelta);
    }

    updateCamera(currentScene: RuntimeScene, layer: RuntimeLayer): void {
      this._sanitizeAngles();
      const layerName = layer.getName();
      layer.setCameraX(this.position.x);
      layer.setCameraY(this.position.y);
      setCameraZ(currentScene, this.position.z, layerName, 0);
      setCameraRotationX(currentScene, 90 - this.elevationAngle, layerName, 0);
      setCameraRotationY(currentScene, 0, layerName, 0);
      layer.setCameraRotation(this.rotationAngle);
    }

    private getCameraVectors() {
      this._sanitizeAngles();
      this._euler.x = gdjs.toRad(90 - this.elevationAngle);
      this._euler.z = gdjs.toRad(this.rotationAngle);
      this._rotationMatrix.makeRotationFromEuler(this._euler);

      // threeCamera.matrixWorld is a 4x4. In Three.js, the columns correspond to:
      //   [ right.x,   up.x,    forwardNeg.x,  pos.x
      //     right.y,   up.y,    forwardNeg.y,  pos.y
      //     right.z,   up.z,    forwardNeg.z,  pos.z
      //     0,         0,       0,             1     ]
      //
      // By default, a Three.js camera looks down the -Z axis, so the "forward" axis
      // in the matrix is actually the negative Z column. We'll call it "forward" below.
      const elements = this._rotationMatrix.elements;

      // Local right axis in world space:
      const right = new THREE.Vector3(elements[0], elements[1], elements[2]);
      // Local forward axis in world space (note we take the negative of that column).
      const forward = new THREE.Vector3(
        elements[8],
        elements[9],
        -elements[10]
      );

      // Local up axis in world space: orthogonal to both right and forward.
      const up = new THREE.Vector3().crossVectors(forward, right);

      // Normalize them, just in case (they should generally be unit vectors).
      right.normalize();
      up.normalize();
      forward.normalize();

      return { right, up, forward };
    }

    getAnchorX(): float {
      return this.position.x;
    }

    getAnchorY(): float {
      return this.position.y;
    }

    getAnchorZ(): float {
      return this.position.z;
    }

    zoomBy(zoomInFactor: float): void {
      if (!Number.isFinite(zoomInFactor) || zoomInFactor === 0) {
        return;
      }
      this.moveForward(zoomInFactor > 1 ? 200 : -200);
      this._editorCamera.onHasCameraChanged();
    }

    resetRotationToTopDown(): void {
      this.rotationAngle = 0;
      this.elevationAngle = 90;
      this._sanitizeAngles();
      this._editorCamera.onHasCameraChanged();
    }

    _getCameraState(): EditorCameraState {
      return {
        cameraMode: 'free',
        positionX: this.position.x,
        positionY: this.position.y,
        positionZ: this.position.z,
        rotationAngle: this.rotationAngle,
        elevationAngle: this.elevationAngle,
        distance: 0,
      };
    }

    _restoreCameraState(cameraState: EditorCameraState): void {
      if (cameraState.cameraMode !== 'free') {
        return;
      }
      this.position.x = cameraState.positionX;
      this.position.y = cameraState.positionY;
      this.position.z = cameraState.positionZ;
      this.rotationAngle = cameraState.rotationAngle;
      this.elevationAngle = cameraState.elevationAngle;
      this._sanitizeAngles();
      this._editorCamera.onHasCameraChanged();
    }
  }

  const getCameraZ = (
    runtimeScene: RuntimeScene,
    layerName: string,
    cameraIndex: integer
  ): float => {
    return gdjs.scene3d.camera
      ? gdjs.scene3d.camera.getCameraZ(runtimeScene, layerName, cameraIndex)
      : 0;
  };

  const setCameraZ = (
    runtimeScene: RuntimeScene,
    z: float,
    layerName: string,
    cameraIndex: integer
  ) => {
    if (gdjs.scene3d.camera) {
      gdjs.scene3d.camera.setCameraZ(runtimeScene, z, layerName, cameraIndex);
    }
  };

  const setCameraRotationX = (
    runtimeScene: RuntimeScene,
    angle: float,
    layerName: string,
    cameraIndex: integer
  ) => {
    if (gdjs.scene3d.camera) {
      gdjs.scene3d.camera.setCameraRotationX(
        runtimeScene,
        angle,
        layerName,
        cameraIndex
      );
    }
  };

  const setCameraRotationY = (
    runtimeScene: RuntimeScene,
    angle: float,
    layerName: string,
    cameraIndex: integer
  ) => {
    if (gdjs.scene3d.camera) {
      gdjs.scene3d.camera.setCameraRotationY(
        runtimeScene,
        angle,
        layerName,
        cameraIndex
      );
    }
  };

  class ObjectSkeletonHelper {
    object: gdjs.RuntimeObject;
    container: THREE.Group;
    skeletonHelper: THREE.SkeletonHelper;
    private _handles: BoneControlHandle[] = [];
    private _handleColor: THREE.ColorRepresentation = '#4ca3ff';
    private _activeBone: THREE.Bone | null = null;

    constructor(object: gdjs.RuntimeObject) {
      this.object = object;
      this.container = new THREE.Group();
      this.container.rotation.order = 'ZYX';
      const threeObject = object.get3DRendererObject() || new THREE.Group();
      this.skeletonHelper = new THREE.SkeletonHelper(threeObject);
      const skeletonMaterials = Array.isArray(this.skeletonHelper.material)
        ? this.skeletonHelper.material
        : [this.skeletonHelper.material];
      for (const skeletonMaterial of skeletonMaterials) {
        const configurableSkeletonMaterial =
          skeletonMaterial as THREE.Material & {
            depthTest?: boolean;
            transparent?: boolean;
            opacity?: number;
            fog?: boolean;
          };
        configurableSkeletonMaterial.depthTest = false;
        configurableSkeletonMaterial.transparent = true;
        configurableSkeletonMaterial.opacity = 0.85;
        configurableSkeletonMaterial.fog = false;
      }
      this.container.add(this.skeletonHelper);
      // Keep lines visual-only: IK selection should target bone handles, not helper lines.
      (
        this.skeletonHelper as THREE.Object3D & {
          raycast?: (
            raycaster: THREE.Raycaster,
            intersects: Array<THREE.Intersection>
          ) => void;
        }
      ).raycast = () => {};
      this.skeletonHelper.traverse((child) => {
        (
          child as THREE.Object3D & {
            raycast?: (
              raycaster: THREE.Raycaster,
              intersects: Array<THREE.Intersection>
            ) => void;
          }
        ).raycast = () => {};
      });

      const handleGeometry = new THREE.SphereGeometry(2, 10, 10);
      const handleMaterial = new THREE.MeshBasicMaterial({
        color: '#4ca3ff',
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      });

      threeObject.traverse((child) => {
        const maybeBone = child as any;
        if (!maybeBone || !maybeBone.isBone) return;

        const handle = new THREE.Mesh(
          handleGeometry,
          handleMaterial.clone()
        ) as BoneControlHandle;
        handle.rotation.order = 'ZYX';
        handle.renderOrder = 9999;
        handle.gdjsRuntimeObject = object;
        handle.gdjsBoneControlData = {
          object,
          bone: child as THREE.Bone,
          helper: this,
        } as BoneControlData;
        this.container.add(handle);
        this._handles.push(handle);
      });
      this._refreshHandleStyles();
    }

    syncContainerWithWorldSpace() {
      if (!this.container.parent) return;

      // SkeletonHelper stores world matrix internally. Keep this container in
      // world space to avoid applying layer/scene transforms twice.
      this.container.parent.updateMatrixWorld(true);
      this.container.matrixAutoUpdate = false;
      this.container.matrix.copy(this.container.parent.matrixWorld).invert();
      this.container.matrixWorldNeedsUpdate = true;
    }

    hasBones(): boolean {
      return this._handles.length > 0;
    }

    update() {
      this.syncContainerWithWorldSpace();
      const updatableSkeletonHelper = this
        .skeletonHelper as THREE.SkeletonHelper & {
        update?: () => void;
        root?: THREE.Object3D;
      };

      if (typeof updatableSkeletonHelper.update === 'function') {
        updatableSkeletonHelper.update();
      } else {
        // Three.js changed SkeletonHelper API (update -> updateMatrixWorld).
        // Keep compatibility across versions used by the editor/preview.
        if (updatableSkeletonHelper.root) {
          updatableSkeletonHelper.root.updateMatrixWorld(true);
        }
        this.skeletonHelper.updateMatrixWorld(true);
      }

      const boneWorldPosition = new THREE.Vector3();
      for (const handle of this._handles) {
        const bone = handle.gdjsBoneControlData
          ? handle.gdjsBoneControlData.bone
          : null;
        if (!bone) continue;

        bone.updateMatrixWorld(true);
        bone.getWorldPosition(boneWorldPosition);
        this.container.worldToLocal(boneWorldPosition);
        handle.position.copy(boneWorldPosition);
      }
    }

    removeFromParent() {
      this.container.removeFromParent();
      this.skeletonHelper.geometry.dispose();
      const skeletonMaterials = Array.isArray(this.skeletonHelper.material)
        ? this.skeletonHelper.material
        : [this.skeletonHelper.material];
      for (const skeletonMaterial of skeletonMaterials) {
        skeletonMaterial.dispose();
      }
      for (const handle of this._handles) {
        handle.geometry.dispose();
        const handleMaterials = Array.isArray(handle.material)
          ? handle.material
          : [handle.material];
        for (const handleMaterial of handleMaterials) {
          handleMaterial.dispose();
        }
      }
      this._handles.length = 0;
    }

    setLayer(layer: number): void {
      this.skeletonHelper.layers.set(layer);
      for (const handle of this._handles) {
        handle.layers.set(layer);
      }
    }

    setColor(color: THREE.ColorRepresentation) {
      this._handleColor = color;
      const skeletonMaterials = Array.isArray(this.skeletonHelper.material)
        ? this.skeletonHelper.material
        : [this.skeletonHelper.material];
      for (const skeletonMaterial of skeletonMaterials) {
        const colorMaterial = skeletonMaterial as THREE.Material & {
          color?: THREE.Color;
          needsUpdate?: boolean;
        };
        if (colorMaterial.color) {
          colorMaterial.color.set(color);
        }
        colorMaterial.needsUpdate = true;
      }
      this._refreshHandleStyles();
    }

    setActiveBone(bone: THREE.Bone | null) {
      if (this._activeBone === bone) return;
      this._activeBone = bone;
      this._refreshHandleStyles();
    }

    private _refreshHandleStyles() {
      for (const handle of this._handles) {
        const boneControlData = handle.gdjsBoneControlData || null;
        const isActive =
          !!boneControlData && boneControlData.bone === this._activeBone;
        const handleMaterials = Array.isArray(handle.material)
          ? handle.material
          : [handle.material];
        for (const handleMaterial of handleMaterials) {
          const material = handleMaterial as THREE.MeshBasicMaterial;
          material.color.set(isActive ? '#35f5a3' : this._handleColor);
          material.opacity = isActive ? 1 : 0.95;
          material.needsUpdate = true;
        }
        handle.scale.setScalar(isActive ? 1.2 : 1);
      }
    }
  }

  class ObjectSelectionBoxHelper {
    object: gdjs.RuntimeObject;
    dummyObject3DForObject2D: THREE.Object3D | null = null;
    boxHelper: THREE.BoxHelper;
    container: THREE.Group;

    constructor(object: gdjs.RuntimeObject) {
      this.object = object;

      let threeObject = object.get3DRendererObject();
      if (!threeObject) {
        threeObject = new THREE.Group();
        threeObject.add(
          new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial()
          )
        );
        this.dummyObject3DForObject2D = threeObject;
      }
      // Use a group to invert the Y-axis as the GDevelop Y axis is inverted
      // compared to Three.js. This is somehow necessary because the position
      // of the BoxHelper is always (0, 0, 0) and the geometry is hard to manipulate.
      this.container = new THREE.Group();
      this.container.rotation.order = 'ZYX';
      this.container.scale.y = -1;
      this.boxHelper = new THREE.BoxHelper(threeObject, '#f2a63c');
      this.boxHelper.rotation.order = 'ZYX';
      this.boxHelper.material.depthTest = false;
      this.boxHelper.material.fog = false;
      this.container.add(this.boxHelper);
    }

    update() {
      if (this.dummyObject3DForObject2D) {
        this.dummyObject3DForObject2D.position.set(
          this.object.getCenterXInScene(),
          -this.object.getCenterYInScene(),
          0
        );
        this.dummyObject3DForObject2D.scale.set(
          this.object.getWidth() + 2,
          this.object.getHeight() + 2,
          0
        );
      }
      this.boxHelper.update();
    }

    removeFromParent() {
      this.container.removeFromParent();
    }

    setLayer(layer: number): void {
      this.boxHelper.layers.set(layer);
    }

    setColor(color: THREE.ColorRepresentation) {
      this.boxHelper.material.color.set(color);
      this.boxHelper.material.needsUpdate = true;
    }
  }

  /**
   * A 3D object placeholder that is used as a fall back when the object type
   * is not known.
   */
  class UnknownRuntimeObject extends gdjs.RuntimeObject3D {
    _renderer: UnknownRuntimeObjectRenderer;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: gdjs.Object3DData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);
      this._renderer = new UnknownRuntimeObjectRenderer(
        this,
        instanceContainer
      );
    }

    override getRenderer(): gdjs.RuntimeObject3DRenderer {
      return this._renderer;
    }

    override onDestroyed(): void {
      super.onDestroyed();
      this._renderer.onDestroyed();
    }
  }
  gdjs.registerObject('', UnknownRuntimeObject);

  class UnknownRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _threeObject: THREE.Mesh;

    constructor(
      runtimeObject: UnknownRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(),
        runtimeObject
          .getInstanceContainer()
          .getGame()
          .getImageManager()
          .getThreeMaterial('', {
            useTransparentTexture: false,
            forceBasicMaterial: true,
            vertexColors: false,
          })
      );
      super(runtimeObject, instanceContainer, cube);
      this._threeObject = cube;
      this.updateSize();
      this.updatePosition();
      this.updateRotation();
    }

    onDestroyed(): void {
      this._threeObject.removeFromParent();
      this._threeObject.geometry.dispose();
    }
  }
}
