// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import ScrollView from '../UI/ScrollView';
import Text from '../UI/Text';
import RaisedButton from '../UI/RaisedButton';
import SelectField from '../UI/SelectField';
import SelectOption from '../UI/SelectOption';
import { Column, Line } from '../UI/Grid';
import { ColumnStackLayout, ResponsiveLineStackLayout } from '../UI/Layout';
import { addBehaviorToObject } from '../Utils/Behavior';
import AnimationStateMachineEditor from '../BehaviorsEditor/Editors/AnimationStateMachineEditor';
import { type ResourceManagementProps } from '../ResourcesList/ResourceSource';
import { ProjectScopedContainersAccessor } from '../InstructionOrExpression/EventsScope';
import {
  buildStateMachineGraphFromAnimationNames,
  getObjectAnimationNames,
  STATE_MACHINE_BEHAVIOR_TYPE,
} from './AnimationStateMachineUtils';

const gd: libGDevelop = global.gd;

const styles = {
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 12,
    border: '1px solid rgba(91, 184, 132, 0.2)',
    background:
      'radial-gradient(circle at top left, rgba(72, 163, 106, 0.14), rgba(15, 20, 27, 0.96) 45%), linear-gradient(180deg, rgba(26, 34, 28, 0.96), rgba(17, 20, 25, 0.98))',
    padding: 14,
    marginBottom: 14,
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#eef7ef',
    background: 'rgba(255, 150, 56, 0.18)',
    border: '1px solid rgba(255, 150, 56, 0.4)',
  },
  heroSubtitle: {
    marginTop: 6,
    color: 'rgba(231, 239, 236, 0.72)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  emptyCard: {
    borderRadius: 12,
    border: '1px solid rgba(255, 162, 67, 0.18)',
    background: 'rgba(15, 18, 24, 0.92)',
    padding: 18,
  },
  infoCard: {
    borderRadius: 10,
    border: '1px solid rgba(255, 162, 67, 0.18)',
    background: 'rgba(17, 21, 27, 0.92)',
    padding: 12,
    marginBottom: 12,
  },
  selectCard: {
    borderRadius: 10,
    border: '1px solid rgba(91, 184, 132, 0.18)',
    background: 'rgba(13, 18, 24, 0.94)',
    padding: 12,
    marginBottom: 12,
  },
  compactInput: {
    fontSize: 12,
  },
  codeCard: {
    borderRadius: 10,
    border: '1px solid rgba(91, 184, 132, 0.18)',
    background: 'rgba(10, 14, 19, 0.96)',
    padding: 12,
    marginBottom: 14,
  },
  codeBlock: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    background: 'rgba(24, 29, 36, 0.98)',
    color: '#e8edf4',
    fontSize: 12,
    lineHeight: 1.55,
    overflowX: 'auto',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre',
  },
};

type Props = {|
  project: gdProject,
  object: gdObject,
  resourceManagementProps: ResourceManagementProps,
  projectScopedContainersAccessor: ProjectScopedContainersAccessor,
  onStateMachineUpdated: () => void,
  onUpdateBehaviorsSharedData: () => void,
  isListLocked: boolean,
|};

const getStateMachineBehaviorNames = (object: gdObject): Array<string> =>
  object
    .getAllBehaviorNames()
    .toJSArray()
    .filter(
      behaviorName =>
        object.getBehavior(behaviorName).getTypeName() ===
        STATE_MACHINE_BEHAVIOR_TYPE
    );

