// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import Dialog from '../../UI/Dialog';
import RaisedButton from '../../UI/RaisedButton';
import FlatButton from '../../UI/FlatButton';
import Checkbox from '../../UI/Checkbox';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import SelectField from '../../UI/SelectField';
import SelectOption from '../../UI/SelectOption';
import Text from '../../UI/Text';
import { Line, Spacer } from '../../UI/Grid';
import { ColumnStackLayout, ResponsiveLineStackLayout } from '../../UI/Layout';
import type { BehaviorEditorProps } from './BehaviorEditorProps.flow';
import BehaviorPropertiesEditor from './BehaviorPropertiesEditor';
import {
  buildStateMachineGraphFromAnimationNames,
  getObjectAnimationNames,
} from '../../ObjectEditor/AnimationStateMachineUtils';

const NODE_WIDTH = 174;
const NODE_HEIGHT = 74;
const NODE_HEADER_HEIGHT = 28;
const CANVAS_WIDTH = 2600;
const CANVAS_HEIGHT = 1500;

const FIELD_INPUT_STYLE = {
  fontSize: 12,
  color: '#e9edf2',
};

const styles = {
  summaryPanel: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    border: '1px solid rgba(90, 178, 124, 0.2)',
    background:
      'radial-gradient(circle at top left, rgba(66, 158, 103, 0.14), rgba(15, 19, 25, 0.97) 48%), linear-gradient(180deg, rgba(25, 31, 27, 0.96), rgba(17, 21, 26, 0.98))',
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255, 164, 73, 0.9)',
    marginBottom: 6,
  },
  summarySubtitle: {
    marginTop: 6,
    color: 'rgba(229, 235, 241, 0.7)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  summaryPillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  summaryPill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 28,
    padding: '0 10px',
    borderRadius: 999,
    border: '1px solid rgba(89, 97, 107, 0.9)',
    background: 'rgba(18, 23, 30, 0.9)',
    color: '#edf2f7',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  summaryPillAccent: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 28,
    padding: '0 10px',
    borderRadius: 999,
    border: '1px solid rgba(255, 156, 74, 0.45)',
    background: 'rgba(255, 156, 74, 0.14)',
    color: '#fff1df',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  graphRoot: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    background: '#2b2f35',
    borderRadius: 10,
  },
  graphToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    borderBottom: '1px solid rgba(92, 98, 108, 0.9)',
    background:
      'linear-gradient(180deg, rgba(44, 48, 55, 0.98), rgba(35, 39, 45, 0.98))',
  },
  graphToolbarTitle: {
    color: '#f2f4f7',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  graphToolbarSubtitle: {
    marginTop: 3,
    color: 'rgba(211, 217, 224, 0.72)',
    fontSize: 11,
    lineHeight: 1.4,
  },
  graphBody: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  graphViewport: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    borderRight: '1px solid rgba(92, 98, 108, 0.9)',
    background: '#2b2f35',
  },
  graphCanvas: {
    position: 'relative',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    userSelect: 'none',
    backgroundColor: '#2b2f35',
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
    backgroundSize: '24px 24px, 24px 24px, 120px 120px, 120px 120px',
  },
  graphSvg: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  transitionLabel: {
    fill: '#eef2f6',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.01em',
    paintOrder: 'stroke',
    stroke: 'rgba(43, 47, 53, 0.95)',
    strokeWidth: 4,
    strokeLinejoin: 'round',
  },
  stateNode: {
    position: 'absolute',
    width: NODE_WIDTH,
    minHeight: NODE_HEIGHT,
    borderRadius: 6,
    border: '1px solid rgba(86, 92, 102, 0.98)',
    background:
      'linear-gradient(180deg, rgba(30, 34, 40, 0.99), rgba(22, 25, 31, 0.99))',
    boxShadow: '0 12px 20px rgba(0, 0, 0, 0.34)',
    color: '#edf1f6',
    userSelect: 'none',
  },
  stateNodeDefault: {
    boxShadow:
      '0 0 0 1px rgba(82, 205, 114, 0.45), 0 12px 20px rgba(0, 0, 0, 0.34)',
  },
  stateNodeSelected: {
    border: '1px solid rgba(255, 158, 76, 0.95)',
    boxShadow:
      '0 0 0 1px rgba(255, 158, 76, 0.6), 0 12px 20px rgba(0, 0, 0, 0.4)',
  },
  stateNodeSelectedDefault: {
    boxShadow:
      '0 0 0 1px rgba(255, 158, 76, 0.7), 0 0 0 3px rgba(82, 205, 114, 0.28), 0 12px 20px rgba(0, 0, 0, 0.4)',
  },
  stateHeader: {
    height: NODE_HEADER_HEIGHT,
    borderBottom: '1px solid rgba(72, 78, 87, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 10px',
    cursor: 'grab',
    background:
      'linear-gradient(180deg, rgba(18, 21, 26, 0.98), rgba(33, 37, 43, 0.98))',
  },
  stateHeaderDefault: {
    background:
      'linear-gradient(180deg, rgba(26, 63, 38, 0.98), rgba(34, 96, 58, 0.98))',
  },
  stateHeaderSelected: {
    background:
      'linear-gradient(180deg, rgba(92, 48, 19, 0.98), rgba(138, 73, 28, 0.98))',
  },
  stateName: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.01em',
    color: '#f3f6fa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  startLabel: {
    position: 'absolute',
    left: -42,
    top: 6,
    color: '#d8dde4',
    fontSize: 12,
    fontWeight: 700,
    pointerEvents: 'none',
  },
  stateBody: {
    padding: '8px 10px 10px 10px',
    color: '#d9dee5',
    fontSize: 11,
    lineHeight: 1.45,
  },
  stateMetaLabel: {
    color: 'rgba(207, 214, 222, 0.56)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 3,
  },
  stateMetaValue: {
    color: '#edf1f6',
    fontSize: 12,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connectionHint: {
    marginTop: 7,
    color: '#ffc888',
    fontSize: 11,
    fontWeight: 600,
  },
  inputPort: {
    position: 'absolute',
    left: -5,
    top: NODE_HEADER_HEIGHT + 18,
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid rgba(250, 252, 255, 0.98)',
    background: '#7a8189',
    cursor: 'pointer',
    boxShadow: '0 0 0 3px rgba(122, 129, 137, 0.22)',
  },
  outputPort: {
    position: 'absolute',
    right: -5,
    top: NODE_HEADER_HEIGHT + 18,
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid rgba(250, 252, 255, 0.98)',
    background: '#eceff4',
    cursor: 'pointer',
    boxShadow: '0 0 0 3px rgba(236, 239, 244, 0.16)',
  },
  inspector: {
    width: 330,
    minWidth: 318,
    maxWidth: 348,
    padding: 12,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    background: '#343840',
    color: '#edf1f6',
  },
  inspectorCard: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    border: '1px solid rgba(88, 94, 104, 0.95)',
    background:
      'linear-gradient(180deg, rgba(61, 66, 74, 0.98), rgba(52, 57, 64, 0.98))',
  },
  inspectorSubtitle: {
    marginTop: 4,
    color: 'rgba(218, 223, 230, 0.7)',
    fontSize: 11,
    lineHeight: 1.45,
  },
  inspectorSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#cfd6de',
    marginBottom: 6,
  },
  miniBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '0 8px',
    borderRadius: 999,
    background: 'rgba(86, 190, 112, 0.18)',
    border: '1px solid rgba(86, 190, 112, 0.45)',
    color: '#e4f7e7',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  eventPlaceholder: {
    borderRadius: 6,
    padding: '10px 12px',
    background: 'rgba(43, 47, 53, 0.88)',
    color: 'rgba(219, 224, 230, 0.74)',
    fontSize: 12,
  },
  transitionRow: {
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    border: '1px solid rgba(77, 83, 93, 0.95)',
    background: 'rgba(43, 47, 53, 0.94)',
  },
  transitionHeading: {
    color: '#edf1f6',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
  },
};

