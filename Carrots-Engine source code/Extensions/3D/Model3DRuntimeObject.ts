namespace gdjs {
  type Model3DAnimation = { name: string; source: string; loop: boolean };
  type AnimatorParameterType = 'float' | 'int' | 'bool' | 'trigger';
  type AnimatorConditionOperator =
    | 'equals'
    | 'notEquals'
    | 'greater'
    | 'greaterOrEquals'
    | 'less'
    | 'lessOrEquals'
    | 'isTrue'
    | 'isFalse'
    | 'triggered';
  type AnimatorParameterValue = number | boolean;
  type AnimatorParameterDefinition = {
    id: string;
    name: string;
    type: AnimatorParameterType;
    defaultValue: AnimatorParameterValue;
  };
  type AnimatorParameterState = AnimatorParameterDefinition & {
    currentValue: AnimatorParameterValue;
  };
  type AnimatorTransitionCondition = {
    id: string;
    parameterId: string;
    operator: AnimatorConditionOperator;
    value: AnimatorParameterValue;
  };
  type AnimatorBlend1DMotion = {
    id: string;
    source: string;
    threshold: number;
    loop: boolean;
  };
  type AnimatorStateDefinition =
    | {
        type: 'clip';
      }
    | {
        type: 'blend1d';
        parameterId: string;
        motions: AnimatorBlend1DMotion[];
      };
  type AnimatorPlaybackMotion = {
    source: string;
    loop: boolean;
    weight: number;
  };
  type AnimatorStatePlayback = {
    type: 'clip' | 'blend1d';
    motions: AnimatorPlaybackMotion[];
    primarySource: string;
  };
  type AnimatorTransition = {
    id: string;
    fromIndex: integer;
    toIndex: integer;
    crossfadeDuration: float | null;
    conditions: AnimatorTransitionCondition[];
  };
  type Model3DMaterialTypeString =
    | 'Basic'
    | 'StandardWithoutMetalness'
    | 'KeepOriginal'
    | 'Matte'
    | 'Standard'
    | 'Glossy'
    | 'Metallic';

  type Model3DObjectNetworkSyncDataType = {
    mt: number;
    op: FloatPoint3D | null;
    cp: FloatPoint3D | null;
    anis: Model3DAnimation[];
    ai: integer;
    ass: float;
    aet: float;
    ap: boolean;
    cfd: float;
  };

  type Model3DObjectNetworkSyncData = Object3DNetworkSyncData &
    Model3DObjectNetworkSyncDataType;

  const ANY_STATE_INDEX = -1;
  const animatorEpsilon = 1 / (1 << 16);

  /**
   * Base parameters for {@link gdjs.Model3DRuntimeObject}
   * @category Objects > 3D Model
   */
  export interface Model3DObjectData extends Object3DData {
    /** The base parameters of the Model3D object */
    content: Object3DDataContent & {
      modelResourceName: string;
      rotationX: number;
      rotationY: number;
      rotationZ: number;
      keepAspectRatio: boolean;
      materialType: Model3DMaterialTypeString;
      originLocation:
        | 'ModelOrigin'
        | 'ObjectCenter'
        | 'BottomCenterZ'
        | 'BottomCenterY'
        | 'TopLeft';
      centerLocation:
        | 'ModelOrigin'
        | 'ObjectCenter'
        | 'BottomCenterZ'
        | 'BottomCenterY';
      animations: Model3DAnimation[];
      crossfadeDuration: float;
      animatorStatesJson?: string;
      animatorParametersJson?: string;
      animatorTransitionsJson?: string;
      ikChainsJson?: string;
      ikPosesJson?: string;
      isCastingShadow: boolean;
      isReceivingShadow: boolean;
    };
  }

  type FloatPoint3D = [float, float, float];

  const getPointForLocation = (location: string): FloatPoint3D | null => {
    switch (location) {
      case 'ModelOrigin':
        return null;
      case 'ObjectCenter':
        return [0.5, 0.5, 0.5];
      case 'BottomCenterZ':
        return [0.5, 0.5, 0];
      case 'BottomCenterY':
        return [0.5, 1, 0.5];
      case 'TopLeft':
        return [0, 0, 0];
      default:
        return null;
    }
  };

  const parseIKLinkBoneNames = (linkBoneNames: string): string[] =>
    linkBoneNames
      .split(',')
      .map((boneName) => boneName.trim())
      .filter((boneName) => !!boneName);

  const normalizeAnimatorParameterValue = (
    parameterType: AnimatorParameterType,
    rawValue: any
  ): AnimatorParameterValue => {
    if (parameterType === 'int') {
      return Number.isFinite(rawValue) ? Math.trunc(rawValue) : 0;
    }
    if (parameterType === 'float') {
      return Number.isFinite(rawValue) ? rawValue : 0;
    }
    return !!rawValue;
  };

  const getDefaultAnimatorConditionOperator = (
    parameterType: AnimatorParameterType
  ): AnimatorConditionOperator => {
    if (parameterType === 'bool') return 'isTrue';
    if (parameterType === 'trigger') return 'triggered';
    return 'greater';
  };

  const parseAnimatorParameters = (
    rawValue: string | null | undefined,
    previousParametersById?: Map<string, AnimatorParameterState>
  ): {
    parametersById: Map<string, AnimatorParameterState>;
    parameterIdsByName: Map<string, string>;
  } => {
    const parametersById = new Map<string, AnimatorParameterState>();
    const parameterIdsByName = new Map<string, string>();
    if (!rawValue) {
      return { parametersById, parameterIdsByName };
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) {
        return { parametersById, parameterIdsByName };
      }

      parsedValue.forEach((rawParameter: any, index: number) => {
        if (!rawParameter || typeof rawParameter !== 'object') return;

        const parameterType: AnimatorParameterType =
          rawParameter.type === 'int' ||
          rawParameter.type === 'bool' ||
          rawParameter.type === 'trigger'
            ? rawParameter.type
            : 'float';
        const id =
          typeof rawParameter.id === 'string' && rawParameter.id
            ? rawParameter.id
            : `parameter-${index}`;
        const name =
          typeof rawParameter.name === 'string' ? rawParameter.name.trim() : '';
        const defaultValue = normalizeAnimatorParameterValue(
          parameterType,
          rawParameter.defaultValue
        );
        const previousParameter = previousParametersById
          ? previousParametersById.get(id)
          : null;

        const parameterState: AnimatorParameterState = {
          id,
          name,
          type: parameterType,
          defaultValue,
          currentValue: previousParameter
            ? normalizeAnimatorParameterValue(
                parameterType,
                previousParameter.currentValue
              )
            : defaultValue,
        };
        parametersById.set(id, parameterState);
        if (name) {
          parameterIdsByName.set(name.toLowerCase(), id);
        }
      });
    } catch (error) {}

    return { parametersById, parameterIdsByName };
  };

  const parseAnimatorTransitions = (
    rawValue: string | null | undefined,
    animationsCount: number,
    parametersById: Map<string, AnimatorParameterState>
  ): AnimatorTransition[] => {
    if (!rawValue) return [];

    try {
      const parsedValue = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) return [];

      return parsedValue.reduce(
        (validTransitions: AnimatorTransition[], rawTransition: any, index) => {
          if (!rawTransition || typeof rawTransition !== 'object') {
            return validTransitions;
          }

          const fromIndex = Math.trunc(rawTransition.fromIndex);
          const toIndex = Math.trunc(rawTransition.toIndex);
          if (
            !Number.isFinite(fromIndex) ||
            !Number.isFinite(toIndex) ||
            fromIndex < ANY_STATE_INDEX ||
            toIndex < 0 ||
            (fromIndex !== ANY_STATE_INDEX && fromIndex >= animationsCount) ||
            toIndex >= animationsCount
          ) {
            return validTransitions;
          }

          const conditions = Array.isArray(rawTransition.conditions)
            ? rawTransition.conditions.reduce(
                (
                  validConditions: AnimatorTransitionCondition[],
                  rawCondition: any,
                  conditionIndex
                ) => {
                  if (!rawCondition || typeof rawCondition !== 'object') {
                    return validConditions;
                  }
                  const parameter = parametersById.get(
                    rawCondition.parameterId
                  );
                  if (!parameter) {
                    return validConditions;
                  }
                  const allowedOperator = [
                    'equals',
                    'notEquals',
                    'greater',
                    'greaterOrEquals',
                    'less',
                    'lessOrEquals',
                    'isTrue',
                    'isFalse',
                    'triggered',
                  ].includes(rawCondition.operator)
                    ? rawCondition.operator
                    : getDefaultAnimatorConditionOperator(parameter.type);

                  validConditions.push({
                    id:
                      typeof rawCondition.id === 'string' && rawCondition.id
                        ? rawCondition.id
                        : `condition-${index}-${conditionIndex}`,
                    parameterId: parameter.id,
                    operator: allowedOperator as AnimatorConditionOperator,
                    value: normalizeAnimatorParameterValue(
                      parameter.type,
                      rawCondition.value
                    ),
                  });
                  return validConditions;
                },
                []
              )
            : [];

          validTransitions.push({
            id:
              typeof rawTransition.id === 'string' && rawTransition.id
                ? rawTransition.id
                : `transition-${index}`,
            fromIndex: fromIndex | 0,
            toIndex: toIndex | 0,
            crossfadeDuration: Number.isFinite(rawTransition.crossfadeDuration)
              ? Math.max(rawTransition.crossfadeDuration, 0)
              : null,
            conditions,
          });
          return validTransitions;
        },
        []
      );
    } catch (error) {
      return [];
    }
  };

  const normalizeAnimatorBlend1DMotion = (
    rawMotion: any,
    index: number
  ): AnimatorBlend1DMotion | null => {
    if (!rawMotion || typeof rawMotion !== 'object') {
      return null;
    }

    const source =
      typeof rawMotion.source === 'string' ? rawMotion.source.trim() : '';
    if (!source) {
      return null;
    }

    return {
      id:
        typeof rawMotion.id === 'string' && rawMotion.id
          ? rawMotion.id
          : `blend-motion-${index}`,
      source,
      threshold: Number.isFinite(rawMotion.threshold) ? rawMotion.threshold : 0,
      loop: !!rawMotion.loop,
    };
  };

  const parseAnimatorStateDefinitions = (
    rawValue: string | null | undefined,
    animationsCount: number
  ): AnimatorStateDefinition[] => {
    const animatorStates: AnimatorStateDefinition[] = [];
    for (let index = 0; index < animationsCount; index++) {
      animatorStates.push({ type: 'clip' });
    }

    if (!rawValue) {
      return animatorStates;
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) {
        return animatorStates;
      }

      for (
        let index = 0;
        index < parsedValue.length && index < animationsCount;
        index++
      ) {
        const rawState = parsedValue[index];
        if (!rawState || typeof rawState !== 'object') {
          continue;
        }

        if (rawState.type !== 'blend1d') {
          animatorStates[index] = { type: 'clip' };
          continue;
        }

        const motions: AnimatorBlend1DMotion[] = Array.isArray(rawState.motions)
          ? rawState.motions.reduce(
              (
                validMotions: AnimatorBlend1DMotion[],
                rawMotion,
                motionIndex
              ) => {
                const motion = normalizeAnimatorBlend1DMotion(
                  rawMotion,
                  motionIndex
                );
                if (motion) {
                  validMotions.push(motion);
                }
                return validMotions;
              },
              []
            )
          : [];
        motions.sort((firstMotion, secondMotion) => {
          if (firstMotion.threshold === secondMotion.threshold) {
            return firstMotion.source.localeCompare(secondMotion.source);
          }
          return firstMotion.threshold - secondMotion.threshold;
        });

        animatorStates[index] = {
          type: 'blend1d',
          parameterId:
            typeof rawState.parameterId === 'string'
              ? rawState.parameterId
              : '',
          motions,
        };
      }
    } catch (error) {
      return animatorStates;
    }

    return animatorStates;
  };

  const computeBlend1DPlaybackMotions = (
    motions: AnimatorBlend1DMotion[],
    parameterValue: number
  ): AnimatorPlaybackMotion[] => {
    if (motions.length === 0) {
      return [];
    }

    if (motions.length === 1) {
      return [
        {
          source: motions[0].source,
          loop: motions[0].loop,
          weight: 1,
        },
      ];
    }

    if (!Number.isFinite(parameterValue)) {
      parameterValue = motions[0].threshold;
    }

    if (parameterValue <= motions[0].threshold) {
      return [
        {
          source: motions[0].source,
          loop: motions[0].loop,
          weight: 1,
        },
      ];
    }

    for (let index = 0; index < motions.length - 1; index++) {
      const currentMotion = motions[index];
      const nextMotion = motions[index + 1];
      if (parameterValue > nextMotion.threshold) {
        continue;
      }

      const range = nextMotion.threshold - currentMotion.threshold;
      if (Math.abs(range) <= animatorEpsilon) {
        return [
          {
            source: nextMotion.source,
            loop: nextMotion.loop,
            weight: 1,
          },
        ];
      }

      const factor = Math.max(
        0,
        Math.min((parameterValue - currentMotion.threshold) / range, 1)
      );
      if (currentMotion.source === nextMotion.source) {
        return [
          {
            source: currentMotion.source,
            loop: currentMotion.loop || nextMotion.loop,
            weight: 1,
          },
        ];
      }

      return [
        {
          source: currentMotion.source,
          loop: currentMotion.loop,
          weight: 1 - factor,
        },
        {
          source: nextMotion.source,
          loop: nextMotion.loop,
          weight: factor,
        },
      ].filter((motion) => motion.weight > animatorEpsilon);
    }

    const lastMotion = motions[motions.length - 1];
    return [
      {
        source: lastMotion.source,
        loop: lastMotion.loop,
        weight: 1,
      },
    ];
  };

  /**
   * A 3D object which displays a 3D model.
   * @category Objects > 3D Model
   */
  export class Model3DRuntimeObject
    extends gdjs.RuntimeObject3D
    implements gdjs.Animatable
  {
    private static readonly _defaultOriginPoint: FloatPoint3D = [0, 0, 0];
    private static readonly _defaultCenterPoint: FloatPoint3D = [0.5, 0.5, 0.5];

    _renderer: gdjs.Model3DRuntimeObjectRenderer;

    _modelResourceName: string;
    _materialType: gdjs.Model3DRuntimeObject.MaterialType =
      gdjs.Model3DRuntimeObject.MaterialType.Standard;

    /**
     * The local point of the model that will be at the object position.
     *
     * Coordinates are between 0 and 1.
     *
     * Its value is `null` when the point is configured to `"ModelOrigin"`
     * because the model origin needs to be evaluated according to the object
     * configuration.
     * @see gdjs.Model3DRuntimeObject3DRenderer.getOriginPoint
     */
    _originPoint: FloatPoint3D | null;
    /**
     * The local point of the model that is used as rotation center.
     *
     * Coordinates are between 0 and 1.
     *
     * Its value is `null` when the point is configured to `"ModelOrigin"`
     * because the model origin needs to be evaluated according to the object
     * configuration.
     * @see gdjs.Model3DRuntimeObject3DRenderer.getCenterPoint
     */
    _centerPoint: FloatPoint3D | null;

    _animations: Model3DAnimation[];
    _currentAnimationIndex: integer = 0;
    _animationSpeedScale: float = 1;
    _animationPaused: boolean = false;
    _crossfadeDuration: float = 0;
    _animatorStateDefinitions: AnimatorStateDefinition[] = [];
    _animatorParametersById: Map<string, AnimatorParameterState> = new Map();
    _animatorParameterIdsByName: Map<string, string> = new Map();
    _animatorTransitions: AnimatorTransition[] = [];
    _isCastingShadow: boolean = true;
    _isReceivingShadow: boolean = true;
    _data: Model3DObjectData;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: Model3DObjectData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);
      this._data = objectData;
      this._modelResourceName = objectData.content.modelResourceName;
      this._animations = objectData.content.animations;
      this._originPoint = getPointForLocation(
        objectData.content.originLocation
      );
      this._centerPoint = getPointForLocation(
        objectData.content.centerLocation
      );
      this._renderer = new gdjs.Model3DRuntimeObjectRenderer(
        this,
        instanceContainer
      );
      this._materialType = this._convertMaterialType(
        objectData.content.materialType
      );
      this._crossfadeDuration = objectData.content.crossfadeDuration || 0;
      this._loadAnimatorGraph(objectData);

      this.setIsCastingShadow(objectData.content.isCastingShadow);
      this.setIsReceivingShadow(objectData.content.isReceivingShadow);
      this.onModelChanged(objectData);
      this._loadIKConfiguration(objectData);

      // *ALWAYS* call `this.onCreated()` at the very end of your object constructor.
      this.onCreated();
    }

    /**
     * To be called after the renderer loaded a Model resource:
     * - After the renderer was instantiated
     * - After reloading the model
     */
    private onModelChanged(objectData: Model3DObjectData) {
      this._updateModel(objectData);
      if (this._animations.length > 0) {
        if (
          this._currentAnimationIndex < 0 ||
          this._currentAnimationIndex >= this._animations.length
        ) {
          this._currentAnimationIndex = 0;
        }
        this._applyAnimatorStatePlayback(this._currentAnimationIndex, true);
      }
    }

    override updateOriginalDimensionsFromObjectData(
      oldObjectData: Object3DData,
      newObjectData: Object3DData
    ): void {
      // Original dimensions must not be reset by `super.updateFromObjectData`.
      // `_updateModel` has a different logic to evaluate them using `keepAspectRatio`.
    }

    updateFromObjectData(
      oldObjectData: Model3DObjectData,
      newObjectData: Model3DObjectData
    ): boolean {
      super.updateFromObjectData(oldObjectData, newObjectData);

      if (
        oldObjectData.content.materialType !==
        newObjectData.content.materialType
      ) {
        this._materialType = this._convertMaterialType(
          newObjectData.content.materialType
        );
      }
      if (
        oldObjectData.content.modelResourceName !==
        newObjectData.content.modelResourceName
      ) {
        this._reloadModel(newObjectData);
      } else if (
        oldObjectData.content.width !== newObjectData.content.width ||
        oldObjectData.content.height !== newObjectData.content.height ||
        oldObjectData.content.depth !== newObjectData.content.depth ||
        oldObjectData.content.rotationX !== newObjectData.content.rotationX ||
        oldObjectData.content.rotationY !== newObjectData.content.rotationY ||
        oldObjectData.content.rotationZ !== newObjectData.content.rotationZ ||
        oldObjectData.content.keepAspectRatio !==
          newObjectData.content.keepAspectRatio ||
        oldObjectData.content.materialType !==
          newObjectData.content.materialType ||
        oldObjectData.content.centerLocation !==
          newObjectData.content.centerLocation
      ) {
        // The center is applied to the model by `_updateModel`.
        this._centerPoint = getPointForLocation(
          newObjectData.content.centerLocation
        );
        this.onModelChanged(newObjectData);
      }
      if (
        oldObjectData.content.originLocation !==
        newObjectData.content.originLocation
      ) {
        this._originPoint = getPointForLocation(
          newObjectData.content.originLocation
        );
        this._renderer.updatePosition();
      }
      if (
        oldObjectData.content.isCastingShadow !==
        newObjectData.content.isCastingShadow
      ) {
        this.setIsCastingShadow(newObjectData.content.isCastingShadow);
      }
      if (
        oldObjectData.content.isReceivingShadow !==
        newObjectData.content.isReceivingShadow
      ) {
        this.setIsReceivingShadow(newObjectData.content.isReceivingShadow);
      }
      if (
        oldObjectData.content.crossfadeDuration !==
        newObjectData.content.crossfadeDuration
      ) {
        this._crossfadeDuration = newObjectData.content.crossfadeDuration || 0;
      }
      if (
        oldObjectData.content.animations !== newObjectData.content.animations ||
        oldObjectData.content.animatorStatesJson !==
          newObjectData.content.animatorStatesJson ||
        oldObjectData.content.animatorParametersJson !==
          newObjectData.content.animatorParametersJson ||
        oldObjectData.content.animatorTransitionsJson !==
          newObjectData.content.animatorTransitionsJson
      ) {
        this._animations = newObjectData.content.animations;
        this._loadAnimatorGraph(newObjectData);

        if (this._currentAnimationIndex >= this._animations.length) {
          this._currentAnimationIndex = 0;
        }

        if (
          this._animations.length > 0 &&
          (oldObjectData.content.animations !==
            newObjectData.content.animations ||
            oldObjectData.content.animatorStatesJson !==
              newObjectData.content.animatorStatesJson)
        ) {
          this._applyAnimatorStatePlayback(this._currentAnimationIndex, true);
        } else {
          this._refreshBlendAnimatorStatePlayback();
        }
      }
      if (
        oldObjectData.content.modelResourceName !==
          newObjectData.content.modelResourceName ||
        oldObjectData.content.ikChainsJson !==
          newObjectData.content.ikChainsJson ||
        oldObjectData.content.ikPosesJson !== newObjectData.content.ikPosesJson
      ) {
        this._loadIKConfiguration(newObjectData);
      }
      return true;
    }

    getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): Model3DObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        mt: this._materialType,
        op: this._originPoint,
        cp: this._centerPoint,
        anis: this._animations,
        ai: this._currentAnimationIndex,
        ass: this._animationSpeedScale,
        aet: this.getAnimationElapsedTime(),
        ap: this._animationPaused,
        cfd: this._crossfadeDuration,
      };
    }

    updateFromNetworkSyncData(
      networkSyncData: Model3DObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.mt !== undefined) {
        this._materialType = networkSyncData.mt;
      }
      if (networkSyncData.op !== undefined) {
        this._originPoint = networkSyncData.op;
      }
      if (networkSyncData.cp !== undefined) {
        this._centerPoint = networkSyncData.cp;
      }
      if (networkSyncData.anis !== undefined) {
        this._animations = networkSyncData.anis;
      }
      if (networkSyncData.ass !== undefined) {
        this.setAnimationSpeedScale(networkSyncData.ass);
      }
      if (networkSyncData.ai !== undefined) {
        this.setAnimationIndex(networkSyncData.ai);
      }
      if (networkSyncData.aet !== undefined) {
        this.setAnimationElapsedTime(networkSyncData.aet);
      }
      if (networkSyncData.ap !== undefined) {
        if (networkSyncData.ap !== this.isAnimationPaused()) {
          networkSyncData.ap ? this.pauseAnimation() : this.resumeAnimation();
        }
      }
      if (networkSyncData.cfd !== undefined) {
        this._crossfadeDuration = networkSyncData.cfd;
      }
    }

    _reloadModel(objectData: Model3DObjectData) {
      this._modelResourceName = objectData.content.modelResourceName;
      this._renderer._reloadModel(this, this._runtimeScene);
      this.onModelChanged(objectData);
    }

    _updateModel(objectData: Model3DObjectData) {
      const rotationX = objectData.content.rotationX || 0;
      const rotationY = objectData.content.rotationY || 0;
      const rotationZ = objectData.content.rotationZ || 0;
      const width = objectData.content.width || 100;
      const height = objectData.content.height || 100;
      const depth = objectData.content.depth || 100;
      const keepAspectRatio = objectData.content.keepAspectRatio;
      this._renderer._updateModel(
        rotationX,
        rotationY,
        rotationZ,
        width,
        height,
        depth,
        keepAspectRatio
      );
    }

    getRenderer(): RuntimeObject3DRenderer {
      return this._renderer;
    }

    _convertMaterialType(
      materialTypeString: string
    ): gdjs.Model3DRuntimeObject.MaterialType {
      switch (materialTypeString) {
        case 'Basic':
          return gdjs.Model3DRuntimeObject.MaterialType.Basic;
        case 'KeepOriginal':
          return gdjs.Model3DRuntimeObject.MaterialType.KeepOriginal;
        case 'StandardWithoutMetalness':
          return gdjs.Model3DRuntimeObject.MaterialType
            .StandardWithoutMetalness;
        case 'Matte':
          return gdjs.Model3DRuntimeObject.MaterialType.Matte;
        case 'Glossy':
          return gdjs.Model3DRuntimeObject.MaterialType.Glossy;
        case 'Metallic':
          return gdjs.Model3DRuntimeObject.MaterialType.Metallic;
        case 'Standard':
        default:
          return gdjs.Model3DRuntimeObject.MaterialType.Standard;
      }
    }

    private _loadAnimatorGraph(objectData: Model3DObjectData): void {
      const { parametersById, parameterIdsByName } = parseAnimatorParameters(
        objectData.content.animatorParametersJson,
        this._animatorParametersById
      );
      this._animatorParametersById = parametersById;
      this._animatorParameterIdsByName = parameterIdsByName;
      this._animatorStateDefinitions = parseAnimatorStateDefinitions(
        objectData.content.animatorStatesJson,
        this._animations.length
      );
      this._animatorTransitions = parseAnimatorTransitions(
        objectData.content.animatorTransitionsJson,
        this._animations.length,
        this._animatorParametersById
      );
    }

    private _loadIKConfiguration(objectData: Model3DObjectData): void {
      const ikChainsJson = objectData.content.ikChainsJson || '';
      const ikPosesJson = objectData.content.ikPosesJson || '';

      if (ikChainsJson) {
        this._renderer.importIKChainsFromJSON(ikChainsJson, true);
      } else {
        this._renderer.clearIKChains();
      }

      if (ikPosesJson) {
        this._renderer.importIKPosesFromJSON(ikPosesJson, true);
      } else {
        this._renderer.clearIKPoses();
      }
    }

    private _getAnimatorStatePlayback(
      animationIndex: number
    ): AnimatorStatePlayback | null {
      if (animationIndex < 0 || animationIndex >= this._animations.length) {
        return null;
      }

      const animation = this._animations[animationIndex];
      const stateDefinition = this._animatorStateDefinitions[animationIndex];
      if (
        stateDefinition &&
        stateDefinition.type === 'blend1d' &&
        stateDefinition.motions.length > 0
      ) {
        const parameterState = stateDefinition.parameterId
          ? this._animatorParametersById.get(stateDefinition.parameterId) ||
            null
          : null;
        const parameterValue =
          parameterState &&
          (parameterState.type === 'float' || parameterState.type === 'int')
            ? Number(parameterState.currentValue)
            : stateDefinition.motions[0].threshold;
        const motions = computeBlend1DPlaybackMotions(
          stateDefinition.motions,
          parameterValue
        );
        if (motions.length > 0) {
          const primaryMotion = motions.reduce((bestMotion, motion) =>
            motion.weight > bestMotion.weight ? motion : bestMotion
          );
          return {
            type: 'blend1d',
            motions,
            primarySource: primaryMotion.source,
          };
        }
      }

      if (!animation.source) {
        return null;
      }

      return {
        type: 'clip',
        motions: [
          {
            source: animation.source,
            loop: animation.loop,
            weight: 1,
          },
        ],
        primarySource: animation.source,
      };
    }

    private _applyAnimatorStatePlayback(
      animationIndex: number,
      ignoreCrossFade: boolean = false,
      crossfadeDuration: float | null = null
    ): void {
      const playback = this._getAnimatorStatePlayback(animationIndex);
      if (!playback) {
        return;
      }

      if (playback.type === 'blend1d') {
        this._renderer.playBlendAnimation(
          playback.motions,
          ignoreCrossFade,
          crossfadeDuration
        );
      } else {
        const primaryMotion = playback.motions[0];
        this._renderer.playAnimation(
          primaryMotion.source,
          primaryMotion.loop,
          ignoreCrossFade,
          crossfadeDuration
        );
      }

      if (this._animationPaused) {
        this._renderer.pauseAnimation();
      }
    }

    private _refreshBlendAnimatorStatePlayback(): void {
      const playback = this._getAnimatorStatePlayback(
        this._currentAnimationIndex
      );
      if (!playback || playback.type !== 'blend1d') {
        return;
      }

      this._renderer.updateBlendAnimation(playback.motions);
      if (this._animationPaused) {
        this._renderer.pauseAnimation();
      }
    }

    private _getAnimatorParameterStateByName(
      parameterName: string
    ): AnimatorParameterState | null {
      if (!parameterName) return null;
      const parameterId = this._animatorParameterIdsByName.get(
        parameterName.toLowerCase()
      );
      if (!parameterId) return null;
      return this._animatorParametersById.get(parameterId) || null;
    }

    private _transitionConditionMatches(
      condition: AnimatorTransitionCondition
    ): boolean {
      const parameterState = this._animatorParametersById.get(
        condition.parameterId
      );
      if (!parameterState) {
        return false;
      }

      const currentValue = parameterState.currentValue;
      switch (condition.operator) {
        case 'greater':
          return Number(currentValue) > Number(condition.value);
        case 'greaterOrEquals':
          return Number(currentValue) >= Number(condition.value);
        case 'less':
          return Number(currentValue) < Number(condition.value);
        case 'lessOrEquals':
          return Number(currentValue) <= Number(condition.value);
        case 'notEquals':
          return currentValue !== condition.value;
        case 'isTrue':
          return !!currentValue;
        case 'isFalse':
          return !currentValue;
        case 'triggered':
          return !!currentValue;
        case 'equals':
        default:
          return currentValue === condition.value;
      }
    }

    private _transitionMatches(transition: AnimatorTransition): boolean {
      if (transition.toIndex === this._currentAnimationIndex) {
        return false;
      }
      if (transition.conditions.length === 0) {
        return true;
      }
      return transition.conditions.every((condition) =>
        this._transitionConditionMatches(condition)
      );
    }

    private _consumeTransitionTriggers(transition: AnimatorTransition): void {
      transition.conditions.forEach((condition) => {
        if (condition.operator !== 'triggered') return;
        const parameterState = this._animatorParametersById.get(
          condition.parameterId
        );
        if (!parameterState || parameterState.type !== 'trigger') return;
        parameterState.currentValue = false;
      });
    }

    private _evaluateAnimatorTransitions(): void {
      if (
        this._animationPaused ||
        this._animations.length === 0 ||
        this._currentAnimationIndex < 0 ||
        this._currentAnimationIndex >= this._animations.length
      ) {
        return;
      }

      const matchingAnyStateTransition =
        this._animatorTransitions.find((transition) => {
          if (transition.fromIndex !== ANY_STATE_INDEX) {
            return false;
          }
          return this._transitionMatches(transition);
        }) || null;

      const matchingTransition =
        matchingAnyStateTransition ||
        this._animatorTransitions.find((transition) => {
          if (transition.fromIndex !== this._currentAnimationIndex) {
            return false;
          }
          return this._transitionMatches(transition);
        }) ||
        null;

      if (!matchingTransition) {
        return;
      }

      if (
        matchingTransition.toIndex < 0 ||
        matchingTransition.toIndex >= this._animations.length
      ) {
        return;
      }

      this._consumeTransitionTriggers(matchingTransition);
      this._currentAnimationIndex = matchingTransition.toIndex;
      this._applyAnimatorStatePlayback(
        matchingTransition.toIndex,
        false,
        matchingTransition.crossfadeDuration
      );
    }

    update(instanceContainer: gdjs.RuntimeInstanceContainer): void {
      const elapsedTime = this.getElapsedTime() / 1000;
      this._refreshBlendAnimatorStatePlayback();
      this._evaluateAnimatorTransitions();
      this._renderer.updateAnimation(elapsedTime);
    }

    /**
     * Get the index of the animation being played.
     * @return The index of the new animation being played
     */
    getAnimationIndex(): number {
      return this._currentAnimationIndex;
    }

    getAnimationCount(): number {
      return this._animations.length;
    }

    /**
     * Change the animation being played.
     * @param animationIndex The index of the new animation to be played
     */
    setAnimationIndex(animationIndex: number): void {
      animationIndex = animationIndex | 0;
      if (
        animationIndex < this._animations.length &&
        this._currentAnimationIndex !== animationIndex &&
        animationIndex >= 0
      ) {
        this._currentAnimationIndex = animationIndex;
        this._applyAnimatorStatePlayback(animationIndex);
      }
    }

    /**
     * Get the name of the animation being played.
     * @return The name of the new animation being played
     */
    getAnimationName(): string {
      if (this._currentAnimationIndex >= this._animations.length) {
        return '';
      }
      return this._animations[this._currentAnimationIndex].name;
    }

    /**
     * Change the animation being played.
     * @param newAnimationName The name of the new animation to be played
     */
    setAnimationName(newAnimationName: string): void {
      if (!newAnimationName) {
        return;
      }
      const animationIndex = this._animations.findIndex(
        (animation) => animation.name === newAnimationName
      );
      if (animationIndex >= 0) {
        this.setAnimationIndex(animationIndex);
      }
    }

    isCurrentAnimationName(name: string): boolean {
      return this.getAnimationName() === name;
    }

    /**
     * Return true if animation has ended.
     * The animation had ended if:
     * - it's not configured as a loop;
     * - the current frame is the last frame;
     * - the last frame has been displayed long enough.
     */
    hasAnimationEnded(): boolean {
      return this._renderer.hasAnimationEnded();
    }

    setIsCastingShadow(value: boolean): void {
      this._isCastingShadow = value;
      this._renderer._updateShadow();
    }

    setIsReceivingShadow(value: boolean): void {
      this._isReceivingShadow = value;
      this._renderer._updateShadow();
    }

    setCrossfadeDuration(duration: number): void {
      if (this._crossfadeDuration === duration) return;
      this._crossfadeDuration = duration;
    }

    getCrossfadeDuration(): number {
      return this._crossfadeDuration;
    }

    setAnimatorNumberParameter(parameterName: string, value: number): void {
      const parameterState =
        this._getAnimatorParameterStateByName(parameterName);
      if (
        !parameterState ||
        (parameterState.type !== 'float' && parameterState.type !== 'int')
      ) {
        return;
      }
      parameterState.currentValue = normalizeAnimatorParameterValue(
        parameterState.type,
        value
      );
    }

    getAnimatorNumberParameter(parameterName: string): number {
      const parameterState =
        this._getAnimatorParameterStateByName(parameterName);
      if (!parameterState) {
        return 0;
      }
      return Number(parameterState.currentValue) || 0;
    }

    setAnimatorBooleanParameter(parameterName: string, value: boolean): void {
      const parameterState =
        this._getAnimatorParameterStateByName(parameterName);
      if (
        !parameterState ||
        (parameterState.type !== 'bool' && parameterState.type !== 'trigger')
      ) {
        return;
      }
      parameterState.currentValue = !!value;
    }

    getAnimatorBooleanParameter(parameterName: string): boolean {
      const parameterState =
        this._getAnimatorParameterStateByName(parameterName);
      if (!parameterState) {
        return false;
      }
      return !!parameterState.currentValue;
    }

    triggerAnimatorParameter(parameterName: string): void {
      const parameterState =
        this._getAnimatorParameterStateByName(parameterName);
      if (!parameterState || parameterState.type !== 'trigger') {
        return;
      }
      parameterState.currentValue = true;
    }

    resetAnimatorTrigger(parameterName: string): void {
      const parameterState =
        this._getAnimatorParameterStateByName(parameterName);
      if (!parameterState || parameterState.type !== 'trigger') {
        return;
      }
      parameterState.currentValue = false;
    }

    isAnimatorBooleanParameterTrue(parameterName: string): boolean {
      return this.getAnimatorBooleanParameter(parameterName);
    }

    configureIKChain(
      chainName: string,
      effectorBoneName: string,
      targetBoneName: string,
      linkBoneNames: string,
      iterationCount: number,
      blendFactor: number,
      minAngle: number,
      maxAngle: number
    ): void {
      this._renderer.configureIKChain(
        chainName,
        effectorBoneName,
        targetBoneName,
        parseIKLinkBoneNames(linkBoneNames),
        iterationCount,
        blendFactor,
        minAngle,
        maxAngle
      );
    }

    setIKTargetPosition(
      chainName: string,
      targetX: float,
      targetY: float,
      targetZ: float
    ): void {
      this._renderer.setIKTargetPosition(chainName, targetX, targetY, targetZ);
    }

    setIKTargetBone(chainName: string, targetBoneName: string): void {
      this._renderer.setIKTargetBone(chainName, targetBoneName);
    }

    setIKEnabled(chainName: string, enabled: boolean): void {
      this._renderer.setIKEnabled(chainName, enabled);
    }

    setIKIterationCount(chainName: string, iterationCount: number): void {
      this._renderer.setIKIterationCount(chainName, iterationCount);
    }

    setIKBlendFactor(chainName: string, blendFactor: number): void {
      this._renderer.setIKBlendFactor(chainName, blendFactor);
    }

    setIKAngleLimits(
      chainName: string,
      minAngleDegrees: number,
      maxAngleDegrees: number
    ): void {
      this._renderer.setIKAngleLimits(
        chainName,
        minAngleDegrees,
        maxAngleDegrees
      );
    }

    setIKTargetTolerance(chainName: string, tolerance: number): void {
      this._renderer.setIKTargetTolerance(chainName, tolerance);
    }

    setIKLinkAngleLimits(
      chainName: string,
      linkBoneName: string,
      minAngleXDegrees: number,
      maxAngleXDegrees: number,
      minAngleYDegrees: number,
      maxAngleYDegrees: number,
      minAngleZDegrees: number,
      maxAngleZDegrees: number
    ): void {
      this._renderer.setIKLinkAngleLimits(
        chainName,
        linkBoneName,
        minAngleXDegrees,
        maxAngleXDegrees,
        minAngleYDegrees,
        maxAngleYDegrees,
        minAngleZDegrees,
        maxAngleZDegrees
      );
    }

    clearIKLinkAngleLimits(chainName: string, linkBoneName: string): void {
      this._renderer.clearIKLinkAngleLimits(chainName, linkBoneName);
    }

    clearIKLinkConstraints(chainName: string): void {
      this._renderer.clearIKLinkConstraints(chainName);
    }

    setIKGizmosEnabled(enabled: boolean): void {
      this._renderer.setIKGizmosEnabled(enabled);
    }

    areIKGizmosEnabled(): boolean {
      return this._renderer.areIKGizmosEnabled();
    }

    removeIKChain(chainName: string): void {
      this._renderer.removeIKChain(chainName);
    }

    clearIKChains(): void {
      this._renderer.clearIKChains();
    }

    hasIKChain(chainName: string): boolean {
      return this._renderer.hasIKChain(chainName);
    }

    getIKChainCount(): number {
      return this._renderer.getIKChainCount();
    }

    getIKChainNames(): string[] {
      return this._renderer.getIKChainNames();
    }

    getIKChainSettings(chainName: string): any {
      return this._renderer.getIKChainSettings(chainName);
    }

    getIKBoneNames(): string[] {
      return this._renderer.getIKBoneNames();
    }

    exportIKChainsToJSON(): string {
      return this._renderer.exportIKChainsToJSON();
    }

    importIKChainsFromJSON(chainsJSON: string, clearExisting: boolean): void {
      this._renderer.importIKChainsFromJSON(chainsJSON, clearExisting);
    }

    saveIKPose(poseName: string): void {
      this._renderer.saveIKPose(poseName);
    }

    applyIKPose(poseName: string): void {
      this._renderer.applyIKPose(poseName);
    }

    removeIKPose(poseName: string): void {
      this._renderer.removeIKPose(poseName);
    }

    clearIKPoses(): void {
      this._renderer.clearIKPoses();
    }

    hasIKPose(poseName: string): boolean {
      return this._renderer.hasIKPose(poseName);
    }

    getIKPoseCount(): number {
      return this._renderer.getIKPoseCount();
    }

    getIKPoseNames(): string[] {
      return this._renderer.getIKPoseNames();
    }

    pinIKTargetToCurrentEffector(chainName: string): void {
      this._renderer.pinIKTargetToCurrentEffector(chainName);
    }

    pinAllIKTargetsToCurrentEffectors(): void {
      this._renderer.pinAllIKTargetsToCurrentEffectors();
    }

    exportIKPosesToJSON(): string {
      return this._renderer.exportIKPosesToJSON();
    }

    importIKPosesFromJSON(posesJSON: string, clearExisting: boolean): void {
      this._renderer.importIKPosesFromJSON(posesJSON, clearExisting);
    }

    override onDeletedFromScene(): void {
      this._renderer.onDestroy();
      super.onDeletedFromScene();
    }

    override onDestroyed(): void {
      this._renderer.onDestroy();
      super.onDestroyed();
    }

    isAnimationPaused() {
      return this._animationPaused;
    }

    pauseAnimation() {
      this._animationPaused = true;
      this._renderer.pauseAnimation();
    }

    resumeAnimation() {
      this._animationPaused = false;
      this._renderer.resumeAnimation();
    }

    getAnimationSpeedScale() {
      return this._animationSpeedScale;
    }

    setAnimationSpeedScale(ratio: float): void {
      this._animationSpeedScale = ratio;
      this._renderer.setAnimationTimeScale(ratio);
    }

    getAnimationElapsedTime(): float {
      return this._renderer.getAnimationElapsedTime();
    }

    setAnimationElapsedTime(time: float): void {
      this._renderer.setAnimationElapsedTime(time);
      if (!this._animationPaused) {
        this._renderer.resumeAnimation();
      }
    }

    getAnimationDuration(): float {
      const playback = this._getAnimatorStatePlayback(
        this._currentAnimationIndex
      );
      if (!playback) {
        return 0;
      }
      return this._renderer.getAnimationDuration(playback.primarySource);
    }

    getCenterX(): float {
      const centerPoint = this._getCenterPointForRuntimeAccess();
      return this.getWidth() * centerPoint[0];
    }

    getCenterY(): float {
      const centerPoint = this._getCenterPointForRuntimeAccess();
      return this.getHeight() * centerPoint[1];
    }

    getCenterZ(): float {
      const centerPoint = this._getCenterPointForRuntimeAccess();
      return this.getDepth() * centerPoint[2];
    }

    getDrawableX(): float {
      const originPoint = this._getOriginPointForRuntimeAccess();
      return this.getX() - this.getWidth() * originPoint[0];
    }

    getDrawableY(): float {
      const originPoint = this._getOriginPointForRuntimeAccess();
      return this.getY() - this.getHeight() * originPoint[1];
    }

    getDrawableZ(): float {
      const originPoint = this._getOriginPointForRuntimeAccess();
      return this.getZ() - this.getDepth() * originPoint[2];
    }

    private _getCenterPointForRuntimeAccess(): FloatPoint3D {
      const renderer = (this as any)._renderer as
        | gdjs.Model3DRuntimeObjectRenderer
        | undefined;
      if (renderer && typeof renderer.getCenterPoint === 'function') {
        return renderer.getCenterPoint();
      }
      if (this._centerPoint) {
        return this._centerPoint;
      }
      return gdjs.Model3DRuntimeObject._defaultCenterPoint;
    }

    private _getOriginPointForRuntimeAccess(): FloatPoint3D {
      const renderer = (this as any)._renderer as
        | gdjs.Model3DRuntimeObjectRenderer
        | undefined;
      if (renderer && typeof renderer.getOriginPoint === 'function') {
        return renderer.getOriginPoint();
      }
      if (this._originPoint) {
        return this._originPoint;
      }
      return gdjs.Model3DRuntimeObject._defaultOriginPoint;
    }
  }

  /** @category Objects > 3D Model */
  export namespace Model3DRuntimeObject {
    export enum MaterialType {
      Basic,
      StandardWithoutMetalness,
      KeepOriginal,
      Matte,
      Standard,
      Glossy,
      Metallic,
    }
  }
  gdjs.registerObject('Scene3D::Model3DObject', gdjs.Model3DRuntimeObject);
}
