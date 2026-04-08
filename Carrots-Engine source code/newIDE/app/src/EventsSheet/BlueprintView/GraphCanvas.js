// @flow
import { t, Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';
import * as React from 'react';
import classNames from 'classnames';
import { mapFor } from '../../Utils/MapFor';
import {
  type EventContext,
  type InstructionContext,
  type InstructionsListContext,
  type SelectionState,
  isEventSelected,
  isInstructionSelected,
} from '../SelectionHandler';
import { getInstructionMetadata } from '../InstructionEditor/InstructionEditor';
import { type EventMetadata } from '../EnumerateEventsMetadata';
import { type ProjectScopedContainersAccessor } from '../../InstructionOrExpression/EventsScope';
import FlatButton from '../../UI/FlatButton';
import AddEventIcon from '../../UI/CustomSvgIcons/AddEvent';
import GDevelopThemeContext from '../../UI/Theme/GDevelopThemeContext';
import './style.css';

const gd: libGDevelop = global.gd;
const instructionFormatter = gd.InstructionSentenceFormatter.get();
const BLUEPRINT_WORLD_OFFSET_X = 3600;
const BLUEPRINT_WORLD_OFFSET_Y = 2200;
const BLUEPRINT_WORLD_MIN_WIDTH = 12000;
const BLUEPRINT_WORLD_MIN_HEIGHT = 7200;
const BLUEPRINT_ZOOM_MIN = 0.45;
const BLUEPRINT_ZOOM_MAX = 1.9;
const BLUEPRINT_ZOOM_STEP = 0.12;

type QuickStartEventPreset = 'start' | 'update' | 'fixed-update' | 'key-pressed';

type Props = {|
  project: gdProject,
  events: gdEventsList,
  projectScopedContainersAccessor: ProjectScopedContainersAccessor,
  selection: SelectionState,
  eventMetadataByType: { [string]: EventMetadata },
  onEventClick: (eventContext: EventContext) => void,
  onEventContextMenu: (
    x: number,
    y: number,
    eventContext: EventContext
  ) => void,
  onInstructionClick: (
    eventContext: EventContext,
    instructionContext: InstructionContext
  ) => void,
  onInstructionDoubleClick: (
    eventContext: EventContext,
    instructionContext: InstructionContext
  ) => void,
  onInstructionContextMenu: (
    eventContext: EventContext,
    x: number,
    y: number,
    instructionContext: InstructionContext
  ) => void,
  onSetInstructionParameterValue: (
    eventContext: EventContext,
    instructionContext: InstructionContext,
    parameterIndex: number,
    valueAsString: string
  ) => void,
  onAddInstructionContextMenu: (
    eventContext: EventContext,
    button: HTMLButtonElement,
    instructionsListContext: InstructionsListContext,
    initialInstructionMenuTab?: 'objects' | 'free-instructions'
  ) => void,
  onCreateTemplateNode: (
    eventContext: EventContext,
    templateId:
      | 'add-force'
      | 'set-velocity'
      | 'lerp'
      | 'branch'
      | 'sequence'
  ) => void,
  onCreateQuickStartEvent: (
    eventPreset: QuickStartEventPreset,
    eventsList: gdEventsList
  ) => void,
  onAddNewEvent: (eventType: string, eventsList: gdEventsList) => void,
|};

type BlueprintEventNode = {|
  eventContext: EventContext,
  depth: number,
  isAncestorDisabled: boolean,
|};

type BlueprintLaneRole = 'gate' | 'condition' | 'action';

type BlueprintLane = {|
  key: string,
  label: string,
  role: BlueprintLaneRole,
  isCondition: boolean,
  instructionsList: gdInstructionsList,
|};

type PinDirection = 'in' | 'out';
type PinKind = 'exec' | 'data';
type DataPinType = 'number' | 'boolean' | 'string' | 'vector2' | 'vector3';
type PinType = 'exec' | DataPinType;
type GraphNodeKind =
  | 'event'
  | 'branch'
  | 'sequence'
  | 'condition'
  | 'action'
  | 'placeholder';

type PinDef = {|
  id: string,
  side: 'left' | 'right' | 'top' | 'bottom',
  offset: number,
  kind: PinKind,
  pinType: PinType,
|};

type GraphNode = {|
  id: string,
  clusterId: string,
  kind: GraphNodeKind,
  tone: 'default' | 'physics' | 'tween' | 'logic',
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  eventContext: EventContext,
  instructionContext: ?InstructionContext,
  isSelected: boolean,
  disabled: boolean,
  pins: Array<PinDef>,
  parameters: Array<{| index: number, label: string, value: string, pinType: DataPinType |}>,
  badges: Array<{| text: string, tone: 'condition' | 'action' | 'meta' |}>,
  addConditionContext: ?InstructionsListContext,
  addActionContext: ?InstructionsListContext,
|};

type GraphEdge = {|
  id: string,
  fromPinId: string,
  toPinId: string,
  kind: PinKind,
  pinType: PinType,
|};

type GraphModel = {|
  nodes: Array<GraphNode>,
  edges: Array<GraphEdge>,
  width: number,
  height: number,
|};

type PinPosition = {|
  x: number,
  y: number,
|};

type PinPositionsById = { [string]: PinPosition };

type ManualConnection = {|
  id: string,
  fromPinId: string,
  toPinId: string,
  kind: PinKind,
  pinType: PinType,
|};

type ActiveConnectionDrag = {|
  fromPinId: string,
  pointerX: number,
  pointerY: number,
|};

type NodePosition = {|
  x: number,
  y: number,
|};

type NodePositionsById = { [string]: NodePosition };

type ActiveNodeDrag = {|
  startClientX: number,
  startClientY: number,
  nodeIds: Array<string>,
  basePositionsById: NodePositionsById,
|};

type ActivePanDrag = {|
  startClientX: number,
  startClientY: number,
  startScrollLeft: number,
  startScrollTop: number,
|};

type QuickAddMode =
  | 'event-start'
  | 'event-update'
  | 'event-fixed-update'
  | 'event-key-pressed'
  | 'condition-player'
  | 'condition-global'
  | 'action-player'
  | 'action-global'
  | 'template-add-force'
  | 'template-set-velocity'
  | 'template-lerp'
  | 'template-branch'
  | 'template-sequence'
  | 'event';

type GraphContextMenuState = {|
  x: number,
  y: number,
  clickX: number,
  clickY: number,
  eventContext: ?EventContext,
  addConditionContext: ?InstructionsListContext,
  addActionContext: ?InstructionsListContext,
|};

type InstructionEntry = {|
  eventContext: EventContext,
  instructionContext: InstructionContext,
|};

const clampText = (text: string, maxLength: number): string =>
  text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;

const getPinDirection = (pinId: string): ?PinDirection => {
  if (pinId.endsWith('-in')) return 'in';
  if (pinId.endsWith('-out')) return 'out';
  return null;
};

const getPinKindFromPinId = (pinId: string): PinKind =>
  pinId.includes('-data-') ? 'data' : 'exec';

const getDataPinTypeFromPinId = (pinId: string): DataPinType => {
  if (pinId.includes('-data-number-')) return 'number';
  if (pinId.includes('-data-boolean-')) return 'boolean';
  if (pinId.includes('-data-string-')) return 'string';
  if (pinId.includes('-data-vector2-')) return 'vector2';
  if (pinId.includes('-data-vector3-')) return 'vector3';
  return 'string';
};

const getPinTypeFromPinId = (pinId: string): PinType =>
  getPinKindFromPinId(pinId) === 'exec' ? 'exec' : getDataPinTypeFromPinId(pinId);

const areDataPinTypesCompatible = (
  sourcePinType: DataPinType,
  targetPinType: DataPinType
): boolean => sourcePinType === targetPinType;

const normalizeConnection = (
  sourcePinId: string,
  targetPinId: string
): ?{| fromPinId: string, toPinId: string |} => {
  if (sourcePinId === targetPinId) return null;

  const sourceDirection = getPinDirection(sourcePinId);
  const targetDirection = getPinDirection(targetPinId);
  if (!sourceDirection || !targetDirection) return null;
  if (sourceDirection === targetDirection) return null;
  const sourceKind = getPinKindFromPinId(sourcePinId);
  const targetKind = getPinKindFromPinId(targetPinId);
  if (sourceKind !== targetKind) {
    return null;
  }
  if (
    sourceKind === 'data' &&
    !areDataPinTypesCompatible(
      getDataPinTypeFromPinId(sourcePinId),
      getDataPinTypeFromPinId(targetPinId)
    )
  ) {
    return null;
  }

  if (sourceDirection === 'out') {
    return {
      fromPinId: sourcePinId,
      toPinId: targetPinId,
    };
  }

  return {
    fromPinId: targetPinId,
    toPinId: sourcePinId,
  };
};

const getConnectionId = ({
  fromPinId,
  toPinId,
}: {|
  fromPinId: string,
  toPinId: string,
|}): string => `${fromPinId}-->${toPinId}`;

const arePinsConnectable = (sourcePinId: string, targetPinId: string): boolean =>
  !!normalizeConnection(sourcePinId, targetPinId);

const buildWirePath = (from: PinPosition, to: PinPosition): string => {
  const horizontalDirection = to.x >= from.x ? 1 : -1;
  const curveOffset = Math.max(36, Math.abs(to.x - from.x) * 0.36);
  const controlPoint1X = from.x + curveOffset * horizontalDirection;
  const controlPoint2X = to.x - curveOffset * horizontalDirection;
  return `M ${from.x} ${from.y} C ${controlPoint1X} ${from.y}, ${controlPoint2X} ${to.y}, ${to.x} ${to.y}`;
};

const collectEventNodes = (
  eventsList: gdEventsList,
  projectScopedContainersAccessor: ProjectScopedContainersAccessor,
  depth: number = 0,
  isAncestorDisabled: boolean = false
): Array<BlueprintEventNode> => {
  const nodes: Array<BlueprintEventNode> = [];

  mapFor(0, eventsList.getEventsCount(), indexInList => {
    const event = eventsList.getEventAt(indexInList);
    const eventContext: EventContext = {
      eventsList,
      event,
      indexInList,
      projectScopedContainersAccessor,
    };

    nodes.push({
      eventContext,
      depth,
      isAncestorDisabled,
    });

    if (event.canHaveSubEvents() && event.getSubEvents().getEventsCount() > 0) {
      nodes.push(
        ...collectEventNodes(
          event.getSubEvents(),
          projectScopedContainersAccessor,
          depth + 1,
          isAncestorDisabled || event.isDisabled()
        )
      );
    }
  });

  return nodes;
};

const getEventLanes = (event: gdBaseEvent, i18n: I18nType): Array<BlueprintLane> => {
  const eventType = event.getType();
  if (eventType === 'BuiltinCommonInstructions::Standard') {
    const standardEvent = gd.asStandardEvent(event);
    return [
      {
        key: 'conditions',
        label: i18n._(t`Conditions`),
        role: 'condition',
        isCondition: true,
        instructionsList: standardEvent.getConditions(),
      },
      {
        key: 'actions',
        label: i18n._(t`Actions`),
        role: 'action',
        isCondition: false,
        instructionsList: standardEvent.getActions(),
      },
    ];
  }
  if (eventType === 'BuiltinCommonInstructions::Else') {
    const elseEvent = gd.asElseEvent(event);
    return [
      {
        key: 'conditions',
        label: i18n._(t`Else Conditions`),
        role: 'condition',
        isCondition: true,
        instructionsList: elseEvent.getConditions(),
      },
      {
        key: 'actions',
        label: i18n._(t`Actions`),
        role: 'action',
        isCondition: false,
        instructionsList: elseEvent.getActions(),
      },
    ];
  }
  if (eventType === 'BuiltinCommonInstructions::Repeat') {
    const repeatEvent = gd.asRepeatEvent(event);
    return [
      {
        key: 'conditions',
        label: i18n._(t`Conditions`),
        role: 'condition',
        isCondition: true,
        instructionsList: repeatEvent.getConditions(),
      },
      {
        key: 'actions',
        label: i18n._(t`Actions`),
        role: 'action',
        isCondition: false,
        instructionsList: repeatEvent.getActions(),
      },
    ];
  }
  if (eventType === 'BuiltinCommonInstructions::ForEach') {
    const forEachEvent = gd.asForEachEvent(event);
    return [
      {
        key: 'conditions',
        label: i18n._(t`Conditions`),
        role: 'condition',
        isCondition: true,
        instructionsList: forEachEvent.getConditions(),
      },
      {
        key: 'actions',
        label: i18n._(t`Actions`),
        role: 'action',
        isCondition: false,
        instructionsList: forEachEvent.getActions(),
      },
    ];
  }
  if (eventType === 'BuiltinCommonInstructions::ForEachChildVariable') {
    const forEachChildVariableEvent = gd.asForEachChildVariableEvent(event);
    return [
      {
        key: 'conditions',
        label: i18n._(t`Conditions`),
        role: 'condition',
        isCondition: true,
        instructionsList: forEachChildVariableEvent.getConditions(),
      },
      {
        key: 'actions',
        label: i18n._(t`Actions`),
        role: 'action',
        isCondition: false,
        instructionsList: forEachChildVariableEvent.getActions(),
      },
    ];
  }
  if (eventType === 'BuiltinCommonInstructions::While') {
    const whileEvent = gd.asWhileEvent(event);
    return [
      {
        key: 'while-conditions',
        label: i18n._(t`Loop Conditions`),
        role: 'gate',
        isCondition: true,
        instructionsList: whileEvent.getWhileConditions(),
      },
      {
        key: 'conditions',
        label: i18n._(t`Conditions`),
        role: 'condition',
        isCondition: true,
        instructionsList: whileEvent.getConditions(),
      },
      {
        key: 'actions',
        label: i18n._(t`Actions`),
        role: 'action',
        isCondition: false,
        instructionsList: whileEvent.getActions(),
      },
    ];
  }

  return [];
};

const renderInstructionSentence = ({
  instruction,
  metadata,
  isCondition,
  i18n,
}: {|
  instruction: gdInstruction,
  metadata: ?gdInstructionMetadata,
  isCondition: boolean,
  i18n: I18nType,
|}): string => {
  if (!metadata) return instruction.getType() || i18n._(t`Unknown instruction`);

  const formattedText = instructionFormatter.getAsFormattedText(
    instruction,
    metadata
  );
  const sentence = mapFor(0, formattedText.size(), index =>
    formattedText.getString(index)
  ).join('');
  const invertedPrefix =
    instruction.isInverted() && isCondition ? `${i18n._(t`Not`)} ` : '';

  return clampText(
    (invertedPrefix + (sentence || metadata.getFullName())).trim(),
    120
  );
};

const getInstructionParameterLabel = ({
  metadata,
  index,
  i18n,
}: {|
  metadata: any,
  index: number,
  i18n: I18nType,
|}): string => {
  const fallback = `${i18n._(t`Parameter`)} ${index + 1}`;
  if (!metadata) return fallback;

  try {
    if (metadata.getParameterName) {
      const parameterName = metadata.getParameterName(index);
      if (parameterName) return parameterName;
    }
    if (metadata.getParameter) {
      const parameterMetadata = metadata.getParameter(index);
      if (parameterMetadata && parameterMetadata.getName) {
        const parameterName = parameterMetadata.getName();
        if (parameterName) return parameterName;
      }
    }
  } catch (error) {
    return fallback;
  }

  return fallback;
};

const getInstructionParameterPinType = ({
  instruction,
  metadata,
  index,
  label,
}: {|
  instruction: gdInstruction,
  metadata: any,
  index: number,
  label: string,
|}): DataPinType => {
  const rawType =
    metadata && metadata.getParameter
      ? metadata.getParameter(index).getType()
      : '';
  const type = (rawType || '').toLowerCase();
  const normalizedLabel = (label || '').trim().toLowerCase();
  const instructionType = (instruction.getType() || '').toLowerCase();

  if (type === 'expression' || type === 'number' || type === 'numberwithchoices') {
    return 'number';
  }
  if (type === 'yesorno' || type === 'trueorfalse' || type === 'boolean') {
    return 'boolean';
  }
  if (type.includes('vector3') || type.includes('vec3')) {
    return 'vector3';
  }
  if (type.includes('vector2') || type.includes('vec2')) {
    return 'vector2';
  }
  if (
    type.includes('string') ||
    type.includes('resource') ||
    type.includes('object') ||
    type.includes('behavior') ||
    type.includes('operator') ||
    type.includes('identifier') ||
    type.includes('key') ||
    type.includes('scene') ||
    type.includes('layer') ||
    type.includes('camera') ||
    type.includes('color') ||
    type.includes('effect') ||
    type.includes('pointname') ||
    type.includes('animation') ||
    type.includes('skin') ||
    type.includes('var')
  ) {
    return 'string';
  }
  if (type.includes('position3') || type.includes('rotation3') || type.includes('scale3')) {
    return 'vector3';
  }
  if (type.includes('position') || type.includes('point') || type.includes('size')) {
    return 'vector2';
  }
  if (
    normalizedLabel === 'x' ||
    normalizedLabel === 'y' ||
    normalizedLabel === 'z' ||
    normalizedLabel.endsWith(' x') ||
    normalizedLabel.endsWith(' y') ||
    normalizedLabel.endsWith(' z')
  ) {
    return 'number';
  }
  if (
    instructionType.includes('physics3d::') &&
    (normalizedLabel.includes('force') ||
      normalizedLabel.includes('velocity') ||
      normalizedLabel.includes('impulse'))
  ) {
    return 'vector3';
  }
  if (
    instructionType.includes('lerp') ||
    instructionType.includes('tween') ||
    instructionType.includes('easing')
  ) {
    return 'number';
  }

  return 'string';
};

const getInstructionNodeParameters = ({
  instruction,
  metadata,
  i18n,
  maxCount = 3,
}: {|
  instruction: gdInstruction,
  metadata: any,
  i18n: I18nType,
  maxCount?: number,
|}): Array<{| index: number, label: string, value: string, pinType: DataPinType |}> => {
  const parameterCount = Math.min(instruction.getParametersCount(), maxCount);
  return mapFor(0, parameterCount, index => {
    const label = getInstructionParameterLabel({ metadata, index, i18n });
    return {
      index,
      label,
      value: instruction.getParameter(index).getPlainString(),
      pinType: getInstructionParameterPinType({
        instruction,
        metadata,
        index,
        label,
      }),
    };
  });
};

const getInstructionTone = (
  instructionType: string
): 'default' | 'physics' | 'tween' | 'logic' => {
  if (
    instructionType.includes('Physics3D::') ||
    instructionType.includes('PhysicsBehavior::')
  ) {
    return 'physics';
  }
  if (instructionType.includes('Tween::')) {
    return 'tween';
  }
  if (instructionType.includes('BuiltinCommonInstructions::')) {
    return 'logic';
  }
  return 'default';
};

const getEventDisplayName = ({
  event,
  eventMetadataByType,
}: {|
  event: gdBaseEvent,
  eventMetadataByType: { [string]: EventMetadata },
|}): string => {
  const eventType = event.getType();
  return eventMetadataByType[eventType] && eventMetadataByType[eventType].fullName
    ? eventMetadataByType[eventType].fullName
    : eventType;
};

const getInstructionEntries = ({
  lanes,
  eventContext,
  isCondition,
}: {|
  lanes: Array<BlueprintLane>,
  eventContext: EventContext,
  isCondition: boolean,
|}): Array<InstructionEntry> => {
  const entries: Array<InstructionEntry> = [];

  lanes.forEach(lane => {
    if (lane.isCondition !== isCondition) return;

    mapFor(0, lane.instructionsList.size(), indexInList => {
      const instruction = lane.instructionsList.get(indexInList);
      entries.push({
        eventContext,
        instructionContext: {
          isCondition,
          instrsList: lane.instructionsList,
          instruction,
          indexInList,
        },
      });
    });
  });

  return entries;
};

const getPinStyle = (pin: PinDef): { [string]: string | number } => {
  if (pin.side === 'left') {
    return {
      left: -7,
      top: pin.offset,
      transform: 'translateY(-50%)',
    };
  }

  if (pin.side === 'right') {
    return {
      right: -7,
      top: pin.offset,
      transform: 'translateY(-50%)',
    };
  }

  if (pin.side === 'top') {
    return {
      top: -7,
      left: pin.offset,
      transform: 'translateX(-50%)',
    };
  }

  return {
    bottom: -7,
    left: pin.offset,
    transform: 'translateX(-50%)',
  };
};

const getPinCenterPosition = ({
  node,
  pin,
  zoomLevel,
}: {|
  node: GraphNode,
  pin: PinDef,
  zoomLevel: number,
|}): PinPosition => {
  const scaledNodeX = node.x * zoomLevel;
  const scaledNodeY = node.y * zoomLevel;
  if (pin.side === 'left') {
    return {
      x: scaledNodeX - zoomLevel,
      y: scaledNodeY + pin.offset * zoomLevel,
    };
  }
  if (pin.side === 'right') {
    return {
      x: scaledNodeX + (node.width + 1) * zoomLevel,
      y: scaledNodeY + pin.offset * zoomLevel,
    };
  }
  if (pin.side === 'top') {
    return {
      x: scaledNodeX + pin.offset * zoomLevel,
      y: scaledNodeY - zoomLevel,
    };
  }
  return {
    x: scaledNodeX + pin.offset * zoomLevel,
    y: scaledNodeY + (node.height + 1) * zoomLevel,
  };
};

const buildGraphModel = ({
  eventNodes,
  eventMetadataByType,
  selection,
  project,
  i18n,
}: {|
  eventNodes: Array<BlueprintEventNode>,
  eventMetadataByType: { [string]: EventMetadata },
  selection: SelectionState,
  project: gdProject,
  i18n: I18nType,
|}): GraphModel => {
  const nodes: Array<GraphNode> = [];
  const edges: Array<GraphEdge> = [];

  let edgeIndex = 0;
  const addEdge = ({
    fromPinId,
    toPinId,
    kind,
    pinType,
  }: {|
    fromPinId: string,
    toPinId: string,
    kind: PinKind,
    pinType: PinType,
  |}) => {
    edges.push({
      id: `edge-${edgeIndex++}-${fromPinId}-${toPinId}`,
      fromPinId,
      toPinId,
      kind,
      pinType,
    });
  };

  let cursorY = 74;
  let maxX = 780;

  eventNodes.forEach(({ eventContext, depth, isAncestorDisabled }) => {
    const event = eventContext.event;
    const clusterId = `event-cluster-${event.ptr}`;
    const lanes = getEventLanes(event, i18n);
    const conditionLanes = lanes.filter(lane => lane.isCondition);
    const actionLanes = lanes.filter(lane => !lane.isCondition);

    const conditionEntries = getInstructionEntries({
      lanes: conditionLanes,
      eventContext,
      isCondition: true,
    });
    const actionEntries = getInstructionEntries({
      lanes: actionLanes,
      eventContext,
      isCondition: false,
    });

    const baseX = 56 + depth * 280;
    const eventNodeX = baseX;
    const eventNodeY = cursorY;
    const eventNodeWidth = 260;
    const eventNodeHeight = 96;

    const eventNodeId = `event-node-${event.ptr}`;
    const eventInPinId = `${eventNodeId}-exec-in`;
    const eventOutPinId = `${eventNodeId}-exec-out`;

    const eventDisplayName = getEventDisplayName({ event, eventMetadataByType });
    const selectedEvent = isEventSelected(selection, event);
    const disabled = isAncestorDisabled || event.isDisabled();

    const eventBadges = [
      {
        text: `${conditionEntries.length} ${i18n._(t`conditions`)}`,
        tone: ('condition': 'condition' | 'action' | 'meta'),
      },
      {
        text: `${actionEntries.length} ${i18n._(t`actions`)}`,
        tone: ('action': 'condition' | 'action' | 'meta'),
      },
      {
        text: `#${eventContext.indexInList + 1}`,
        tone: ('meta': 'condition' | 'action' | 'meta'),
      },
    ];

    nodes.push({
      id: eventNodeId,
      clusterId,
      kind: 'event',
      tone: 'default',
      x: eventNodeX,
      y: eventNodeY,
      width: eventNodeWidth,
      height: eventNodeHeight,
      title: clampText(eventDisplayName, 42),
      subtitle: i18n._(t`Event entry point`),
      eventContext,
      instructionContext: null,
      isSelected: selectedEvent,
      disabled,
      pins: [
        {
          id: eventInPinId,
          side: 'left',
          offset: 48,
          kind: 'exec',
          pinType: 'exec',
        },
        {
          id: eventOutPinId,
          side: 'right',
          offset: 48,
          kind: 'exec',
          pinType: 'exec',
        },
      ],
      parameters: [],
      badges: eventBadges,
      addConditionContext:
        conditionLanes.length > 0
          ? {
              isCondition: true,
              instrsList: conditionLanes[0].instructionsList,
            }
          : null,
      addActionContext:
        actionLanes.length > 0
          ? {
              isCondition: false,
              instrsList: actionLanes[0].instructionsList,
            }
          : null,
    });

    let graphBottom = eventNodeY + eventNodeHeight;
    let execSourcePinId = eventOutPinId;

    if (conditionEntries.length > 0) {
      const branchNodeId = `${eventNodeId}-branch`;
      const branchNodeX = baseX + 620;
      const branchNodeY = eventNodeY + 6;
      const branchNodeWidth = 206;
      const branchNodeHeight = 108;

      const branchExecInPinId = `${branchNodeId}-exec-in`;
      const branchDataInPinId = `${branchNodeId}-data-boolean-in`;
      const branchTrueOutPinId = `${branchNodeId}-exec-true-out`;
      const branchFalseOutPinId = `${branchNodeId}-exec-false-out`;

      nodes.push({
        id: branchNodeId,
        clusterId,
        kind: 'branch',
        tone: 'logic',
        x: branchNodeX,
        y: branchNodeY,
        width: branchNodeWidth,
        height: branchNodeHeight,
        title: i18n._(t`Branch`),
        subtitle: i18n._(t`Executes actions only when condition is true`),
        eventContext,
        instructionContext: null,
        isSelected: false,
        disabled,
        pins: [
          {
            id: branchExecInPinId,
            side: 'left',
            offset: 45,
            kind: 'exec',
            pinType: 'exec',
          },
          {
            id: branchDataInPinId,
            side: 'top',
            offset: 103,
            kind: 'data',
            pinType: 'boolean',
          },
          {
            id: branchTrueOutPinId,
            side: 'right',
            offset: 38,
            kind: 'exec',
            pinType: 'exec',
          },
          {
            id: branchFalseOutPinId,
            side: 'right',
            offset: 74,
            kind: 'exec',
            pinType: 'exec',
          },
        ],
        parameters: [],
        badges: [
          {
            text: i18n._(t`True / False`),
            tone: ('meta': 'condition' | 'action' | 'meta'),
          },
        ],
        addConditionContext:
          conditionLanes.length > 0
            ? {
                isCondition: true,
                instrsList: conditionLanes[0].instructionsList,
              }
            : null,
        addActionContext: null,
      });

      addEdge({
        fromPinId: eventOutPinId,
        toPinId: branchExecInPinId,
        kind: 'exec',
        pinType: 'exec',
      });

      execSourcePinId = branchTrueOutPinId;

      const conditionNodeX = baseX + 340;
      const conditionNodeVerticalSpacing = 178;
      const conditionStartY =
        branchNodeY -
        ((conditionEntries.length - 1) * conditionNodeVerticalSpacing) / 2;

      conditionEntries.forEach((entry, index) => {
        const instruction = entry.instructionContext.instruction;
        const instructionId = instruction.ptr;
        const conditionNodeId = `condition-node-${instructionId}`;
        const conditionNodeY =
          conditionStartY + index * conditionNodeVerticalSpacing;

        const conditionInPinId = `${conditionNodeId}-exec-in`;
        const conditionOutPinId = `${conditionNodeId}-data-boolean-out`;

        const metadata = getInstructionMetadata({
          instructionType: instruction.getType(),
          isCondition: true,
          project,
        });
        const parameters = getInstructionNodeParameters({
          instruction,
          metadata,
          i18n,
        });
        const conditionNodeHeight = 92 + parameters.length * 26;
        const conditionDataPinOffsetStart = 72;

        nodes.push({
          id: conditionNodeId,
          clusterId,
          kind: 'condition',
          tone: getInstructionTone(instruction.getType()),
          x: conditionNodeX,
          y: conditionNodeY,
          width: 252,
          height: conditionNodeHeight,
          title: clampText(
            metadata && metadata.getFullName()
              ? metadata.getFullName()
              : instruction.getType() || i18n._(t`Condition`),
            44
          ),
          subtitle: renderInstructionSentence({
            instruction,
            metadata,
            isCondition: true,
            i18n,
          }),
          eventContext,
          instructionContext: entry.instructionContext,
          isSelected: isInstructionSelected(selection, instruction),
          disabled,
          pins: [
            {
              id: conditionInPinId,
              side: 'left',
              offset: 44,
              kind: 'exec',
              pinType: 'exec',
            },
            {
              id: conditionOutPinId,
              side: 'right',
              offset: 44,
              kind: 'data',
              pinType: 'boolean',
            },
            ...parameters.map((parameter, parameterIndex) => ({
              id: `${conditionNodeId}-data-${parameter.pinType}-param-${parameter.index}-in`,
              side: 'left',
              offset: conditionDataPinOffsetStart + parameterIndex * 26,
              kind: ('data': PinKind),
              pinType: parameter.pinType,
            })),
          ],
          parameters,
          badges: [],
          addConditionContext: null,
          addActionContext: null,
        });

        addEdge({
          fromPinId: conditionOutPinId,
          toPinId: branchDataInPinId,
          kind: 'data',
          pinType: 'boolean',
        });

        graphBottom = Math.max(graphBottom, conditionNodeY + conditionNodeHeight);
      });

      graphBottom = Math.max(graphBottom, branchNodeY + branchNodeHeight);
      maxX = Math.max(maxX, branchNodeX + branchNodeWidth + 50);
    }

    const actionsBaseX = baseX + (conditionEntries.length > 0 ? 920 : 420);
    let actionExecutionTailPinId = execSourcePinId;
    let actionsRightEdge = actionsBaseX;

    if (actionEntries.length > 0) {
      let previousActionOutPinId = execSourcePinId;
      const actionRowSpacing = 196;

      actionEntries.forEach((entry, index) => {
        const instruction = entry.instructionContext.instruction;
        const instructionId = instruction.ptr;
        const actionNodeId = `action-node-${instructionId}`;

        const row = Math.floor(index / 4);
        const column = index % 4;
        const actionNodeX = actionsBaseX + column * 272;
        const actionNodeY = eventNodeY + row * actionRowSpacing;

        const actionInPinId = `${actionNodeId}-exec-in`;
        const actionOutPinId = `${actionNodeId}-exec-out`;

        const metadata = getInstructionMetadata({
          instructionType: instruction.getType(),
          isCondition: false,
          project,
        });
        const parameters = getInstructionNodeParameters({
          instruction,
          metadata,
          i18n,
        });
        const actionNodeHeight = 92 + parameters.length * 26;
        const actionDataPinOffsetStart = 72;

        nodes.push({
          id: actionNodeId,
          clusterId,
          kind: 'action',
          tone: getInstructionTone(instruction.getType()),
          x: actionNodeX,
          y: actionNodeY,
          width: 252,
          height: actionNodeHeight,
          title: clampText(
            metadata && metadata.getFullName()
              ? metadata.getFullName()
              : instruction.getType() || i18n._(t`Action`),
            44
          ),
          subtitle: renderInstructionSentence({
            instruction,
            metadata,
            isCondition: false,
            i18n,
          }),
          eventContext,
          instructionContext: entry.instructionContext,
          isSelected: isInstructionSelected(selection, instruction),
          disabled,
          pins: [
            {
              id: actionInPinId,
              side: 'left',
              offset: 44,
              kind: 'exec',
              pinType: 'exec',
            },
            {
              id: actionOutPinId,
              side: 'right',
              offset: 44,
              kind: 'exec',
              pinType: 'exec',
            },
            ...parameters.map((parameter, parameterIndex) => ({
              id: `${actionNodeId}-data-${parameter.pinType}-param-${parameter.index}-in`,
              side: 'left',
              offset: actionDataPinOffsetStart + parameterIndex * 26,
              kind: ('data': PinKind),
              pinType: parameter.pinType,
            })),
          ],
          parameters,
          badges: [],
          addConditionContext: null,
          addActionContext: null,
        });

        addEdge({
          fromPinId: previousActionOutPinId,
          toPinId: actionInPinId,
          kind: 'exec',
          pinType: 'exec',
        });

        previousActionOutPinId = actionOutPinId;
        actionExecutionTailPinId = actionOutPinId;
        actionsRightEdge = Math.max(actionsRightEdge, actionNodeX + 252);
        graphBottom = Math.max(graphBottom, actionNodeY + actionNodeHeight);
        maxX = Math.max(maxX, actionNodeX + 252 + 80);
      });
    } else {
      const placeholderNodeId = `${eventNodeId}-placeholder`;
      const placeholderNodeX = actionsBaseX;
      const placeholderNodeY = eventNodeY + 8;
      const placeholderInPinId = `${placeholderNodeId}-exec-in`;

      nodes.push({
        id: placeholderNodeId,
        clusterId,
        kind: 'placeholder',
        tone: 'default',
        x: placeholderNodeX,
        y: placeholderNodeY,
        width: 220,
        height: 74,
        title: i18n._(t`No actions yet`),
        subtitle: i18n._(t`Add your first action from the Event node.`),
        eventContext,
        instructionContext: null,
        isSelected: false,
        disabled,
        pins: [
          {
            id: placeholderInPinId,
            side: 'left',
            offset: 37,
            kind: 'exec',
            pinType: 'exec',
          },
        ],
        parameters: [],
        badges: [],
        addConditionContext: null,
        addActionContext: null,
      });

      addEdge({
        fromPinId: execSourcePinId,
        toPinId: placeholderInPinId,
        kind: 'exec',
        pinType: 'exec',
      });

      graphBottom = Math.max(graphBottom, placeholderNodeY + 74);
      actionsRightEdge = Math.max(actionsRightEdge, placeholderNodeX + 220);
      maxX = Math.max(maxX, placeholderNodeX + 220 + 70);
    }

    const subEvents = [];
    if (event.canHaveSubEvents() && event.getSubEvents().getEventsCount() > 0) {
      mapFor(0, event.getSubEvents().getEventsCount(), subEventIndex => {
        subEvents.push(event.getSubEvents().getEventAt(subEventIndex));
      });
    }

    if (subEvents.length > 0) {
      const sequenceNodeId = `${eventNodeId}-sequence`;
      const sequenceNodeX = actionsRightEdge + 84;
      const sequenceNodeY = eventNodeY + 10;
      const sequenceNodeWidth = 242;
      const sequenceNodeHeight = 54 + subEvents.length * 20;
      const sequenceInPinId = `${sequenceNodeId}-exec-in`;
      const sequenceOutPins = subEvents.map((subEvent, index) => ({
        id: `${sequenceNodeId}-exec-${subEvent.ptr}-out`,
        side: ('right': 'left' | 'right' | 'top' | 'bottom'),
        offset: 22 + index * 20,
        kind: ('exec': PinKind),
        pinType: ('exec': PinType),
      }));

      nodes.push({
        id: sequenceNodeId,
        clusterId,
        kind: 'sequence',
        tone: 'logic',
        x: sequenceNodeX,
        y: sequenceNodeY,
        width: sequenceNodeWidth,
        height: sequenceNodeHeight,
        title: i18n._(t`Sequence`),
        subtitle: i18n._(t`Run branches in order`),
        eventContext,
        instructionContext: null,
        isSelected: false,
        disabled,
        pins: [
          {
            id: sequenceInPinId,
            side: 'left',
            offset: 22,
            kind: 'exec',
            pinType: 'exec',
          },
          ...sequenceOutPins,
        ],
        parameters: [],
        badges: [
          {
            text: `${subEvents.length} ${i18n._(t`outputs`)}`,
            tone: ('meta': 'condition' | 'action' | 'meta'),
          },
        ],
        addConditionContext: null,
        addActionContext: null,
      });

      addEdge({
        fromPinId: actionExecutionTailPinId,
        toPinId: sequenceInPinId,
        kind: 'exec',
        pinType: 'exec',
      });

      subEvents.forEach((subEvent, index) => {
        addEdge({
          fromPinId: sequenceOutPins[index].id,
          toPinId: `event-node-${subEvent.ptr}-exec-in`,
          kind: 'exec',
          pinType: 'exec',
        });
      });

      graphBottom = Math.max(graphBottom, sequenceNodeY + sequenceNodeHeight);
      maxX = Math.max(maxX, sequenceNodeX + sequenceNodeWidth + 80);
    }

    cursorY = graphBottom + 126;
  });

  return {
    nodes,
    edges,
    width: maxX,
    height: Math.max(cursorY, 320),
  };
};

const getEventStyleVariables = (isLightTheme: boolean): { [string]: string } =>
  isLightTheme
    ? {
        '--bp-grid-small': 'rgba(33, 41, 62, 0.12)',
        '--bp-grid-large': 'rgba(33, 41, 62, 0.22)',
        '--bp-background':
          'linear-gradient(180deg, #25282d 0%, #1f2126 48%, #1b1d22 100%)',
      }
    : {
        '--bp-grid-small': 'rgba(238, 246, 255, 0.055)',
        '--bp-grid-large': 'rgba(238, 246, 255, 0.11)',
        '--bp-background':
          'linear-gradient(180deg, #2f3137 0%, #26282d 48%, #212328 100%)',
      };

const getPinElementClass = ({
  pin,
  activeConnectionDrag,
}: {|
  pin: PinDef,
  activeConnectionDrag: ?ActiveConnectionDrag,
|}): string => {
  const isSource =
    !!activeConnectionDrag && activeConnectionDrag.fromPinId === pin.id;
  const isConnectable =
    !!activeConnectionDrag &&
    activeConnectionDrag.fromPinId !== pin.id &&
    arePinsConnectable(activeConnectionDrag.fromPinId, pin.id);

  return classNames('gd-blueprint-pin', {
    'gd-blueprint-pin-data': pin.kind === 'data',
    'gd-blueprint-pin-type-number': pin.pinType === 'number',
    'gd-blueprint-pin-type-boolean': pin.pinType === 'boolean',
    'gd-blueprint-pin-type-string': pin.pinType === 'string',
    'gd-blueprint-pin-type-vector2': pin.pinType === 'vector2',
    'gd-blueprint-pin-type-vector3': pin.pinType === 'vector3',
    'gd-blueprint-pin-source': isSource,
    'gd-blueprint-pin-connectable': isConnectable,
  });
};

const getNodeClass = (node: GraphNode): string =>
  classNames('gd-blueprint-node', {
    'gd-blueprint-node-event': node.kind === 'event',
    'gd-blueprint-node-branch': node.kind === 'branch',
    'gd-blueprint-node-sequence': node.kind === 'sequence',
    'gd-blueprint-node-condition': node.kind === 'condition',
    'gd-blueprint-node-action': node.kind === 'action',
    'gd-blueprint-node-placeholder': node.kind === 'placeholder',
    'gd-blueprint-node-tone-physics': node.tone === 'physics',
    'gd-blueprint-node-tone-tween': node.tone === 'tween',
    'gd-blueprint-node-tone-logic': node.tone === 'logic',
    'gd-blueprint-node-selected': node.isSelected,
    'gd-blueprint-node-disabled': node.disabled,
  });

const getWireClass = ({
  kind,
  pinType,
  isManual,
}: {|
  kind: PinKind,
  pinType: PinType,
  isManual: boolean,
|}): string =>
  classNames('gd-blueprint-wire', {
    'gd-blueprint-wire-data': kind === 'data',
    'gd-blueprint-wire-exec': kind === 'exec',
    'gd-blueprint-wire-type-number': pinType === 'number',
    'gd-blueprint-wire-type-boolean': pinType === 'boolean',
    'gd-blueprint-wire-type-string': pinType === 'string',
    'gd-blueprint-wire-type-vector2': pinType === 'vector2',
    'gd-blueprint-wire-type-vector3': pinType === 'vector3',
    'gd-blueprint-wire-manual': isManual,
  });

const getPinTypeLabel = (pinType: PinType): string => {
  if (pinType === 'exec') return 'Exec';
  if (pinType === 'number') return 'Number';
  if (pinType === 'boolean') return 'Boolean';
  if (pinType === 'string') return 'String';
  if (pinType === 'vector2') return 'Vector2';
  return 'Vector3';
};

const clampZoomLevel = (zoom: number): number =>
  Math.max(BLUEPRINT_ZOOM_MIN, Math.min(BLUEPRINT_ZOOM_MAX, zoom));

const BlueprintGraphCanvas = ({
  project,
  events,
  projectScopedContainersAccessor,
  selection,
  eventMetadataByType,
  onEventClick,
  onEventContextMenu,
  onInstructionClick,
  onInstructionDoubleClick,
  onInstructionContextMenu,
  onSetInstructionParameterValue,
  onAddInstructionContextMenu,
  onCreateTemplateNode,
  onCreateQuickStartEvent,
  onAddNewEvent,
}: Props): React.Node => {
  const theme = React.useContext(GDevelopThemeContext);
  const rootRef = React.useRef<?HTMLDivElement>(null);
  const contentRef = React.useRef<?HTMLDivElement>(null);
  const instructionMenuAnchorRef = React.useRef<?HTMLButtonElement>(null);
  const hasCenteredViewRef = React.useRef<boolean>(false);
  const dragMovedRef = React.useRef<boolean>(false);
  const suppressNodeClickRef = React.useRef<boolean>(false);
  const suppressNodeClickTimeoutRef = React.useRef<?TimeoutID>(null);
  const pendingEventPlacementRef = React.useRef<?NodePosition>(null);
  const knownEventPointersRef = React.useRef<?Set<number>>(null);
  const latestGraphModelRef = React.useRef<?GraphModel>(null);
  const graphModelCacheRef = React.useRef<?{|
    eventNodes: Array<BlueprintEventNode>,
    eventMetadataByType: { [string]: EventMetadata },
    selection: SelectionState,
    project: gdProject,
    locale: string,
    graphModel: GraphModel,
  |}>(null);
  const positionedNodesCacheRef = React.useRef<?{|
    graphModel: GraphModel,
    nodePositionsById: NodePositionsById,
    positionedNodes: Array<GraphNode>,
    positionedNodeById: { [string]: GraphNode },
  |}>(null);

  const [nodePositionsById, setNodePositionsById] = React.useState<
    NodePositionsById
  >({});
  const [manualConnections, setManualConnections] = React.useState<
    Array<ManualConnection>
  >([]);
  const [activeConnectionDrag, setActiveConnectionDrag] = React.useState<?ActiveConnectionDrag>(
    null
  );
  const [activeNodeDrag, setActiveNodeDrag] = React.useState<?ActiveNodeDrag>(
    null
  );
  const [activePanDrag, setActivePanDrag] = React.useState<?ActivePanDrag>(
    null
  );
  const [graphContextMenu, setGraphContextMenu] = React.useState<?GraphContextMenuState>(
    null
  );
  const [contextMenuSearchText, setContextMenuSearchText] = React.useState('');
  const [nodeParameterDraftValues, setNodeParameterDraftValues] = React.useState<{
    [string]: { [number]: string },
  }>({});
  const [instructionMenuAnchorPosition, setInstructionMenuAnchorPosition] = React.useState<NodePosition>(
    {
      x: 0,
      y: 0,
    }
  );
  const [zoomLevel, setZoomLevel] = React.useState<number>(1);
  const zoomLevelRef = React.useRef<number>(1);

  const eventNodes = React.useMemo(
    () => collectEventNodes(events, projectScopedContainersAccessor),
    [events, projectScopedContainersAccessor]
  );

  const styleVariables = React.useMemo(
    () => getEventStyleVariables(theme.palette.type === 'light'),
    [theme.palette.type]
  );

  React.useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const setZoomAroundPoint = React.useCallback(
    (nextZoomRaw: number, clientX: number, clientY: number) => {
      const rootElement = rootRef.current;
      const currentZoom = zoomLevelRef.current;
      const nextZoom = clampZoomLevel(Math.round(nextZoomRaw * 100) / 100);

      if (!rootElement) {
        setZoomLevel(nextZoom);
        return;
      }
      if (Math.abs(nextZoom - currentZoom) < 0.001) return;

      const rootRect = rootElement.getBoundingClientRect();
      const pointerX = clientX - rootRect.left;
      const pointerY = clientY - rootRect.top;

      const worldX = (rootElement.scrollLeft + pointerX) / currentZoom;
      const worldY = (rootElement.scrollTop + pointerY) / currentZoom;

      setZoomLevel(nextZoom);
      requestAnimationFrame(() => {
        const refreshedRootElement = rootRef.current;
        if (!refreshedRootElement) return;
        refreshedRootElement.scrollLeft = Math.max(0, worldX * nextZoom - pointerX);
        refreshedRootElement.scrollTop = Math.max(0, worldY * nextZoom - pointerY);
      });
    },
    []
  );

  const zoomFromViewportCenter = React.useCallback(
    (nextZoomRaw: number) => {
      const rootElement = rootRef.current;
      const nextZoom = clampZoomLevel(nextZoomRaw);

      if (!rootElement) {
        setZoomLevel(nextZoom);
        return;
      }

      const rootRect = rootElement.getBoundingClientRect();
      setZoomAroundPoint(
        nextZoom,
        rootRect.left + rootElement.clientWidth / 2,
        rootRect.top + rootElement.clientHeight / 2
      );
    },
    [setZoomAroundPoint]
  );

  const zoomIn = React.useCallback(() => {
    zoomFromViewportCenter(zoomLevelRef.current + BLUEPRINT_ZOOM_STEP);
  }, [zoomFromViewportCenter]);

  const zoomOut = React.useCallback(() => {
    zoomFromViewportCenter(zoomLevelRef.current - BLUEPRINT_ZOOM_STEP);
  }, [zoomFromViewportCenter]);

  const resetZoom = React.useCallback(() => {
    zoomFromViewportCenter(1);
  }, [zoomFromViewportCenter]);

  React.useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (!keyboardEvent.ctrlKey && !keyboardEvent.metaKey) return;
      const target = keyboardEvent.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (keyboardEvent.key === '+' || keyboardEvent.key === '=') {
        keyboardEvent.preventDefault();
        zoomIn();
      } else if (keyboardEvent.key === '-' || keyboardEvent.key === '_') {
        keyboardEvent.preventDefault();
        zoomOut();
      } else if (keyboardEvent.key === '0') {
        keyboardEvent.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  React.useEffect(
    () => () => {
      if (suppressNodeClickTimeoutRef.current) {
        clearTimeout(suppressNodeClickTimeoutRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    if (hasCenteredViewRef.current) return;
    const rootElement = rootRef.current;
    if (!rootElement) return;

    rootElement.scrollLeft = Math.max(
      0,
      BLUEPRINT_WORLD_OFFSET_X * zoomLevelRef.current - rootElement.clientWidth * 0.38
    );
    rootElement.scrollTop = Math.max(
      0,
      BLUEPRINT_WORLD_OFFSET_Y * zoomLevelRef.current - rootElement.clientHeight * 0.32
    );
    hasCenteredViewRef.current = true;
  }, []);

  const armPendingEventPlacement = React.useCallback((graphX: number, graphY: number) => {
    const currentZoom = zoomLevelRef.current || 1;
    pendingEventPlacementRef.current = {
      x: Math.max(0, Math.round((graphX / currentZoom) * 10) / 10),
      y: Math.max(0, Math.round((graphY / currentZoom) * 10) / 10),
    };
  }, []);

  React.useEffect(() => {
    const currentEventPointers = eventNodes.map(
      eventNode => eventNode.eventContext.event.ptr
    );
    const currentEventPointerSet = new Set(currentEventPointers);
    const previousEventPointerSet = knownEventPointersRef.current;

    if (!previousEventPointerSet) {
      knownEventPointersRef.current = currentEventPointerSet;
      return;
    }

    const pendingEventPlacement = pendingEventPlacementRef.current;
    if (!pendingEventPlacement) {
      knownEventPointersRef.current = currentEventPointerSet;
      return;
    }

    const newEventPointers = currentEventPointers.filter(
      eventPointer => !previousEventPointerSet.has(eventPointer)
    );
    if (!newEventPointers.length) {
      knownEventPointersRef.current = currentEventPointerSet;
      return;
    }

    const anchorEventPointer = newEventPointers[0];
    const latestGraphModel = latestGraphModelRef.current;
    if (!latestGraphModel) {
      knownEventPointersRef.current = currentEventPointerSet;
      return;
    }

    const createdClusterIds = newEventPointers.map(
      eventPointer => `event-cluster-${eventPointer}`
    );
    const createdClusterNodes = latestGraphModel.nodes.filter(node =>
      createdClusterIds.includes(node.clusterId)
    );
    const anchorEventNode = createdClusterNodes.find(
      node => node.kind === 'event' && node.clusterId === `event-cluster-${anchorEventPointer}`
    );

    if (anchorEventNode && createdClusterNodes.length) {
      const targetWorldX = pendingEventPlacement.x;
      const targetWorldY = pendingEventPlacement.y;
      const anchorEventNodeDefaultWorldX =
        anchorEventNode.x + BLUEPRINT_WORLD_OFFSET_X;
      const anchorEventNodeDefaultWorldY =
        anchorEventNode.y + BLUEPRINT_WORLD_OFFSET_Y;
      const deltaX = targetWorldX - anchorEventNodeDefaultWorldX;
      const deltaY = targetWorldY - anchorEventNodeDefaultWorldY;

      setNodePositionsById(previousNodePositions => {
        const nextNodePositions = { ...previousNodePositions };
        createdClusterNodes.forEach(node => {
          nextNodePositions[node.id] = {
            x: Math.round(node.x + BLUEPRINT_WORLD_OFFSET_X + deltaX),
            y: Math.round(node.y + BLUEPRINT_WORLD_OFFSET_Y + deltaY),
          };
        });
        return nextNodePositions;
      });
    }

    pendingEventPlacementRef.current = null;
    knownEventPointersRef.current = currentEventPointerSet;
  }, [eventNodes]);

  React.useEffect(() => {
    if (!activeConnectionDrag) return;

    const onPointerMove = (domEvent: PointerEvent) => {
      const contentElement = contentRef.current;
      if (!contentElement) return;

      const contentRect = contentElement.getBoundingClientRect();
      setActiveConnectionDrag(previousActiveConnectionDrag =>
        previousActiveConnectionDrag
          ? {
              ...previousActiveConnectionDrag,
              pointerX: domEvent.clientX - contentRect.left,
              pointerY: domEvent.clientY - contentRect.top,
            }
          : previousActiveConnectionDrag
      );
    };

    const onPointerUp = () => {
      setActiveConnectionDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [activeConnectionDrag]);

  React.useEffect(() => {
    if (!activeNodeDrag) return;

    dragMovedRef.current = false;
    let dragAnimationFrameId: ?number = null;
    let lastDeltaX = 0;
    let lastDeltaY = 0;

    const applyNodeDragPosition = () => {
      setNodePositionsById(previousNodePositions => {
        const nextNodePositions = { ...previousNodePositions };
        activeNodeDrag.nodeIds.forEach(nodeId => {
          const basePosition = activeNodeDrag.basePositionsById[nodeId];
          if (!basePosition) return;
          nextNodePositions[nodeId] = {
            x: Math.round(basePosition.x + lastDeltaX),
            y: Math.round(basePosition.y + lastDeltaY),
          };
        });
        return nextNodePositions;
      });
    };

    const onPointerMove = (domEvent: PointerEvent) => {
      lastDeltaX =
        (domEvent.clientX - activeNodeDrag.startClientX) / zoomLevelRef.current;
      lastDeltaY =
        (domEvent.clientY - activeNodeDrag.startClientY) / zoomLevelRef.current;

      if (Math.abs(lastDeltaX) > 2 || Math.abs(lastDeltaY) > 2) {
        dragMovedRef.current = true;
      }

      if (dragAnimationFrameId !== null) return;
      dragAnimationFrameId = requestAnimationFrame(() => {
        dragAnimationFrameId = null;
        applyNodeDragPosition();
      });
    };

    const onPointerUp = () => {
      const shouldApplyFinalPosition =
        dragMovedRef.current || dragAnimationFrameId !== null;
      if (dragAnimationFrameId !== null) {
        cancelAnimationFrame(dragAnimationFrameId);
        dragAnimationFrameId = null;
      }
      if (shouldApplyFinalPosition) {
        applyNodeDragPosition();
      }

      if (dragMovedRef.current) {
        suppressNodeClickRef.current = true;
        if (suppressNodeClickTimeoutRef.current) {
          clearTimeout(suppressNodeClickTimeoutRef.current);
        }
        suppressNodeClickTimeoutRef.current = setTimeout(() => {
          suppressNodeClickRef.current = false;
        }, 120);
      }
      setActiveNodeDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      if (dragAnimationFrameId !== null) {
        cancelAnimationFrame(dragAnimationFrameId);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [activeNodeDrag]);

  React.useEffect(() => {
    if (!activePanDrag) return;

    const onPointerMove = (domEvent: PointerEvent) => {
      const rootElement = rootRef.current;
      if (!rootElement) return;

      const deltaX = domEvent.clientX - activePanDrag.startClientX;
      const deltaY = domEvent.clientY - activePanDrag.startClientY;
      rootElement.scrollLeft = activePanDrag.startScrollLeft - deltaX;
      rootElement.scrollTop = activePanDrag.startScrollTop - deltaY;
    };

    const onPointerUp = () => {
      setActivePanDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [activePanDrag]);

  const startConnectionDrag = React.useCallback((domEvent: any, pinId: string) => {
    domEvent.preventDefault();
    domEvent.stopPropagation();
    setGraphContextMenu(null);
    setContextMenuSearchText('');
    setActivePanDrag(null);
    setActiveNodeDrag(null);

    const contentElement = contentRef.current;
    if (!contentElement) return;
    const contentRect = contentElement.getBoundingClientRect();

    setActiveConnectionDrag({
      fromPinId: pinId,
      pointerX: domEvent.clientX - contentRect.left,
      pointerY: domEvent.clientY - contentRect.top,
    });
  }, []);

  const completeConnectionDrag = React.useCallback(
    (domEvent: any, targetPinId: string) => {
      if (!activeConnectionDrag) return;

      domEvent.preventDefault();
      domEvent.stopPropagation();

      const normalizedConnection = normalizeConnection(
        activeConnectionDrag.fromPinId,
        targetPinId
      );

      setActiveConnectionDrag(null);
      if (!normalizedConnection) return;

      const connectionId = getConnectionId(normalizedConnection);
      const kind = getPinKindFromPinId(normalizedConnection.fromPinId);
      const pinType = getPinTypeFromPinId(normalizedConnection.fromPinId);

      setManualConnections(previousConnections => {
        if (
          previousConnections.some(
            previousConnection => previousConnection.id === connectionId
          )
        ) {
          return previousConnections;
        }

        return [
          ...previousConnections,
          {
            id: connectionId,
            fromPinId: normalizedConnection.fromPinId,
            toPinId: normalizedConnection.toPinId,
            kind,
            pinType,
          },
        ];
      });
    },
    [activeConnectionDrag]
  );

  const closeGraphContextMenu = React.useCallback(() => {
    setGraphContextMenu(null);
    setContextMenuSearchText('');
  }, []);

  const startNodeDrag = React.useCallback(
    (
      domEvent: any,
      nodeIds: Array<string>,
      basePositionsById: NodePositionsById
    ) => {
      if (domEvent.button !== 0) return;
      if (!nodeIds.length) return;

      domEvent.preventDefault();
      domEvent.stopPropagation();
      closeGraphContextMenu();
      setActivePanDrag(null);
      setActiveConnectionDrag(null);

      setActiveNodeDrag({
        startClientX: domEvent.clientX,
        startClientY: domEvent.clientY,
        nodeIds,
        basePositionsById,
      });
    },
    [closeGraphContextMenu]
  );

  const startPanDrag = React.useCallback(
    (domEvent: any) => {
      if (domEvent.button !== 0 && domEvent.button !== 1) return;
      if (activeConnectionDrag || activeNodeDrag) return;

      const target = domEvent.target;
      if (target instanceof HTMLElement && target.closest('.gd-blueprint-node')) {
        return;
      }

      const rootElement = rootRef.current;
      if (!rootElement) return;

      domEvent.preventDefault();
      closeGraphContextMenu();
      setActivePanDrag({
        startClientX: domEvent.clientX,
        startClientY: domEvent.clientY,
        startScrollLeft: rootElement.scrollLeft,
        startScrollTop: rootElement.scrollTop,
      });
    },
    [activeConnectionDrag, activeNodeDrag, closeGraphContextMenu]
  );

  const triggerQuickAdd = React.useCallback(
    ({
      mode,
      eventContext,
      addConditionContext,
      addActionContext,
      x,
      y,
    }: {|
      mode: QuickAddMode,
      eventContext: ?EventContext,
      addConditionContext: ?InstructionsListContext,
      addActionContext: ?InstructionsListContext,
      x: number,
      y: number,
    |}) => {
      if (
        mode === 'event-start' ||
        mode === 'event-update' ||
        mode === 'event-fixed-update' ||
        mode === 'event-key-pressed'
      ) {
        const eventPreset: QuickStartEventPreset =
          mode === 'event-start'
            ? 'start'
            : mode === 'event-update'
            ? 'update'
            : mode === 'event-fixed-update'
            ? 'fixed-update'
            : 'key-pressed';
        armPendingEventPlacement(x, y);
        closeGraphContextMenu();
        onCreateQuickStartEvent(eventPreset, events);
        return;
      }

      if (mode === 'event') {
        armPendingEventPlacement(x, y);
        closeGraphContextMenu();
        onAddNewEvent('BuiltinCommonInstructions::Standard', events);
        return;
      }

      if (
        mode === 'template-add-force' ||
        mode === 'template-set-velocity' ||
        mode === 'template-lerp' ||
        mode === 'template-branch' ||
        mode === 'template-sequence'
      ) {
        if (!eventContext) return;
        const templateId =
          mode === 'template-add-force'
            ? 'add-force'
            : mode === 'template-set-velocity'
            ? 'set-velocity'
            : mode === 'template-lerp'
            ? 'lerp'
            : mode === 'template-branch'
            ? 'branch'
            : 'sequence';
        closeGraphContextMenu();
        onCreateTemplateNode(eventContext, templateId);
        return;
      }

      if (!eventContext) return;
      const instructionsListContext =
        mode === 'condition-player' || mode === 'condition-global'
          ? addConditionContext
          : addActionContext;
      if (!instructionsListContext) return;

      const anchorElement = instructionMenuAnchorRef.current;
      if (!anchorElement) return;

      setInstructionMenuAnchorPosition({ x, y });
      closeGraphContextMenu();

      const initialInstructionMenuTab =
        mode === 'condition-global' || mode === 'action-global'
          ? 'free-instructions'
          : 'objects';

      requestAnimationFrame(() => {
        onAddInstructionContextMenu(
          eventContext,
          anchorElement,
          instructionsListContext,
          initialInstructionMenuTab
        );
      });
    },
    [
      armPendingEventPlacement,
      closeGraphContextMenu,
      events,
      onAddInstructionContextMenu,
      onAddNewEvent,
      onCreateQuickStartEvent,
      onCreateTemplateNode,
    ]
  );

  const setNodeParameterDraftValue = React.useCallback(
    (nodeId: string, parameterIndex: number, value: string) => {
      setNodeParameterDraftValues(previousValues => ({
        ...previousValues,
        [nodeId]: {
          ...(previousValues[nodeId] || {}),
          [parameterIndex]: value,
        },
      }));
    },
    []
  );

  const clearNodeParameterDraftValue = React.useCallback(
    (nodeId: string, parameterIndex: number) => {
      setNodeParameterDraftValues(previousValues => {
        if (!previousValues[nodeId]) return previousValues;
        const nodeDraftValues = { ...previousValues[nodeId] };
        delete nodeDraftValues[parameterIndex];
        if (Object.keys(nodeDraftValues).length) {
          return {
            ...previousValues,
            [nodeId]: nodeDraftValues,
          };
        }
        const nextValues = { ...previousValues };
        delete nextValues[nodeId];
        return nextValues;
      });
    },
    []
  );

  return (
    <I18n>
      {({ i18n }) => {
        const locale = i18n.locale;
        const cachedGraphModel = graphModelCacheRef.current;
        const graphModel =
          cachedGraphModel &&
          cachedGraphModel.eventNodes === eventNodes &&
          cachedGraphModel.eventMetadataByType === eventMetadataByType &&
          cachedGraphModel.selection === selection &&
          cachedGraphModel.project === project &&
          cachedGraphModel.locale === locale
            ? cachedGraphModel.graphModel
            : buildGraphModel({
                eventNodes,
                eventMetadataByType,
                selection,
                project,
                i18n,
              });

        if (!cachedGraphModel || cachedGraphModel.graphModel !== graphModel) {
          graphModelCacheRef.current = {
            eventNodes,
            eventMetadataByType,
            selection,
            project,
            locale,
            graphModel,
          };
        }
        latestGraphModelRef.current = graphModel;

        const cachedPositionedNodes = positionedNodesCacheRef.current;
        let positionedNodes: Array<GraphNode>;
        let positionedNodeById: { [string]: GraphNode };
        if (
          cachedPositionedNodes &&
          cachedPositionedNodes.graphModel === graphModel &&
          cachedPositionedNodes.nodePositionsById === nodePositionsById
        ) {
          positionedNodes = cachedPositionedNodes.positionedNodes;
          positionedNodeById = cachedPositionedNodes.positionedNodeById;
        } else {
          positionedNodes = graphModel.nodes.map(node => {
            const customPosition = nodePositionsById[node.id];
            const defaultWorldPosition = {
              x: node.x + BLUEPRINT_WORLD_OFFSET_X,
              y: node.y + BLUEPRINT_WORLD_OFFSET_Y,
            };
            return customPosition
              ? {
                  ...node,
                  x: customPosition.x,
                  y: customPosition.y,
                }
              : {
                  ...node,
                  x: defaultWorldPosition.x,
                  y: defaultWorldPosition.y,
                };
          });

          positionedNodeById = {};
          positionedNodes.forEach(node => {
            positionedNodeById[node.id] = node;
          });
          positionedNodesCacheRef.current = {
            graphModel,
            nodePositionsById,
            positionedNodes,
            positionedNodeById,
          };
        }

        const pinPositions: PinPositionsById = {};
        positionedNodes.forEach(node => {
          node.pins.forEach(pin => {
            pinPositions[pin.id] = getPinCenterPosition({ node, pin, zoomLevel });
          });
        });

        const contentWidth = Math.max(
          BLUEPRINT_WORLD_MIN_WIDTH,
          graphModel.width + BLUEPRINT_WORLD_OFFSET_X * 1.8,
          positionedNodes.reduce(
            (currentMax, node) => Math.max(currentMax, node.x + node.width + 140),
            0
          )
        );
        const contentHeight = Math.max(
          BLUEPRINT_WORLD_MIN_HEIGHT,
          graphModel.height + BLUEPRINT_WORLD_OFFSET_Y * 1.8,
          positionedNodes.reduce(
            (currentMax, node) => Math.max(currentMax, node.y + node.height + 150),
            0
          )
        );
        const scaledContentWidth = Math.round(contentWidth * zoomLevel);
        const scaledContentHeight = Math.round(contentHeight * zoomLevel);
        const zoomLabel = `${Math.round(zoomLevel * 100)}%`;
        const rootStyle = {
          ...styleVariables,
          '--bp-grid-zoom': `${zoomLevel}`,
        };

        const eventGraphNodes = positionedNodes.filter(
          node => node.kind === 'event'
        );
        const preferredEventNode =
          eventGraphNodes.find(eventNode => eventNode.isSelected) ||
          eventGraphNodes[0];

        const quickStartItems = [
          {
            id: 'event-start',
            mode: ('event-start': QuickAddMode),
            itemType: 'quick-start',
            enabled: true,
            title: i18n._(t`Start`),
            subtitle: i18n._(t`Create event: At the beginning of the scene`),
            keywords: 'start begin scene just begins init',
          },
          {
            id: 'event-update',
            mode: ('event-update': QuickAddMode),
            itemType: 'quick-start',
            enabled: true,
            title: i18n._(t`Update`),
            subtitle: i18n._(t`Create event that runs every frame`),
            keywords: 'update tick every frame loop',
          },
          {
            id: 'event-fixed-update',
            mode: ('event-fixed-update': QuickAddMode),
            itemType: 'quick-start',
            enabled: true,
            title: i18n._(t`FixedUpdate`),
            subtitle: i18n._(t`Create fixed-step timer-driven update event`),
            keywords: 'fixed update timestep physics timer',
          },
          {
            id: 'event-key-pressed',
            mode: ('event-key-pressed': QuickAddMode),
            itemType: 'quick-start',
            enabled: true,
            title: i18n._(t`Key Pressed`),
            subtitle: i18n._(t`Create keyboard pressed condition event (Space)`),
            keywords: 'key pressed keyboard input space',
          },
        ];

        const instructionSearchItems = [
          {
            id: 'condition-player',
            mode: ('condition-player': QuickAddMode),
            itemType: 'picker',
            enabled: !!graphContextMenu && !!graphContextMenu.addConditionContext,
            title: i18n._(t`Condition - Player/Object`),
            subtitle: i18n._(
              t`Search object-based conditions (Player, enemies, behaviors...)`
            ),
            keywords: 'condition player object behavior if compare',
          },
          {
            id: 'condition-global',
            mode: ('condition-global': QuickAddMode),
            itemType: 'picker',
            enabled: !!graphContextMenu && !!graphContextMenu.addConditionContext,
            title: i18n._(t`Condition - Global/Time/Variables`),
            subtitle: i18n._(
              t`Search global conditions (time, variables, math, logic...)`
            ),
            keywords: 'condition global variables time math logic system',
          },
          {
            id: 'action-player',
            mode: ('action-player': QuickAddMode),
            itemType: 'picker',
            enabled: !!graphContextMenu && !!graphContextMenu.addActionContext,
            title: i18n._(t`Action - Player/Object`),
            subtitle: i18n._(
              t`Search object actions (movement, animation, camera, audio...)`
            ),
            keywords: 'action player object move animate camera behavior',
          },
          {
            id: 'action-global',
            mode: ('action-global': QuickAddMode),
            itemType: 'picker',
            enabled: !!graphContextMenu && !!graphContextMenu.addActionContext,
            title: i18n._(t`Action - Global/Time/Variables`),
            subtitle: i18n._(
              t`Search global actions (variables, timers, scene, arrays...)`
            ),
            keywords: 'action global variable timer scene array control',
          },
        ];
        const quickAddItems = [...quickStartItems, ...instructionSearchItems];

        const templateItems = [
          {
            id: 'template-add-force',
            mode: ('template-add-force': QuickAddMode),
            itemType: 'template',
            enabled: !!graphContextMenu && !!graphContextMenu.eventContext,
            title: i18n._(t`Template - Add Force`),
            subtitle: i18n._(
              t`Create Physics3D force node with editable X/Y/Z inputs`
            ),
            keywords: 'template force physics rigidbody add force',
          },
          {
            id: 'template-set-velocity',
            mode: ('template-set-velocity': QuickAddMode),
            itemType: 'template',
            enabled: !!graphContextMenu && !!graphContextMenu.eventContext,
            title: i18n._(t`Template - Set Velocity`),
            subtitle: i18n._(
              t`Create Physics3D velocity nodes (X/Y/Z) ready to tweak`
            ),
            keywords: 'template set velocity physics rigidbody x y z',
          },
          {
            id: 'template-lerp',
            mode: ('template-lerp': QuickAddMode),
            itemType: 'template',
            enabled: !!graphContextMenu && !!graphContextMenu.eventContext,
            title: i18n._(t`Template - Lerp`),
            subtitle: i18n._(t`Create Tween lerp movement node with easing and time`),
            keywords: 'template lerp tween interpolation smoothing',
          },
          {
            id: 'template-branch',
            mode: ('template-branch': QuickAddMode),
            itemType: 'template',
            enabled: !!graphContextMenu && !!graphContextMenu.eventContext,
            title: i18n._(t`Template - Branch`),
            subtitle: i18n._(t`Create a comparison condition to drive true/false flow`),
            keywords: 'template branch if compare condition true false',
          },
          {
            id: 'template-sequence',
            mode: ('template-sequence': QuickAddMode),
            itemType: 'template',
            enabled: !!graphContextMenu && !!graphContextMenu.eventContext,
            title: i18n._(t`Template - Sequence`),
            subtitle: i18n._(
              t`Create 2 sub-events and sequence outputs for parallel build`
            ),
            keywords: 'template sequence outputs flow split',
          },
        ];

        const normalizedSearch = contextMenuSearchText.trim().toLowerCase();
        const filterContextMenuItems = items =>
          items.filter(item => {
            if (!item.enabled) return false;
            if (!normalizedSearch) return true;
            return `${item.title} ${item.subtitle} ${item.keywords}`
              .toLowerCase()
              .includes(normalizedSearch);
          });
        const filteredQuickAddItems = filterContextMenuItems(quickAddItems);
        const filteredQuickStartItems = filteredQuickAddItems.filter(
          item => item.itemType === 'quick-start'
        );
        const filteredInstructionItems = filteredQuickAddItems.filter(
          item => item.itemType !== 'quick-start'
        );
        const filteredTemplateItems = filterContextMenuItems(templateItems);

        const validatedManualConnections = manualConnections.filter(
          connection =>
            !!pinPositions[connection.fromPinId] &&
            !!pinPositions[connection.toPinId] &&
            arePinsConnectable(connection.fromPinId, connection.toPinId)
        );
        const manualConnectionIdSet = new Set(
          validatedManualConnections.map(connection => connection.id)
        );
        const graphEdges = [...graphModel.edges, ...validatedManualConnections];

        const renderedEdges = graphEdges
          .map(edge => {
            const fromPinPosition = pinPositions[edge.fromPinId];
            const toPinPosition = pinPositions[edge.toPinId];
            if (!fromPinPosition || !toPinPosition) return null;
            return {
              ...edge,
              fromPinPosition,
              toPinPosition,
              path: buildWirePath(fromPinPosition, toPinPosition),
            };
          })
          .filter(Boolean);

        const activeWirePath =
          activeConnectionDrag && pinPositions[activeConnectionDrag.fromPinId]
            ? buildWirePath(pinPositions[activeConnectionDrag.fromPinId], {
                x: activeConnectionDrag.pointerX,
                y: activeConnectionDrag.pointerY,
              })
            : '';

        return (
          <div
            className={classNames('gd-events-blueprint-root', {
              'gd-events-blueprint-panning': !!activePanDrag,
            })}
            style={rootStyle}
            ref={rootRef}
            onPointerDown={startPanDrag}
            onWheel={domEvent => {
              if (!domEvent.ctrlKey && !domEvent.metaKey) return;
              domEvent.preventDefault();
              domEvent.stopPropagation();

              const zoomFactor = Math.exp(-domEvent.deltaY * 0.002);
              setZoomAroundPoint(
                zoomLevelRef.current * zoomFactor,
                domEvent.clientX,
                domEvent.clientY
              );
            }}
            onClick={() => {
              if (graphContextMenu) {
                closeGraphContextMenu();
              }
            }}
            onContextMenu={domEvent => {
              const target = domEvent.target;
              if (
                target instanceof HTMLElement &&
                target.closest('.gd-blueprint-context-menu')
              ) {
                return;
              }
              if (
                target instanceof HTMLElement &&
                target.closest('.gd-blueprint-node')
              ) {
                return;
              }

              domEvent.preventDefault();
              domEvent.stopPropagation();

              const rootElement = rootRef.current;
              if (!rootElement) return;

              const rect = rootElement.getBoundingClientRect();
              const rawX =
                domEvent.clientX - rect.left + rootElement.scrollLeft;
              const rawY =
                domEvent.clientY - rect.top + rootElement.scrollTop;
              const menuX = Math.max(
                rootElement.scrollLeft + 10,
                Math.min(rawX, rootElement.scrollLeft + rootElement.clientWidth - 340)
              );
              const menuY = Math.max(
                rootElement.scrollTop + 10,
                Math.min(rawY, rootElement.scrollTop + rootElement.clientHeight - 312)
              );

              setGraphContextMenu({
                x: menuX,
                y: menuY,
                clickX: rawX,
                clickY: rawY,
                eventContext: preferredEventNode
                  ? preferredEventNode.eventContext
                  : null,
                addConditionContext: preferredEventNode
                  ? preferredEventNode.addConditionContext
                  : null,
                addActionContext: preferredEventNode
                  ? preferredEventNode.addActionContext
                  : null,
              });
              setContextMenuSearchText('');
            }}
          >
            <div className="gd-events-blueprint-overlay-grid" />
            <div
              className="gd-blueprint-zoom-toolbar"
              onPointerDown={domEvent => domEvent.stopPropagation()}
              onClick={domEvent => domEvent.stopPropagation()}
            >
              <button
                type="button"
                className="gd-blueprint-zoom-button"
                onClick={zoomOut}
                title={i18n._(t`Zoom out`)}
              >
                -
              </button>
              <button
                type="button"
                className="gd-blueprint-zoom-button gd-blueprint-zoom-button-value"
                onClick={resetZoom}
                title={i18n._(t`Reset zoom (100%)`)}
              >
                {zoomLabel}
              </button>
              <button
                type="button"
                className="gd-blueprint-zoom-button"
                onClick={zoomIn}
                title={i18n._(t`Zoom in`)}
              >
                +
              </button>
              <span className="gd-blueprint-zoom-hint">{i18n._(t`Ctrl + Wheel`)}</span>
            </div>
            <button
              ref={instructionMenuAnchorRef}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="gd-blueprint-instruction-anchor"
              style={{
                left: `${instructionMenuAnchorPosition.x}px`,
                top: `${instructionMenuAnchorPosition.y}px`,
              }}
            />
            <div
              className="gd-events-blueprint-content"
              ref={contentRef}
              style={{
                width: `${scaledContentWidth}px`,
                height: `${scaledContentHeight}px`,
              }}
            >
              <svg
                className="gd-events-blueprint-wires-layer"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                {renderedEdges.map(
                  renderedEdge =>
                    renderedEdge && (
                      <g key={renderedEdge.id}>
                        <path
                          className={classNames(
                            'gd-blueprint-wire-shadow',
                            getWireClass({
                              kind: renderedEdge.kind,
                              pinType: renderedEdge.pinType,
                              isManual: manualConnectionIdSet.has(renderedEdge.id),
                            })
                          )}
                          d={renderedEdge.path}
                        />
                        <path
                          className={getWireClass({
                            kind: renderedEdge.kind,
                            pinType: renderedEdge.pinType,
                            isManual: manualConnectionIdSet.has(renderedEdge.id),
                          })}
                          d={renderedEdge.path}
                        />
                      </g>
                    )
                )}
                {!!activeWirePath && (
                  <path className="gd-blueprint-wire gd-blueprint-wire-active" d={activeWirePath} />
                )}
              </svg>

              {eventNodes.length === 0 ? (
                <div className="gd-events-blueprint-empty-state">
                  <div className="gd-events-blueprint-empty-title">
                    <Trans>Start with your first Blueprint event.</Trans>
                  </div>
                  <div className="gd-events-blueprint-empty-description">
                    <Trans>Add an event to start building a node graph.</Trans>
                  </div>
                  <FlatButton
                    primary
                    label={<Trans>Add first event</Trans>}
                    leftIcon={<AddEventIcon />}
                    onClick={() =>
                      onAddNewEvent('BuiltinCommonInstructions::Standard', events)
                    }
                  />
                </div>
              ) : (
                positionedNodes.map(node => (
                  <div
                    key={node.id}
                    className={getNodeClass(node)}
                    style={{
                      left: `${Math.round(node.x * zoomLevel * 10) / 10}px`,
                      top: `${Math.round(node.y * zoomLevel * 10) / 10}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'top left',
                    }}
                    onPointerDown={domEvent => {
                      const target = domEvent.target;
                      if (!(target instanceof HTMLElement)) return;
                      if (
                        target.closest('.gd-blueprint-pin') ||
                        target.closest('.gd-blueprint-mini-button') ||
                        target.tagName === 'INPUT' ||
                        target.tagName === 'TEXTAREA' ||
                        target.tagName === 'SELECT' ||
                        target.tagName === 'BUTTON'
                      ) {
                        return;
                      }

                      const dragNodeIds =
                        node.kind === 'event'
                          ? positionedNodes
                              .filter(
                                candidateNode =>
                                  candidateNode.clusterId === node.clusterId
                              )
                              .map(candidateNode => candidateNode.id)
                          : [node.id];
                      const basePositionsById: NodePositionsById = {};
                      dragNodeIds.forEach(dragNodeId => {
                        const dragNode = positionedNodeById[dragNodeId];
                        if (!dragNode) return;
                        basePositionsById[dragNodeId] = {
                          x: dragNode.x,
                          y: dragNode.y,
                        };
                      });
                      startNodeDrag(domEvent, dragNodeIds, basePositionsById);
                    }}
                    onClick={domEvent => {
                      if (suppressNodeClickRef.current) {
                        domEvent.preventDefault();
                        domEvent.stopPropagation();
                        return;
                      }
                      domEvent.stopPropagation();
                      closeGraphContextMenu();
                      if (node.instructionContext) {
                        onInstructionClick(node.eventContext, node.instructionContext);
                      } else {
                        onEventClick(node.eventContext);
                      }
                    }}
                    onDoubleClick={domEvent => {
                      if (!node.instructionContext) return;
                      domEvent.stopPropagation();
                      onInstructionDoubleClick(node.eventContext, node.instructionContext);
                    }}
                    onContextMenu={domEvent => {
                      domEvent.preventDefault();
                      domEvent.stopPropagation();
                      closeGraphContextMenu();
                      if (node.instructionContext) {
                        onInstructionContextMenu(
                          node.eventContext,
                          domEvent.clientX,
                          domEvent.clientY,
                          node.instructionContext
                        );
                      } else {
                        onEventContextMenu(
                          domEvent.clientX,
                          domEvent.clientY,
                          node.eventContext
                        );
                      }
                    }}
                  >
                    <div className="gd-blueprint-node-header gd-blueprint-node-drag-handle">
                      <span className="gd-blueprint-node-title">{node.title}</span>
                      {!!node.badges.length && (
                        <div className="gd-blueprint-node-badges">
                          {node.badges.map((badge, index) => (
                            <span
                              key={`${node.id}-badge-${index}`}
                              className={classNames('gd-blueprint-node-badge', {
                                'gd-blueprint-node-badge-condition':
                                  badge.tone === 'condition',
                                'gd-blueprint-node-badge-action':
                                  badge.tone === 'action',
                                'gd-blueprint-node-badge-meta':
                                  badge.tone === 'meta',
                              })}
                            >
                              {badge.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="gd-blueprint-node-body">
                      <div className="gd-blueprint-node-subtitle">{node.subtitle}</div>
                      {!!node.parameters.length && (
                        <div className="gd-blueprint-node-parameters">
                          {node.parameters.map(parameter => {
                            const draftValue =
                              nodeParameterDraftValues[node.id] &&
                              nodeParameterDraftValues[node.id][parameter.index] !==
                                undefined
                                ? nodeParameterDraftValues[node.id][parameter.index]
                                : parameter.value;

                            return (
                              <label
                                key={`${node.id}-parameter-${parameter.index}`}
                                className="gd-blueprint-parameter-row"
                              >
                                <span className="gd-blueprint-parameter-label">
                                  {parameter.label}
                                </span>
                                <input
                                  type="text"
                                  className="gd-blueprint-parameter-input"
                                  value={draftValue}
                                  onPointerDown={domEvent => domEvent.stopPropagation()}
                                  onClick={domEvent => domEvent.stopPropagation()}
                                  onChange={domEvent => {
                                    setNodeParameterDraftValue(
                                      node.id,
                                      parameter.index,
                                      domEvent.currentTarget.value
                                    );
                                  }}
                                  onBlur={domEvent => {
                                    if (!node.instructionContext) return;
                                    const nextValue = domEvent.currentTarget.value;
                                    if (nextValue !== parameter.value) {
                                      onSetInstructionParameterValue(
                                        node.eventContext,
                                        node.instructionContext,
                                        parameter.index,
                                        nextValue
                                      );
                                    }
                                    clearNodeParameterDraftValue(
                                      node.id,
                                      parameter.index
                                    );
                                  }}
                                  onKeyDown={domEvent => {
                                    if (domEvent.key === 'Escape') {
                                      clearNodeParameterDraftValue(
                                        node.id,
                                        parameter.index
                                      );
                                      domEvent.currentTarget.blur();
                                    }
                                    if (domEvent.key === 'Enter') {
                                      domEvent.currentTarget.blur();
                                    }
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {node.kind === 'event' && (
                        <div className="gd-blueprint-node-actions">
                          <button
                            type="button"
                            className="gd-blueprint-mini-button"
                            disabled={!node.addConditionContext}
                            onClick={domEvent => {
                              domEvent.stopPropagation();
                              if (!node.addConditionContext) return;
                              const button = domEvent.currentTarget;
                              if (!(button instanceof HTMLButtonElement)) return;
                              onAddInstructionContextMenu(
                                node.eventContext,
                                button,
                                node.addConditionContext
                              );
                            }}
                          >
                            + {i18n._(t`Condition`)}
                          </button>
                          <button
                            type="button"
                            className="gd-blueprint-mini-button"
                            disabled={!node.addActionContext}
                            onClick={domEvent => {
                              domEvent.stopPropagation();
                              if (!node.addActionContext) return;
                              const button = domEvent.currentTarget;
                              if (!(button instanceof HTMLButtonElement)) return;
                              onAddInstructionContextMenu(
                                node.eventContext,
                                button,
                                node.addActionContext
                              );
                            }}
                          >
                            + {i18n._(t`Action`)}
                          </button>
                        </div>
                      )}
                    </div>

                    {node.pins.map(pin => (
                      <span
                        key={pin.id}
                        className={getPinElementClass({
                          pin,
                          activeConnectionDrag,
                        })}
                        title={getPinTypeLabel(pin.pinType)}
                        style={getPinStyle(pin)}
                        onPointerDown={(domEvent: any) =>
                          startConnectionDrag(domEvent, pin.id)
                        }
                        onPointerUp={(domEvent: any) =>
                          completeConnectionDrag(domEvent, pin.id)
                        }
                      />
                    ))}
                  </div>
                ))
              )}

              {graphContextMenu && (
                <div
                  className="gd-blueprint-context-menu"
                  style={{
                    left: `${graphContextMenu.x}px`,
                    top: `${graphContextMenu.y}px`,
                  }}
                  onPointerDown={domEvent => domEvent.stopPropagation()}
                  onClick={domEvent => domEvent.stopPropagation()}
                  onContextMenu={domEvent => domEvent.preventDefault()}
                >
                  <div className="gd-blueprint-context-menu-title">
                    <Trans>Blueprint Quick Add</Trans>
                  </div>
                  <div className="gd-blueprint-context-menu-target">
                    {graphContextMenu.eventContext ? (
                      <Trans>
                        Target event #{graphContextMenu.eventContext.indexInList + 1}
                      </Trans>
                    ) : (
                      <Trans>No event selected (you can still add a new one)</Trans>
                    )}
                  </div>
                  <input
                    type="text"
                    className="gd-blueprint-context-menu-search"
                    placeholder={i18n._(
                      t`Search action/condition (time, variables, player...)`
                    )}
                    value={contextMenuSearchText}
                    autoFocus
                    onChange={domEvent => {
                      setContextMenuSearchText(domEvent.currentTarget.value);
                    }}
                  />
                  <div className="gd-blueprint-context-menu-list">
                    {filteredQuickAddItems.length || filteredTemplateItems.length ? (
                      <>
                        {!!filteredQuickStartItems.length && (
                          <>
                            <div className="gd-blueprint-context-menu-section">
                              <Trans>Quick Start Nodes</Trans>
                            </div>
                            {filteredQuickStartItems.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                className={classNames('gd-blueprint-context-menu-item', {
                                  'gd-blueprint-context-menu-item-condition':
                                    item.mode.startsWith('condition'),
                                  'gd-blueprint-context-menu-item-action':
                                    item.mode.startsWith('action'),
                                  'gd-blueprint-context-menu-item-event':
                                    item.mode === 'event' ||
                                    item.mode.startsWith('event-'),
                                })}
                                onClick={() =>
                                  triggerQuickAdd({
                                    mode: item.mode,
                                    eventContext: graphContextMenu.eventContext,
                                    addConditionContext:
                                      graphContextMenu.addConditionContext,
                                    addActionContext:
                                      graphContextMenu.addActionContext,
                                    x: graphContextMenu.clickX,
                                    y: graphContextMenu.clickY,
                                  })
                                }
                              >
                                <span className="gd-blueprint-context-menu-item-title">
                                  {item.title}
                                </span>
                                <span className="gd-blueprint-context-menu-item-subtitle">
                                  {item.subtitle}
                                </span>
                              </button>
                            ))}
                          </>
                        )}

                        {!!filteredInstructionItems.length && (
                          <>
                            <div className="gd-blueprint-context-menu-section">
                              <Trans>Instruction Search</Trans>
                            </div>
                            {filteredInstructionItems.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                className={classNames('gd-blueprint-context-menu-item', {
                                  'gd-blueprint-context-menu-item-condition':
                                    item.mode.startsWith('condition'),
                                  'gd-blueprint-context-menu-item-action':
                                    item.mode.startsWith('action'),
                                  'gd-blueprint-context-menu-item-event':
                                    item.mode === 'event' ||
                                    item.mode.startsWith('event-'),
                                })}
                                onClick={() =>
                                  triggerQuickAdd({
                                    mode: item.mode,
                                    eventContext: graphContextMenu.eventContext,
                                    addConditionContext:
                                      graphContextMenu.addConditionContext,
                                    addActionContext:
                                      graphContextMenu.addActionContext,
                                    x: graphContextMenu.clickX,
                                    y: graphContextMenu.clickY,
                                  })
                                }
                              >
                                <span className="gd-blueprint-context-menu-item-title">
                                  {item.title}
                                </span>
                                <span className="gd-blueprint-context-menu-item-subtitle">
                                  {item.subtitle}
                                </span>
                              </button>
                            ))}
                          </>
                        )}

                        {!!filteredTemplateItems.length && (
                          <>
                            <div className="gd-blueprint-context-menu-section">
                              <Trans>Node Templates</Trans>
                            </div>
                            {filteredTemplateItems.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                className="gd-blueprint-context-menu-item gd-blueprint-context-menu-item-template"
                                onClick={() =>
                                  triggerQuickAdd({
                                    mode: item.mode,
                                    eventContext: graphContextMenu.eventContext,
                                    addConditionContext:
                                      graphContextMenu.addConditionContext,
                                    addActionContext:
                                      graphContextMenu.addActionContext,
                                    x: graphContextMenu.clickX,
                                    y: graphContextMenu.clickY,
                                  })
                                }
                              >
                                <span className="gd-blueprint-context-menu-item-title">
                                  {item.title}
                                </span>
                                <span className="gd-blueprint-context-menu-item-subtitle">
                                  {item.subtitle}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <div className="gd-blueprint-context-menu-empty">
                        <Trans>No matching result.</Trans>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </I18n>
  );
};

export default React.memo<Props>(BlueprintGraphCanvas);