const createId = prefix =>
  `${prefix}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

const createDefaultGraph = () => ({
  version: 1,
  defaultStateId: 'idle',
  states: [
    { id: 'idle', name: 'idle', animationName: 'idle', x: 220, y: 250 },
    { id: 'run', name: 'run', animationName: 'run', x: 620, y: 250 },
    { id: 'jump', name: 'jump', animationName: 'jump', x: 430, y: 470 },
  ],
  transitions: [
    {
      id: 'idle-to-run',
      fromStateId: 'idle',
      toStateId: 'run',
      mode: 'number',
      parameter: 'speed',
      comparison: '>',
      numberValue: 0.1,
      boolValue: true,
      trigger: '',
      minDuration: 0,
    },
    {
      id: 'run-to-idle',
      fromStateId: 'run',
      toStateId: 'idle',
      mode: 'number',
      parameter: 'speed',
      comparison: '<=',
      numberValue: 0.1,
      boolValue: true,
      trigger: '',
      minDuration: 0,
    },
  ],
});

const parseGraph = graphDefinition => {
  if (!graphDefinition) return createDefaultGraph();
  try {
    const parsedValue = JSON.parse(graphDefinition);
    if (!parsedValue || typeof parsedValue !== 'object') return createDefaultGraph();
    if (!Array.isArray(parsedValue.states) || !parsedValue.states.length) {
      return createDefaultGraph();
    }
    return {
      version: Number(parsedValue.version) || 1,
      defaultStateId:
        typeof parsedValue.defaultStateId === 'string' &&
        parsedValue.defaultStateId
          ? parsedValue.defaultStateId
          : parsedValue.states[0].id,
      states: parsedValue.states.map((state, index) => ({
        id: String(state.id || `state-${index + 1}`),
        name: String(state.name || `state-${index + 1}`),
        animationName: String(state.animationName || ''),
        x: Number(state.x) || 240 + index * 220,
        y: Number(state.y) || 220 + (index % 3) * 140,
      })),
      transitions: Array.isArray(parsedValue.transitions)
        ? parsedValue.transitions.map((transition, index) => ({
            id: String(transition.id || `transition-${index + 1}`),
            fromStateId: String(transition.fromStateId || ''),
            toStateId: String(transition.toStateId || ''),
            mode: String(transition.mode || 'immediate'),
            parameter: String(transition.parameter || ''),
            comparison: String(transition.comparison || '>'),
            numberValue: Number(transition.numberValue) || 0,
            boolValue:
              transition.boolValue === undefined ? true : !!transition.boolValue,
            trigger: String(transition.trigger || ''),
            minDuration: Number(transition.minDuration) || 0,
          }))
        : [],
    };
  } catch (error) {
    return createDefaultGraph();
  }
};

const getBehaviorPropertyValue = (behavior, propertyName, fallbackValue) => {
  try {
    const properties = behavior.getProperties();
    const descriptor = properties.get(propertyName);
    return descriptor ? descriptor.getValue() : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
};

const getStateCenter = state => ({
  inputX: state.x,
  inputY: state.y + NODE_HEADER_HEIGHT + 23,
  outputX: state.x + NODE_WIDTH,
  outputY: state.y + NODE_HEADER_HEIGHT + 23,
});

const getBezierPath = (from, to) => {
  const handleOffset = Math.max(72, Math.abs(to.x - from.x) * 0.4);
  return `M ${from.x} ${from.y} C ${from.x + handleOffset} ${from.y}, ${to.x - handleOffset} ${to.y}, ${to.x} ${to.y}`;
};

const getTransitionLabel = transition => {
  if (transition.mode === 'trigger') {
    return `Trigger: ${transition.trigger || 'transition'}`;
  }
  if (transition.mode === 'bool') {
    return `${transition.parameter || 'flag'} = ${
      transition.boolValue ? 'true' : 'false'
    }`;
  }
  if (transition.mode === 'number') {
    return `${transition.parameter || 'value'} ${
      transition.comparison || '>'
    } ${transition.numberValue}`;
  }
  return 'Immediate';
};

const getTransitionLabelPosition = (from, to) => ({
  x: (from.outputX + to.inputX) / 2,
  y: (from.outputY + to.inputY) / 2 - 10,
});

type AnimationStateMachineEditorProps = {|
  ...BehaviorEditorProps,
  standalone?: boolean,
|};

const AnimationStateMachineEditor = ({
  behavior,
  onBehaviorUpdated,
  standalone = false,
  ...props
}: AnimationStateMachineEditorProps): React.Node => {
  const [isDialogOpen, setIsDialogOpen] = React.useState<boolean>(false);
  const [graph, setGraph] = React.useState(createDefaultGraph());
  const [selectedStateId, setSelectedStateId] = React.useState<string>('idle');
  const [connectingFromStateId, setConnectingFromStateId] = React.useState<?string>(
    null
  );
  const [dragState, setDragState] = React.useState<?{
    stateId: string,
    lastClientX: number,
    lastClientY: number,
  }>(null);
  const [panState, setPanState] = React.useState<?{
    lastClientX: number,
    lastClientY: number,
  }>(null);
  const graphViewportRef = React.useRef<?HTMLDivElement>(null);
  const autoOpenedBehaviorNameRef = React.useRef('');
  const animationNames = getObjectAnimationNames(props.object);

  const enabledValue = getBehaviorPropertyValue(behavior, 'enabled', 'true') === 'true';
  const autoApplyValue =
    getBehaviorPropertyValue(behavior, 'autoApplyAnimation', 'true') === 'true';

  const loadGraphFromBehavior = React.useCallback(() => {
    const definition = getBehaviorPropertyValue(behavior, 'graphDefinition', '');
    const parsedGraph = parseGraph(definition);
    setGraph(parsedGraph);
    setSelectedStateId(parsedGraph.defaultStateId || parsedGraph.states[0].id);
    setConnectingFromStateId(null);
    return parsedGraph;
  }, [behavior]);

  React.useEffect(
    () => {
      loadGraphFromBehavior();
    },
    [loadGraphFromBehavior]
  );

  const openEditor = React.useCallback(() => {
    loadGraphFromBehavior();
    setIsDialogOpen(true);
  }, [loadGraphFromBehavior]);

  const closeEditor = React.useCallback(() => {
    loadGraphFromBehavior();
    setIsDialogOpen(false);
  }, [loadGraphFromBehavior]);

  React.useEffect(
    () => {
      if (!standalone) return;
      const behaviorName = behavior.getName();
      if (autoOpenedBehaviorNameRef.current === behaviorName) return;
      autoOpenedBehaviorNameRef.current = behaviorName;
      openEditor();
    },
    [behavior, openEditor, standalone]
  );

  React.useEffect(
    () => {
      if (!isDialogOpen || !graphViewportRef.current) return undefined;

      const frameId = window.requestAnimationFrame(() => {
        if (!graphViewportRef.current) return;
        const stateToFocus =
          graph.states.find(state => state.id === selectedStateId) ||
          graph.states[0] ||
          null;
        if (!stateToFocus) return;

        const nextScrollLeft = Math.max(
          0,
          stateToFocus.x - graphViewportRef.current.clientWidth / 2 + NODE_WIDTH / 2
        );
        const nextScrollTop = Math.max(
          0,
          stateToFocus.y -
            graphViewportRef.current.clientHeight / 2 +
            NODE_HEIGHT / 2
        );
        graphViewportRef.current.scrollLeft = nextScrollLeft;
        graphViewportRef.current.scrollTop = nextScrollTop;
      });

      return () => window.cancelAnimationFrame(frameId);
    },
    [graph.states, isDialogOpen, selectedStateId]
  );

  const selectedState = React.useMemo(
    () => graph.states.find(state => state.id === selectedStateId) || null,
    [graph.states, selectedStateId]
  );

  const selectedStateTransitions = React.useMemo(
    () =>
      graph.transitions.filter(transition => transition.fromStateId === selectedStateId),
    [graph.transitions, selectedStateId]
  );

  const commitGraph = React.useCallback(
    nextGraph => {
      behavior.updateProperty('graphDefinition', JSON.stringify(nextGraph, null, 2));
      behavior.updateProperty('defaultState', nextGraph.defaultStateId || '');
      onBehaviorUpdated();
    },
    [behavior, onBehaviorUpdated]
  );

  const onApply = React.useCallback(() => {
    commitGraph(graph);
    setIsDialogOpen(false);
  }, [commitGraph, graph]);

  const syncGraphFromAnimations = React.useCallback(() => {
    if (!animationNames.length) return;
    const nextGraph = buildStateMachineGraphFromAnimationNames(animationNames, graph);
    setGraph(nextGraph);
    setSelectedStateId(nextGraph.defaultStateId || (nextGraph.states[0] || {}).id || '');
    setConnectingFromStateId(null);
  }, [animationNames, graph]);

  const updateSelectedState = React.useCallback(
    patch => {
      if (!selectedState) return;
      setGraph(previousGraph => ({
        ...previousGraph,
        states: previousGraph.states.map(state =>
          state.id === selectedState.id ? { ...state, ...patch } : state
        ),
      }));
    },
    [selectedState]
  );

  const addState = React.useCallback(() => {
    const nextIndex = graph.states.length + 1;
    const id = createId('state');
    const usedAnimationNames = graph.states.map(state => state.animationName);
    const suggestedAnimationName =
      animationNames.find(
        animationName => usedAnimationNames.indexOf(animationName) === -1
      ) || '';
    const nextState = {
      id,
      name: `state_${nextIndex}`,
      animationName: suggestedAnimationName,
      x: 220 + (nextIndex % 4) * 240,
      y: 210 + Math.floor(nextIndex / 4) * 170,
    };
    setGraph(previousGraph => ({
      ...previousGraph,
      states: [...previousGraph.states, nextState],
    }));
    setSelectedStateId(id);
    setConnectingFromStateId(null);
  }, [animationNames, graph.states]);

  const removeSelectedState = React.useCallback(() => {
    if (!selectedState) return;

    const nextStates = graph.states.filter(state => state.id !== selectedState.id);
    const nextGraph = !nextStates.length
      ? createDefaultGraph()
      : {
          ...graph,
          defaultStateId:
            graph.defaultStateId === selectedState.id
              ? nextStates[0].id
              : graph.defaultStateId,
          states: nextStates,
          transitions: graph.transitions.filter(
            transition =>
              transition.fromStateId !== selectedState.id &&
              transition.toStateId !== selectedState.id
          ),
        };

    setGraph(nextGraph);
    setSelectedStateId(nextGraph.defaultStateId || nextGraph.states[0].id);
    setConnectingFromStateId(previousStateId =>
      previousStateId === selectedState.id ? null : previousStateId
    );
  }, [graph, selectedState]);

  const addTransitionBetween = React.useCallback((fromStateId, toStateId) => {
    if (!fromStateId || !toStateId || fromStateId === toStateId) return;
    setGraph(previousGraph => {
      const alreadyExists = previousGraph.transitions.some(
        transition =>
          transition.fromStateId === fromStateId &&
          transition.toStateId === toStateId
      );
      if (alreadyExists) return previousGraph;
      return {
        ...previousGraph,
        transitions: [
          ...previousGraph.transitions,
          {
            id: createId('transition'),
            fromStateId,
            toStateId,
            mode: 'immediate',
            parameter: '',
            comparison: '>',
            numberValue: 0,
            boolValue: true,
            trigger: '',
            minDuration: 0,
          },
        ],
      };
    });
  }, []);

  const updateTransition = React.useCallback((transitionId, patch) => {
    setGraph(previousGraph => ({
      ...previousGraph,
      transitions: previousGraph.transitions.map(transition =>
        transition.id === transitionId ? { ...transition, ...patch } : transition
      ),
    }));
  }, []);

  const removeTransition = React.useCallback(transitionId => {
    setGraph(previousGraph => ({
      ...previousGraph,
      transitions: previousGraph.transitions.filter(
        transition => transition.id !== transitionId
      ),
    }));
  }, []);

  React.useEffect(
    () => {
      if (!dragState) return undefined;

      const onMouseMove = event => {
        const deltaX = event.clientX - dragState.lastClientX;
        const deltaY = event.clientY - dragState.lastClientY;
        setGraph(previousGraph => ({
          ...previousGraph,
          states: previousGraph.states.map(state =>
            state.id !== dragState.stateId
              ? state
              : {
                  ...state,
                  x: Math.max(0, state.x + deltaX),
                  y: Math.max(0, state.y + deltaY),
                }
          ),
        }));
        setDragState(previousDragState =>
          previousDragState
            ? {
                ...previousDragState,
                lastClientX: event.clientX,
                lastClientY: event.clientY,
              }
            : previousDragState
        );
      };

      const onMouseUp = () => {
        setDragState(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    },
    [dragState]
  );

  React.useEffect(
    () => {
      if (!panState || !graphViewportRef.current) return undefined;

      const onMouseMove = event => {
        if (!graphViewportRef.current) return;
        const deltaX = event.clientX - panState.lastClientX;
        const deltaY = event.clientY - panState.lastClientY;
        graphViewportRef.current.scrollLeft -= deltaX;
        graphViewportRef.current.scrollTop -= deltaY;
        setPanState({
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        });
      };

      const onMouseUp = () => {
        setPanState(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    },
    [panState]
  );

  const graphToolbarMessage = connectingFromStateId ? (
    <Trans>Choose a target state to complete the transition.</Trans>
  ) : (
    <Trans>
      Drag cards to arrange them. Drag on empty grid space to pan. Click an
      output port, then another state to create a transition.
    </Trans>
  );

  return (
    <ColumnStackLayout noMargin>
      <div style={styles.summaryPanel}>
        <Line noMargin alignItems="center">
          <div>
            <div style={styles.summaryEyebrow}>State Machine</div>
            <Text noMargin size="block-title">
              <Trans>Animation State Machine</Trans>
            </Text>
            <div style={styles.summarySubtitle}>
              <Trans>
                Organize animation flow in a clean graph with focused state and
                transition editing.
              </Trans>
            </div>
          </div>
          <Spacer />
          <div style={styles.summaryPillsRow}>
            <div style={styles.summaryPill}>
              {graph.states.length} <Trans>States</Trans>
            </div>
            <div style={styles.summaryPill}>
              {graph.transitions.length} <Trans>Transitions</Trans>
            </div>
            <div style={styles.summaryPillAccent}>
              <Trans>Start</Trans>: {graph.defaultStateId || '-'}
            </div>
          </div>
        </Line>
        <ResponsiveLineStackLayout noMargin noColumnMargin style={{ marginTop: 10 }}>
          <Checkbox
            label={<Trans>Enabled</Trans>}
            checked={enabledValue}
            onCheck={(_, value) => {
              behavior.updateProperty('enabled', value ? 'true' : 'false');
              onBehaviorUpdated();
            }}
          />
          <Checkbox
            label={<Trans>Auto apply animation</Trans>}
            checked={autoApplyValue}
            onCheck={(_, value) => {
              behavior.updateProperty('autoApplyAnimation', value ? 'true' : 'false');
              onBehaviorUpdated();
            }}
          />
          <Spacer />
          {animationNames.length ? (
            <FlatButton
              label={<Trans>Load Animations</Trans>}
              onClick={syncGraphFromAnimations}
            />
          ) : null}
          <FlatButton label={<Trans>Reset Graph</Trans>} onClick={loadGraphFromBehavior} />
          <RaisedButton
            primary
            label={<Trans>Edit Graph</Trans>}
            onClick={openEditor}
          />
        </ResponsiveLineStackLayout>
      </div>

      {!standalone ? (
        <BehaviorPropertiesEditor
          behavior={behavior}
          onBehaviorUpdated={onBehaviorUpdated}
          {...props}
        />
      ) : null}

      {isDialogOpen && (
        <Dialog
          title={<Trans>State Machine Graph</Trans>}
          maxWidth={false}
          fullHeight
          flexBody
          open
          onRequestClose={closeEditor}
          actions={[
            <FlatButton
              key="cancel"
              label={<Trans>Cancel</Trans>}
              onClick={closeEditor}
            />,
            <RaisedButton
              key="apply"
              primary
              label={<Trans>Apply</Trans>}
              onClick={onApply}
            />,
          ]}
        >
          <div style={styles.graphRoot}>
            <div style={styles.graphToolbar}>
              <div>
                <div style={styles.graphToolbarTitle}>
                  <Trans>State Machine Graph</Trans>
                </div>
                <div style={styles.graphToolbarSubtitle}>{graphToolbarMessage}</div>
              </div>
              <ResponsiveLineStackLayout noMargin noColumnMargin>
                {animationNames.length ? (
                  <FlatButton
                    label={<Trans>Load Animations</Trans>}
                    onClick={syncGraphFromAnimations}
                  />
                ) : null}
                <FlatButton
                  label={<Trans>Reset Draft</Trans>}
                  onClick={loadGraphFromBehavior}
                />
                <RaisedButton
                  primary
                  label={<Trans>Add State</Trans>}
                  onClick={addState}
                />
              </ResponsiveLineStackLayout>
            </div>

            <div style={styles.graphBody}>
              <div
                ref={graphViewportRef}
                style={{
                  ...styles.graphViewport,
                  cursor: panState ? 'grabbing' : 'grab',
                }}
              >
                <div
                  data-state-machine-pan="background"
                  style={styles.graphCanvas}
                  onMouseDown={event => {
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    const targetTagName = target.tagName.toLowerCase();
                    const canStartPan =
                      target.getAttribute('data-state-machine-pan') ===
                        'background' ||
                      targetTagName === 'svg';
                    if (!canStartPan) return;
                    setPanState({
                      lastClientX: event.clientX,
                      lastClientY: event.clientY,
                    });
                    event.preventDefault();
                  }}
                >
                  <svg style={styles.graphSvg}>
                    <defs>
                      <marker
                        id="asm-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="6"
                        refY="3"
                        orient="auto"
                      >
                        <path
                          d="M0,0 L6,3 L0,6 z"
                          fill="rgba(236, 240, 244, 0.96)"
                        />
                      </marker>
                    </defs>
                    {graph.transitions.map(transition => {
                      const fromState = graph.states.find(
                        state => state.id === transition.fromStateId
                      );
                      const toState = graph.states.find(
                        state => state.id === transition.toStateId
                      );
                      if (!fromState || !toState) return null;
                      const from = getStateCenter(fromState);
                      const to = getStateCenter(toState);
                      const labelPosition = getTransitionLabelPosition(from, to);
                      const isHighlighted =
                        transition.fromStateId === selectedStateId ||
                        transition.toStateId === selectedStateId;
                      return (
                        <g key={transition.id}>
                          <path
                            d={getBezierPath(
                              { x: from.outputX, y: from.outputY },
                              { x: to.inputX, y: to.inputY }
                            )}
                            stroke={
                              isHighlighted
                                ? 'rgba(255, 165, 92, 0.92)'
                                : 'rgba(235, 239, 244, 0.76)'
                            }
                            strokeWidth={isHighlighted ? '2.2' : '1.7'}
                            fill="none"
                            markerEnd="url(#asm-arrow)"
                          />
                          <text
                            x={labelPosition.x}
                            y={labelPosition.y}
                            textAnchor="middle"
                            style={styles.transitionLabel}
                          >
                            {getTransitionLabel(transition)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {graph.states.map(state => {
                    const isSelected = selectedStateId === state.id;
                    const isDefaultState = graph.defaultStateId === state.id;
                    return (
                      <div
                        key={state.id}
                        style={{
                          ...styles.stateNode,
                          ...(isDefaultState ? styles.stateNodeDefault : {}),
                          ...(isSelected ? styles.stateNodeSelected : {}),
                          ...(isSelected && isDefaultState
                            ? styles.stateNodeSelectedDefault
                            : {}),
                          left: state.x,
                          top: state.y,
                        }}
                        onMouseDown={() => setSelectedStateId(state.id)}
                      >
                        {isDefaultState ? (
                          <div style={styles.startLabel}>
                            <Trans>Start</Trans>
                          </div>
                        ) : null}
                        <div
                          style={styles.inputPort}
                          title="Connect here"
                          onClick={() => {
                            if (!connectingFromStateId) return;
                            addTransitionBetween(connectingFromStateId, state.id);
                            setSelectedStateId(connectingFromStateId);
                            setConnectingFromStateId(null);
                          }}
                        />
                        <div
                          style={styles.outputPort}
                          title="Connect to another state"
                          onClick={() => {
                            setSelectedStateId(state.id);
                            setConnectingFromStateId(previousStateId =>
                              previousStateId === state.id ? null : state.id
                            );
                          }}
                        />
                        <div
                          style={{
                            ...styles.stateHeader,
                            ...(isDefaultState ? styles.stateHeaderDefault : {}),
                            ...(isSelected ? styles.stateHeaderSelected : {}),
                          }}
                          onMouseDown={event => {
                            setDragState({
                              stateId: state.id,
                              lastClientX: event.clientX,
                              lastClientY: event.clientY,
                            });
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        >
                          <div style={styles.stateName}>{state.name}</div>
                        </div>
                        <div style={styles.stateBody}>
                          <div style={styles.stateMetaLabel}>
                            <Trans>Animation</Trans>
                          </div>
                          <div style={styles.stateMetaValue}>
                            {state.animationName || '-'}
                          </div>
                          {connectingFromStateId === state.id ? (
                            <div style={styles.connectionHint}>
                              <Trans>Pick another state to connect.</Trans>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={styles.inspector}>
              <div style={styles.inspectorCard}>
                <Text noMargin size="sub-title">
                  <Trans>Inspector</Trans>
                </Text>
                <div style={styles.inspectorSubtitle}>
                  <Trans>
                    Select a state to edit its name, animation, start flag, and
                    outgoing transitions.
                  </Trans>
                </div>
              </div>

              {selectedState ? (
                <div style={styles.inspectorCard}>
                  <Line noMargin alignItems="center">
                    <Text noMargin size="sub-title">
                      {selectedState.name}
                    </Text>
                    <Spacer />
                    {graph.defaultStateId === selectedState.id ? (
                      <div style={styles.miniBadge}>
                        <Trans>Start</Trans>
                      </div>
                    ) : (
                      <FlatButton
                        label={<Trans>Set Start</Trans>}
                        onClick={() =>
                          setGraph(previousGraph => ({
                            ...previousGraph,
                            defaultStateId: selectedState.id,
                          }))
                        }
                      />
                    )}
                  </Line>
                  <SemiControlledTextField
                    fullWidth
                    margin="dense"
                    inputStyle={FIELD_INPUT_STYLE}
                    value={selectedState.name}
                    floatingLabelText={<Trans>State name</Trans>}
                    floatingLabelFixed
                    onChange={value => updateSelectedState({ name: value })}
                  />
                  {animationNames.length ? (
                    <SelectField
                      fullWidth
                      margin="dense"
                      inputStyle={FIELD_INPUT_STYLE}
                      floatingLabelText={<Trans>Animation name</Trans>}
                      value={selectedState.animationName}
                      onChange={(event, _index, value) =>
                        updateSelectedState({ animationName: value })
                      }
                    >
                      {animationNames.map(animationName => (
                        <SelectOption
                          key={animationName}
                          value={animationName}
                          label={animationName}
                          shouldNotTranslate
                        />
                      ))}
                    </SelectField>
                  ) : (
                    <SemiControlledTextField
                      fullWidth
                      margin="dense"
                      inputStyle={FIELD_INPUT_STYLE}
                      value={selectedState.animationName}
                      floatingLabelText={<Trans>Animation name</Trans>}
                      floatingLabelFixed
                      onChange={value =>
                        updateSelectedState({ animationName: value })
                      }
                    />
                  )}
                  <FlatButton
                    color="danger"
                    label={<Trans>Delete State</Trans>}
                    onClick={removeSelectedState}
                  />
                </div>
              ) : (
                <div style={styles.inspectorCard}>
                  <Text noMargin size="body2">
                    <Trans>Select a state from the graph to edit it.</Trans>
                  </Text>
                </div>
              )}

              {selectedState ? (
                <div style={styles.inspectorCard}>
                  <div style={styles.inspectorSectionTitle}>
                    <Trans>On Enter State()</Trans>
                  </div>
                  <div style={styles.eventPlaceholder}>
                    <Trans>List is empty.</Trans>
                  </div>
                </div>
              ) : null}

              {selectedState ? (
                <div style={styles.inspectorCard}>
                  <div style={styles.inspectorSectionTitle}>
                    <Trans>On Exit State()</Trans>
                  </div>
                  <div style={styles.eventPlaceholder}>
                    <Trans>List is empty.</Trans>
                  </div>
                </div>
              ) : null}

              {selectedState ? (
                <div style={styles.inspectorCard}>
                  <Line noMargin alignItems="center">
                    <Text noMargin size="sub-title">
                      <Trans>Transitions</Trans>
                    </Text>
                    <Spacer />
                    <FlatButton
                      label={<Trans>Add Transition</Trans>}
                      onClick={() => {
                        const targetState =
                          graph.states.find(state => state.id !== selectedState.id) ||
                          null;
                        if (!targetState) return;
                        addTransitionBetween(selectedState.id, targetState.id);
                      }}
                    />
                  </Line>

                  {selectedStateTransitions.length === 0 ? (
                    <div style={styles.eventPlaceholder}>
                      <Trans>No outgoing transitions for this state yet.</Trans>
                    </div>
                  ) : null}

                  {selectedStateTransitions.map(transition => (
                    <div key={transition.id} style={styles.transitionRow}>
                      <div style={styles.transitionHeading}>
                        {selectedState.name} {'->'}{' '}
                        {(
                          graph.states.find(
                            state => state.id === transition.toStateId
                          ) || { name: transition.toStateId }
                        ).name}
                      </div>
                      <SelectField
                        floatingLabelText={<Trans>To state</Trans>}
                        value={transition.toStateId}
                        fullWidth
                        margin="dense"
                        inputStyle={FIELD_INPUT_STYLE}
                        onChange={(event, _index, value) =>
                          updateTransition(transition.id, { toStateId: value })
                        }
                      >
                        {graph.states.map(state => (
                          <SelectOption
                            key={state.id}
                            value={state.id}
                            label={state.name}
                            shouldNotTranslate
                          />
                        ))}
                      </SelectField>

                      <SelectField
                        floatingLabelText={<Trans>Mode</Trans>}
                        value={transition.mode}
                        fullWidth
                        margin="dense"
                        inputStyle={FIELD_INPUT_STYLE}
                        onChange={(event, _index, value) =>
                          updateTransition(transition.id, { mode: value })
                        }
                      >
                        <SelectOption
                          value="immediate"
                          label="Immediate"
                          shouldNotTranslate
                        />
                        <SelectOption
                          value="trigger"
                          label="Trigger"
                          shouldNotTranslate
                        />
                        <SelectOption
                          value="bool"
                          label="Boolean Param"
                          shouldNotTranslate
                        />
                        <SelectOption
                          value="number"
                          label="Number Param"
                          shouldNotTranslate
                        />
                      </SelectField>

                      {transition.mode === 'trigger' ? (
                        <SemiControlledTextField
                          fullWidth
                          margin="dense"
                          inputStyle={FIELD_INPUT_STYLE}
                          value={transition.trigger}
                          floatingLabelText={<Trans>Trigger name</Trans>}
                          floatingLabelFixed
                          onChange={value =>
                            updateTransition(transition.id, { trigger: value })
                          }
                        />
                      ) : null}

                      {transition.mode === 'bool' ? (
                        <React.Fragment>
                          <SemiControlledTextField
                            fullWidth
                            margin="dense"
                            inputStyle={FIELD_INPUT_STYLE}
                            value={transition.parameter}
                            floatingLabelText={<Trans>Parameter</Trans>}
                            floatingLabelFixed
                            onChange={value =>
                              updateTransition(transition.id, { parameter: value })
                            }
                          />
                          <Checkbox
                            label={<Trans>Expected value = true</Trans>}
                            checked={!!transition.boolValue}
                            onCheck={(_, checked) =>
                              updateTransition(transition.id, {
                                boolValue: checked,
                              })
                            }
                          />
                        </React.Fragment>
                      ) : null}

                      {transition.mode === 'number' ? (
                        <React.Fragment>
                          <SemiControlledTextField
                            fullWidth
                            margin="dense"
                            inputStyle={FIELD_INPUT_STYLE}
                            value={transition.parameter}
                            floatingLabelText={<Trans>Parameter</Trans>}
                            floatingLabelFixed
                            onChange={value =>
                              updateTransition(transition.id, { parameter: value })
                            }
                          />
                          <SelectField
                            floatingLabelText={<Trans>Comparison</Trans>}
                            value={transition.comparison}
                            fullWidth
                            margin="dense"
                            inputStyle={FIELD_INPUT_STYLE}
                            onChange={(event, _index, value) =>
                              updateTransition(transition.id, { comparison: value })
                            }
                          >
                            <SelectOption value=">" label=">" shouldNotTranslate />
                            <SelectOption value=">=" label=">=" shouldNotTranslate />
                            <SelectOption value="<" label="<" shouldNotTranslate />
                            <SelectOption value="<=" label="<=" shouldNotTranslate />
                            <SelectOption value="==" label="==" shouldNotTranslate />
                            <SelectOption value="!=" label="!=" shouldNotTranslate />
                          </SelectField>
                          <SemiControlledTextField
                            fullWidth
                            margin="dense"
                            inputStyle={FIELD_INPUT_STYLE}
                            type="number"
                            value={String(transition.numberValue)}
                            floatingLabelText={<Trans>Threshold</Trans>}
                            floatingLabelFixed
                            onChange={value =>
                              updateTransition(transition.id, {
                                numberValue: parseFloat(value) || 0,
                              })
                            }
                          />
                        </React.Fragment>
                      ) : null}

                      <SemiControlledTextField
                        fullWidth
                        margin="dense"
                        inputStyle={FIELD_INPUT_STYLE}
                        type="number"
                        value={String(transition.minDuration)}
                        floatingLabelText={<Trans>Min time (seconds)</Trans>}
                        floatingLabelFixed
                        onChange={value =>
                          updateTransition(transition.id, {
                            minDuration: Math.max(0, parseFloat(value) || 0),
                          })
                        }
                      />
                      <FlatButton
                        color="danger"
                        label={<Trans>Remove Transition</Trans>}
                        onClick={() => removeTransition(transition.id)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </ColumnStackLayout>
  );
};

export default AnimationStateMachineEditor;
