// @flow

export const STATE_MACHINE_BEHAVIOR_TYPE =
  'AnimationStateMachine::StateMachine';

const pushAnimationNameIfValid = (
  animationNames: Array<string>,
  rawAnimationName: ?string
) => {
  const animationName = String(rawAnimationName || '').trim();
  if (!animationName) return;
  if (animationNames.indexOf(animationName) !== -1) return;
  animationNames.push(animationName);
};

const buildStateIdFromAnimationName = (
  animationName: string,
  usedStateIds: Set<string>
): string => {
  const normalizedBaseId =
    animationName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'state';

  let stateId = normalizedBaseId;
  let suffix = 2;
  while (usedStateIds.has(stateId)) {
    stateId = `${normalizedBaseId}_${suffix}`;
    suffix++;
  }
  usedStateIds.add(stateId);
  return stateId;
};

const reuseOrBuildStateId = (
  rawStateId: ?string,
  animationName: string,
  usedStateIds: Set<string>
): string => {
  const existingStateId = String(rawStateId || '').trim();
  if (existingStateId && !usedStateIds.has(existingStateId)) {
    usedStateIds.add(existingStateId);
    return existingStateId;
  }
  return buildStateIdFromAnimationName(animationName, usedStateIds);
};

export const getObjectAnimationNames = (object: gdObject): Array<string> => {
  const animationNames = [];
  const objectConfiguration = object.getConfiguration();

  try {
    if (
      objectConfiguration &&
      typeof objectConfiguration.getAnimationsCount === 'function' &&
      typeof objectConfiguration.getAnimation === 'function'
    ) {
      const animationsCount = objectConfiguration.getAnimationsCount();
      for (let animationIndex = 0; animationIndex < animationsCount; animationIndex++) {
        const animation = objectConfiguration.getAnimation(animationIndex);
        if (!animation) continue;
        pushAnimationNameIfValid(
          animationNames,
          typeof animation.getName === 'function'
            ? animation.getName()
            : typeof animation.getSource === 'function'
            ? animation.getSource()
            : ''
        );
      }
    }
  } catch (error) {
    // Some object configurations don't support animations at all.
  }

  try {
    if (
      objectConfiguration &&
      typeof objectConfiguration.getAnimations === 'function'
    ) {
      const animations = objectConfiguration.getAnimations();
      if (
        animations &&
        typeof animations.getAnimationsCount === 'function' &&
        typeof animations.getAnimation === 'function'
      ) {
        const animationsCount = animations.getAnimationsCount();
        for (let animationIndex = 0; animationIndex < animationsCount; animationIndex++) {
          const animation = animations.getAnimation(animationIndex);
          if (!animation) continue;
          pushAnimationNameIfValid(
            animationNames,
            typeof animation.getName === 'function'
              ? animation.getName()
              : typeof animation.getSource === 'function'
              ? animation.getSource()
              : ''
          );
        }
      }
    }
  } catch (error) {
    // Some object configurations don't expose a sprite-like animations container.
  }

  return animationNames;
};

export const hasObjectAnimationsForStateMachine = (object: gdObject): boolean =>
  getObjectAnimationNames(object).length > 0;

export const buildStateMachineGraphFromAnimationNames = (
  animationNames: Array<string>,
  previousGraph?: ?{
    version?: number,
    defaultStateId?: string,
    states?: Array<{
      id: string,
      name: string,
      animationName: string,
      x: number,
      y: number,
    }>,
    transitions?: Array<{
      id: string,
      fromStateId: string,
      toStateId: string,
      mode: string,
      trigger: string,
      parameter: string,
      comparison: string,
      numberValue: number,
      boolValue: boolean,
      minDuration: number,
    }>,
  }
) => {
  const usedStateIds = new Set();
  const previousStates = Array.isArray(previousGraph && previousGraph.states)
    ? previousGraph.states
    : [];
  const normalizedAnimationNames = animationNames.filter(animationName =>
    String(animationName || '').trim()
  );

  const states = normalizedAnimationNames.map((animationName, index) => {
    const existingState =
      previousStates.find(
        state =>
          state.animationName === animationName || state.name === animationName
      ) || null;
    const stateId = reuseOrBuildStateId(
      existingState ? existingState.id : '',
      animationName,
      usedStateIds
    );

    return {
      id: stateId,
      name: existingState ? existingState.name : animationName,
      animationName,
      x: existingState ? existingState.x : 220 + (index % 4) * 240,
      y: existingState ? existingState.y : 220 + Math.floor(index / 4) * 170,
    };
  });

  const stateIds = new Set(states.map(state => state.id));
  const previousTransitions = Array.isArray(previousGraph && previousGraph.transitions)
    ? previousGraph.transitions
    : [];
  const transitions = previousTransitions.filter(
    transition =>
      stateIds.has(transition.fromStateId) && stateIds.has(transition.toStateId)
  );

  const defaultStateId =
    previousGraph &&
    previousGraph.defaultStateId &&
    stateIds.has(previousGraph.defaultStateId)
      ? previousGraph.defaultStateId
      : states.length
      ? states[0].id
      : '';

  return {
    version: previousGraph && previousGraph.version ? previousGraph.version : 1,
    defaultStateId,
    states,
    transitions,
  };
};