const ObjectStateMachineEditor = ({
  project,
  object,
  resourceManagementProps,
  projectScopedContainersAccessor,
  onStateMachineUpdated,
  onUpdateBehaviorsSharedData,
  isListLocked,
}: Props): React.Node => {
  const [selectedBehaviorName, setSelectedBehaviorName] = React.useState('');
  const hasRequestedAutoCreationRef = React.useRef(false);

  const animationNames = getObjectAnimationNames(object);
  const stateMachineBehaviorNames = getStateMachineBehaviorNames(object);
  const stateMachineBehaviorCount = stateMachineBehaviorNames.length;
  const firstStateMachineBehaviorName = stateMachineBehaviorNames[0] || '';

  React.useEffect(
    () => {
      if (!stateMachineBehaviorCount) {
        if (selectedBehaviorName) setSelectedBehaviorName('');
        return;
      }

      if (
        !selectedBehaviorName ||
        !object.hasBehaviorNamed(selectedBehaviorName) ||
        object.getBehavior(selectedBehaviorName).getTypeName() !==
          STATE_MACHINE_BEHAVIOR_TYPE
      ) {
        setSelectedBehaviorName(firstStateMachineBehaviorName);
      }
    },
    [
      firstStateMachineBehaviorName,
      object,
      selectedBehaviorName,
      stateMachineBehaviorCount,
    ]
  );

  const selectedBehavior =
    selectedBehaviorName &&
    object.hasBehaviorNamed(selectedBehaviorName) &&
    object.getBehavior(selectedBehaviorName).getTypeName() ===
      STATE_MACHINE_BEHAVIOR_TYPE
      ? object.getBehavior(selectedBehaviorName)
      : stateMachineBehaviorNames.length
      ? object.getBehavior(stateMachineBehaviorNames[0])
      : null;

  const canUseStateMachine =
    animationNames.length > 0 &&
    gd.ObjectTools.isBehaviorCompatibleWithObject(
      project.getCurrentPlatform(),
      object.getType(),
      STATE_MACHINE_BEHAVIOR_TYPE
    );

  const addStateMachine = React.useCallback(() => {
    if (!canUseStateMachine || isListLocked || stateMachineBehaviorCount) {
      return;
    }

    const previousBehaviorNames = getStateMachineBehaviorNames(object);
    const hasBeenAdded = addBehaviorToObject(
      project,
      object,
      STATE_MACHINE_BEHAVIOR_TYPE,
      'StateMachine'
    );
    if (!hasBeenAdded) return;

    const nextBehaviorNames = getStateMachineBehaviorNames(object);
    const createdBehaviorName =
      nextBehaviorNames.find(
        behaviorName => previousBehaviorNames.indexOf(behaviorName) === -1
      ) || nextBehaviorNames[0];

    if (createdBehaviorName) {
      setSelectedBehaviorName(createdBehaviorName);
      const createdBehavior = object.getBehavior(createdBehaviorName);
      const initialGraph = buildStateMachineGraphFromAnimationNames(
        animationNames,
        null
      );
      createdBehavior.updateProperty(
        'graphDefinition',
        JSON.stringify(initialGraph, null, 2)
      );
      createdBehavior.updateProperty(
        'defaultState',
        initialGraph.defaultStateId || ''
      );
    }

    onUpdateBehaviorsSharedData();
    onStateMachineUpdated();
  }, [
    canUseStateMachine,
    animationNames,
    isListLocked,
    object,
    onStateMachineUpdated,
    onUpdateBehaviorsSharedData,
    project,
    stateMachineBehaviorCount,
  ]);

  React.useEffect(
    () => {
      if (!canUseStateMachine || isListLocked || stateMachineBehaviorCount > 0) {
        return;
      }
      if (hasRequestedAutoCreationRef.current) return;
      hasRequestedAutoCreationRef.current = true;
      addStateMachine();
    },
    [addStateMachine, canUseStateMachine, isListLocked, stateMachineBehaviorCount]
  );

  const selectedBehaviorCodeSample = selectedBehavior
    ? `const stateMachine =
  object.getBehavior("${selectedBehavior.getName()}") as gdjs.AnimationStateMachineRuntimeBehavior;
stateMachine.setDefaultState("idle");
stateMachine.setState("run");
stateMachine.trigger("jump");
stateMachine.setNumberParameter("speed", 6);
stateMachine.setBooleanParameter("grounded", true);
console.log(stateMachine.getCurrentStateName());
console.log(stateMachine.getCurrentState());
console.log(stateMachine.getCurrentAnimationName());`
    : '';

  return (
    <Column noMargin expand useFullHeight noOverflowParent>
      <ScrollView>
        <div style={styles.scrollContent}>
          <div style={styles.heroCard}>
            <Line noMargin alignItems="center">
              <Column noMargin expand>
                <Text noMargin size="block-title">
                  <Trans>State Machine</Trans>
                </Text>
                <div style={styles.heroSubtitle}>
                  <Trans>
                    Build 2D and 3D animation flow in a dedicated graph editor,
                    separate from the regular behaviors list. When this tab is
                    opened, the graph editor is opened directly for faster
                    workflow.
                  </Trans>
                </div>
              </Column>
              <div style={styles.heroBadge}>2D / 3D</div>
            </Line>

            {!canUseStateMachine ? (
              <div style={styles.infoCard}>
                <Text noMargin size="body2">
                  <Trans>
                    State Machine appears only for objects that already have 2D
                    or 3D animations. Add animations to this object first, then
                    the graph will become available here.
                  </Trans>
                </Text>
              </div>
            ) : null}

            {stateMachineBehaviorNames.length > 1 ? (
              <div style={styles.selectCard}>
                <Text noMargin size="body2">
                  <Trans>Choose which State Machine graph to edit</Trans>
                </Text>
                <SelectField
                  fullWidth
                  margin="dense"
                  floatingLabelText={<Trans>State Machine behavior</Trans>}
                  value={selectedBehaviorName}
                  inputStyle={styles.compactInput}
                  onChange={(event, _index, value) =>
                    setSelectedBehaviorName(value)
                  }
                >
                  {stateMachineBehaviorNames.map(behaviorName => (
                    <SelectOption
                      key={behaviorName}
                      value={behaviorName}
                      label={behaviorName}
                      shouldNotTranslate
                    />
                  ))}
                </SelectField>
              </div>
            ) : null}

            {!selectedBehavior && canUseStateMachine ? (
              <div style={styles.emptyCard}>
                <ColumnStackLayout noMargin>
                  <Text noMargin size="block-title">
                    <Trans>Create your first State Machine</Trans>
                  </Text>
                  <Text noMargin size="body2">
                    <Trans>
                      Add a dedicated animation graph for this object, then
                      edit states, transitions, and the default start state from
                      one place.
                    </Trans>
                  </Text>
                  <ResponsiveLineStackLayout noMargin noColumnMargin>
                    <RaisedButton
                      primary
                      label={<Trans>Create State Machine</Trans>}
                      onClick={addStateMachine}
                      disabled={isListLocked}
                    />
                    {isListLocked ? (
                      <Text noMargin size="body2">
                        <Trans>
                          This list is locked, so a new graph cannot be added
                          here.
                        </Trans>
                      </Text>
                    ) : null}
                  </ResponsiveLineStackLayout>
                </ColumnStackLayout>
              </div>
            ) : null}
          </div>

          {selectedBehavior ? (
            <div style={styles.codeCard}>
              <Text noMargin size="block-title">
                <Trans>TypeScript Control</Trans>
              </Text>
              <Text noMargin size="body2">
                <Trans>
                  The runtime behavior is controllable from code with direct
                  methods for states, triggers, and parameters.
                </Trans>
              </Text>
              <div style={styles.codeBlock}>{selectedBehaviorCodeSample}</div>
            </div>
          ) : null}

          {selectedBehavior ? (
            <AnimationStateMachineEditor
              standalone
              behavior={selectedBehavior}
              project={project}
              object={object}
              resourceManagementProps={resourceManagementProps}
              projectScopedContainersAccessor={projectScopedContainersAccessor}
              onBehaviorUpdated={onStateMachineUpdated}
            />
          ) : null}
        </div>
      </ScrollView>
    </Column>
  );
};

export default ObjectStateMachineEditor;
