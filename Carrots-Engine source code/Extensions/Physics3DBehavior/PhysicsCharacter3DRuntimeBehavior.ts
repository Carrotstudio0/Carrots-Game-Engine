/// <reference path="./jolt-physics.d.ts" />

namespace gdjs {
  interface PhysicsCharacter3DNetworkSyncDataType {
    sma: float;
    shm: float;
    grav: float;
    mfs: float;
    facc: float;
    fdec: float;
    fsm: float;
    sacc: float;
    sdec: float;
    ssm: float;
    jumpspeed: float;
    jumpsustime: float;
    sbpa: boolean;
    fwa: float;
    fws: float;
    sws: float;
    cfs: float;
    cjs: float;
    cj: boolean;
    lek: boolean;
    rik: boolean;
    upk: boolean;
    dok: boolean;
    juk: boolean;
    us: boolean;
    sa: float;
    sf: float;
    tscjs: float;
    jkhsjs: boolean;
    mvm?: float;
    spm?: float;
    air?: float;
    gfr?: float;
    afr?: float;
    vdm?: float;
    spk?: boolean;
    jms?: float;
    jpr?: float;
    jmh?: integer;
    jhc?: float;
    jsx?: float;
    jsy?: float;
    jsz?: float;
    jwc?: float;
    jwd?: float;
    jsd?: float;
    jpc?: float;
    jci?: integer;
    jct?: integer;
    jmt?: float;
    jco?: float;
    jcp?: float;
  }

  /** @category Behaviors > Physics 3D */
  export interface PhysicsCharacter3DNetworkSyncData
    extends BehaviorNetworkSyncData {
    props: PhysicsCharacter3DNetworkSyncDataType;
  }

  type Physics3D = {
    behavior: gdjs.Physics3DRuntimeBehavior;
    extendedUpdateSettings: Jolt.ExtendedUpdateSettings;
    broadPhaseLayerFilter: Jolt.BroadPhaseLayerFilter;
    objectLayerFilter: Jolt.ObjectLayerFilter;
    bodyFilter: Jolt.BodyFilter;
    shapeFilter: Jolt.ShapeFilter;
  };

  export type PhysicsCharacter3DVector3 = {
    x: float;
    y: float;
    z: float;
  };

  export interface PhysicsCharacter3DMovementTuning {
    movementSpeedMultiplier: float;
    sprintMultiplier: float;
    airControl: float;
    groundFriction: float;
    airFriction: float;
    verticalVelocityDamping: float;
  }

  export interface PhysicsCharacter3DJoltTuning {
    maxStrength?: float;
    penetrationRecoverySpeed?: float;
    maxHits?: integer;
    hitReductionCosMaxAngle?: float;
    shapeOffset?: PhysicsCharacter3DVector3;
    walkStairsCosAngleForwardContact?: float;
    walkStairsStepDownExtra?: float;
    stickToFloorStepDownExtra?: float;
    predictiveContactDistance?: float;
    maxCollisionIterations?: integer;
    maxConstraintIterations?: integer;
    minTimeRemaining?: float;
    collisionTolerance?: float;
    characterPadding?: float;
  }

  export type PhysicsCharacter3DInputKey = string | number;

  export type PhysicsCharacter3DInputBinding =
    | PhysicsCharacter3DInputKey
    | ReadonlyArray<PhysicsCharacter3DInputKey>;

