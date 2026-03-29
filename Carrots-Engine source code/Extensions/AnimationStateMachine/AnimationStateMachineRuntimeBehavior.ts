namespace gdjs {
  type AnimationStateMachineTransitionMode =
    | 'immediate'
    | 'trigger'
    | 'bool'
    | 'number';

  type AnimationStateMachineComparison =
    | '>'
    | '>='
    | '<'
    | '<='
    | '=='
    | '!=';

  type AnimationStateMachineState = {
    id: string;
    name: string;
    animationName: string;
    x: float;
    y: float;
  };

  type AnimationStateMachineTransition = {
    id: string;
    fromStateId: string;
    toStateId: string;
    mode: AnimationStateMachineTransitionMode;
    trigger: string;
    parameter: string;
    comparison: AnimationStateMachineComparison;
    numberValue: float;
    boolValue: boolean;
    minDuration: float;
  };

  type AnimationStateMachineGraph = {
    version: number;
    defaultStateId: string;
    states: Array<AnimationStateMachineState>;
    transitions: Array<AnimationStateMachineTransition>;
  };

  type AnimatableRuntimeObject = gdjs.RuntimeObject & {
    setAnimationName?: (animationName: string) => void;
    getAnimationName?: () => string;
    playAnimation?: () => void;
  };

  const logger = new gdjs.Logger('AnimationStateMachine');

  const EPSILON = 0.00001;
  const SUPPORTED_COMPARISONS: Array<AnimationStateMachineComparison> = [
    '>',
    '>=',
    '<',
    '<=',
    '==',
    '!=',
  ];
  const SUPPORTED_MODES: Array<AnimationStateMachineTransitionMode> = [
    'immediate',
    'trigger',
    'bool',
    'number',
  ];

  const parseFiniteNumber = (value: any, fallbackValue: number): number => {
    const parsedValue =
      typeof value === 'number' ? value : Number.parseFloat(String(value || ''));
    return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
  };

  const toBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on' ||
      normalized === '1'
    );
  };

  const normalizeId = (value: any, fallbackValue: string): string => {
    const raw = String(value || '').trim();
    return raw ? raw : fallbackValue;
  };

  const normalizeMode = (
    value: any
  ): AnimationStateMachineTransitionMode => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (
      SUPPORTED_MODES.indexOf(
        normalized as AnimationStateMachineTransitionMode
      ) !== -1
    ) {
      return normalized as AnimationStateMachineTransitionMode;
    }
    return 'immediate';
  };

  const normalizeComparison = (
    value: any
  ): AnimationStateMachineComparison => {
    const normalized = String(value || '').trim();
    if (
      SUPPORTED_COMPARISONS.indexOf(
        normalized as AnimationStateMachineComparison
      ) !== -1
    ) {
      return normalized as AnimationStateMachineComparison;
    }
    return '>';
  };

  const createDefaultGraph = (): AnimationStateMachineGraph => ({
    version: 1,
    defaultStateId: 'idle',
    states: [
      { id: 'idle', name: 'idle', animationName: 'idle', x: 220, y: 260 },
      { id: 'run', name: 'run', animationName: 'run', x: 620, y: 260 },
    ],
    transitions: [
      {
        id: 'idle-to-run',
        fromStateId: 'idle',
        toStateId: 'run',
        mode: 'number',
        trigger: '',
        parameter: 'speed',
        comparison: '>',
        numberValue: 0.1,
        boolValue: true,
        minDuration: 0,
      },
      {
        id: 'run-to-idle',
        fromStateId: 'run',
        toStateId: 'idle',
        mode: 'number',
        trigger: '',
        parameter: 'speed',
        comparison: '<=',
        numberValue: 0.1,
        boolValue: true,
        minDuration: 0,
      },
    ],
  });

  const parseGraphDefinition = (
    graphDefinition: string
  ): AnimationStateMachineGraph => {
    const fallbackGraph = createDefaultGraph();
    let parsedValue: any = null;

    try {
      parsedValue = JSON.parse(String(graphDefinition || '').trim() || '{}');
    } catch (error) {
      return fallbackGraph;
    }

    if (!parsedValue || typeof parsedValue !== 'object') return fallbackGraph;

    const states = Array.isArray(parsedValue.states)
      ? parsedValue.states
          .map((rawState, index) => {
            if (!rawState || typeof rawState !== 'object') return null;
            const fallbackId = `state-${index + 1}`;
            return {
              id: normalizeId(rawState.id, fallbackId),
              name: normalizeId(rawState.name, fallbackId),
              animationName: String(rawState.animationName || '').trim(),
              x: parseFiniteNumber(rawState.x, 240 + index * 240),
              y: parseFiniteNumber(rawState.y, 220 + (index % 3) * 140),
            };
          })
          .filter((state): state is AnimationStateMachineState => !!state)
      : [];

    if (!states.length) {
      return fallbackGraph;
    }

    const stateById = new Set(states.map(state => state.id));
    const transitions = Array.isArray(parsedValue.transitions)
      ? parsedValue.transitions
          .map((rawTransition, index) => {
            if (!rawTransition || typeof rawTransition !== 'object') return null;
            const fromStateId = normalizeId(rawTransition.fromStateId, '');
            const toStateId = normalizeId(rawTransition.toStateId, '');
            if (!stateById.has(fromStateId) || !stateById.has(toStateId)) {
              return null;
            }
            return {
              id: normalizeId(rawTransition.id, `transition-${index + 1}`),
              fromStateId,
              toStateId,
              mode: normalizeMode(rawTransition.mode),
              trigger: String(rawTransition.trigger || '').trim(),
              parameter: String(rawTransition.parameter || '').trim(),
              comparison: normalizeComparison(rawTransition.comparison),
              numberValue: parseFiniteNumber(rawTransition.numberValue, 0),
              boolValue: toBoolean(rawTransition.boolValue),
              minDuration: Math.max(
                0,
                parseFiniteNumber(rawTransition.minDuration, 0)
              ),
            };
          })
          .filter(
            (transition): transition is AnimationStateMachineTransition =>
              !!transition
          )
      : [];

    const defaultStateId = normalizeId(
      parsedValue.defaultStateId,
      states[0].id
    );

    return {
      version: parseFiniteNumber(parsedValue.version, 1),
      defaultStateId: stateById.has(defaultStateId) ? defaultStateId : states[0].id,
      states,
      transitions,
    };
  };

  /**
   * @category Behaviors > Animation
   */
  export class AnimationStateMachineRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _autoApplyAnimation: boolean;
    private _defaultStateId: string;
    private _graphDefinition: string;
    private _graph: AnimationStateMachineGraph;
    private _stateById: Map<string, AnimationStateMachineState>;
    private _outgoingTransitionsByStateId: Map<
      string,
      Array<AnimationStateMachineTransition>
    >;
    private _currentStateId: string;
    private _stateElapsedTimeSeconds: number;
    private _numberParameters: Map<string, number>;
    private _booleanParameters: Map<string, boolean>;
    private _pendingTriggers: Set<string>;
    private _lastAppliedAnimationName: string;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData: any,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      this._enabled =
        behaviorData.enabled === undefined ? true : toBoolean(behaviorData.enabled);
      this._autoApplyAnimation =
        behaviorData.autoApplyAnimation === undefined
          ? true
          : toBoolean(behaviorData.autoApplyAnimation);
      this._defaultStateId = String(behaviorData.defaultState || '').trim();
      this._graphDefinition = String(behaviorData.graphDefinition || '').trim();
      this._graph = createDefaultGraph();
      this._stateById = new Map();
      this._outgoingTransitionsByStateId = new Map();
      this._currentStateId = '';
      this._stateElapsedTimeSeconds = 0;
      this._numberParameters = new Map();
      this._booleanParameters = new Map();
      this._pendingTriggers = new Set();
      this._lastAppliedAnimationName = '';
      this._reloadGraphInternal();
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      let shouldReloadGraph = false;

      if (behaviorData.enabled !== undefined) {
        this._enabled = toBoolean(behaviorData.enabled);
      }
      if (behaviorData.autoApplyAnimation !== undefined) {
        this._autoApplyAnimation = toBoolean(behaviorData.autoApplyAnimation);
      }
      if (behaviorData.defaultState !== undefined) {
        this._defaultStateId = String(behaviorData.defaultState || '').trim();
        shouldReloadGraph = true;
      }
      if (behaviorData.graphDefinition !== undefined) {
        this._graphDefinition = String(behaviorData.graphDefinition || '').trim();
        shouldReloadGraph = true;
      }

      if (shouldReloadGraph) this._reloadGraphInternal();
      return true;
    }

    doStepPreEvents(instanceContainer: gdjs.RuntimeInstanceContainer): void {
      if (!this._enabled) {
        this._pendingTriggers.clear();
        return;
      }

      this._ensureCurrentState();
      const elapsedTimeSeconds = parseFiniteNumber(
        instanceContainer.getElapsedTime() / 1000,
        0
      );
      this._stateElapsedTimeSeconds += Math.max(0, elapsedTimeSeconds);

      const outgoingTransitions =
        this._outgoingTransitionsByStateId.get(this._currentStateId) || [];
      for (const transition of outgoingTransitions) {
        if (!this._isTransitionSatisfied(transition)) continue;
        this._switchToState(transition.toStateId);
        if (transition.mode === 'trigger' && transition.trigger) {
          this._pendingTriggers.delete(transition.trigger.toLowerCase());
        }
        break;
      }

      this._applyCurrentStateAnimation();
      this._pendingTriggers.clear();
    }

    doStepPostEvents(_instanceContainer: gdjs.RuntimeInstanceContainer): void {}

    onDeActivate(): void {
      this._pendingTriggers.clear();
    }

    setEnabled(enabled: any): void {
      this._enabled = toBoolean(enabled);
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    reloadDefinition(): void {
      this._reloadGraphInternal();
    }

    getGraphDefinition(): string {
      return this._graphDefinition;
    }

    setGraphDefinition(graphDefinition: string): boolean {
      this._graphDefinition = String(graphDefinition || '').trim();
      this._reloadGraphInternal();
      return true;
    }

    getGraph(): AnimationStateMachineGraph {
      return parseGraphDefinition(this._graphDefinition);
    }

    setGraph(graph: AnimationStateMachineGraph | string): boolean {
      if (typeof graph === 'string') {
        return this.setGraphDefinition(graph);
      }

      try {
        this._graphDefinition = JSON.stringify(graph || createDefaultGraph());
        this._reloadGraphInternal();
        return true;
      } catch (error) {
        return false;
      }
    }

    trigger(triggerName: string): void {
      const normalized = String(triggerName || '')
        .trim()
        .toLowerCase();
      if (!normalized) return;
      this._pendingTriggers.add(normalized);
    }

    setState(stateIdOrName: string): void {
      const stateId = this._findStateIdByIdOrName(stateIdOrName);
      if (!stateId) return;
      this._switchToState(stateId);
    }

    getCurrentState(): string {
      return this._currentStateId;
    }

    getCurrentStateName(): string {
      this._ensureCurrentState();
      const state = this._stateById.get(this._currentStateId);
      return state ? String(state.name || '').trim() : '';
    }

    getDefaultState(): string {
      return this._graph.defaultStateId || '';
    }

    setDefaultState(stateIdOrName: string): void {
      const stateId = this._findStateIdByIdOrName(stateIdOrName);
      if (!stateId) return;
      this._defaultStateId = stateId;
      this._graph = {
        ...this._graph,
        defaultStateId: stateId,
      };
      this._syncGraphDefinitionFromGraph();
      this._ensureCurrentState();
    }

    isInState(stateIdOrName: string): boolean {
      const stateId = this._findStateIdByIdOrName(stateIdOrName);
      return !!stateId && stateId === this._currentStateId;
    }

    hasState(stateIdOrName: string): boolean {
      return !!this._findStateIdByIdOrName(stateIdOrName);
    }

    getCurrentAnimationName(): string {
      this._ensureCurrentState();
      const state = this._stateById.get(this._currentStateId);
      return state ? String(state.animationName || '').trim() : '';
    }

    setNumberParameter(parameterName: string, value: number): void {
      const normalizedParameterName = String(parameterName || '').trim();
      if (!normalizedParameterName) return;
      this._numberParameters.set(
        normalizedParameterName,
        parseFiniteNumber(value, 0)
      );
    }

    getNumberParameter(parameterName: string): number {
      const normalizedParameterName = String(parameterName || '').trim();
      if (!normalizedParameterName) return 0;
      return this._getNumberParameterValue(normalizedParameterName);
    }

    setBooleanParameter(parameterName: string, value: any): void {
      const normalizedParameterName = String(parameterName || '').trim();
      if (!normalizedParameterName) return;
      this._booleanParameters.set(normalizedParameterName, toBoolean(value));
    }

    getBooleanParameter(parameterName: string): boolean {
      const normalizedParameterName = String(parameterName || '').trim();
      if (!normalizedParameterName) return false;
      return this._getBooleanParameterValue(normalizedParameterName);
    }

    private _reloadGraphInternal(): void {
      this._graph = parseGraphDefinition(this._graphDefinition);
      if (this._defaultStateId) {
        const hasCustomDefaultState = this._graph.states.some(
          state => state.id === this._defaultStateId
        );
        if (hasCustomDefaultState) {
          this._graph = {
            ...this._graph,
            defaultStateId: this._defaultStateId,
          };
        }
      }
      this._syncGraphDefinitionFromGraph();

      this._stateById.clear();
      this._outgoingTransitionsByStateId.clear();
      for (const state of this._graph.states) {
        this._stateById.set(state.id, state);
        this._outgoingTransitionsByStateId.set(state.id, []);
      }
      for (const transition of this._graph.transitions) {
        const outgoingTransitions =
          this._outgoingTransitionsByStateId.get(transition.fromStateId) || [];
        outgoingTransitions.push(transition);
        this._outgoingTransitionsByStateId.set(
          transition.fromStateId,
          outgoingTransitions
        );
      }
      this._ensureCurrentState();
      this._stateElapsedTimeSeconds = 0;
      this._lastAppliedAnimationName = '';
      this._applyCurrentStateAnimation();
    }

    private _syncGraphDefinitionFromGraph(): void {
      this._graphDefinition = JSON.stringify(this._graph);
    }

    private _ensureCurrentState(): void {
      if (this._stateById.has(this._currentStateId)) return;
      const fallbackStateId = this._stateById.has(this._graph.defaultStateId)
        ? this._graph.defaultStateId
        : this._graph.states.length
          ? this._graph.states[0].id
          : '';
      this._currentStateId = fallbackStateId;
      this._stateElapsedTimeSeconds = 0;
    }

    private _findStateIdByIdOrName(stateIdOrName: string): string {
      const normalizedValue = String(stateIdOrName || '').trim();
      if (!normalizedValue) return '';
      if (this._stateById.has(normalizedValue)) return normalizedValue;
      const lowerCaseStateName = normalizedValue.toLowerCase();
      for (const state of this._graph.states) {
        if (state.name.toLowerCase() === lowerCaseStateName) return state.id;
      }
      return '';
    }

    private _switchToState(nextStateId: string): void {
      if (!nextStateId || !this._stateById.has(nextStateId)) return;
      if (nextStateId === this._currentStateId) return;
      this._currentStateId = nextStateId;
      this._stateElapsedTimeSeconds = 0;
      this._lastAppliedAnimationName = '';
      this._applyCurrentStateAnimation();
    }

    private _isTransitionSatisfied(
      transition: AnimationStateMachineTransition
    ): boolean {
      if (
        this._stateElapsedTimeSeconds + EPSILON <
        parseFiniteNumber(transition.minDuration, 0)
      ) {
        return false;
      }

      if (transition.mode === 'immediate') return true;

      if (transition.mode === 'trigger') {
        const triggerName = String(transition.trigger || '')
          .trim()
          .toLowerCase();
        if (!triggerName) return false;
        return this._pendingTriggers.has(triggerName);
      }

      if (transition.mode === 'bool') {
        const parameterName = String(transition.parameter || '').trim();
        if (!parameterName) return false;
        return (
          this._getBooleanParameterValue(parameterName) ===
          toBoolean(transition.boolValue)
        );
      }

      if (transition.mode === 'number') {
        const parameterName = String(transition.parameter || '').trim();
        if (!parameterName) return false;
        const parameterValue = this._getNumberParameterValue(parameterName);
        const transitionValue = parseFiniteNumber(transition.numberValue, 0);
        const comparison = normalizeComparison(transition.comparison);
        if (comparison === '>') return parameterValue > transitionValue;
        if (comparison === '>=') return parameterValue >= transitionValue;
        if (comparison === '<') return parameterValue < transitionValue;
        if (comparison === '<=') return parameterValue <= transitionValue;
        if (comparison === '==')
          return Math.abs(parameterValue - transitionValue) <= EPSILON;
        if (comparison === '!=')
          return Math.abs(parameterValue - transitionValue) > EPSILON;
      }

      return false;
    }

    private _getNumberParameterValue(parameterName: string): number {
      if (this._numberParameters.has(parameterName)) {
        return parseFiniteNumber(this._numberParameters.get(parameterName), 0);
      }
      const variableValue = this.owner.getVariables().get(parameterName);
      return parseFiniteNumber(variableValue.getAsNumber(), 0);
    }

    private _getBooleanParameterValue(parameterName: string): boolean {
      if (this._booleanParameters.has(parameterName)) {
        return toBoolean(this._booleanParameters.get(parameterName));
      }
      const variableValue = this.owner.getVariables().get(parameterName);
      return toBoolean(variableValue.getAsBoolean());
    }

    private _applyCurrentStateAnimation(): void {
      if (!this._autoApplyAnimation) return;
      const state = this._stateById.get(this._currentStateId);
      if (!state) return;
      const animationName = String(state.animationName || '').trim();
      if (!animationName) return;
      if (this._lastAppliedAnimationName === animationName) return;

      const owner = this.owner as AnimatableRuntimeObject;
      if (!owner.setAnimationName) return;
      try {
        owner.setAnimationName(animationName);
        if (owner.playAnimation) owner.playAnimation();
        this._lastAppliedAnimationName = animationName;
      } catch (error) {
        logger.warn(
          `Animation State Machine: failed to apply animation "${animationName}".`
        );
      }
    }
  }

  gdjs.registerBehavior(
    'AnimationStateMachine::StateMachine',
    gdjs.AnimationStateMachineRuntimeBehavior
  );
}