  export interface PhysicsCharacter3DMovementInputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    sprint: boolean;
    stickForwardAxis: float;
    stickRightAxis: float;
    stickAngle: float;
    stickForce: float;
  }

  export interface PhysicsCharacter3DMovementInputBindings {
    forward: PhysicsCharacter3DInputBinding;
    backward: PhysicsCharacter3DInputBinding;
    left: PhysicsCharacter3DInputBinding;
    right: PhysicsCharacter3DInputBinding;
    jump: PhysicsCharacter3DInputBinding;
    sprint: PhysicsCharacter3DInputBinding;
  }

  export interface PhysicsCharacter3DKeyboardInputOptions {
    useJustPressedForJump: boolean;
    useJustPressedForSprint: boolean;
  }

  export interface PhysicsCharacter3DMovementAxesOptions {
    deadZone: float;
    forceMultiplier: float;
    simulateDigitalKeys: boolean;
    digitalThreshold: float;
  }

  export interface PhysicsCharacter3DPhysicsProfile {
    slopeMaxAngle: float;
    stairHeightMax: float;
    gravity: float;
    maxFallingSpeed: float;
    forwardAcceleration: float;
    forwardDeceleration: float;
    forwardSpeedMax: float;
    sidewaysAcceleration: float;
    sidewaysDeceleration: float;
    sidewaysSpeedMax: float;
    jumpSpeed: float;
    jumpSustainTime: float;
    bindObjectAndForwardAngle: boolean;
    movementTuning: PhysicsCharacter3DMovementTuning;
    joltTuning: PhysicsCharacter3DJoltTuning;
  }

  /**
   * @category Behaviors > Physics 3D
   */
  export class PhysicsCharacter3DRuntimeBehavior
    extends gdjs.RuntimeBehavior
    implements gdjs.Physics3DRuntimeBehavior.Physics3DHook
  {
    owner3D: gdjs.RuntimeObject3D;
    private _physics3DBehaviorName: string;
    private _physics3D: Physics3D | null = null;
    private _isHookedToPhysicsStep = false;
    character: Jolt.CharacterVirtual | null = null;
    /**
     * sharedData is a reference to the shared data of the scene, that registers
     * every physics behavior that is created so that collisions can be cleared
     * before stepping the world.
     */
    _sharedData: gdjs.Physics3DSharedData;
    collisionChecker: gdjs.PhysicsCharacter3DRuntimeBehavior.CharacterCollisionChecker;
    private _destroyedDuringFrameLogic: boolean = false;

    // TODO Should there be angle were the character can climb but will slip?
    _slopeMaxAngle: float;
    private _slopeClimbingFactor: float = 1;
    private _slopeClimbingMinNormalZ: float = Math.cos(Math.PI / 4);
    private _forwardAngle: float = 0;
    private _shouldBindObjectAndForwardAngle: boolean;
    private _forwardAcceleration: float;
    private _forwardDeceleration: float;
    private _forwardSpeedMax: float;
    private _sidewaysAcceleration: float;
    private _sidewaysDeceleration: float;
    private _sidewaysSpeedMax: float;
    private _gravity: float;
    private _maxFallingSpeed: float;
    private _jumpSpeed: float;
    private _jumpSustainTime: float;
    private _stairHeightMax: float;
    _canBePushed: boolean;
    private _movementTuning: PhysicsCharacter3DMovementTuning = {
      movementSpeedMultiplier: 1,
      sprintMultiplier: 1,
      airControl: 1,
      groundFriction: 1,
      airFriction: 1,
      verticalVelocityDamping: 1,
    };
    private _joltTuning: PhysicsCharacter3DJoltTuning = {};

    private _hasPressedForwardKey: boolean = false;
    private _hasPressedBackwardKey: boolean = false;
    private _hasPressedRightKey: boolean = false;
    private _hasPressedLeftKey: boolean = false;
    private _hasPressedJumpKey: boolean = false;
    private _hasPressedSprintKey: boolean = false;
    private _hasUsedStick: boolean = false;
    private _stickAngle: float = 0;
    private _stickForce: float = 0;
    private _currentForwardSpeed: float = 0;
    private _currentSidewaysSpeed: float = 0;
    private _currentFallSpeed: float = 0;
    private _canJump: boolean = false;
    private _currentJumpSpeed: float = 0;
    private _timeSinceCurrentJumpStart: float = 0;
    private _jumpKeyHeldSinceJumpStart: boolean = false;
    private _hasReallyMoved: boolean = false;
    private _oldPhysicsPosition: FloatPoint = [0, 0];

    // This is useful for extensions that need to know
    // which keys were pressed and doesn't know the mapping
    // done by the scene events.
    private _wasLeftKeyPressed: boolean = false;
    private _wasRightKeyPressed: boolean = false;
    private _wasForwardKeyPressed: boolean = false;
    private _wasBackwardKeyPressed: boolean = false;
    private _wasJumpKeyPressed: boolean = false;
    private _wasSprintKeyPressed: boolean = false;
    private _wasStickUsed: boolean = false;

    // This is useful when the object is synchronized by an external source
    // like in a multiplayer game, and we want to be able to predict the
    // movement of the object, even if the inputs are not updated every frame.
    private _clearInputsBetweenFrames: boolean = true;

    /**
     * A very small value compare to 1 pixel, yet very huge compare to rounding errors.
     */
    private static readonly epsilon = 2 ** -20;
    private static readonly defaultKeyboardInputBindings: PhysicsCharacter3DMovementInputBindings =
      {
        forward: ['w', 'Up'],
        backward: ['s', 'Down'],
        left: ['a', 'Left'],
        right: ['d', 'Right'],
        jump: ['Space'],
        sprint: ['LShift', 'RShift'],
      };
    private static readonly defaultKeyboardInputOptions: PhysicsCharacter3DKeyboardInputOptions =
      {
        useJustPressedForJump: false,
        useJustPressedForSprint: false,
      };
    private static readonly defaultMovementAxesOptions: PhysicsCharacter3DMovementAxesOptions =
      {
        deadZone: 0.15,
        forceMultiplier: 1,
        simulateDigitalKeys: false,
        digitalThreshold: 0.5,
      };

    /** Handle collisions between characters that can push each other. */
    charactersManager: gdjs.PhysicsCharacter3DRuntimeBehavior.CharactersManager;
    private _physicsRotationEulerZYX = new THREE.Euler(0, 0, 0, 'ZYX');
    private _physicsRotationFallbackQuaternion = new THREE.Quaternion();
    private _autoMovementInputFromKeyboard: boolean = false;
    private _keyboardMovementInputBindings: PhysicsCharacter3DMovementInputBindings =
      PhysicsCharacter3DRuntimeBehavior.getMergedMovementInputBindings();
    private _keyboardMovementInputOptions: PhysicsCharacter3DKeyboardInputOptions =
      PhysicsCharacter3DRuntimeBehavior.getMergedKeyboardInputOptions();

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject3D
    ) {
      super(instanceContainer, behaviorData, owner);
      this.owner3D = owner;
      this._physics3DBehaviorName = behaviorData.physics3D;
      this._sharedData = gdjs.Physics3DSharedData.getSharedData(
        instanceContainer.getScene(),
        behaviorData.Physics3D
      );
      this.collisionChecker =
        new gdjs.PhysicsCharacter3DRuntimeBehavior.CharacterCollisionChecker(
          this
        );
      this.charactersManager =
        gdjs.PhysicsCharacter3DRuntimeBehavior.CharactersManager.getManager(
          instanceContainer
        );

      this._slopeMaxAngle = 0;
      this.setSlopeMaxAngle(behaviorData.slopeMaxAngle);
      this._forwardAcceleration = behaviorData.forwardAcceleration;
      this._forwardDeceleration = behaviorData.forwardDeceleration;
      this._forwardSpeedMax = behaviorData.forwardSpeedMax;
      this._sidewaysAcceleration = behaviorData.sidewaysAcceleration;
      this._sidewaysDeceleration = behaviorData.sidewaysDeceleration;
      this._sidewaysSpeedMax = behaviorData.sidewaysSpeedMax;
      this._gravity = behaviorData.gravity;
      this._maxFallingSpeed = behaviorData.fallingSpeedMax;
      this._jumpSustainTime = behaviorData.jumpSustainTime;
      this._jumpSpeed = this.getJumpSpeedToReach(behaviorData.jumpHeight);
      this._shouldBindObjectAndForwardAngle =
        behaviorData.shouldBindObjectAndForwardAngle;
      this._stairHeightMax =
        behaviorData.stairHeightMax === undefined
          ? 20
          : behaviorData.stairHeightMax;
      this._canBePushed =
        behaviorData.canBePushed === undefined
          ? true
          : behaviorData.canBePushed;

      if (behaviorData.movementTuning) {
        this.setMovementTuning(behaviorData.movementTuning);
      }
      if (behaviorData.joltTuning) {
        this._joltTuning = this.sanitizeJoltTuning(behaviorData.joltTuning);
      }
    }

    private getVec3(x: float, y: float, z: float): Jolt.Vec3 {
      const tempVec3 = this._sharedData._tempVec3;
      tempVec3.Set(x, y, z);
      return tempVec3;
    }

    private static toFiniteOrFallback(value: unknown, fallback: float): float {
      return Number.isFinite(value) ? (value as float) : fallback;
    }

    private static toNonNegativeOrFallback(
      value: unknown,
      fallback: float
    ): float {
      const safeValue = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        value,
        fallback
      );
      return Math.max(0, safeValue);
    }

    private static toClampedOrFallback(
      value: unknown,
      min: float,
      max: float,
      fallback: float
    ): float {
      const safeValue = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        value,
        fallback
      );
      return gdjs.evtTools.common.clamp(safeValue, min, max);
    }

    private static toIntegerOrFallback(
      value: unknown,
      fallback: integer,
      minimum: integer = 0
    ): integer {
      if (!Number.isFinite(value)) {
        return Math.max(minimum, fallback);
      }
      return Math.max(minimum, Math.round(value as float));
    }

    private static cloneInputBinding(
      inputBinding: PhysicsCharacter3DInputBinding
    ): PhysicsCharacter3DInputBinding {
      if (Array.isArray(inputBinding)) {
        return [...inputBinding];
      }
      return inputBinding;
    }

    private static getMergedMovementInputBindings(
      inputBindings?: Partial<PhysicsCharacter3DMovementInputBindings>
    ): PhysicsCharacter3DMovementInputBindings {
      const defaultBindings =
        PhysicsCharacter3DRuntimeBehavior.defaultKeyboardInputBindings;
      return {
        forward: PhysicsCharacter3DRuntimeBehavior.cloneInputBinding(
          inputBindings && inputBindings.forward !== undefined
            ? inputBindings.forward
            : defaultBindings.forward
        ),
        backward: PhysicsCharacter3DRuntimeBehavior.cloneInputBinding(
          inputBindings && inputBindings.backward !== undefined
            ? inputBindings.backward
            : defaultBindings.backward
        ),
        left: PhysicsCharacter3DRuntimeBehavior.cloneInputBinding(
          inputBindings && inputBindings.left !== undefined
            ? inputBindings.left
            : defaultBindings.left
        ),
        right: PhysicsCharacter3DRuntimeBehavior.cloneInputBinding(
          inputBindings && inputBindings.right !== undefined
            ? inputBindings.right
            : defaultBindings.right
        ),
        jump: PhysicsCharacter3DRuntimeBehavior.cloneInputBinding(
          inputBindings && inputBindings.jump !== undefined
            ? inputBindings.jump
            : defaultBindings.jump
        ),
        sprint: PhysicsCharacter3DRuntimeBehavior.cloneInputBinding(
          inputBindings && inputBindings.sprint !== undefined
            ? inputBindings.sprint
            : defaultBindings.sprint
        ),
      };
    }

    private static getMergedKeyboardInputOptions(
      options?: Partial<PhysicsCharacter3DKeyboardInputOptions>
    ): PhysicsCharacter3DKeyboardInputOptions {
      const defaultOptions =
        PhysicsCharacter3DRuntimeBehavior.defaultKeyboardInputOptions;
      return {
        useJustPressedForJump:
          options && options.useJustPressedForJump !== undefined
            ? !!options.useJustPressedForJump
            : defaultOptions.useJustPressedForJump,
        useJustPressedForSprint:
          options && options.useJustPressedForSprint !== undefined
            ? !!options.useJustPressedForSprint
            : defaultOptions.useJustPressedForSprint,
      };
    }

    private static getMergedMovementAxesOptions(
      options?: Partial<PhysicsCharacter3DMovementAxesOptions>
    ): PhysicsCharacter3DMovementAxesOptions {
      const defaultOptions =
        PhysicsCharacter3DRuntimeBehavior.defaultMovementAxesOptions;
      return {
        deadZone:
          options && options.deadZone !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
                options.deadZone,
                0,
                1,
                defaultOptions.deadZone
              )
            : defaultOptions.deadZone,
        forceMultiplier:
          options && options.forceMultiplier !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                options.forceMultiplier,
                defaultOptions.forceMultiplier
              )
            : defaultOptions.forceMultiplier,
        simulateDigitalKeys:
          options && options.simulateDigitalKeys !== undefined
            ? !!options.simulateDigitalKeys
            : defaultOptions.simulateDigitalKeys,
        digitalThreshold:
          options && options.digitalThreshold !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
                options.digitalThreshold,
                0,
                1,
                defaultOptions.digitalThreshold
              )
            : defaultOptions.digitalThreshold,
      };
    }

    private static resolveInputKeyCode(
      inputKey: PhysicsCharacter3DInputKey
    ): number | null {
      if (typeof inputKey === 'number' && Number.isFinite(inputKey)) {
        return Math.round(inputKey);
      }
      if (typeof inputKey !== 'string') {
        return null;
      }
      const keyName = inputKey.trim();
      if (!keyName) {
        return null;
      }

      const numericCode = Number(keyName);
      if (Number.isFinite(numericCode) && `${Math.round(numericCode)}` === keyName) {
        return Math.round(numericCode);
      }

      const keysNameToCode = gdjs.evtTools.input.keysNameToCode as {
        [key: string]: number;
      };
      if (Object.prototype.hasOwnProperty.call(keysNameToCode, keyName)) {
        return keysNameToCode[keyName];
      }

      const lowerCaseKeyName = keyName.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(keysNameToCode, lowerCaseKeyName)) {
        return keysNameToCode[lowerCaseKeyName];
      }

      for (const mappedKeyName in keysNameToCode) {
        if (!Object.prototype.hasOwnProperty.call(keysNameToCode, mappedKeyName)) {
          continue;
        }
        if (mappedKeyName.toLowerCase() === lowerCaseKeyName) {
          return keysNameToCode[mappedKeyName];
        }
      }
      return null;
    }

    private static isInputBindingPressed(
      inputManager: gdjs.InputManager,
      inputBinding: PhysicsCharacter3DInputBinding,
      useJustPressed: boolean
    ): boolean {
      const bindingsArray = Array.isArray(inputBinding)
        ? inputBinding
        : [inputBinding];
      for (const bindingEntry of bindingsArray) {
        const keyCode =
          PhysicsCharacter3DRuntimeBehavior.resolveInputKeyCode(bindingEntry);
        if (keyCode === null) {
          continue;
        }
        if (
          useJustPressed
            ? inputManager.wasKeyJustPressed(keyCode)
            : inputManager.isKeyPressed(keyCode)
        ) {
          return true;
        }
      }
      return false;
    }

    private static getStickFromAxes(
      forwardAxis: float,
      rightAxis: float
    ): { angle: float; force: float } {
      const safeForwardAxis = PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
        forwardAxis,
        -1,
        1,
        0
      );
      const safeRightAxis = PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
        rightAxis,
        -1,
        1,
        0
      );
      const normalizedForce = Math.min(
        1,
        Math.hypot(safeForwardAxis, safeRightAxis)
      );
      if (normalizedForce <= PhysicsCharacter3DRuntimeBehavior.epsilon) {
        return { angle: 0, force: 0 };
      }

      return {
        angle: gdjs.toDegrees(Math.atan2(-safeForwardAxis, safeRightAxis)),
        force: normalizedForce,
      };
    }

    private sanitizeJoltTuning(
      tuning: Partial<PhysicsCharacter3DJoltTuning>
    ): PhysicsCharacter3DJoltTuning {
      const sanitizedTuning: PhysicsCharacter3DJoltTuning = {};

      if (tuning.maxStrength !== undefined) {
        sanitizedTuning.maxStrength =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.maxStrength,
            0
          );
      }
      if (tuning.penetrationRecoverySpeed !== undefined) {
        sanitizedTuning.penetrationRecoverySpeed =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.penetrationRecoverySpeed,
            0
          );
      }
      if (tuning.maxHits !== undefined) {
        sanitizedTuning.maxHits =
          PhysicsCharacter3DRuntimeBehavior.toIntegerOrFallback(
            tuning.maxHits,
            1,
            1
          );
      }
      if (tuning.hitReductionCosMaxAngle !== undefined) {
        sanitizedTuning.hitReductionCosMaxAngle =
          PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
            tuning.hitReductionCosMaxAngle,
            -1,
            1,
            1
          );
      }
      if (tuning.shapeOffset !== undefined) {
        sanitizedTuning.shapeOffset = {
          x: PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
            tuning.shapeOffset.x,
            0
          ),
          y: PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
            tuning.shapeOffset.y,
            0
          ),
          z: PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
            tuning.shapeOffset.z,
            0
          ),
        };
      }
      if (tuning.walkStairsCosAngleForwardContact !== undefined) {
        sanitizedTuning.walkStairsCosAngleForwardContact =
          PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
            tuning.walkStairsCosAngleForwardContact,
            -1,
            1,
            0
          );
      }
      if (tuning.walkStairsStepDownExtra !== undefined) {
        sanitizedTuning.walkStairsStepDownExtra =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.walkStairsStepDownExtra,
            0
          );
      }
      if (tuning.stickToFloorStepDownExtra !== undefined) {
        sanitizedTuning.stickToFloorStepDownExtra =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.stickToFloorStepDownExtra,
            0
          );
      }
      if (tuning.predictiveContactDistance !== undefined) {
        sanitizedTuning.predictiveContactDistance =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.predictiveContactDistance,
            0
          );
      }
      if (tuning.maxCollisionIterations !== undefined) {
        sanitizedTuning.maxCollisionIterations =
          PhysicsCharacter3DRuntimeBehavior.toIntegerOrFallback(
            tuning.maxCollisionIterations,
            1,
            1
          );
      }
      if (tuning.maxConstraintIterations !== undefined) {
        sanitizedTuning.maxConstraintIterations =
          PhysicsCharacter3DRuntimeBehavior.toIntegerOrFallback(
            tuning.maxConstraintIterations,
            1,
            1
          );
      }
      if (tuning.minTimeRemaining !== undefined) {
        sanitizedTuning.minTimeRemaining =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.minTimeRemaining,
            0
          );
      }
      if (tuning.collisionTolerance !== undefined) {
        sanitizedTuning.collisionTolerance =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.collisionTolerance,
            0
          );
      }
      if (tuning.characterPadding !== undefined) {
        sanitizedTuning.characterPadding =
          PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
            tuning.characterPadding,
            0
          );
      }
      return sanitizedTuning;
    }

    private static cloneJoltTuning(
      tuning: PhysicsCharacter3DJoltTuning
    ): PhysicsCharacter3DJoltTuning {
      return {
        ...tuning,
        shapeOffset: tuning.shapeOffset
          ? { ...tuning.shapeOffset }
          : undefined,
      };
    }

    private shouldRecreateCharacterAfterJoltTuningUpdate(
      newTuning: PhysicsCharacter3DJoltTuning
    ): boolean {
      return (
        newTuning.predictiveContactDistance !== undefined ||
        newTuning.maxCollisionIterations !== undefined ||
        newTuning.maxConstraintIterations !== undefined ||
        newTuning.minTimeRemaining !== undefined ||
        newTuning.collisionTolerance !== undefined ||
        newTuning.characterPadding !== undefined
      );
    }

    applyJoltTuningToCharacterSettings(
      settings: Jolt.CharacterVirtualSettings
    ): void {
      const worldInvScale = this._sharedData.worldInvScale;
      const tuning = this._joltTuning;

      if (tuning.maxStrength !== undefined) {
        settings.mMaxStrength = tuning.maxStrength;
      }
      if (tuning.penetrationRecoverySpeed !== undefined) {
        settings.mPenetrationRecoverySpeed = tuning.penetrationRecoverySpeed;
      }
      if (tuning.maxHits !== undefined) {
        settings.mMaxNumHits = tuning.maxHits;
      }
      if (tuning.hitReductionCosMaxAngle !== undefined) {
        settings.mHitReductionCosMaxAngle = tuning.hitReductionCosMaxAngle;
      }
      if (tuning.shapeOffset !== undefined) {
        settings.mShapeOffset = this.getVec3(
          tuning.shapeOffset.x * worldInvScale,
          tuning.shapeOffset.y * worldInvScale,
          tuning.shapeOffset.z * worldInvScale
        );
      }
      if (tuning.predictiveContactDistance !== undefined) {
        settings.mPredictiveContactDistance =
          tuning.predictiveContactDistance * worldInvScale;
      }
      if (tuning.maxCollisionIterations !== undefined) {
        settings.mMaxCollisionIterations = tuning.maxCollisionIterations;
      }
      if (tuning.maxConstraintIterations !== undefined) {
        settings.mMaxConstraintIterations = tuning.maxConstraintIterations;
      }
      if (tuning.minTimeRemaining !== undefined) {
        settings.mMinTimeRemaining = tuning.minTimeRemaining;
      }
      if (tuning.collisionTolerance !== undefined) {
        settings.mCollisionTolerance = tuning.collisionTolerance * worldInvScale;
      }
      if (tuning.characterPadding !== undefined) {
        settings.mCharacterPadding = tuning.characterPadding * worldInvScale;
      }
    }

    applyJoltTuningToRuntimeCharacter(physics3D: Physics3D): void {
      if (!this.character) {
        return;
      }
      const tuning = this._joltTuning;
      const worldInvScale = this._sharedData.worldInvScale;
      const { extendedUpdateSettings } = physics3D;

      if (tuning.maxStrength !== undefined) {
        this.character.SetMaxStrength(tuning.maxStrength);
      }
      if (tuning.penetrationRecoverySpeed !== undefined) {
        this.character.SetPenetrationRecoverySpeed(
          tuning.penetrationRecoverySpeed
        );
      }
      if (tuning.maxHits !== undefined) {
        this.character.SetMaxNumHits(tuning.maxHits);
      }
      if (tuning.hitReductionCosMaxAngle !== undefined) {
        this.character.SetHitReductionCosMaxAngle(tuning.hitReductionCosMaxAngle);
      }
      if (tuning.shapeOffset !== undefined) {
        this.character.SetShapeOffset(
          this.getVec3(
            tuning.shapeOffset.x * worldInvScale,
            tuning.shapeOffset.y * worldInvScale,
            tuning.shapeOffset.z * worldInvScale
          )
        );
      }

      if (tuning.walkStairsCosAngleForwardContact !== undefined) {
        extendedUpdateSettings.mWalkStairsCosAngleForwardContact =
          tuning.walkStairsCosAngleForwardContact;
      }
      const walkStairsStepDownExtra =
        tuning.walkStairsStepDownExtra !== undefined
          ? tuning.walkStairsStepDownExtra
          : 0;
      extendedUpdateSettings.mWalkStairsStepDownExtra.Set(
        0,
        0,
        -walkStairsStepDownExtra * worldInvScale
      );
    }

    getPhysics3D(): Physics3D | null {
      if (this._destroyedDuringFrameLogic) {
        return null;
      }
      if (this._physics3D) {
        return this._physics3D;
      }
      if (!this.activated()) {
        return null;
      }
      const behavior = this.owner.getBehavior(
        this._physics3DBehaviorName
      ) as gdjs.Physics3DRuntimeBehavior;
      if (!behavior.activated()) {
        return null;
      }
      const sharedData = behavior._sharedData;
      const jolt = sharedData.jolt;
      const extendedUpdateSettings = new Jolt.ExtendedUpdateSettings();
      const broadPhaseLayerFilter = new Jolt.DefaultBroadPhaseLayerFilter(
        jolt.GetObjectVsBroadPhaseLayerFilter(),
        gdjs.Physics3DSharedData.dynamicBroadPhaseLayerIndex
      );
      const objectLayerFilter = new Jolt.DefaultObjectLayerFilter(
        jolt.GetObjectLayerPairFilter(),
        behavior.getBodyLayer()
      );
      const bodyFilter = new Jolt.BodyFilter();
      const shapeFilter = new Jolt.ShapeFilter();

      this._physics3D = {
        behavior,
        extendedUpdateSettings,
        broadPhaseLayerFilter,
        objectLayerFilter,
        bodyFilter,
        shapeFilter,
      };
      this.setStairHeightMax(this._stairHeightMax);
      if (!this._isHookedToPhysicsStep) {
        sharedData.registerHook(this);
        this._isHookedToPhysicsStep = true;
      }

      // Destroy the body before switching the bodyUpdater,
      // to ensure the body of the previous bodyUpdater is not left alive.
      // (would be a memory leak and would create a phantom body in the physics world)
      // But transfer the linear and angular velocity to the new body,
      // so the body doesn't stop when it is recreated.
      let previousBodyData = {
        linearVelocityX: 0,
        linearVelocityY: 0,
        linearVelocityZ: 0,
        angularVelocityX: 0,
        angularVelocityY: 0,
        angularVelocityZ: 0,
      };
      if (behavior._body) {
        const linearVelocity = behavior._body.GetLinearVelocity();
        previousBodyData.linearVelocityX = linearVelocity.GetX();
        previousBodyData.linearVelocityY = linearVelocity.GetY();
        previousBodyData.linearVelocityZ = linearVelocity.GetZ();
        const angularVelocity = behavior._body.GetAngularVelocity();
        previousBodyData.angularVelocityX = angularVelocity.GetX();
        previousBodyData.angularVelocityY = angularVelocity.GetY();
        previousBodyData.angularVelocityZ = angularVelocity.GetZ();
        behavior.bodyUpdater.destroyBody();
      }

      behavior.bodyUpdater =
        new gdjs.PhysicsCharacter3DRuntimeBehavior.CharacterBodyUpdater(this);
      behavior.collisionChecker = this.collisionChecker;
      behavior.recreateBody(previousBodyData);

      // Always begin in the direction of the object.
      this._forwardAngle = this.owner.getAngle();
      this.applyJoltTuningToRuntimeCharacter(this._physics3D);

      return this._physics3D;
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.gravity !== undefined) {
        this.setGravity(behaviorData.gravity);
      }
      if (behaviorData.maxFallingSpeed !== undefined) {
        this.setMaxFallingSpeed(behaviorData.maxFallingSpeed);
      }
      if (behaviorData.forwardAcceleration !== undefined) {
        this.setForwardAcceleration(behaviorData.forwardAcceleration);
      }
      if (behaviorData.forwardDeceleration !== undefined) {
        this.setForwardDeceleration(behaviorData.forwardDeceleration);
      }
      if (behaviorData.forwardSpeedMax !== undefined) {
        this.setForwardSpeedMax(behaviorData.forwardSpeedMax);
      }
      if (behaviorData.sidewaysAcceleration !== undefined) {
        this.setSidewaysAcceleration(behaviorData.sidewaysAcceleration);
      }
      if (behaviorData.sidewaysDeceleration !== undefined) {
        this.setSidewaysDeceleration(behaviorData.sidewaysDeceleration);
      }
      if (behaviorData.sidewaysSpeedMax !== undefined) {
        this.setSidewaysSpeedMax(behaviorData.sidewaysSpeedMax);
      }
      if (behaviorData.jumpSustainTime !== undefined) {
        this.setJumpSustainTime(behaviorData.jumpSustainTime);
      }
      if (behaviorData.jumpHeight !== undefined) {
        this.setJumpSpeed(this.getJumpSpeedToReach(behaviorData.jumpHeight));
      }
      if (behaviorData.shouldBindObjectAndForwardAngle !== undefined) {
        this.setShouldBindObjectAndForwardAngle(
          behaviorData.shouldBindObjectAndForwardAngle
        );
      }
      if (behaviorData.stairHeightMax !== undefined) {
        this.setStairHeightMax(behaviorData.stairHeightMax);
      }
      if (behaviorData.movementTuning !== undefined) {
        this.setMovementTuning(behaviorData.movementTuning);
      }
      if (behaviorData.joltTuning !== undefined) {
        this.setJoltTuning(behaviorData.joltTuning);
      }
      return true;
    }

    override getNetworkSyncData(
      options: GetNetworkSyncDataOptions
    ): PhysicsCharacter3DNetworkSyncData {
      // This method is called, so we are synchronizing this object.
      // Let's clear the inputs between frames as we control it.
      this._clearInputsBetweenFrames = true;

      return {
        ...super.getNetworkSyncData(options),
        props: {
          sma: this._slopeMaxAngle,
          shm: this._stairHeightMax,
          grav: this._gravity,
          mfs: this._maxFallingSpeed,
          facc: this._forwardAcceleration,
          fdec: this._forwardDeceleration,
          fsm: this._forwardSpeedMax,
          sacc: this._sidewaysAcceleration,
          sdec: this._sidewaysDeceleration,
          ssm: this._sidewaysSpeedMax,
          jumpspeed: this._jumpSpeed,
          jumpsustime: this._jumpSustainTime,
          fwa: this._forwardAngle,
          sbpa: this._shouldBindObjectAndForwardAngle,
          fws: this._currentForwardSpeed,
          sws: this._currentSidewaysSpeed,
          cfs: this._currentFallSpeed,
          cjs: this._currentJumpSpeed,
          cj: this._canJump,
          lek: this._wasLeftKeyPressed,
          rik: this._wasRightKeyPressed,
          upk: this._wasForwardKeyPressed,
          dok: this._wasBackwardKeyPressed,
          juk: this._wasJumpKeyPressed,
          us: this._wasStickUsed,
          sa: this._stickAngle,
          sf: this._stickForce,
          tscjs: this._timeSinceCurrentJumpStart,
          jkhsjs: this._jumpKeyHeldSinceJumpStart,
          mvm: this._movementTuning.movementSpeedMultiplier,
          spm: this._movementTuning.sprintMultiplier,
          air: this._movementTuning.airControl,
          gfr: this._movementTuning.groundFriction,
          afr: this._movementTuning.airFriction,
          vdm: this._movementTuning.verticalVelocityDamping,
          spk: this._wasSprintKeyPressed,
          jms: this._joltTuning.maxStrength,
          jpr: this._joltTuning.penetrationRecoverySpeed,
          jmh: this._joltTuning.maxHits,
          jhc: this._joltTuning.hitReductionCosMaxAngle,
          jsx: this._joltTuning.shapeOffset
            ? this._joltTuning.shapeOffset.x
            : undefined,
          jsy: this._joltTuning.shapeOffset
            ? this._joltTuning.shapeOffset.y
            : undefined,
          jsz: this._joltTuning.shapeOffset
            ? this._joltTuning.shapeOffset.z
            : undefined,
          jwc: this._joltTuning.walkStairsCosAngleForwardContact,
          jwd: this._joltTuning.walkStairsStepDownExtra,
          jsd: this._joltTuning.stickToFloorStepDownExtra,
          jpc: this._joltTuning.predictiveContactDistance,
          jci: this._joltTuning.maxCollisionIterations,
          jct: this._joltTuning.maxConstraintIterations,
          jmt: this._joltTuning.minTimeRemaining,
          jco: this._joltTuning.collisionTolerance,
          jcp: this._joltTuning.characterPadding,
        },
      };
    }

    override updateFromNetworkSyncData(
      networkSyncData: PhysicsCharacter3DNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ) {
      super.updateFromNetworkSyncData(networkSyncData, options);

      const behaviorSpecificProps = networkSyncData.props;
      this._slopeMaxAngle = behaviorSpecificProps.sma;
      this._stairHeightMax = behaviorSpecificProps.shm;
      this._gravity = behaviorSpecificProps.grav;
      this._maxFallingSpeed = behaviorSpecificProps.mfs;
      this._forwardAcceleration = behaviorSpecificProps.facc;
      this._forwardDeceleration = behaviorSpecificProps.fdec;
      this._forwardSpeedMax = behaviorSpecificProps.fsm;
      this._sidewaysAcceleration = behaviorSpecificProps.sacc;
      this._sidewaysDeceleration = behaviorSpecificProps.sdec;
      this._sidewaysSpeedMax = behaviorSpecificProps.ssm;
      this._jumpSpeed = behaviorSpecificProps.jumpspeed;
      this._jumpSustainTime = behaviorSpecificProps.jumpsustime;
      this._forwardAngle = behaviorSpecificProps.fwa;
      this._shouldBindObjectAndForwardAngle = behaviorSpecificProps.sbpa;
      this._currentForwardSpeed = behaviorSpecificProps.fws;
      this._currentSidewaysSpeed = behaviorSpecificProps.sws;
      this._currentFallSpeed = behaviorSpecificProps.cfs;
      this._currentJumpSpeed = behaviorSpecificProps.cjs;
      this._canJump = behaviorSpecificProps.cj;
      this._hasPressedForwardKey = behaviorSpecificProps.upk;
      this._hasPressedBackwardKey = behaviorSpecificProps.dok;
      this._hasPressedLeftKey = behaviorSpecificProps.lek;
      this._hasPressedRightKey = behaviorSpecificProps.rik;
      this._hasPressedJumpKey = behaviorSpecificProps.juk;
      this._hasUsedStick = behaviorSpecificProps.us;
      this._stickAngle = behaviorSpecificProps.sa;
      this._stickForce = behaviorSpecificProps.sf;
      this._timeSinceCurrentJumpStart = behaviorSpecificProps.tscjs;
      this._jumpKeyHeldSinceJumpStart = behaviorSpecificProps.jkhsjs;
      this._hasPressedSprintKey = !!behaviorSpecificProps.spk;
      this._wasSprintKeyPressed = !!behaviorSpecificProps.spk;

      if (
        behaviorSpecificProps.mvm !== undefined ||
        behaviorSpecificProps.spm !== undefined ||
        behaviorSpecificProps.air !== undefined ||
        behaviorSpecificProps.gfr !== undefined ||
        behaviorSpecificProps.afr !== undefined ||
        behaviorSpecificProps.vdm !== undefined
      ) {
        this.setMovementTuning({
          movementSpeedMultiplier:
            behaviorSpecificProps.mvm !== undefined
              ? behaviorSpecificProps.mvm
              : this._movementTuning.movementSpeedMultiplier,
          sprintMultiplier:
            behaviorSpecificProps.spm !== undefined
              ? behaviorSpecificProps.spm
              : this._movementTuning.sprintMultiplier,
          airControl:
            behaviorSpecificProps.air !== undefined
              ? behaviorSpecificProps.air
              : this._movementTuning.airControl,
          groundFriction:
            behaviorSpecificProps.gfr !== undefined
              ? behaviorSpecificProps.gfr
              : this._movementTuning.groundFriction,
          airFriction:
            behaviorSpecificProps.afr !== undefined
              ? behaviorSpecificProps.afr
              : this._movementTuning.airFriction,
          verticalVelocityDamping:
            behaviorSpecificProps.vdm !== undefined
              ? behaviorSpecificProps.vdm
              : this._movementTuning.verticalVelocityDamping,
        });
      }

      const joltTuningFromSync: PhysicsCharacter3DJoltTuning = {};
      if (behaviorSpecificProps.jms !== undefined) {
        joltTuningFromSync.maxStrength = behaviorSpecificProps.jms;
      }
      if (behaviorSpecificProps.jpr !== undefined) {
        joltTuningFromSync.penetrationRecoverySpeed = behaviorSpecificProps.jpr;
      }
      if (behaviorSpecificProps.jmh !== undefined) {
        joltTuningFromSync.maxHits = behaviorSpecificProps.jmh;
      }
      if (behaviorSpecificProps.jhc !== undefined) {
        joltTuningFromSync.hitReductionCosMaxAngle = behaviorSpecificProps.jhc;
      }
      if (
        behaviorSpecificProps.jsx !== undefined ||
        behaviorSpecificProps.jsy !== undefined ||
        behaviorSpecificProps.jsz !== undefined
      ) {
        joltTuningFromSync.shapeOffset = {
          x:
            behaviorSpecificProps.jsx !== undefined
              ? behaviorSpecificProps.jsx
              : 0,
          y:
            behaviorSpecificProps.jsy !== undefined
              ? behaviorSpecificProps.jsy
              : 0,
          z:
            behaviorSpecificProps.jsz !== undefined
              ? behaviorSpecificProps.jsz
              : 0,
        };
      }
      if (behaviorSpecificProps.jwc !== undefined) {
        joltTuningFromSync.walkStairsCosAngleForwardContact =
          behaviorSpecificProps.jwc;
      }
      if (behaviorSpecificProps.jwd !== undefined) {
        joltTuningFromSync.walkStairsStepDownExtra = behaviorSpecificProps.jwd;
      }
      if (behaviorSpecificProps.jsd !== undefined) {
        joltTuningFromSync.stickToFloorStepDownExtra = behaviorSpecificProps.jsd;
      }
      if (behaviorSpecificProps.jpc !== undefined) {
        joltTuningFromSync.predictiveContactDistance =
          behaviorSpecificProps.jpc;
      }
      if (behaviorSpecificProps.jci !== undefined) {
        joltTuningFromSync.maxCollisionIterations = behaviorSpecificProps.jci;
      }
      if (behaviorSpecificProps.jct !== undefined) {
        joltTuningFromSync.maxConstraintIterations = behaviorSpecificProps.jct;
      }
      if (behaviorSpecificProps.jmt !== undefined) {
        joltTuningFromSync.minTimeRemaining = behaviorSpecificProps.jmt;
      }
      if (behaviorSpecificProps.jco !== undefined) {
        joltTuningFromSync.collisionTolerance = behaviorSpecificProps.jco;
      }
      if (behaviorSpecificProps.jcp !== undefined) {
        joltTuningFromSync.characterPadding = behaviorSpecificProps.jcp;
      }
      if (Object.keys(joltTuningFromSync).length > 0) {
        this.setJoltTuning(joltTuningFromSync);
      }

      // Clear user inputs between frames only if requested.
      this._clearInputsBetweenFrames = !!options.clearInputs;
    }

    _getPhysicsPosition(result: Jolt.RVec3): Jolt.RVec3 {
      const physics3D = this.getPhysics3D();
      if (!physics3D) {
        result.Set(0, 0, 0);
        return result;
      }
      const { behavior } = physics3D;
      // The character origin is at its feet:
      // - the center is used for X and Y because Box3D origin is at the top-left corner
      // - the origin is used for Z because, when the character is made smaller,
      //   it must stay on the ground and not fell from its old size.
      result.Set(
        this.owner3D.getCenterXInScene() * this._sharedData.worldInvScale,
        this.owner3D.getCenterYInScene() * this._sharedData.worldInvScale,
        this.owner3D.getZ() * this._sharedData.worldInvScale +
          behavior._shapeHalfDepth
      );
      return result;
    }

    _getPhysicsRotation(result: Jolt.Quat): Jolt.Quat {
      // Characters body should not rotate around X and Y.
      const rotation = result.sEulerAngles(
        this.getVec3(0, 0, gdjs.toRad(this.owner3D.getAngle()))
      );
      result.Set(
        rotation.GetX(),
        rotation.GetY(),
        rotation.GetZ(),
        rotation.GetW()
      );
      Jolt.destroy(rotation);
      return result;
    }

    _moveObjectToPhysicsPosition(physicsPosition: Jolt.RVec3): void {
      const physics3D = this.getPhysics3D();
      if (!physics3D) {
        return;
      }
      const { behavior } = physics3D;
      this.owner3D.setCenterXInScene(
        physicsPosition.GetX() * this._sharedData.worldScale
      );
      this.owner3D.setCenterYInScene(
        physicsPosition.GetY() * this._sharedData.worldScale
      );
      this.owner3D.setZ(
        (physicsPosition.GetZ() - behavior._shapeHalfDepth) *
          this._sharedData.worldScale
      );
    }

    _moveObjectToPhysicsRotation(physicsRotation: Jolt.Quat): void {
      const ownerRuntimeObjectAsAny = this.owner3D as any;
      const threeObject =
        ownerRuntimeObjectAsAny &&
        ownerRuntimeObjectAsAny._renderer &&
        ownerRuntimeObjectAsAny._renderer.get3DRendererObject
          ? ownerRuntimeObjectAsAny._renderer.get3DRendererObject()
          : null;
      const targetQuaternion =
        threeObject && typeof (threeObject as any).quaternion === 'object'
          ? ((threeObject as any).quaternion as THREE.Quaternion)
          : this._physicsRotationFallbackQuaternion;
      targetQuaternion.x = physicsRotation.GetX();
      targetQuaternion.y = physicsRotation.GetY();
      targetQuaternion.z = physicsRotation.GetZ();
      targetQuaternion.w = physicsRotation.GetW();
      this._physicsRotationEulerZYX.setFromQuaternion(targetQuaternion);
      // No need to update the rotation for X and Y as CharacterVirtual doesn't change it.
      this.owner3D.setAngle(gdjs.toDegrees(this._physicsRotationEulerZYX.z));
    }

    override onDeActivate() {
      if (!this._physics3D) {
        return;
      }
      this._destroyBody();
    }

    override onActivate() {
      const behavior = this.owner.getBehavior(
        this._physics3DBehaviorName
      ) as gdjs.Physics3DRuntimeBehavior;
      if (!behavior) {
        return;
      }
      behavior._destroyBody();
    }

    override onDestroy() {
      this._destroyedDuringFrameLogic = true;
      this.onDeActivate();
    }

    /**
     * Remove the character and its body from the physics engine.
     * This method is called when:
     * - The Physics3D behavior is deactivated
     * - This behavior is deactivated
     * - The object is destroyed
     */
    _destroyBody() {
      if (this.character) {
        if (this._canBePushed) {
          this.charactersManager.removeCharacter(this.character);
          Jolt.destroy(this.character.GetListener());
        }
        this.collisionChecker.clearContacts();
        // The body is destroyed with the character.
        Jolt.destroy(this.character);
        this.character = null;
        if (this._physics3D) {
          const { behavior } = this._physics3D;
          behavior.resetToDefaultBodyUpdater();
          behavior.resetToDefaultCollisionChecker();
          this._physics3D.behavior._body = null;
          const {
            extendedUpdateSettings,
            broadPhaseLayerFilter,
            objectLayerFilter,
            bodyFilter,
            shapeFilter,
          } = this._physics3D;
          Jolt.destroy(extendedUpdateSettings);
          Jolt.destroy(broadPhaseLayerFilter);
          Jolt.destroy(objectLayerFilter);
          Jolt.destroy(bodyFilter);
          Jolt.destroy(shapeFilter);
          this._physics3D = null;
        }
      }
    }

    override doStepPreEvents(instanceContainer: gdjs.RuntimeInstanceContainer) {
      if (this._autoMovementInputFromKeyboard) {
        this.applyMovementInputFromKeyboard(
          instanceContainer,
          this._keyboardMovementInputBindings,
          this._keyboardMovementInputOptions
        );
      }
      // Trigger createAndAddBody()
      this.getPhysics3D();
    }

    override doStepPostEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      // Trigger createAndAddBody()
      this.getPhysics3D();
    }

    doBeforePhysicsStep(timeDelta: float): void {
      if (!Number.isFinite(timeDelta) || timeDelta <= 0) {
        return;
      }
      if (!this.activated()) {
        return;
      }
      const physics3D = this.getPhysics3D();
      if (!physics3D) {
        return;
      }
      const {
        behavior,
        extendedUpdateSettings,
        broadPhaseLayerFilter,
        objectLayerFilter,
        bodyFilter,
        shapeFilter,
      } = physics3D;
      if (!this.character) {
        return;
      }
      const characterBody = behavior._body;
      if (!characterBody) {
        return;
      }
      const worldInvScale = this._sharedData.worldInvScale;

      const oldX = this.character.GetPosition().GetX();
      const oldY = this.character.GetPosition().GetY();
      const oldZ = this.character.GetPosition().GetZ();

      if (this._shouldBindObjectAndForwardAngle) {
        this._forwardAngle = this.owner.getAngle();
      }

      const isGroundedBeforeMove = this.isOnFloor();
      this.updateCharacterSpeedFromInputs(timeDelta, isGroundedBeforeMove);

      if (this._currentJumpSpeed > 0) {
        this._timeSinceCurrentJumpStart += timeDelta;
      }
      // Check if the jump key is continuously held since
      // the beginning of the jump.
      if (!this._hasPressedJumpKey) {
        this._jumpKeyHeldSinceJumpStart = false;
      }
      if (
        this._canJump &&
        this._hasPressedJumpKey &&
        // Avoid the character to jump in loop when the jump key is held.
        !this._jumpKeyHeldSinceJumpStart
      ) {
        this._currentJumpSpeed = this._jumpSpeed;
        this._currentFallSpeed = 0;
        this._canJump = false;
        this._jumpKeyHeldSinceJumpStart = true;
        this._timeSinceCurrentJumpStart = 0;
      }
      if (!this.isOnFloor()) {
        // Decrease jump speed after the (optional) jump sustain time is over.
        const sustainJumpSpeed =
          this._jumpKeyHeldSinceJumpStart &&
          this._timeSinceCurrentJumpStart < this._jumpSustainTime;
        if (!sustainJumpSpeed) {
          this._currentJumpSpeed = Math.max(
            0,
            this._currentJumpSpeed - this._gravity * timeDelta
          );
        }
        this._currentFallSpeed = Math.min(
          this._maxFallingSpeed,
          this._currentFallSpeed + this._gravity * timeDelta
        );
      }

      // Follow moving platforms.
      let groundVelocityX = 0;
      let groundVelocityY = 0;
      let groundVelocityZ = 0;
      if (this.character.IsSupported()) {
        const shouldFollow = this.updateGroundVelocity(behavior, timeDelta);
        if (shouldFollow) {
          const groundVelocity = this.character.GetGroundVelocity();
          groundVelocityX = groundVelocity.GetX();
          groundVelocityY = groundVelocity.GetY();
          groundVelocityZ = groundVelocity.GetZ();
        }
      }

      // Update walking speed
      let forwardSpeed = this._currentForwardSpeed;
      let sidewaysSpeed = this._currentSidewaysSpeed;
      if (sidewaysSpeed !== 0 && forwardSpeed !== 0) {
        const speedMultiplier =
          this._movementTuning.movementSpeedMultiplier *
          (this._hasPressedSprintKey
            ? this._movementTuning.sprintMultiplier
            : 1);
        const normalizedForwardSpeedMax = Math.max(
          Math.abs(this._forwardSpeedMax * speedMultiplier),
          PhysicsCharacter3DRuntimeBehavior.epsilon
        );
        const normalizedSidewaysSpeedMax = Math.max(
          Math.abs(this._sidewaysSpeedMax * speedMultiplier),
          PhysicsCharacter3DRuntimeBehavior.epsilon
        );
        // It avoids the speed vector to go outside of an ellipse.
        const speedNormalizationInverseRatio = Math.hypot(
          forwardSpeed / normalizedForwardSpeedMax,
          sidewaysSpeed / normalizedSidewaysSpeedMax
        );
        if (speedNormalizationInverseRatio > 1) {
          forwardSpeed /= speedNormalizationInverseRatio;
          sidewaysSpeed /= speedNormalizationInverseRatio;
        }
      }
      forwardSpeed *= worldInvScale;
      sidewaysSpeed *= worldInvScale;
      const angle = gdjs.toRad(this._forwardAngle);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const speedX = forwardSpeed * cosA - sidewaysSpeed * sinA;
      const speedY = forwardSpeed * sinA + sidewaysSpeed * cosA;
      const verticalVelocityDamping = isGroundedBeforeMove
        ? 1
        : this._movementTuning.verticalVelocityDamping;
      const verticalVelocity =
        (this._currentJumpSpeed - this._currentFallSpeed) *
        worldInvScale *
        verticalVelocityDamping;
      this.character.SetLinearVelocity(
        this.getVec3(
          groundVelocityX + speedX,
          groundVelocityY + speedY,
          // The ground velocity is not added on Z as it's handled by mStickToFloorStepDown.
          verticalVelocity
        )
      );

      if (this.isOnFloor()) {
        // Keep the character on the floor when walking down-hill.
        const walkingDistance = Math.max(
          Math.hypot(
            this.character.GetPosition().GetX() - this._oldPhysicsPosition[0],
            this.character.GetPosition().GetY() - this._oldPhysicsPosition[1]
          ),
          Math.hypot(
            this.character.GetLinearVelocity().GetX(),
            this.character.GetLinearVelocity().GetY()
          ) * timeDelta
        );
        this._oldPhysicsPosition[0] = this.character.GetPosition().GetX();
        this._oldPhysicsPosition[1] = this.character.GetPosition().GetY();
        const stickToFloorExtraDown =
          (this._joltTuning.stickToFloorStepDownExtra !== undefined
            ? this._joltTuning.stickToFloorStepDownExtra
            : 0) * worldInvScale;

        // A safety margin is taken as if the ground normal is too steep, the
        // character will fall next step anyway.
        const stickToFloorStepDownZ = Math.max(
          -0.01 -
            stickToFloorExtraDown +
            1.01 *
              Math.min(
                // Follow the platform slope...
                -walkingDistance * this._slopeClimbingFactor,
                // ...and follow a platform falling...
                groundVelocityZ * timeDelta
              ),
          // ...but never fall faster than the max fall speed.
          -this._maxFallingSpeed * worldInvScale * timeDelta
        );
        extendedUpdateSettings.mStickToFloorStepDown.Set(
          0,
          0,
          stickToFloorStepDownZ
        );
      } else {
        extendedUpdateSettings.mStickToFloorStepDown.Set(0, 0, 0);
      }

      this.character.ExtendedUpdate(
        timeDelta,
        this.character.GetUp(),
        extendedUpdateSettings,
        broadPhaseLayerFilter,
        objectLayerFilter,
        bodyFilter,
        shapeFilter,
        this._sharedData.jolt.GetTempAllocator()
      );
      this.collisionChecker.updateContacts();

      if (this.isOnFloor()) {
        this._canJump = true;
        this._currentFallSpeed = 0;
        this._currentJumpSpeed = 0;
      }

      this._wasForwardKeyPressed = this._hasPressedForwardKey;
      this._wasBackwardKeyPressed = this._hasPressedBackwardKey;
      this._wasRightKeyPressed = this._hasPressedRightKey;
      this._wasLeftKeyPressed = this._hasPressedLeftKey;
      this._wasJumpKeyPressed = this._hasPressedJumpKey;
      this._wasSprintKeyPressed = this._hasPressedSprintKey;
      this._wasStickUsed = this._hasUsedStick;

      if (this._clearInputsBetweenFrames) {
        this._hasPressedForwardKey = false;
        this._hasPressedBackwardKey = false;
        this._hasPressedRightKey = false;
        this._hasPressedLeftKey = false;
        this._hasPressedJumpKey = false;
        this._hasPressedSprintKey = false;
        this._hasUsedStick = false;
      }

      this._hasReallyMoved =
        Math.abs(this.character.GetPosition().GetX() - oldX) >
          PhysicsCharacter3DRuntimeBehavior.epsilon ||
        Math.abs(this.character.GetPosition().GetY() - oldY) >
          PhysicsCharacter3DRuntimeBehavior.epsilon ||
        Math.abs(this.character.GetPosition().GetZ() - oldZ) >
          PhysicsCharacter3DRuntimeBehavior.epsilon;
    }

    private updateCharacterSpeedFromInputs(
      timeDelta: float,
      isGrounded: boolean
    ) {
      if (!Number.isFinite(timeDelta) || timeDelta <= 0) {
        return;
      }
      const speedMultiplier =
        this._movementTuning.movementSpeedMultiplier *
        (this._hasPressedSprintKey ? this._movementTuning.sprintMultiplier : 1);
      const forwardSpeedMax = this._forwardSpeedMax * speedMultiplier;
      const sidewaysSpeedMax = this._sidewaysSpeedMax * speedMultiplier;
      const controlFactor = isGrounded ? 1 : this._movementTuning.airControl;
      const frictionFactor = isGrounded
        ? this._movementTuning.groundFriction
        : this._movementTuning.airFriction;
      const forwardAcceleration = this._forwardAcceleration * controlFactor;
      const forwardDeceleration = this._forwardDeceleration * frictionFactor;
      const sidewaysAcceleration = this._sidewaysAcceleration * controlFactor;
      const sidewaysDeceleration = this._sidewaysDeceleration * frictionFactor;

      /** A stick with a half way force targets a lower speed than the maximum speed. */
      let targetedForwardSpeed = 0;
      // Change the speed according to the player's input.
      // TODO Give priority to the last key for faster reaction time.
      if (this._hasPressedBackwardKey !== this._hasPressedForwardKey) {
        if (this._hasPressedBackwardKey) {
          targetedForwardSpeed = -forwardSpeedMax;
        } else if (this._hasPressedForwardKey) {
          targetedForwardSpeed = forwardSpeedMax;
        }
      } else if (this._hasUsedStick) {
        targetedForwardSpeed =
          -forwardSpeedMax *
          this._stickForce *
          Math.sin(gdjs.toRad(this._stickAngle));
      }
      this._currentForwardSpeed =
        PhysicsCharacter3DRuntimeBehavior.getAcceleratedSpeed(
          this._currentForwardSpeed,
          targetedForwardSpeed,
          forwardSpeedMax,
          forwardAcceleration,
          forwardDeceleration,
          timeDelta
        );
      /** A stick with a half way force targets a lower speed than the maximum speed. */
      let targetedSidewaysSpeed = 0;
      if (this._hasPressedLeftKey !== this._hasPressedRightKey) {
        if (this._hasPressedLeftKey) {
          targetedSidewaysSpeed = -sidewaysSpeedMax;
        } else if (this._hasPressedRightKey) {
          targetedSidewaysSpeed = sidewaysSpeedMax;
        }
      } else if (this._hasUsedStick) {
        targetedSidewaysSpeed =
          sidewaysSpeedMax *
          this._stickForce *
          Math.cos(gdjs.toRad(this._stickAngle));
      }
      this._currentSidewaysSpeed =
        PhysicsCharacter3DRuntimeBehavior.getAcceleratedSpeed(
          this._currentSidewaysSpeed,
          targetedSidewaysSpeed,
          sidewaysSpeedMax,
          sidewaysAcceleration,
          sidewaysDeceleration,
          timeDelta
        );
    }

    private static getAcceleratedSpeed(
      currentSpeed: float,
      targetedSpeed: float,
      speedMax: float,
      acceleration: float,
      deceleration: float,
      timeDelta: float
    ): float {
      const safeSpeedMax = Math.max(0, Math.abs(speedMax));
      const safeAcceleration = Math.max(0, acceleration);
      const safeDeceleration = Math.max(0, deceleration);
      const safeTimeDelta = Math.max(0, timeDelta);

      const clampedCurrentSpeed = gdjs.evtTools.common.clamp(
        Number.isFinite(currentSpeed) ? currentSpeed : 0,
        -safeSpeedMax,
        safeSpeedMax
      );
      const clampedTargetedSpeed = gdjs.evtTools.common.clamp(
        Number.isFinite(targetedSpeed) ? targetedSpeed : 0,
        -safeSpeedMax,
        safeSpeedMax
      );

      if (safeTimeDelta === 0 || clampedCurrentSpeed === clampedTargetedSpeed) {
        return clampedCurrentSpeed;
      }

      const shouldAccelerateMagnitude =
        Math.abs(clampedTargetedSpeed) > Math.abs(clampedCurrentSpeed);
      const baseRate = shouldAccelerateMagnitude
        ? safeAcceleration
        : safeDeceleration;
      const turningBackRate = Math.max(safeAcceleration, safeDeceleration);

      if (clampedTargetedSpeed > clampedCurrentSpeed) {
        const rate =
          clampedCurrentSpeed < 0 && clampedTargetedSpeed > 0
            ? turningBackRate
            : baseRate;
        return Math.min(
          clampedTargetedSpeed,
          clampedCurrentSpeed + rate * safeTimeDelta
        );
      }

      const rate =
        clampedCurrentSpeed > 0 && clampedTargetedSpeed < 0
          ? turningBackRate
          : baseRate;
      return Math.max(
        clampedTargetedSpeed,
        clampedCurrentSpeed - rate * safeTimeDelta
      );
    }

    private updateGroundVelocity(
      behavior: Physics3DRuntimeBehavior,
      timeDelta: float
    ): boolean {
      if (!this.character) {
        return false;
      }
      const characterBody = behavior._body;
      if (!characterBody) {
        return false;
      }
      const worldInvScale = this._sharedData.worldInvScale;

      if (!this.character.IsSupported()) {
        return false;
      }

      const groundBody = this._sharedData.physicsSystem
        .GetBodyLockInterface()
        .TryGetBody(this.character.GetGroundBodyID());

      const stillKinematicPlatform =
        groundBody.IsKinematic() &&
        groundBody.GetLinearVelocity().Equals(Jolt.Vec3.prototype.sZero()) &&
        groundBody.GetAngularVelocity().Equals(Jolt.Vec3.prototype.sZero());
      if (stillKinematicPlatform) {
        const groundBehavior = groundBody.gdjsAssociatedBehavior;
        if (groundBehavior) {
          const inverseTimeDelta = 1 / Math.max(timeDelta, 1 / 240);
          // The platform may be moved by position changes instead of velocity.
          // Emulate a velocity from the position changes.
          groundBody.SetLinearVelocity(
            this.getVec3(
              (groundBehavior.owner3D.getX() - groundBehavior._objectOldX) *
                worldInvScale *
                inverseTimeDelta,
              (groundBehavior.owner3D.getY() - groundBehavior._objectOldY) *
                worldInvScale *
                inverseTimeDelta,
              (groundBehavior.owner3D.getZ() - groundBehavior._objectOldZ) *
                worldInvScale *
                inverseTimeDelta
            )
          );
          groundBody.SetAngularVelocity(
            this.getVec3(
              0,
              0,
              gdjs.toRad(
                gdjs.evtTools.common.angleDifference(
                  groundBehavior.owner3D.getAngle(),
                  groundBehavior._objectOldRotationZ
                )
              ) * inverseTimeDelta
            )
          );
        }
      }
      this.character.UpdateGroundVelocity();

      const groundAngularVelocityZ = groundBody.GetAngularVelocity().GetZ();
      if (groundAngularVelocityZ !== 0) {
        // Make the character rotate with the platform on Z axis.
        const angleDelta = groundAngularVelocityZ * timeDelta;
        this.character.SetRotation(
          Jolt.Quat.prototype.sEulerAngles(
            this.getVec3(
              0,
              0,
              this.character
                .GetRotation()
                .GetRotationAngle(Jolt.Vec3.prototype.sAxisZ()) + angleDelta
            )
          )
        );
        // Also update the forward angle to make sure it stays the same
        // relatively to the object angle.
        this._forwardAngle += gdjs.toDegrees(angleDelta);
      }
      if (stillKinematicPlatform) {
        groundBody.SetLinearVelocity(Jolt.Vec3.prototype.sZero());
        groundBody.SetAngularVelocity(Jolt.Vec3.prototype.sZero());
      }

      // Characters should not try to magnet on a body that rolls on the ground.
      const rollingSpeedMax = (1 * Math.PI) / 180;
      const shouldFollow =
        Math.abs(groundBody.GetAngularVelocity().GetX()) < rollingSpeedMax &&
        Math.abs(groundBody.GetAngularVelocity().GetY()) < rollingSpeedMax;
      return shouldFollow;
    }

    onObjectHotReloaded() {}

    /**
     * Get maximum angle of a slope for the Character to run on it as a floor.
     * @returns the slope maximum angle, in degrees.
     */
    getSlopeMaxAngle(): float {
      return this._slopeMaxAngle;
    }

    /**
     * Set the maximum slope angle of the Character.
     * @param slopeMaxAngle The new maximum slope angle.
     */
    setSlopeMaxAngle(slopeMaxAngle: float): void {
      if (slopeMaxAngle < 0 || slopeMaxAngle >= 90) {
        return;
      }
      this._slopeMaxAngle = slopeMaxAngle;

      //Avoid rounding errors
      if (slopeMaxAngle === 45) {
        this._slopeClimbingFactor = 1;
      } else {
        // Avoid a `_slopeClimbingFactor` set to exactly 0.
        // Otherwise, this can lead the floor finding functions to consider
        // a floor to be "too high" to reach, even if the object is very slightly
        // inside it, which can happen because of rounding errors.
        // See "Floating-point error mitigations" tests.
        this._slopeClimbingFactor = Math.max(
          1 / 1024,
          Math.tan(gdjs.toRad(slopeMaxAngle))
        );
      }
      // The floor is in 3D but to go back to 2D trigonometry, we can take the
      // 2D space generated by the floor normal and the Z axis, given that:
      // - The normal keeps the same Z coordinate (as the Z axis is included in the 2D space)
      // - The normal keeps the same length (as the normal is included in the 2D space)
      this._slopeClimbingMinNormalZ = Math.min(
        Math.cos(gdjs.toRad(slopeMaxAngle)),
        1 - 1 / 1024
      );
    }

    getStairHeightMax(): float {
      return this._stairHeightMax;
    }

    setStairHeightMax(stairHeightMax: float): void {
      this._stairHeightMax = stairHeightMax;

      const physics3D = this.getPhysics3D();
      if (!physics3D) {
        return;
      }
      const { extendedUpdateSettings } = physics3D;
      const walkStairsStepUp = stairHeightMax * this._sharedData.worldInvScale;
      extendedUpdateSettings.mWalkStairsStepUp = this.getVec3(
        0,
        0,
        walkStairsStepUp
      );
      // Use default values proportionally;
      // "The factors are arbitrary but works well when tested in a game."
      extendedUpdateSettings.mWalkStairsMinStepForward =
        (0.02 / 0.4) * walkStairsStepUp;
      extendedUpdateSettings.mWalkStairsStepForwardTest =
        (0.15 / 0.4) * walkStairsStepUp;
    }

    /**
     * Get the gravity of the Character.
     * @returns The current gravity.
     */
    getGravity(): float {
      return this._gravity;
    }

    /**
     * Set the gravity of the Character.
     * @param gravity The new gravity.
     */
    setGravity(gravity: float): void {
      this._gravity = gravity;
    }

    /**
     * Get the maximum falling speed of the Character.
     * @returns The maximum falling speed.
     */
    getMaxFallingSpeed(): float {
      return this._maxFallingSpeed;
    }

    /**
     * Set the maximum falling speed of the Character.
     * @param maxFallingSpeed The maximum falling speed.
     * @param tryToPreserveAirSpeed If true and if jumping, tune the current
     * jump speed to preserve the overall speed in the air.
     */
    setMaxFallingSpeed(
      maxFallingSpeed: float,
      tryToPreserveAirSpeed: boolean = false
    ): void {
      if (tryToPreserveAirSpeed && !this.isOnFloor()) {
        // If the falling speed is too high compared to the new max falling speed,
        // reduce it and adapt the jump speed to preserve the overall vertical speed.
        const fallingSpeedOverflow = this._currentFallSpeed - maxFallingSpeed;
        if (fallingSpeedOverflow > 0) {
          this._currentFallSpeed -= fallingSpeedOverflow;
          this._currentJumpSpeed = Math.max(
            0,
            this.getCurrentJumpSpeed() - fallingSpeedOverflow
          );
        }
      }
      this._maxFallingSpeed = maxFallingSpeed;
    }

    /**
     * Get the forward acceleration value of the Character.
     * @returns The current acceleration.
     */
    getForwardAcceleration(): float {
      return this._forwardAcceleration;
    }

    /**
     * Set the forward acceleration of the Character.
     * @param forwardAcceleration The new acceleration.
     */
    setForwardAcceleration(forwardAcceleration: float): void {
      this._forwardAcceleration = forwardAcceleration;
    }

    /**
     * Get the forward deceleration of the Character.
     * @returns The current deceleration.
     */
    getForwardDeceleration(): float {
      return this._forwardDeceleration;
    }

    /**
     * Set the forward deceleration of the Character.
     * @param forwardDeceleration The new deceleration.
     */
    setForwardDeceleration(forwardDeceleration: float): void {
      this._forwardDeceleration = forwardDeceleration;
    }

    /**
     * Get the forward maximum speed of the Character.
     * @returns The maximum speed.
     */
    getForwardSpeedMax(): float {
      return this._forwardSpeedMax;
    }

    /**
     * Set the forward maximum speed of the Character.
     * @param forwardSpeedMax The new maximum speed.
     */
    setForwardSpeedMax(forwardSpeedMax: float): void {
      this._forwardSpeedMax = forwardSpeedMax;
    }

    /**
     * Get the sideways acceleration value of the Character.
     * @returns The current acceleration.
     */
    getSidewaysAcceleration(): float {
      return this._sidewaysAcceleration;
    }

    /**
     * Set the sideways acceleration of the Character.
     * @param sidewaysAcceleration The new acceleration.
     */
    setSidewaysAcceleration(sidewaysAcceleration: float): void {
      this._sidewaysAcceleration = sidewaysAcceleration;
    }

    /**
     * Get the sideways deceleration of the Character.
     * @returns The current deceleration.
     */
    getSidewaysDeceleration(): float {
      return this._sidewaysDeceleration;
    }

    /**
     * Set the sideways deceleration of the Character.
     * @param sidewaysDeceleration The new deceleration.
     */
    setSidewaysDeceleration(sidewaysDeceleration: float): void {
      this._sidewaysDeceleration = sidewaysDeceleration;
    }

    /**
     * Get the sideways maximum speed of the Character.
     * @returns The maximum speed.
     */
    getSidewaysSpeedMax(): float {
      return this._sidewaysSpeedMax;
    }

    /**
     * Set the sideways maximum speed of the Character.
     * @param sidewaysSpeedMax The new maximum speed.
     */
    setSidewaysSpeedMax(sidewaysSpeedMax: float): void {
      this._sidewaysSpeedMax = sidewaysSpeedMax;
    }

    /**
     * Get the jump speed of the Character.
     * @returns The jump speed.
     */
    getJumpSpeed(): float {
      return this._jumpSpeed;
    }

    /**
     * Set the jump speed of the Character.
     * @param jumpSpeed The new jump speed.
     */
    setJumpSpeed(jumpSpeed: float): void {
      this._jumpSpeed = jumpSpeed;
    }

    /**
     * Get the jump sustain time of the Character.
     * @returns The jump sustain time.
     */
    getJumpSustainTime(): float {
      return this._jumpSustainTime;
    }

    /**
     * Set the jump sustain time of the Character.
     * @param jumpSustainTime The new jump sustain time.
     */
    setJumpSustainTime(jumpSustainTime: float): void {
      this._jumpSustainTime = jumpSustainTime;
    }

    getForwardAngle(): float {
      return this._forwardAngle;
    }

    setForwardAngle(angle: float): void {
      this._forwardAngle = angle;
      if (this._shouldBindObjectAndForwardAngle) {
        this.owner.setAngle(angle);
      }
    }

    isForwardAngleAround(degreeAngle: float, tolerance: float) {
      return (
        Math.abs(
          gdjs.evtTools.common.angleDifference(this._forwardAngle, degreeAngle)
        ) <= tolerance
      );
    }

    shouldBindObjectAndForwardAngle(): boolean {
      return this._shouldBindObjectAndForwardAngle;
    }

    setShouldBindObjectAndForwardAngle(
      shouldBindObjectAndForwardAngle: boolean
    ): void {
      this._shouldBindObjectAndForwardAngle = shouldBindObjectAndForwardAngle;
    }

    getPhysicsProfile(): PhysicsCharacter3DPhysicsProfile {
      return {
        slopeMaxAngle: this.getSlopeMaxAngle(),
        stairHeightMax: this.getStairHeightMax(),
        gravity: this.getGravity(),
        maxFallingSpeed: this.getMaxFallingSpeed(),
        forwardAcceleration: this.getForwardAcceleration(),
        forwardDeceleration: this.getForwardDeceleration(),
        forwardSpeedMax: this.getForwardSpeedMax(),
        sidewaysAcceleration: this.getSidewaysAcceleration(),
        sidewaysDeceleration: this.getSidewaysDeceleration(),
        sidewaysSpeedMax: this.getSidewaysSpeedMax(),
        jumpSpeed: this.getJumpSpeed(),
        jumpSustainTime: this.getJumpSustainTime(),
        bindObjectAndForwardAngle: this.shouldBindObjectAndForwardAngle(),
        movementTuning: this.getMovementTuning(),
        joltTuning: this.getJoltTuning(),
      };
    }

    setPhysicsProfile(profile: Partial<PhysicsCharacter3DPhysicsProfile>): void {
      if (profile.slopeMaxAngle !== undefined) {
        this.setSlopeMaxAngle(profile.slopeMaxAngle);
      }
      if (profile.stairHeightMax !== undefined) {
        this.setStairHeightMax(profile.stairHeightMax);
      }
      if (profile.gravity !== undefined) {
        this.setGravity(profile.gravity);
      }
      if (profile.maxFallingSpeed !== undefined) {
        this.setMaxFallingSpeed(profile.maxFallingSpeed);
      }
      if (profile.forwardAcceleration !== undefined) {
        this.setForwardAcceleration(profile.forwardAcceleration);
      }
      if (profile.forwardDeceleration !== undefined) {
        this.setForwardDeceleration(profile.forwardDeceleration);
      }
      if (profile.forwardSpeedMax !== undefined) {
        this.setForwardSpeedMax(profile.forwardSpeedMax);
      }
      if (profile.sidewaysAcceleration !== undefined) {
        this.setSidewaysAcceleration(profile.sidewaysAcceleration);
      }
      if (profile.sidewaysDeceleration !== undefined) {
        this.setSidewaysDeceleration(profile.sidewaysDeceleration);
      }
      if (profile.sidewaysSpeedMax !== undefined) {
        this.setSidewaysSpeedMax(profile.sidewaysSpeedMax);
      }
      if (profile.jumpSpeed !== undefined) {
        this.setJumpSpeed(profile.jumpSpeed);
      }
      if (profile.jumpSustainTime !== undefined) {
        this.setJumpSustainTime(profile.jumpSustainTime);
      }
      if (profile.bindObjectAndForwardAngle !== undefined) {
        this.setShouldBindObjectAndForwardAngle(
          profile.bindObjectAndForwardAngle
        );
      }
      if (profile.movementTuning !== undefined) {
        this.setMovementTuning(profile.movementTuning);
      }
      if (profile.joltTuning !== undefined) {
        this.setJoltTuning(profile.joltTuning);
      }
    }

    shouldClearMovementInputsBetweenFrames(): boolean {
      return this._clearInputsBetweenFrames;
    }

    setClearMovementInputsBetweenFrames(clearInputs: boolean): void {
      this._clearInputsBetweenFrames = !!clearInputs;
    }

    getMovementTuning(): PhysicsCharacter3DMovementTuning {
      return { ...this._movementTuning };
    }

    setMovementTuning(
      tuning: Partial<PhysicsCharacter3DMovementTuning>
    ): void {
      const fallback = this._movementTuning;
      this._movementTuning = {
        movementSpeedMultiplier:
          tuning.movementSpeedMultiplier !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                tuning.movementSpeedMultiplier,
                fallback.movementSpeedMultiplier
              )
            : fallback.movementSpeedMultiplier,
        sprintMultiplier:
          tuning.sprintMultiplier !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                tuning.sprintMultiplier,
                fallback.sprintMultiplier
              )
            : fallback.sprintMultiplier,
        airControl:
          tuning.airControl !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                tuning.airControl,
                fallback.airControl
              )
            : fallback.airControl,
        groundFriction:
          tuning.groundFriction !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                tuning.groundFriction,
                fallback.groundFriction
              )
            : fallback.groundFriction,
        airFriction:
          tuning.airFriction !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                tuning.airFriction,
                fallback.airFriction
              )
            : fallback.airFriction,
        verticalVelocityDamping:
          tuning.verticalVelocityDamping !== undefined
            ? PhysicsCharacter3DRuntimeBehavior.toNonNegativeOrFallback(
                tuning.verticalVelocityDamping,
                fallback.verticalVelocityDamping
              )
            : fallback.verticalVelocityDamping,
      };
    }

    resetMovementTuning(): void {
      this._movementTuning = {
        movementSpeedMultiplier: 1,
        sprintMultiplier: 1,
        airControl: 1,
        groundFriction: 1,
        airFriction: 1,
        verticalVelocityDamping: 1,
      };
    }

    getJoltTuning(): PhysicsCharacter3DJoltTuning {
      return PhysicsCharacter3DRuntimeBehavior.cloneJoltTuning(this._joltTuning);
    }

    setJoltTuning(tuning: Partial<PhysicsCharacter3DJoltTuning>): void {
      const sanitizedTuning = this.sanitizeJoltTuning(tuning);
      if (Object.keys(sanitizedTuning).length === 0) {
        return;
      }

      const mergedTuning: PhysicsCharacter3DJoltTuning = {
        ...this._joltTuning,
        ...sanitizedTuning,
        shapeOffset:
          sanitizedTuning.shapeOffset !== undefined
            ? { ...sanitizedTuning.shapeOffset }
            : this._joltTuning.shapeOffset
              ? { ...this._joltTuning.shapeOffset }
              : undefined,
      };
      this._joltTuning = mergedTuning;

      const physics3D = this.getPhysics3D();
      if (!physics3D) {
        return;
      }

      if (this.shouldRecreateCharacterAfterJoltTuningUpdate(sanitizedTuning)) {
        physics3D.behavior.recreateBody();
      }
      this.applyJoltTuningToRuntimeCharacter(physics3D);
    }

    clearJoltTuning(): void {
      this._joltTuning = {};
      const physics3D = this.getPhysics3D();
      if (!physics3D) {
        return;
      }
      physics3D.behavior.recreateBody();
      this.applyJoltTuningToRuntimeCharacter(physics3D);
    }

    getLinearVelocityInPhysicsUnits(): PhysicsCharacter3DVector3 {
      if (!this.character) {
        return { x: 0, y: 0, z: 0 };
      }
      const linearVelocity = this.character.GetLinearVelocity();
      return {
        x: linearVelocity.GetX(),
        y: linearVelocity.GetY(),
        z: linearVelocity.GetZ(),
      };
    }

    getLinearVelocity(): PhysicsCharacter3DVector3 {
      const linearVelocity = this.getLinearVelocityInPhysicsUnits();
      const worldScale = this._sharedData.worldScale;
      return {
        x: linearVelocity.x * worldScale,
        y: linearVelocity.y * worldScale,
        z: linearVelocity.z * worldScale,
      };
    }

    setLinearVelocity(
      linearVelocity: PhysicsCharacter3DVector3,
      inputInPhysicsUnits: boolean = false
    ): void {
      if (!this.character) {
        return;
      }

      const safeVelocityX = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        linearVelocity.x,
        0
      );
      const safeVelocityY = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        linearVelocity.y,
        0
      );
      const safeVelocityZ = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        linearVelocity.z,
        0
      );
      const velocityScale = inputInPhysicsUnits
        ? 1
        : this._sharedData.worldInvScale;
      this.character.SetLinearVelocity(
        this.getVec3(
          safeVelocityX * velocityScale,
          safeVelocityY * velocityScale,
          safeVelocityZ * velocityScale
        )
      );

      const speedScale = inputInPhysicsUnits ? this._sharedData.worldScale : 1;
      const sceneVelocityX = safeVelocityX * speedScale;
      const sceneVelocityY = safeVelocityY * speedScale;
      const sceneVelocityZ = safeVelocityZ * speedScale;
      const forwardAngle = gdjs.toRad(this._forwardAngle);
      const cosA = Math.cos(forwardAngle);
      const sinA = Math.sin(forwardAngle);
      this._currentForwardSpeed = sceneVelocityX * cosA + sceneVelocityY * sinA;
      this._currentSidewaysSpeed = -sceneVelocityX * sinA + sceneVelocityY * cosA;
      if (sceneVelocityZ >= 0) {
        this._currentJumpSpeed = sceneVelocityZ;
        this._currentFallSpeed = 0;
      } else {
        this._currentJumpSpeed = 0;
        this._currentFallSpeed = -sceneVelocityZ;
      }
    }

    addLinearVelocity(
      deltaLinearVelocity: PhysicsCharacter3DVector3,
      inputInPhysicsUnits: boolean = false
    ): void {
      if (!this.character) {
        return;
      }
      const currentVelocity = inputInPhysicsUnits
        ? this.getLinearVelocityInPhysicsUnits()
        : this.getLinearVelocity();
      const deltaX = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        deltaLinearVelocity.x,
        0
      );
      const deltaY = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        deltaLinearVelocity.y,
        0
      );
      const deltaZ = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
        deltaLinearVelocity.z,
        0
      );
      this.setLinearVelocity(
        {
          x: currentVelocity.x + deltaX,
          y: currentVelocity.y + deltaY,
          z: currentVelocity.z + deltaZ,
        },
        inputInPhysicsUnits
      );
    }

    /**
     * Get the current speed of the Character.
     * @returns The current speed.
     */
    getCurrentForwardSpeed(): float {
      return this._currentForwardSpeed;
    }

    /**
     * Set the current speed of the Character.
     * @param currentForwardSpeed The current speed.
     */
    setCurrentForwardSpeed(currentForwardSpeed: float): void {
      this._currentForwardSpeed = currentForwardSpeed;
    }

    /**
     * Get the current speed of the Character.
     * @returns The current speed.
     */
    getCurrentSidewaysSpeed(): float {
      return this._currentSidewaysSpeed;
    }

    /**
     * Set the current speed of the Character.
     * @param currentSidewaysSpeed The current speed.
     */
    setCurrentSidewaysSpeed(currentSidewaysSpeed: float): void {
      this._currentSidewaysSpeed = currentSidewaysSpeed;
    }

    /**
     * Get the speed at which the object is falling. It is 0 when the object is
     * on a floor, and non 0 as soon as the object leaves the floor.
     * @returns The current fall speed.
     */
    getCurrentFallSpeed(): float {
      return this._currentFallSpeed;
    }

    /**
     * Set the current fall speed.
     */
    setCurrentFallSpeed(currentFallSpeed: float) {
      this._currentFallSpeed = gdjs.evtTools.common.clamp(
        currentFallSpeed,
        0,
        this._maxFallingSpeed
      );
    }

    /**
     * Get the current jump speed of the Character.
     * @returns The current jump speed.
     */
    getCurrentJumpSpeed(): float {
      return this._currentJumpSpeed;
    }

    /**
     * Set the current jump speed.
     */
    setCurrentJumpSpeed(currentJumpSpeed: float) {
      this._currentJumpSpeed = Math.max(0, currentJumpSpeed);
    }

    /**
     * Check if the Character can jump.
     * @returns Returns true if the object can jump.
     */
    canJump(): boolean {
      return this._canJump;
    }

    /**
     * Allow the Character to jump again.
     */
    setCanJump(): void {
      this._canJump = true;
    }

    /**
     * Forbid the Character to air jump.
     */
    setCanNotAirJump(): void {
      if (this.isJumping() || this.isFalling()) {
        this._canJump = false;
      }
    }

    /**
     * Abort the current jump.
     *
     * When the character is not in the jumping state this method has no effect.
     */
    abortJump(): void {
      if (this.isJumping()) {
        this._currentFallSpeed = 0;
        this._currentJumpSpeed = 0;
      }
    }

    getMovementInputState(): PhysicsCharacter3DMovementInputState {
      const isStickUsed = this._hasUsedStick;
      const stickAngle = isStickUsed ? this._stickAngle : 0;
      const stickForce = isStickUsed ? this._stickForce : 0;
      let stickForwardAxis = 0;
      let stickRightAxis = 0;
      if (isStickUsed && stickForce > PhysicsCharacter3DRuntimeBehavior.epsilon) {
        const stickAngleInRadians = gdjs.toRad(stickAngle);
        stickForwardAxis = -Math.sin(stickAngleInRadians) * stickForce;
        stickRightAxis = Math.cos(stickAngleInRadians) * stickForce;
      }

      return {
        forward: this._hasPressedForwardKey,
        backward: this._hasPressedBackwardKey,
        left: this._hasPressedLeftKey,
        right: this._hasPressedRightKey,
        jump: this._hasPressedJumpKey,
        sprint: this._hasPressedSprintKey,
        stickForwardAxis,
        stickRightAxis,
        stickAngle,
        stickForce,
      };
    }

    clearMovementInputState(clearStick: boolean = true): void {
      this._hasPressedForwardKey = false;
      this._hasPressedBackwardKey = false;
      this._hasPressedLeftKey = false;
      this._hasPressedRightKey = false;
      this._hasPressedJumpKey = false;
      this._hasPressedSprintKey = false;
      if (clearStick) {
        this._hasUsedStick = false;
        this._stickAngle = 0;
        this._stickForce = 0;
      }
    }

    setMovementInputState(
      inputState: Partial<PhysicsCharacter3DMovementInputState>,
      resetOtherInputs: boolean = false
    ): void {
      if (resetOtherInputs) {
        this.clearMovementInputState(true);
      }

      if (inputState.forward !== undefined) {
        this._hasPressedForwardKey = !!inputState.forward;
      }
      if (inputState.backward !== undefined) {
        this._hasPressedBackwardKey = !!inputState.backward;
      }
      if (inputState.left !== undefined) {
        this._hasPressedLeftKey = !!inputState.left;
      }
      if (inputState.right !== undefined) {
        this._hasPressedRightKey = !!inputState.right;
      }
      if (inputState.jump !== undefined) {
        this._hasPressedJumpKey = !!inputState.jump;
      }
      if (inputState.sprint !== undefined) {
        this._hasPressedSprintKey = !!inputState.sprint;
      }

      const hasStickAxesInput =
        inputState.stickForwardAxis !== undefined ||
        inputState.stickRightAxis !== undefined;
      if (hasStickAxesInput) {
        const currentInputState = this.getMovementInputState();
        const stickFromAxes = PhysicsCharacter3DRuntimeBehavior.getStickFromAxes(
          inputState.stickForwardAxis !== undefined
            ? inputState.stickForwardAxis
            : currentInputState.stickForwardAxis,
          inputState.stickRightAxis !== undefined
            ? inputState.stickRightAxis
            : currentInputState.stickRightAxis
        );
        if (stickFromAxes.force <= PhysicsCharacter3DRuntimeBehavior.epsilon) {
          this._hasUsedStick = false;
          this._stickForce = 0;
        } else {
          this._hasUsedStick = true;
          this._stickAngle = stickFromAxes.angle;
          this._stickForce = stickFromAxes.force;
        }
        return;
      }

      if (
        inputState.stickAngle !== undefined ||
        inputState.stickForce !== undefined
      ) {
        const currentInputState = this.getMovementInputState();
        const safeStickForce = PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
          inputState.stickForce,
          0,
          1,
          currentInputState.stickForce
        );
        if (safeStickForce <= PhysicsCharacter3DRuntimeBehavior.epsilon) {
          this._hasUsedStick = false;
          this._stickForce = 0;
        } else {
          this._hasUsedStick = true;
          this._stickAngle = PhysicsCharacter3DRuntimeBehavior.toFiniteOrFallback(
            inputState.stickAngle,
            currentInputState.stickAngle
          );
          this._stickForce = safeStickForce;
        }
      }
    }

    applyMovementInputAxes(
      forwardAxis: float,
      rightAxis: float,
      options?: Partial<PhysicsCharacter3DMovementAxesOptions>
    ): void {
      const mergedOptions =
        PhysicsCharacter3DRuntimeBehavior.getMergedMovementAxesOptions(options);
      const safeForwardAxis = PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
        forwardAxis,
        -1,
        1,
        0
      );
      const safeRightAxis = PhysicsCharacter3DRuntimeBehavior.toClampedOrFallback(
        rightAxis,
        -1,
        1,
        0
      );
      if (mergedOptions.simulateDigitalKeys) {
        this._hasPressedForwardKey = safeForwardAxis >= mergedOptions.digitalThreshold;
        this._hasPressedBackwardKey =
          safeForwardAxis <= -mergedOptions.digitalThreshold;
        this._hasPressedRightKey = safeRightAxis >= mergedOptions.digitalThreshold;
        this._hasPressedLeftKey = safeRightAxis <= -mergedOptions.digitalThreshold;
      }

      const stickFromAxes = PhysicsCharacter3DRuntimeBehavior.getStickFromAxes(
        safeForwardAxis,
        safeRightAxis
      );
      const stickForce = Math.min(
        1,
        stickFromAxes.force * mergedOptions.forceMultiplier
      );
      if (stickForce <= mergedOptions.deadZone) {
        this._hasUsedStick = false;
        this._stickForce = 0;
        return;
      }
      this._hasUsedStick = true;
      this._stickAngle = stickFromAxes.angle;
      this._stickForce = stickForce;
    }

    isAutoMovementInputFromKeyboardEnabled(): boolean {
      return this._autoMovementInputFromKeyboard;
    }

    setAutoMovementInputFromKeyboard(enabled: boolean): void {
      this._autoMovementInputFromKeyboard = !!enabled;
    }

    getKeyboardMovementInputBindings(): PhysicsCharacter3DMovementInputBindings {
      return PhysicsCharacter3DRuntimeBehavior.getMergedMovementInputBindings(
        this._keyboardMovementInputBindings
      );
    }

    setKeyboardMovementInputBindings(
      inputBindings: Partial<PhysicsCharacter3DMovementInputBindings>
    ): void {
      this._keyboardMovementInputBindings =
        PhysicsCharacter3DRuntimeBehavior.getMergedMovementInputBindings({
          ...this._keyboardMovementInputBindings,
          ...inputBindings,
        });
    }

    resetKeyboardMovementInputBindings(): void {
      this._keyboardMovementInputBindings =
        PhysicsCharacter3DRuntimeBehavior.getMergedMovementInputBindings();
    }

    getKeyboardMovementInputOptions(): PhysicsCharacter3DKeyboardInputOptions {
      return { ...this._keyboardMovementInputOptions };
    }

    setKeyboardMovementInputOptions(
      options: Partial<PhysicsCharacter3DKeyboardInputOptions>
    ): void {
      this._keyboardMovementInputOptions =
        PhysicsCharacter3DRuntimeBehavior.getMergedKeyboardInputOptions({
          ...this._keyboardMovementInputOptions,
          ...options,
        });
    }

    resetKeyboardMovementInputOptions(): void {
      this._keyboardMovementInputOptions =
        PhysicsCharacter3DRuntimeBehavior.getMergedKeyboardInputOptions();
    }

    sampleMovementInputFromKeyboard(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      inputBindings?: Partial<PhysicsCharacter3DMovementInputBindings>,
      options?: Partial<PhysicsCharacter3DKeyboardInputOptions>
    ): PhysicsCharacter3DMovementInputState {
      const mergedBindings =
        PhysicsCharacter3DRuntimeBehavior.getMergedMovementInputBindings(
          inputBindings
        );
      const mergedOptions =
        PhysicsCharacter3DRuntimeBehavior.getMergedKeyboardInputOptions(options);
      const inputManager = instanceContainer.getGame().getInputManager();

      const forward = PhysicsCharacter3DRuntimeBehavior.isInputBindingPressed(
        inputManager,
        mergedBindings.forward,
        false
      );
      const backward = PhysicsCharacter3DRuntimeBehavior.isInputBindingPressed(
        inputManager,
        mergedBindings.backward,
        false
      );
      const left = PhysicsCharacter3DRuntimeBehavior.isInputBindingPressed(
        inputManager,
        mergedBindings.left,
        false
      );
      const right = PhysicsCharacter3DRuntimeBehavior.isInputBindingPressed(
        inputManager,
        mergedBindings.right,
        false
      );
      const jump = PhysicsCharacter3DRuntimeBehavior.isInputBindingPressed(
        inputManager,
        mergedBindings.jump,
        mergedOptions.useJustPressedForJump
      );
      const sprint = PhysicsCharacter3DRuntimeBehavior.isInputBindingPressed(
        inputManager,
        mergedBindings.sprint,
        mergedOptions.useJustPressedForSprint
      );

      const stickForwardAxis = (forward ? 1 : 0) - (backward ? 1 : 0);
      const stickRightAxis = (right ? 1 : 0) - (left ? 1 : 0);
      const stickFromAxes = PhysicsCharacter3DRuntimeBehavior.getStickFromAxes(
        stickForwardAxis,
        stickRightAxis
      );

      return {
        forward,
        backward,
        left,
        right,
        jump,
        sprint,
        stickForwardAxis,
        stickRightAxis,
        stickAngle: stickFromAxes.angle,
        stickForce: stickFromAxes.force,
      };
    }

    applyMovementInputFromKeyboard(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      inputBindings?: Partial<PhysicsCharacter3DMovementInputBindings>,
      options?: Partial<PhysicsCharacter3DKeyboardInputOptions>
    ): PhysicsCharacter3DMovementInputState {
      const inputState = this.sampleMovementInputFromKeyboard(
        instanceContainer,
        inputBindings,
        options
      );
      this.setMovementInputState(
        {
          forward: inputState.forward,
          backward: inputState.backward,
          left: inputState.left,
          right: inputState.right,
          jump: inputState.jump,
          sprint: inputState.sprint,
          stickForce: 0,
          stickAngle: 0,
        },
        true
      );
      return inputState;
    }

    simulateForwardKey(): void {
      this._hasPressedForwardKey = true;
    }

    wasForwardKeyPressed(): boolean {
      return this._wasForwardKeyPressed;
    }

    simulateBackwardKey(): void {
      this._hasPressedBackwardKey = true;
    }

    wasBackwardKeyPressed(): boolean {
      return this._wasBackwardKeyPressed;
    }

    simulateRightKey(): void {
      this._hasPressedRightKey = true;
    }

    wasRightKeyPressed(): boolean {
      return this._wasRightKeyPressed;
    }

    simulateLeftKey(): void {
      this._hasPressedLeftKey = true;
    }

    wasLeftKeyPressed(): boolean {
      return this._wasLeftKeyPressed;
    }

    simulateJumpKey(): void {
      this._hasPressedJumpKey = true;
    }

    wasJumpKeyPressed(): boolean {
      return this._wasJumpKeyPressed;
    }

    simulateSprintKey(): void {
      this._hasPressedSprintKey = true;
    }

    wasSprintKeyPressed(): boolean {
      return this._wasSprintKeyPressed;
    }

    isSprinting(): boolean {
      return this._hasPressedSprintKey || this._wasSprintKeyPressed;
    }

    simulateStick(stickAngle: float, stickForce: float) {
      this._hasUsedStick = true;
      this._stickAngle = stickAngle;
      this._stickForce = Math.max(0, Math.min(1, stickForce));
    }

    wasStickUsed(): boolean {
      return this._wasStickUsed;
    }

    getStickAngle(): float {
      return this._wasStickUsed ? this._stickAngle : 0;
    }

    getStickForce(): float {
      return this._wasStickUsed ? this._stickForce : 0;
    }

    // TODO Should we add a "is sliding" condition?
    /**
     * Check if the Character is on a floor.
     * @returns Returns true if on a floor and false if not.
     */
    isOnFloor(): boolean {
      return this.character
        ? this.character.IsSupported() &&
            // Ensure characters don't land on too step floor.
            this.character.GetGroundNormal().GetZ() >=
              this._slopeClimbingMinNormalZ &&
            // Ensure characters don't land on a platform corner while jumping.
            this._currentJumpSpeed <= this._currentFallSpeed
        : false;
    }

    /**
     * Check if the Character is on the given object.
     * @returns Returns true if on the object and false if not.
     */
    isOnFloorObject(physics3DBehavior: gdjs.Physics3DRuntimeBehavior): boolean {
      if (!physics3DBehavior._body || !this.character || !this.isOnFloor()) {
        return false;
      }
      return (
        this.character.GetGroundBodyID().GetIndexAndSequenceNumber() ===
        physics3DBehavior._body.GetID().GetIndexAndSequenceNumber()
      );
    }

    /**
     * Check if the Character is jumping.
     * @returns Returns true if jumping and false if not.
     */
    isJumping(): boolean {
      return this._currentJumpSpeed > 0;
    }

    /**
     * Check if the Character is in the falling state. This is false
     * if the object is jumping, even if the object is going down after reaching
     * the jump peak.
     * @returns Returns true if it is falling and false if not.
     */
    isFallingWithoutJumping(): boolean {
      return !this.isOnFloor() && !this.isJumping();
    }

    /**
     * Check if the Character is "going down", either because it's in the
     * falling state *or* because it's jumping but reached the jump peak and
     * is now going down (because the jump speed can't compensate anymore the
     * falling speed).
     *
     * If you want to check if the object is falling outside of a jump (or because
     * the jump is entirely finished and there is no jump speed applied to the object
     * anymore), consider using `isFallingWithoutJumping`.
     *
     * @returns Returns true if it is "going down" and false if not.
     */
    isFalling(): boolean {
      return (
        this.isFallingWithoutJumping() ||
        (this.isJumping() && this._currentFallSpeed > this._currentJumpSpeed)
      );
    }

    /**
     * Check if the Character is moving.
     * @returns Returns true if it is moving and false if not.
     */
    isMovingEvenALittle(): boolean {
      return (
        (this._hasReallyMoved &&
          (this._currentForwardSpeed !== 0 ||
            this._currentSidewaysSpeed !== 0)) ||
        this._currentJumpSpeed !== 0 ||
        this._currentFallSpeed !== 0
      );
    }

    getJumpSpeedToReach(jumpHeight: float): float {
      // Formulas used in this extension were generated from a math model.
      // They are probably not understandable on their own.
      // If you need to modify them or need to write new feature,
      // please take a look at the platformer extension documentation:
      // https://github.com/4ian/GDevelop/tree/master/Extensions/PlatformBehavior#readme

      jumpHeight = -Math.abs(jumpHeight);

      const gravity = this._gravity;
      const maxFallingSpeed = this._maxFallingSpeed;
      const jumpSustainTime = this._jumpSustainTime;

      const maxFallingSpeedReachedTime = maxFallingSpeed / gravity;

      // The implementation jumps from one quadratic resolution to another
      // to find the right formula to use as the time is unknown.

      const sustainCase = (jumpHeight) => Math.sqrt(-jumpHeight * gravity * 2);
      const maxFallingCase = (jumpHeight) =>
        -gravity * jumpSustainTime +
        maxFallingSpeed +
        Math.sqrt(
          gravity * gravity * jumpSustainTime * jumpSustainTime -
            2 * jumpHeight * gravity -
            maxFallingSpeed * maxFallingSpeed
        );

      let jumpSpeed = 0;
      let peakTime = 0;
      if (maxFallingSpeedReachedTime > jumpSustainTime) {
        // common case
        jumpSpeed =
          -gravity * jumpSustainTime +
          Math.sqrt(
            2 * gravity * gravity * jumpSustainTime * jumpSustainTime -
              4 * jumpHeight * gravity
          );
        peakTime = (gravity * jumpSustainTime + jumpSpeed) / (2 * gravity);
        if (peakTime < jumpSustainTime) {
          jumpSpeed = sustainCase(jumpHeight);
        } else if (peakTime > maxFallingSpeedReachedTime) {
          jumpSpeed = maxFallingCase(jumpHeight);
        }
      } else {
        // affine case can't have a maximum

        // sustain case
        jumpSpeed = sustainCase(jumpHeight);
        peakTime = jumpSpeed / gravity;
        if (peakTime > maxFallingSpeedReachedTime) {
          jumpSpeed = maxFallingCase(jumpHeight);
        }
      }
      return jumpSpeed;
    }
  }

  gdjs.registerBehavior(
    'Physics3D::PhysicsCharacter3D',
    gdjs.PhysicsCharacter3DRuntimeBehavior
  );

  gdjs.runtimeCapabilities.registerBehaviorCapability({
    behaviorType: 'Physics3D::PhysicsCharacter3D',
    methods: {
      setPhysicsProfile: (behavior, profile) =>
        (behavior as gdjs.PhysicsCharacter3DRuntimeBehavior).setPhysicsProfile(
          profile
        ),
      getPhysicsProfile: (behavior) =>
        (behavior as gdjs.PhysicsCharacter3DRuntimeBehavior).getPhysicsProfile(),
      setMovementInputState: (behavior, inputState, resetOtherInputs) =>
        (behavior as gdjs.PhysicsCharacter3DRuntimeBehavior).setMovementInputState(
          inputState,
          resetOtherInputs
        ),
      getMovementInputState: (behavior) =>
        (behavior as gdjs.PhysicsCharacter3DRuntimeBehavior).getMovementInputState(),
      applyMovementInputAxes: (behavior, forwardAxis, rightAxis, options) =>
        (behavior as gdjs.PhysicsCharacter3DRuntimeBehavior).applyMovementInputAxes(
          forwardAxis,
          rightAxis,
          options
        ),
      applyMovementInputFromKeyboard: (
        behavior,
        instanceContainer,
        inputBindings,
        options
      ) =>
        (behavior as gdjs.PhysicsCharacter3DRuntimeBehavior).applyMovementInputFromKeyboard(
          instanceContainer,
          inputBindings,
          options
        ),
    },
  });

  /** @category Behaviors > Physics 3D */
  export namespace PhysicsCharacter3DRuntimeBehavior {
    /**
     * Handle collisions between characters that can push each other.
     */
    export class CharactersManager {
      /** Handle collisions between characters that can push each other. */
      private characterVsCharacterCollision: Jolt.CharacterVsCharacterCollisionSimple;

      constructor(instanceContainer: gdjs.RuntimeInstanceContainer) {
        this.characterVsCharacterCollision =
          new Jolt.CharacterVsCharacterCollisionSimple();
      }

      /**
       * Get the characters manager of an instance container.
       */
      static getManager(instanceContainer: gdjs.RuntimeInstanceContainer) {
        // @ts-ignore
        if (!instanceContainer.charactersManager) {
          //Create the shared manager if necessary.
          // @ts-ignore
          instanceContainer.charactersManager =
            new gdjs.PhysicsCharacter3DRuntimeBehavior.CharactersManager(
              instanceContainer
            );
        }
        // @ts-ignore
        return instanceContainer.charactersManager;
      }

      /**
       * Add a character to the list of characters that can push each other.
       */
      addCharacter(character: Jolt.CharacterVirtual) {
        this.characterVsCharacterCollision.Add(character);
        character.SetCharacterVsCharacterCollision(
          this.characterVsCharacterCollision
        );
      }

      /**
       * Remove a character from the list of characters that can push each other.
       */
      removeCharacter(character: Jolt.CharacterVirtual) {
        this.characterVsCharacterCollision.Remove(character);
      }

      destroy() {
        Jolt.destroy(this.characterVsCharacterCollision);
      }
    }
    gdjs.registerRuntimeSceneUnloadedCallback(function (runtimeScene) {
      gdjs.PhysicsCharacter3DRuntimeBehavior.CharactersManager.getManager(
        runtimeScene
      ).destroy();
    });

    /** @category Behaviors > Physics 3D */
    export class CharacterBodyUpdater
      implements gdjs.Physics3DRuntimeBehavior.BodyUpdater
    {
      characterBehavior: gdjs.PhysicsCharacter3DRuntimeBehavior;

      constructor(characterBehavior: gdjs.PhysicsCharacter3DRuntimeBehavior) {
        this.characterBehavior = characterBehavior;
      }

      createAndAddBody(): Jolt.Body | null {
        const physics3D = this.characterBehavior.getPhysics3D();
        if (!physics3D) {
          return null;
        }
        const { behavior } = physics3D;
        const { _slopeMaxAngle, owner3D, _sharedData } = this.characterBehavior;

        // Jolt doesn't support center of mass offset for characters.
        const shape = behavior.createShapeWithoutMassCenterOffset();

        const settings = new Jolt.CharacterVirtualSettings();
        // Characters innerBody are Kinematic body, they don't allow other
        // characters to push them.
        // The layer 0 doesn't allow any collision as masking them always result to 0.
        // This allows CharacterVsCharacterCollisionSimple to handle the collisions.
        settings.mInnerBodyLayer = this.characterBehavior._canBePushed
          ? 0
          : behavior.getBodyLayer();
        settings.mInnerBodyShape = shape;
        settings.mMass = shape.GetMassProperties().get_mMass();
        settings.mMaxSlopeAngle = gdjs.toRad(_slopeMaxAngle);
        settings.mShape = shape;
        settings.mUp = Jolt.Vec3.prototype.sAxisZ();
        settings.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
        this.characterBehavior.applyJoltTuningToCharacterSettings(settings);
        // TODO Should we make them configurable?
        //settings.mMaxStrength = maxStrength;
        //settings.mCharacterPadding = characterPadding;
        //settings.mPenetrationRecoverySpeed = penetrationRecoverySpeed;
        //settings.mPredictiveContactDistance = predictiveContactDistance;
        const depth = owner3D.getDepth() * _sharedData.worldInvScale;
        const width = owner3D.getWidth() * _sharedData.worldInvScale;
        const height = owner3D.getHeight() * _sharedData.worldInvScale;
        // Only the bottom of the capsule can make a contact with the floor.
        // It avoids characters from sticking to walls.
        const capsuleHalfLength = depth / 2;
        const capsuleRadius = Math.sqrt(width * height) / 2;
        settings.mSupportingVolume = new Jolt.Plane(
          Jolt.Vec3.prototype.sAxisZ(),
          // TODO It's strange that the value is positive.
          // Use a big safety margin as the ground normal will be checked anyway.
          // It only avoids to detect walls as ground.
          capsuleHalfLength -
            capsuleRadius *
              (1 - Math.cos(gdjs.toRad(Math.min(_slopeMaxAngle + 20, 70))))
        );
        const character = new Jolt.CharacterVirtual(
          settings,
          this.characterBehavior._getPhysicsPosition(
            _sharedData.getRVec3(0, 0, 0)
          ),
          behavior._getPhysicsRotation(_sharedData.getQuat(0, 0, 0, 1)),
          _sharedData.physicsSystem
        );
        Jolt.destroy(settings);
        const body = _sharedData.physicsSystem
          .GetBodyLockInterface()
          .TryGetBody(character.GetInnerBodyID());
        if (this.characterBehavior.character) {
          if (this.characterBehavior._canBePushed) {
            this.characterBehavior.charactersManager.removeCharacter(
              this.characterBehavior.character
            );
            // Character.mListener is a plain pointer, it's not destroyed with the character.
            Jolt.destroy(this.characterBehavior.character.GetListener());
          }
          Jolt.destroy(this.characterBehavior.character);
        }
        this.characterBehavior.character = character;
        if (physics3D) {
          this.characterBehavior.applyJoltTuningToRuntimeCharacter(physics3D);
        }

        if (this.characterBehavior._canBePushed) {
          // CharacterVsCharacterCollisionSimple handle characters pushing each other.
          this.characterBehavior.charactersManager.addCharacter(character);

          const characterContactListener =
            new Jolt.CharacterContactListenerJS();
          characterContactListener.OnAdjustBodyVelocity = (
            character,
            body2Ptr,
            linearVelocityPtr,
            angularVelocity
          ) => {};
          characterContactListener.OnContactValidate = (
            character,
            bodyID2,
            subShapeID2
          ) => {
            return true;
          };
          characterContactListener.OnCharacterContactValidate = (
            characterPtr,
            otherCharacterPtr,
            subShapeID2
          ) => {
            // CharacterVsCharacterCollisionSimple doesn't handle collision layers.
            // We have to filter characters ourself.
            const character = Jolt.wrapPointer(
              characterPtr,
              Jolt.CharacterVirtual
            );
            const otherCharacter = Jolt.wrapPointer(
              otherCharacterPtr,
              Jolt.CharacterVirtual
            );

            const body = _sharedData.physicsSystem
              .GetBodyLockInterface()
              .TryGetBody(character.GetInnerBodyID());
            const otherBody = _sharedData.physicsSystem
              .GetBodyLockInterface()
              .TryGetBody(otherCharacter.GetInnerBodyID());

            const physicsBehavior = body.gdjsAssociatedBehavior;
            const otherPhysicsBehavior = otherBody.gdjsAssociatedBehavior;

            if (!physicsBehavior || !otherPhysicsBehavior) {
              return true;
            }
            return physicsBehavior.canCollideAgainst(otherPhysicsBehavior);
          };
          characterContactListener.OnContactAdded = (
            character,
            bodyID2,
            subShapeID2,
            contactPosition,
            contactNormal,
            settings
          ) => {};
          characterContactListener.OnContactPersisted = (
            inCharacter,
            inBodyID2,
            inSubShapeID2,
            inContactPosition,
            inContactNormal,
            ioSettings
          ) => {};
          characterContactListener.OnContactRemoved = (
            inCharacter,
            inBodyID2,
            inSubShapeID2
          ) => {};
          characterContactListener.OnCharacterContactAdded = (
            character,
            otherCharacter,
            subShapeID2,
            contactPosition,
            contactNormal,
            settings
          ) => {};
          characterContactListener.OnCharacterContactPersisted = (
            inCharacter,
            inOtherCharacter,
            inSubShapeID2,
            inContactPosition,
            inContactNormal,
            ioSettings
          ) => {};
          characterContactListener.OnCharacterContactRemoved = (
            inCharacter,
            inOtherCharacter,
            inSubShapeID2
          ) => {};
          characterContactListener.OnContactSolve = (
            character,
            bodyID2,
            subShapeID2,
            contactPosition,
            contactNormal,
            contactVelocity,
            contactMaterial,
            characterVelocity,
            newCharacterVelocity
          ) => {};
          characterContactListener.OnCharacterContactSolve = (
            character,
            otherCharacter,
            subShapeID2,
            contactPosition,
            contactNormal,
            contactVelocity,
            contactMaterial,
            characterVelocityPtr,
            newCharacterVelocityPtr
          ) => {};
          character.SetListener(characterContactListener);
        }

        // TODO This is not really reliable. We could choose to disable it and force user to use the "is on platform" condition.
        //body.SetCollideKinematicVsNonDynamic(true);
        return body;
      }

      updateObjectFromBody() {
        const { character } = this.characterBehavior;
        if (!character) {
          return;
        }
        // We can't rely on the body position because of mCharacterPadding.
        this.characterBehavior._moveObjectToPhysicsPosition(
          character.GetPosition()
        );
        this.characterBehavior._moveObjectToPhysicsRotation(
          character.GetRotation()
        );
      }

      capturePhysicsSnapshot(
        snapshotBuffer: Float32Array,
        snapshotOffset: integer
      ): boolean {
        const physics3D = this.characterBehavior.getPhysics3D();
        if (!physics3D) {
          return false;
        }
        const { character } = this.characterBehavior;
        if (!character) {
          return false;
        }

        const characterPosition = character.GetPosition();
        const characterRotation = character.GetRotation();
        physics3D.behavior._writePhysicsSnapshotValues(
          snapshotBuffer,
          snapshotOffset,
          characterPosition.GetX(),
          characterPosition.GetY(),
          characterPosition.GetZ(),
          characterRotation.GetX(),
          characterRotation.GetY(),
          characterRotation.GetZ(),
          characterRotation.GetW()
        );
        return true;
      }

      updateBodyFromObject() {
        const physics3D = this.characterBehavior.getPhysics3D();
        if (!physics3D) {
          return;
        }
        const { behavior } = physics3D;
        const { character, owner3D, _sharedData } = this.characterBehavior;
        if (!character) {
          return;
        }
        if (
          behavior._objectOldX !== owner3D.getX() ||
          behavior._objectOldY !== owner3D.getY() ||
          behavior._objectOldZ !== owner3D.getZ()
        ) {
          this.updateCharacterPosition();
        }
        if (
          behavior._objectOldRotationX !== owner3D.getRotationX() ||
          behavior._objectOldRotationY !== owner3D.getRotationY() ||
          behavior._objectOldRotationZ !== owner3D.getAngle()
        ) {
          character.SetRotation(
            this.characterBehavior._getPhysicsRotation(
              _sharedData.getQuat(0, 0, 0, 1)
            )
          );
        }
      }

      updateCharacterPosition() {
        const { character, _sharedData } = this.characterBehavior;
        if (!character) {
          return;
        }
        character.SetPosition(
          this.characterBehavior._getPhysicsPosition(
            _sharedData.getRVec3(0, 0, 0)
          )
        );
      }

      recreateShape() {
        const physics3D = this.characterBehavior.getPhysics3D();
        if (!physics3D) {
          return;
        }
        const {
          behavior,
          broadPhaseLayerFilter,
          objectLayerFilter,
          bodyFilter,
          shapeFilter,
        } = physics3D;
        const { character, _sharedData } = this.characterBehavior;
        if (!character) {
          return;
        }
        const shape = behavior.createShapeWithoutMassCenterOffset();
        const isShapeValid = character.SetShape(
          shape,
          Number.MAX_VALUE,
          broadPhaseLayerFilter,
          objectLayerFilter,
          bodyFilter,
          shapeFilter,
          _sharedData.jolt.GetTempAllocator()
        );
        if (!isShapeValid) {
          return;
        }
        character.SetInnerBodyShape(shape);
        character.SetMass(shape.GetMassProperties().get_mMass());

        // shapeHalfDepth may have changed, update the character position accordingly.
        this.updateCharacterPosition();
      }

      destroyBody() {
        this.characterBehavior._destroyBody();
      }
    }

    /**
     * A character is simulated by Jolt before the rest of the physics simulation
     * (see `doBeforePhysicsStep`).
     * This means that contacts with the character would only rarely be recognized by
     * the physics engine if using the default contact listeners.
     * Instead, this class allows to properly track contacts of the character
     * using Jolt `CharacterVirtual::GetActiveContacts`.
     * @category Behaviors > Physics 3D
     */
    export class CharacterCollisionChecker
      implements gdjs.Physics3DRuntimeBehavior.CollisionChecker
    {
      characterBehavior: gdjs.PhysicsCharacter3DRuntimeBehavior;

      _currentContacts: Array<Physics3DRuntimeBehavior> = [];
      _previousContacts: Array<Physics3DRuntimeBehavior> = [];

      constructor(characterBehavior: gdjs.PhysicsCharacter3DRuntimeBehavior) {
        this.characterBehavior = characterBehavior;
      }

      clearContacts(): void {
        this._previousContacts.length = 0;
        this._currentContacts.length = 0;
      }

      updateContacts(): void {
        const swap = this._previousContacts;
        this._previousContacts = this._currentContacts;
        this._currentContacts = swap;
        this._currentContacts.length = 0;

        const { character, _sharedData } = this.characterBehavior;
        if (!character) {
          return;
        }
        const contacts = character.GetActiveContacts();
        for (let index = 0; index < contacts.size(); index++) {
          const contact = contacts.at(index);

          const bodyLockInterface =
            _sharedData.physicsSystem.GetBodyLockInterface();
          const body = bodyLockInterface.TryGetBody(contact.mBodyB);
          const behavior = body.gdjsAssociatedBehavior;
          if (behavior) {
            this._currentContacts.push(behavior);
          }
        }
      }

      isColliding(object: gdjs.RuntimeObject): boolean {
        const { character } = this.characterBehavior;
        if (!character) {
          return false;
        }
        return this._currentContacts.some(
          (behavior) => behavior.owner === object
        );
      }

      hasCollisionStartedWith(object: gdjs.RuntimeObject): boolean {
        const { character } = this.characterBehavior;
        if (!character) {
          return false;
        }
        return (
          this._currentContacts.some((behavior) => behavior.owner === object) &&
          !this._previousContacts.some((behavior) => behavior.owner === object)
        );
      }

      hasCollisionStoppedWith(object: gdjs.RuntimeObject): boolean {
        const { character } = this.characterBehavior;
        if (!character) {
          return false;
        }
        return (
          !this._currentContacts.some(
            (behavior) => behavior.owner === object
          ) &&
          this._previousContacts.some((behavior) => behavior.owner === object)
        );
      }
    }
  }
}
