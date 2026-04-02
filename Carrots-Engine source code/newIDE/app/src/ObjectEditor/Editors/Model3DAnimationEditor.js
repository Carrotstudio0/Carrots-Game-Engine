// @flow

import * as React from 'react';
import { Trans, t } from '@lingui/macro';
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import * as THREE from 'three';
import AlertMessage from '../../UI/AlertMessage';
import Checkbox from '../../UI/Checkbox';
import FlatButton from '../../UI/FlatButton';
import { Column, Line } from '../../UI/Grid';
import IconButton from '../../UI/IconButton';
import Paper from '../../UI/Paper';
import PlaceholderLoader from '../../UI/PlaceholderLoader';
import RaisedButton from '../../UI/RaisedButton';
import { useResponsiveWindowSize } from '../../UI/Responsive/ResponsiveWindowMeasurer';
import ScrollView from '../../UI/ScrollView';
import SelectField from '../../UI/SelectField';
import SelectOption from '../../UI/SelectOption';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import Slider from '../../UI/Slider';
import Text from '../../UI/Text';
import Add from '../../UI/CustomSvgIcons/Add';
import Trash from '../../UI/CustomSvgIcons/Trash';
import { EmptyPlaceholder } from '../../UI/EmptyPlaceholder';
import useAlertDialog from '../../UI/Alert/useAlertDialog';
import GDevelopThemeContext from '../../UI/Theme/GDevelopThemeContext';
import PixiResourcesLoader from '../../ObjectsRendering/PixiResourcesLoader';
import {
  configureThreeRendererQuality,
  createStudioEnvironmentRenderTarget,
  createStudioLightingRig,
} from '../../Utils/ThreeRenderingQuality';
import useForceUpdate from '../../Utils/UseForceUpdate';
import { mapFor } from '../../Utils/MapFor';
import { type EditorProps } from './EditorProps.flow';
import { PropertyField } from './PropertyFields';

const gd: libGDevelop = global.gd;

const GRAPH_CANVAS_WIDTH = 3200;
const GRAPH_CANVAS_HEIGHT = 2200;
const GRAPH_NODE_WIDTH = 380;
const GRAPH_NODE_MIN_HEIGHT = 124;
const GRAPH_ANY_STATE_WIDTH = 420;
const GRAPH_ENTRY_WIDTH = 240;
const GRAPH_DEFAULT_PAN_X = 0;
const GRAPH_DEFAULT_PAN_Y = 0;
const GRAPH_DEFAULT_ZOOM = 0.9;
const GRAPH_MIN_ZOOM = 0.45;
const GRAPH_MAX_ZOOM = 1.65;
const GRAPH_ANY_STATE_POSITION = { x: 980, y: 56 };
const GRAPH_ENTRY_POSITION = { x: 1070, y: 280 };
const GRAPH_FIRST_STATE_Y = 520;
const GRAPH_STATE_GAP_Y = 260;
const GRAPH_STATE_DEFAULT_X = 1000;
const GRAPH_NODE_MARGIN = 40;
const ANIMATOR_GRAPH_BLOCK_MIME_TYPE =
  'application/x-gdevelop-3d-animator-block';

const styles = {
  root: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  stackedRoot: {
    flexDirection: 'column',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: 10,
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  countBadge: {
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.08)',
    whiteSpace: 'nowrap',
  },
  clipScrollView: {
    minHeight: 0,
  },
  clipList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingRight: 4,
  },
  clipHint: {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  clipItem: {
    width: '100%',
    border: 'none',
    borderRadius: 8,
    padding: 10,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 120ms ease, box-shadow 120ms ease',
  },
  graphHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  graphToolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.05)',
  },
  graphToolbarTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    flexWrap: 'wrap',
  },
  graphToolbarDescription: {
    flex: 1,
    minWidth: 260,
  },
  graphBlockPalette: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    width: '100%',
  },
  graphBlockTemplate: {
    minWidth: 0,
    flex: '1 1 180px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: '10px 12px',
    cursor: 'grab',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    color: 'inherit',
    background: 'rgba(255, 255, 255, 0.04)',
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.14)',
  },
  graphBlockTemplateState: {
    background:
      'linear-gradient(180deg, rgba(87, 117, 144, 0.25), rgba(24, 37, 51, 0.45))',
  },
  graphBlockTemplateBlend: {
    background:
      'linear-gradient(180deg, rgba(120, 87, 161, 0.28), rgba(39, 27, 61, 0.48))',
  },
  graphBlockTemplateLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  graphBlockTypeBadge: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.08)',
    whiteSpace: 'nowrap',
  },
  graphSurface: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    minHeight: 560,
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'grab',
    background:
      'linear-gradient(180deg, rgba(19, 27, 35, 0.98), rgba(10, 14, 18, 0.98))',
  },
  graphCanvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: GRAPH_CANVAS_WIDTH,
    height: GRAPH_CANVAS_HEIGHT,
    transformOrigin: '0 0',
    userSelect: 'none',
  },
  graphCanvasBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
    backgroundSize: '48px 48px, 48px 48px, 12px 12px, 12px 12px',
    borderRadius: 18,
  },
  graphConnectionLayer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'visible',
  },
  entryNode: {
    width: GRAPH_ENTRY_WIDTH,
    borderRadius: 10,
    padding: '14px 18px',
    textAlign: 'center',
    background:
      'linear-gradient(180deg, rgba(39, 174, 96, 0.95), rgba(30, 132, 73, 0.95))',
    color: '#fff',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
  },
  anyStateNode: {
    width: GRAPH_ANY_STATE_WIDTH,
    borderRadius: 10,
    padding: '14px 18px',
    background:
      'linear-gradient(180deg, rgba(47, 128, 237, 0.95), rgba(31, 91, 172, 0.95))',
    color: '#fff',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
  },
  entryConnector: {
    width: 2,
    height: 32,
    background: 'rgba(255, 194, 59, 0.85)',
    borderRadius: 999,
  },
  stateRow: {
    position: 'absolute',
    width: GRAPH_NODE_WIDTH,
  },
  stateCard: {
    width: GRAPH_NODE_WIDTH,
    minHeight: GRAPH_NODE_MIN_HEIGHT,
    borderRadius: 10,
    padding: '16px 18px',
    cursor: 'pointer',
    border: '1px solid transparent',
    boxSizing: 'border-box',
    boxShadow: '0 18px 34px rgba(0, 0, 0, 0.18)',
  },
  nodeHandle: {
    position: 'absolute',
    top: '50%',
    right: -14,
    width: 18,
    height: 18,
    borderRadius: 999,
    border: '2px solid rgba(255, 255, 255, 0.92)',
    background: 'rgba(255, 165, 0, 0.96)',
    transform: 'translateY(-50%)',
    cursor: 'crosshair',
    boxShadow: '0 0 0 4px rgba(255, 165, 0, 0.18)',
  },
  anyStateHandle: {
    background: 'rgba(47, 128, 237, 0.98)',
    boxShadow: '0 0 0 4px rgba(47, 128, 237, 0.2)',
  },
  graphHud: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 999,
    background: 'rgba(9, 14, 19, 0.88)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    zIndex: 3,
  },
  graphHudButton: {
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'inherit',
    borderRadius: 999,
    width: 28,
    height: 28,
    lineHeight: '24px',
    cursor: 'pointer',
    fontSize: 16,
  },
  graphHudButtonWide: {
    width: 'auto',
    minWidth: 68,
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 600,
  },
  graphHintBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(9, 14, 19, 0.88)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    zIndex: 3,
    maxWidth: 360,
  },
  stateMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  stateActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  stateMiniButton: {
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'inherit',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.1,
  },
  loopBadge: {
    borderRadius: 999,
    padding: '4px 8px',
    background: 'rgba(255, 255, 255, 0.08)',
    whiteSpace: 'nowrap',
  },
  stateTypeBadge: {
    borderRadius: 999,
    padding: '4px 8px',
    background: 'rgba(47, 128, 237, 0.14)',
    whiteSpace: 'nowrap',
  },
  stateTypeBadgeBlend: {
    background: 'rgba(255, 181, 71, 0.16)',
  },
  blendCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  blendSummaryText: {
    lineHeight: 1.4,
  },
  blendRail: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 8,
  },
  blendMotionChip: {
    minWidth: 92,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  blendMotionThreshold: {
    marginTop: 4,
  },
  blendInspectorLabel: {
    lineHeight: 1.4,
  },
  stateTransitionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  transitionChip: {
    width: '100%',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.04)',
    padding: '8px 10px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  transitionSummary: {
    marginTop: 2,
  },
  sectionCard: {
    padding: 10,
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.04)',
  },
  transitionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  conditionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  conditionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.04)',
  },
  motionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  motionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.04)',
  },
  inspectorContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  inspectorScrollView: {
    minHeight: 0,
    paddingRight: 4,
  },
  previewPanel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: 12,
  },
  previewViewport: {
    position: 'relative',
    minHeight: 260,
    borderRadius: 8,
    overflow: 'hidden',
    background:
      'radial-gradient(circle at top, rgba(255,255,255,0.12), rgba(0,0,0,0.12) 58%, rgba(0,0,0,0.22) 100%)',
  },
  previewCanvas: {
    position: 'absolute',
    inset: 0,
  },
  previewOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.14)',
  },
  previewControls: {
    marginTop: 8,
  },
  dangerButton: {
    flexShrink: 0,
  },
};

type AnimatorParameterType = 'float' | 'int' | 'bool' | 'trigger';
type AnimatorStateType = 'clip' | 'blend1d';
type AnimatorGraphBlockTemplateType = 'state' | 'blend1d';
type AnimatorParameter = {|
  id: string,
  name: string,
  type: AnimatorParameterType,
  defaultValue: number | boolean,
|};
type AnimatorBlendStateMotion = {|
  id: string,
  source: string,
  threshold: number,
  loop: boolean,
|};
type AnimatorGraphPosition = {|
  x: number,
  y: number,
|};
type AnimatorStateDefinition =
  | {|
      type: 'clip',
      editorPosition?: AnimatorGraphPosition,
    |}
  | {|
      type: 'blend1d',
      parameterId: string,
      motions: AnimatorBlendStateMotion[],
      editorPosition?: AnimatorGraphPosition,
    |};
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
type AnimatorTransitionCondition = {|
  id: string,
  parameterId: string,
  operator: AnimatorConditionOperator,
  value: number | boolean,
|};
type AnimatorTransition = {|
  id: string,
  fromIndex: number,
  toIndex: number,
  crossfadeDuration: ?number,
  conditions: AnimatorTransitionCondition[],
|};
type PreviewAnimationState = {|
  name: string,
  source: string,
  loop: boolean,
  type: AnimatorStateType,
  blendParameterId: string,
  blendMotions: AnimatorBlendStateMotion[],
|};
type Model3DAnimationPreviewProps = {|
  gltf: GLTF | null,
  animations: PreviewAnimationState[],
  animatorTransitions: AnimatorTransition[],
  initialAnimationIndex: number,
  previewParameterValuesById: { [string]: number | boolean },
  animatorParametersById: Map<string, AnimatorParameter>,
  onConsumePreviewTriggers: (parameterIds: string[]) => void,
  restartToken: number,
|};

const ANY_STATE_INDEX = -1;

const animatorParameterTypes: AnimatorParameterType[] = [
  'float',
  'int',
  'bool',
  'trigger',
];
const numericConditionOperators: AnimatorConditionOperator[] = [
  'greater',
  'greaterOrEquals',
  'less',
  'lessOrEquals',
  'equals',
  'notEquals',
];

const createUniqueId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createAnimatorParameter = (
  type: AnimatorParameterType = 'float'
): AnimatorParameter => ({
  id: createUniqueId(),
  name: '',
  type,
  defaultValue: type === 'float' || type === 'int' ? 0 : false,
});

const makeUniqueAnimatorParameterName = (
  baseName: string,
  animatorParameters: AnimatorParameter[],
  ignoredParameterId?: string
): string => {
  const trimmedBaseName = baseName.trim() || 'Blend';
  const lowerCaseNames = new Set(
    animatorParameters
      .filter((parameter) => parameter.id !== ignoredParameterId)
      .map((parameter) => parameter.name.trim().toLowerCase())
      .filter((parameterName) => !!parameterName)
  );
  if (!lowerCaseNames.has(trimmedBaseName.toLowerCase())) {
    return trimmedBaseName;
  }

  let suffix = 2;
  let nextName = `${trimmedBaseName} ${suffix}`;
  while (lowerCaseNames.has(nextName.toLowerCase())) {
    suffix++;
    nextName = `${trimmedBaseName} ${suffix}`;
  }
  return nextName;
};

const createNamedAnimatorParameter = (
  name: string,
  type: AnimatorParameterType,
  animatorParameters: AnimatorParameter[]
): AnimatorParameter => ({
  ...createAnimatorParameter(type),
  name: makeUniqueAnimatorParameterName(name, animatorParameters),
});

const isNumericAnimatorParameter = (parameter: ?AnimatorParameter): boolean =>
  !!parameter && (parameter.type === 'float' || parameter.type === 'int');

const createAnimatorBlendStateMotion = (
  source: string = '',
  threshold: number = 0,
  loop: boolean = true
): AnimatorBlendStateMotion => ({
  id: createUniqueId(),
  source,
  threshold,
  loop,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const safeToDisplayString = (value: any, fallback: string = ''): string => {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value === null || value === undefined) return fallback;
  try {
    return String(value);
  } catch (error) {
    return fallback;
  }
};

const getDefaultAnimatorStatePosition = (
  animationIndex: number = 0
): AnimatorGraphPosition => ({
  x: GRAPH_STATE_DEFAULT_X + (animationIndex % 2 === 0 ? 0 : 140),
  y: GRAPH_FIRST_STATE_Y + animationIndex * GRAPH_STATE_GAP_Y,
});

const constrainAnimatorStatePosition = (
  rawPosition: AnimatorGraphPosition
): AnimatorGraphPosition => ({
  x: clamp(
    rawPosition.x,
    GRAPH_NODE_MARGIN,
    GRAPH_CANVAS_WIDTH - GRAPH_NODE_WIDTH - GRAPH_NODE_MARGIN
  ),
  y: clamp(
    rawPosition.y,
    GRAPH_NODE_MARGIN,
    GRAPH_CANVAS_HEIGHT - GRAPH_NODE_MIN_HEIGHT - GRAPH_NODE_MARGIN
  ),
});

const normalizeAnimatorStatePosition = (
  rawPosition: any,
  animationIndex: number
): AnimatorGraphPosition => {
  if (!rawPosition || typeof rawPosition !== 'object') {
    return getDefaultAnimatorStatePosition(animationIndex);
  }

  return constrainAnimatorStatePosition({
    x: Number.isFinite(rawPosition.x)
      ? rawPosition.x
      : getDefaultAnimatorStatePosition(animationIndex).x,
    y: Number.isFinite(rawPosition.y)
      ? rawPosition.y
      : getDefaultAnimatorStatePosition(animationIndex).y,
  });
};

const createDefaultAnimatorStateDefinition = (
  animationIndex: number = 0
): AnimatorStateDefinition => ({
  type: 'clip',
  editorPosition: getDefaultAnimatorStatePosition(animationIndex),
});

const createDefaultBlend1DStateDefinition = (
  animatorParameters: AnimatorParameter[],
  sourceAnimationNames: string[],
  fallbackSource: string = '',
  fallbackLoop: boolean = true,
  animationIndex?: number
): AnimatorStateDefinition => {
  const numericParameter =
    animatorParameters.find((parameter) =>
      isNumericAnimatorParameter(parameter)
    ) || null;
  const firstMotionSource = fallbackSource || sourceAnimationNames[0] || '';
  const secondMotionSource =
    sourceAnimationNames.find(
      (sourceName) => sourceName !== firstMotionSource
    ) || firstMotionSource;
  const motions =
    firstMotionSource === ''
      ? []
      : secondMotionSource && secondMotionSource !== firstMotionSource
        ? [
            createAnimatorBlendStateMotion(firstMotionSource, 0, fallbackLoop),
            createAnimatorBlendStateMotion(secondMotionSource, 1, fallbackLoop),
          ]
        : [createAnimatorBlendStateMotion(firstMotionSource, 0, fallbackLoop)];

  return {
    type: 'blend1d',
    parameterId: numericParameter ? numericParameter.id : '',
    motions,
    editorPosition: getDefaultAnimatorStatePosition(animationIndex || 0),
  };
};

const normalizeAnimatorParameter = (
  rawParameter: any,
  index: number
): AnimatorParameter | null => {
  if (!rawParameter || typeof rawParameter !== 'object') {
    return null;
  }

  const type = animatorParameterTypes.includes(rawParameter.type)
    ? rawParameter.type
    : 'float';
  const name =
    typeof rawParameter.name === 'string' ? rawParameter.name.trim() : '';
  const defaultValue =
    type === 'float'
      ? Number.isFinite(rawParameter.defaultValue)
        ? rawParameter.defaultValue
        : 0
      : type === 'int'
        ? Number.isFinite(rawParameter.defaultValue)
          ? Math.trunc(rawParameter.defaultValue)
          : 0
        : !!rawParameter.defaultValue;

  return {
    id:
      typeof rawParameter.id === 'string' && rawParameter.id
        ? rawParameter.id
        : `parameter-${index}`,
    name,
    type,
    defaultValue,
  };
};

const parseAnimatorParameters = (rawValue: string): AnimatorParameter[] => {
  if (!rawValue) return [];
  try {
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .map((rawParameter, index) =>
        normalizeAnimatorParameter(rawParameter, index)
      )
      .filter(Boolean);
  } catch (error) {
    return [];
  }
};

const serializeAnimatorParameters = (
  animatorParameters: AnimatorParameter[]
): string =>
  JSON.stringify(
    animatorParameters.map((parameter) => ({
      id: parameter.id,
      name: parameter.name.trim(),
      type: parameter.type,
      defaultValue:
        parameter.type === 'float' || parameter.type === 'int'
          ? Number(parameter.defaultValue) || 0
          : !!parameter.defaultValue,
    }))
  );

const normalizeAnimatorBlendStateMotion = (
  rawMotion: any,
  index: number
): AnimatorBlendStateMotion | null => {
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

const normalizeAnimatorStateDefinition = (
  rawState: any,
  index: number
): AnimatorStateDefinition => {
  if (
    !rawState ||
    typeof rawState !== 'object' ||
    rawState.type !== 'blend1d'
  ) {
    return {
      ...createDefaultAnimatorStateDefinition(index),
      editorPosition: normalizeAnimatorStatePosition(
        rawState && typeof rawState === 'object' ? rawState.editorPosition : null,
        index
      ),
    };
  }

  const motions = Array.isArray(rawState.motions)
    ? rawState.motions.reduce((validMotions, rawMotion, motionIndex) => {
        const motion = normalizeAnimatorBlendStateMotion(
          rawMotion,
          motionIndex
        );
        if (motion) validMotions.push(motion);
        return validMotions;
      }, [])
    : [];
  motions.sort((firstMotion, secondMotion) => {
    if (firstMotion.threshold === secondMotion.threshold) {
      return firstMotion.source.localeCompare(secondMotion.source);
    }
    return firstMotion.threshold - secondMotion.threshold;
  });

  return {
    type: 'blend1d',
    parameterId:
      typeof rawState.parameterId === 'string' ? rawState.parameterId : '',
    motions,
    editorPosition: normalizeAnimatorStatePosition(rawState.editorPosition, index),
  };
};

const parseAnimatorStateDefinitions = (
  rawValue: string,
  animationsCount: number
): AnimatorStateDefinition[] => {
  const animatorStates = mapFor(0, animationsCount, (stateIndex) =>
    createDefaultAnimatorStateDefinition(stateIndex)
  );
  if (!rawValue) return animatorStates;

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return animatorStates;

    for (
      let stateIndex = 0;
      stateIndex < parsedValue.length && stateIndex < animationsCount;
      stateIndex++
    ) {
      animatorStates[stateIndex] = normalizeAnimatorStateDefinition(
        parsedValue[stateIndex],
        stateIndex
      );
    }
  } catch (error) {
    return animatorStates;
  }

  return animatorStates;
};

const serializeAnimatorStateDefinitions = (
  animatorStates: AnimatorStateDefinition[]
): string =>
  JSON.stringify(
    animatorStates.map((stateDefinition) =>
      stateDefinition.type === 'blend1d'
        ? {
            type: 'blend1d',
            parameterId: stateDefinition.parameterId,
            motions: stateDefinition.motions.map((motion) => ({
              id: motion.id,
              source: motion.source,
              threshold: motion.threshold,
              loop: motion.loop,
            })),
            editorPosition: stateDefinition.editorPosition
              ? {
                  x: stateDefinition.editorPosition.x,
                  y: stateDefinition.editorPosition.y,
                }
              : undefined,
          }
        : {
            type: 'clip',
            editorPosition: stateDefinition.editorPosition
              ? {
                  x: stateDefinition.editorPosition.x,
                  y: stateDefinition.editorPosition.y,
                }
              : undefined,
          }
    )
  );

const getDefaultConditionOperator = (
  parameterType: AnimatorParameterType
): AnimatorConditionOperator => {
  if (parameterType === 'bool') return 'isTrue';
  if (parameterType === 'trigger') return 'triggered';
  return 'greater';
};

const getDefaultConditionValue = (
  parameterType: AnimatorParameterType
): number | boolean =>
  parameterType === 'float' || parameterType === 'int' ? 0 : true;

const getAllowedConditionOperators = (
  parameterType: AnimatorParameterType
): AnimatorConditionOperator[] => {
  if (parameterType === 'bool') return ['isTrue', 'isFalse'];
  if (parameterType === 'trigger') return ['triggered'];
  return numericConditionOperators;
};

const conditionOperatorUsesValue = (
  operator: AnimatorConditionOperator
): boolean =>
  operator !== 'isTrue' && operator !== 'isFalse' && operator !== 'triggered';

const createAnimatorTransitionCondition = (
  parameter: AnimatorParameter
): AnimatorTransitionCondition => ({
  id: createUniqueId(),
  parameterId: parameter.id,
  operator: getDefaultConditionOperator(parameter.type),
  value: getDefaultConditionValue(parameter.type),
});

const createAnimatorTransition = (
  fromIndex: number,
  toIndex: number,
  animatorParameters: AnimatorParameter[]
): AnimatorTransition => ({
  id: createUniqueId(),
  fromIndex,
  toIndex,
  crossfadeDuration: null,
  conditions:
    animatorParameters.length > 0
      ? [createAnimatorTransitionCondition(animatorParameters[0])]
      : [],
});

const normalizeAnimatorTransitionCondition = (
  rawCondition: any,
  index: number,
  animatorParametersById: Map<string, AnimatorParameter>
): AnimatorTransitionCondition | null => {
  if (!rawCondition || typeof rawCondition !== 'object') {
    return null;
  }

  const parameter = animatorParametersById.get(rawCondition.parameterId);
  if (!parameter) {
    return null;
  }

  const allowedOperators = getAllowedConditionOperators(parameter.type);
  const operator = allowedOperators.includes(rawCondition.operator)
    ? rawCondition.operator
    : getDefaultConditionOperator(parameter.type);
  const value = conditionOperatorUsesValue(operator)
    ? parameter.type === 'int'
      ? Number.isFinite(rawCondition.value)
        ? Math.trunc(rawCondition.value)
        : 0
      : Number.isFinite(rawCondition.value)
        ? rawCondition.value
        : 0
    : parameter.type === 'bool' || parameter.type === 'trigger'
      ? !!rawCondition.value
      : 0;

  return {
    id:
      typeof rawCondition.id === 'string' && rawCondition.id
        ? rawCondition.id
        : `condition-${index}`,
    parameterId: parameter.id,
    operator,
    value,
  };
};

const normalizeAnimatorTransition = (
  rawTransition: any,
  index: number,
  animationsCount: number,
  animatorParametersById: Map<string, AnimatorParameter>
): AnimatorTransition | null => {
  if (!rawTransition || typeof rawTransition !== 'object') {
    return null;
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
    return null;
  }

  const conditions = Array.isArray(rawTransition.conditions)
    ? rawTransition.conditions
        .map((rawCondition, conditionIndex) =>
          normalizeAnimatorTransitionCondition(
            rawCondition,
            conditionIndex,
            animatorParametersById
          )
        )
        .filter(Boolean)
    : [];

  return {
    id:
      typeof rawTransition.id === 'string' && rawTransition.id
        ? rawTransition.id
        : `transition-${index}`,
    fromIndex,
    toIndex,
    crossfadeDuration: Number.isFinite(rawTransition.crossfadeDuration)
      ? Math.max(rawTransition.crossfadeDuration, 0)
      : null,
    conditions,
  };
};

const parseAnimatorTransitions = (
  rawValue: string,
  animationsCount: number,
  animatorParameters: AnimatorParameter[]
): AnimatorTransition[] => {
  if (!rawValue) return [];
  try {
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];
    const animatorParametersById = new Map(
      animatorParameters.map((parameter) => [parameter.id, parameter])
    );
    return parsedValue
      .map((rawTransition, index) =>
        normalizeAnimatorTransition(
          rawTransition,
          index,
          animationsCount,
          animatorParametersById
        )
      )
      .filter(Boolean);
  } catch (error) {
    return [];
  }
};

const serializeAnimatorTransitions = (
  animatorTransitions: AnimatorTransition[]
): string =>
  JSON.stringify(
    animatorTransitions.map((transition) => ({
      id: transition.id,
      fromIndex: transition.fromIndex,
      toIndex: transition.toIndex,
      crossfadeDuration:
        transition.crossfadeDuration === null
          ? null
          : Math.max(transition.crossfadeDuration || 0, 0),
      conditions: transition.conditions.map((condition) => ({
        id: condition.id,
        parameterId: condition.parameterId,
        operator: condition.operator,
        value: condition.value,
      })),
    }))
  );

const getParameterDisplayName = (parameter: ?AnimatorParameter): string =>
  parameter && parameter.name ? parameter.name : 'Parameter';

const formatConditionSummary = (
  condition: AnimatorTransitionCondition,
  parameter: ?AnimatorParameter
): string => {
  const parameterName = getParameterDisplayName(parameter);
  switch (condition.operator) {
    case 'greater':
      return `${parameterName} > ${String(condition.value)}`;
    case 'greaterOrEquals':
      return `${parameterName} >= ${String(condition.value)}`;
    case 'less':
      return `${parameterName} < ${String(condition.value)}`;
    case 'lessOrEquals':
      return `${parameterName} <= ${String(condition.value)}`;
    case 'notEquals':
      return `${parameterName} != ${String(condition.value)}`;
    case 'isTrue':
      return `${parameterName} is true`;
    case 'isFalse':
      return `${parameterName} is false`;
    case 'triggered':
      return `${parameterName} triggered`;
    case 'equals':
    default:
      return `${parameterName} == ${String(condition.value)}`;
  }
};

const formatTransitionSummary = (
  transition: AnimatorTransition,
  animatorParametersById: Map<string, AnimatorParameter>,
  getStateName: (number) => string
): string => {
  const targetName = getStateName(transition.toIndex);
  if (transition.conditions.length === 0) {
    return transition.crossfadeDuration !== null
      ? `Auto -> ${targetName} (${transition.crossfadeDuration}s blend)`
      : `Auto -> ${targetName}`;
  }

  const conditionSummary = `${transition.conditions
    .map((condition) =>
      formatConditionSummary(
        condition,
        animatorParametersById.get(condition.parameterId) || null
      )
    )
    .join(' and ')} -> ${targetName}`;
  return transition.crossfadeDuration !== null
    ? `${conditionSummary} (${transition.crossfadeDuration}s blend)`
    : conditionSummary;
};

const getAnimatorStateDefinitionAt = (
  animatorStates: AnimatorStateDefinition[],
  animationIndex: number
): AnimatorStateDefinition =>
  animationIndex >= 0 && animationIndex < animatorStates.length
    ? animatorStates[animationIndex]
    : createDefaultAnimatorStateDefinition(animationIndex);

const sortBlendMotions = (
  motions: AnimatorBlendStateMotion[]
): AnimatorBlendStateMotion[] =>
  motions
    .slice()
    .sort((firstMotion, secondMotion) => {
      if (firstMotion.threshold === secondMotion.threshold) {
        return firstMotion.source.localeCompare(secondMotion.source);
      }
      return firstMotion.threshold - secondMotion.threshold;
    });

const withAnimatorStateDefinitionAt = (
  animatorStates: AnimatorStateDefinition[],
  animationIndex: number,
  nextStateDefinition: AnimatorStateDefinition
): AnimatorStateDefinition[] => {
  const nextAnimatorStates = animatorStates.slice();
  while (nextAnimatorStates.length <= animationIndex) {
    nextAnimatorStates.push(
      createDefaultAnimatorStateDefinition(nextAnimatorStates.length)
    );
  }
  nextAnimatorStates[animationIndex] = nextStateDefinition;
  return nextAnimatorStates;
};

const withAnimatorStatePositionAt = (
  animatorStates: AnimatorStateDefinition[],
  animationIndex: number,
  nextPosition: AnimatorGraphPosition
): AnimatorStateDefinition[] => {
  const stateDefinition = getAnimatorStateDefinitionAt(animatorStates, animationIndex);
  return withAnimatorStateDefinitionAt(animatorStates, animationIndex, {
    ...stateDefinition,
    editorPosition: constrainAnimatorStatePosition(nextPosition),
  });
};

const getAnimatorStatePosition = (
  animatorStates: AnimatorStateDefinition[],
  animationIndex: number
): AnimatorGraphPosition =>
  normalizeAnimatorStatePosition(
    getAnimatorStateDefinitionAt(animatorStates, animationIndex).editorPosition,
    animationIndex
  );

const getAnimatorGraphContentBounds = (
  animatorStates: AnimatorStateDefinition[],
  animationsCount: number
): {|
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
|} => {
  let minX = Math.min(GRAPH_ANY_STATE_POSITION.x, GRAPH_ENTRY_POSITION.x);
  let minY = Math.min(GRAPH_ANY_STATE_POSITION.y, GRAPH_ENTRY_POSITION.y);
  let maxX = Math.max(
    GRAPH_ANY_STATE_POSITION.x + GRAPH_ANY_STATE_WIDTH,
    GRAPH_ENTRY_POSITION.x + GRAPH_ENTRY_WIDTH
  );
  let maxY = Math.max(
    GRAPH_ANY_STATE_POSITION.y + GRAPH_NODE_MIN_HEIGHT,
    GRAPH_ENTRY_POSITION.y + 84
  );

  if (animationsCount === 0) {
    minX = Math.min(minX, GRAPH_STATE_DEFAULT_X - 40);
    minY = Math.min(minY, GRAPH_FIRST_STATE_Y);
    maxX = Math.max(maxX, GRAPH_STATE_DEFAULT_X + 420);
    maxY = Math.max(maxY, GRAPH_FIRST_STATE_Y + 240);
  }

  for (let animationIndex = 0; animationIndex < animationsCount; animationIndex++) {
    const stateDefinition = getAnimatorStateDefinitionAt(
      animatorStates,
      animationIndex
    );
    const statePosition = getAnimatorStatePosition(animatorStates, animationIndex);
    const extraHeight =
      stateDefinition.type === 'blend1d'
        ? Math.max(0, stateDefinition.motions.length - 1) * 28 + 80
        : 0;
    minX = Math.min(minX, statePosition.x);
    minY = Math.min(minY, statePosition.y);
    maxX = Math.max(maxX, statePosition.x + GRAPH_NODE_WIDTH);
    maxY = Math.max(
      maxY,
      statePosition.y + GRAPH_NODE_MIN_HEIGHT + extraHeight
    );
  }

  return {
    minX: Math.max(0, minX - 120),
    minY: Math.max(0, minY - 120),
    maxX: Math.min(GRAPH_CANVAS_WIDTH, maxX + 120),
    maxY: Math.min(GRAPH_CANVAS_HEIGHT, maxY + 120),
  };
};

const getCenteredGraphView = (
  bounds: {|
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  |},
  viewportWidth: number,
  viewportHeight: number,
  zoom: number = GRAPH_DEFAULT_ZOOM
): {| panX: number, panY: number, zoom: number |} => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    panX: viewportWidth / 2 - centerX * zoom,
    panY: viewportHeight / 2 - centerY * zoom,
  };
};

const createGraphCurvePath = (
  startPoint: AnimatorGraphPosition,
  endPoint: AnimatorGraphPosition
): string => {
  const horizontalDistance = Math.max(Math.abs(endPoint.x - startPoint.x), 120);
  const controlOffset = Math.min(horizontalDistance * 0.45, 220);
  return `M ${startPoint.x} ${startPoint.y} C ${startPoint.x + controlOffset} ${
    startPoint.y
  }, ${endPoint.x - controlOffset} ${endPoint.y}, ${endPoint.x} ${endPoint.y}`;
};

const computeBlend1DPreviewMotions = (
  motions: AnimatorBlendStateMotion[],
  parameterValue: number
): Array<{| source: string, loop: boolean, weight: number |}> => {
  if (motions.length === 0) return [];

  if (motions.length === 1) {
    return [{ source: motions[0].source, loop: motions[0].loop, weight: 1 }];
  }

  if (!Number.isFinite(parameterValue)) {
    parameterValue = motions[0].threshold;
  }

  if (parameterValue <= motions[0].threshold) {
    return [{ source: motions[0].source, loop: motions[0].loop, weight: 1 }];
  }

  for (let motionIndex = 0; motionIndex < motions.length - 1; motionIndex++) {
    const currentMotion = motions[motionIndex];
    const nextMotion = motions[motionIndex + 1];
    if (parameterValue > nextMotion.threshold) continue;

    const range = nextMotion.threshold - currentMotion.threshold;
    if (Math.abs(range) <= 0.00001) {
      return [{ source: nextMotion.source, loop: nextMotion.loop, weight: 1 }];
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
    ].filter((motion) => motion.weight > 0.00001);
  }

  const lastMotion = motions[motions.length - 1];
  return [{ source: lastMotion.source, loop: lastMotion.loop, weight: 1 }];
};

const getPreviewStatePlayback = (
  state: PreviewAnimationState,
  previewParameterValuesById: { [string]: number | boolean }
): {|
  type: 'clip' | 'blend1d',
  motions: Array<{| source: string, loop: boolean, weight: number |}>,
  primarySource: string,
|} | null => {
  if (state.type === 'blend1d' && state.blendMotions.length > 0) {
    const parameterValue = Number(
      previewParameterValuesById[state.blendParameterId]
    );
    const motions = computeBlend1DPreviewMotions(
      state.blendMotions,
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

  if (!state.source) return null;
  return {
    type: 'clip',
    motions: [{ source: state.source, loop: state.loop, weight: 1 }],
    primarySource: state.source,
  };
};

const buildPreviewParameterValuesById = (
  animatorParameters: AnimatorParameter[],
  previousValuesById?: { [string]: number | boolean }
): { [string]: number | boolean } =>
  animatorParameters.reduce((accumulator, parameter) => {
    accumulator[parameter.id] =
      previousValuesById &&
      Object.prototype.hasOwnProperty.call(previousValuesById, parameter.id)
        ? previousValuesById[parameter.id]
        : parameter.defaultValue;
    return accumulator;
  }, {});

const setTransparentGridMaterial = (
  material: THREE.Material | THREE.Material[]
) => {
  if (Array.isArray(material)) {
    material.forEach((gridMaterial) => {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.32;
    });
    return;
  }
  material.transparent = true;
  material.opacity = 0.32;
};

const Model3DAnimationPreview = ({
  gltf,
  animations,
  animatorTransitions,
  initialAnimationIndex,
  previewParameterValuesById,
  animatorParametersById,
  onConsumePreviewTriggers,
  restartToken,
}: Model3DAnimationPreviewProps): React.Node => {
  const containerRef = React.useRef<?HTMLDivElement>(null);
  // $FlowFixMe[value-as-type]
  const rendererRef = React.useRef<?THREE.WebGLRenderer>(null);
  // $FlowFixMe[value-as-type]
  const sceneRef = React.useRef<?THREE.Scene>(null);
  // $FlowFixMe[value-as-type]
  const cameraRef = React.useRef<?THREE.PerspectiveCamera>(null);
  // $FlowFixMe[value-as-type]
  const previewPivotRef = React.useRef<?THREE.Group>(null);
  // $FlowFixMe[value-as-type]
  const previewRootRef = React.useRef<?THREE.Group>(null);
  // $FlowFixMe[value-as-type]
  const mixerRef = React.useRef<?THREE.AnimationMixer>(null);
  const frameRequestRef = React.useRef<?number>(null);
  const resizeObserverRef = React.useRef<?ResizeObserver>(null);
  const [playbackSpeed, setPlaybackSpeed] = React.useState<number>(1);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [autoRotateEnabled, setAutoRotateEnabled] = React.useState(true);
  const [localRestartToken, setLocalRestartToken] = React.useState<number>(0);
  const [currentAnimationIndex, setCurrentAnimationIndex] =
    React.useState<number>(
      initialAnimationIndex >= 0 && initialAnimationIndex < animations.length
        ? initialAnimationIndex
        : 0
    );

  const isPlayingRef = React.useRef<boolean>(isPlaying);
  const autoRotateEnabledRef = React.useRef<boolean>(autoRotateEnabled);
  const playbackSpeedRef = React.useRef<number>(playbackSpeed);
  const currentAnimationIndexRef = React.useRef<number>(currentAnimationIndex);
  const animatorTransitionsRef =
    React.useRef<AnimatorTransition[]>(animatorTransitions);
  const previewParameterValuesRef = React.useRef<{
    [string]: number | boolean,
  }>(previewParameterValuesById);
  const animationsRef = React.useRef<PreviewAnimationState[]>(animations);
  const animatorParametersByIdRef = React.useRef<
    Map<string, AnimatorParameter>,
  >(animatorParametersById);
  const consumeTriggersRef = React.useRef(onConsumePreviewTriggers);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  React.useEffect(() => {
    autoRotateEnabledRef.current = autoRotateEnabled;
  }, [autoRotateEnabled]);
  React.useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);
  React.useEffect(() => {
    currentAnimationIndexRef.current = currentAnimationIndex;
  }, [currentAnimationIndex]);
  React.useEffect(() => {
    animatorTransitionsRef.current = animatorTransitions;
  }, [animatorTransitions]);
  React.useEffect(() => {
    previewParameterValuesRef.current = previewParameterValuesById;
  }, [previewParameterValuesById]);
  React.useEffect(() => {
    animationsRef.current = animations;
  }, [animations]);
  React.useEffect(() => {
    animatorParametersByIdRef.current = animatorParametersById;
  }, [animatorParametersById]);
  React.useEffect(() => {
    consumeTriggersRef.current = onConsumePreviewTriggers;
  }, [onConsumePreviewTriggers]);

  React.useEffect(() => {
    const nextInitialAnimationIndex =
      initialAnimationIndex >= 0 && initialAnimationIndex < animations.length
        ? initialAnimationIndex
        : 0;
    currentAnimationIndexRef.current = nextInitialAnimationIndex;
    setCurrentAnimationIndex(nextInitialAnimationIndex);
    setLocalRestartToken((currentToken) => currentToken + 1);
    setIsPlaying(true);
  }, [animations.length, initialAnimationIndex, restartToken]);

  const currentAnimation =
    currentAnimationIndex >= 0 && currentAnimationIndex < animations.length
      ? animations[currentAnimationIndex]
      : null;
  const currentAnimationPlayback = React.useMemo(
    () =>
      currentAnimation
        ? getPreviewStatePlayback(currentAnimation, previewParameterValuesById)
        : null,
    [currentAnimation, previewParameterValuesById]
  );
  const currentAnimationLabel = currentAnimation
    ? String(currentAnimation.name || currentAnimation.source || '')
    : '';
  const activePlaybackSourcesRef = React.useRef<Set<string>>(new Set());

  const hasPreviewClip = React.useMemo(
    () =>
      !!(
        gltf &&
        currentAnimationPlayback &&
        currentAnimationPlayback.motions.some((motion) =>
          gltf.animations.some((animation) => animation.name === motion.source)
        )
      ),
    [currentAnimationPlayback, gltf]
  );

  const applyPlaybackToMixer = React.useCallback(
    (
      mixer: THREE.AnimationMixer,
      playback: {|
        motions: Array<{| source: string, loop: boolean, weight: number |}>,
      |} | null,
      preserveTime: boolean
    ): boolean => {
      if (!gltf) return false;

      const desiredMotions = playback
        ? playback.motions.filter(
            (motion) =>
              motion.source &&
              gltf.animations.some(
                (animation) => animation.name === motion.source
              )
          )
        : [];
      const desiredSources = new Set(
        desiredMotions.map((motion) => motion.source).filter(Boolean)
      );
      const sourcesToUpdate = new Set([
        ...activePlaybackSourcesRef.current,
        ...desiredSources,
      ]);

      sourcesToUpdate.forEach((source) => {
        const clip = gltf.animations.find((animation) => animation.name === source);
        if (!clip) return;

        const action = mixer.clipAction(clip);
        const matchingMotion =
          desiredMotions.find((motion) => motion.source === source) || null;
        if (!matchingMotion) {
          action.stop();
          action.enabled = false;
          action.setEffectiveWeight(0);
          return;
        }

        if (matchingMotion.loop) {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
        } else {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        action.enabled = true;
        action.setEffectiveWeight(matchingMotion.weight);
        if (!preserveTime || !activePlaybackSourcesRef.current.has(source)) {
          action.reset();
        }
        action.play();
      });

      activePlaybackSourcesRef.current = desiredSources;
      return desiredSources.size > 0;
    },
    [gltf]
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    configureThreeRendererQuality(renderer, {
      toneMapping: 'AgX',
      exposure: 1.02,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2.45, 1.55, 3.25);
    camera.lookAt(0, 0.6, 0);
    const environmentRenderTarget = createStudioEnvironmentRenderTarget(renderer);
    if (environmentRenderTarget) {
      scene.environment = environmentRenderTarget.texture;
      const sceneWithEnvironment = ((scene: any): {
        environmentIntensity?: number,
      });
      if (typeof sceneWithEnvironment.environmentIntensity === 'number') {
        sceneWithEnvironment.environmentIntensity = 1.18;
      }
    }

    const previewPivot = new THREE.Group();
    scene.add(previewPivot);

    const lightingRig = createStudioLightingRig();
    scene.add(lightingRig);

    const gridHelper = new THREE.GridHelper(8, 24, 0xffffff, 0xffffff);
    setTransparentGridMaterial(gridHelper.material);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    previewPivotRef.current = previewPivot;

    const updateSize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }
      const width = Math.max(containerRef.current.clientWidth, 1);
      const height = Math.max(containerRef.current.clientHeight, 1);
      rendererRef.current.setSize(width, height, false);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    updateSize();

    if (window.ResizeObserver) {
      const resizeObserver = new window.ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(container);
      resizeObserverRef.current = resizeObserver;
    } else {
      window.addEventListener('resize', updateSize);
    }

    const clock = new THREE.Clock();
    const renderFrame = () => {
      if (mixerRef.current && isPlayingRef.current) {
        mixerRef.current.update(clock.getDelta() * playbackSpeedRef.current);
      } else {
        clock.getDelta();
      }
      if (previewPivotRef.current && autoRotateEnabledRef.current) {
        previewPivotRef.current.rotation.y += 0.008;
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      frameRequestRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      } else {
        window.removeEventListener('resize', updateSize);
      }
      mixerRef.current = null;
      previewRootRef.current = null;
      previewPivotRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      if (environmentRenderTarget) {
        environmentRenderTarget.dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  React.useEffect(() => {
    const previewPivot = previewPivotRef.current;
    if (!previewPivot) return;

    if (previewRootRef.current) {
      previewPivot.remove(previewRootRef.current);
      previewRootRef.current = null;
    }
    mixerRef.current = null;

    if (!gltf) {
      return;
    }

    const clonedScene = SkeletonUtils.clone(gltf.scene);
    const previewRoot = new THREE.Group();
    previewRoot.add(clonedScene);
    previewRoot.rotation.order = 'ZYX';

    const box = new THREE.Box3().setFromObject(previewRoot);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const previewScale = 1.8 / maxDimension;
    previewRoot.scale.setScalar(previewScale);
    previewRoot.position.x -= center.x * previewScale;
    previewRoot.position.z -= center.z * previewScale;
    previewRoot.position.y -= (center.y - size.y / 2) * previewScale;
    previewPivot.rotation.y = 0;
    previewPivot.add(previewRoot);
    previewRootRef.current = previewRoot;

    if (cameraRef.current) {
      const focusY = Math.max(size.y * previewScale * 0.42, 0.4);
      cameraRef.current.position.set(2.45, 1.55, 3.25);
      cameraRef.current.lookAt(0, focusY, 0);
    }

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    activePlaybackSourcesRef.current = new Set();
    applyPlaybackToMixer(mixer, currentAnimationPlayback, false);
    setIsPlaying(true);

    return () => {
      if (previewPivotRef.current && previewRootRef.current === previewRoot) {
        previewPivotRef.current.remove(previewRoot);
        previewRootRef.current = null;
      }
      if (mixerRef.current === mixer) {
        mixerRef.current = null;
      }
      activePlaybackSourcesRef.current = new Set();
    };
  }, [
    applyPlaybackToMixer,
    currentAnimationPlayback,
    gltf,
    localRestartToken,
    restartToken,
  ]);

  React.useEffect(() => {
    if (!mixerRef.current) return;
    applyPlaybackToMixer(mixerRef.current, currentAnimationPlayback, true);
  }, [applyPlaybackToMixer, currentAnimationPlayback]);

  return (
    <>
      <div style={styles.previewViewport}>
        <div ref={containerRef} style={styles.previewCanvas} />
        {!gltf && (
          <div style={styles.previewOverlay}>
            <PlaceholderLoader />
          </div>
        )}
      </div>
      <Column noMargin>
        <Line noMargin justifyContent="space-between" alignItems="center">
          <Text size="body-small" noMargin color="secondary">
            {currentAnimation ? (
              <>
                <Trans>Previewing</Trans>
                {' '}
                {currentAnimationLabel}
              </>
            ) : (
              <Trans>Previewing the 3D model</Trans>
            )}
          </Text>
          <Text size="body-small" noMargin color="secondary">
            {hasPreviewClip ? (
              currentAnimationPlayback &&
              currentAnimationPlayback.type === 'blend1d' ? (
                <Trans>Live blend</Trans>
              ) : (
                <Trans>Live clip</Trans>
              )
            ) : (
              <Trans>Static pose</Trans>
            )}
          </Text>
        </Line>
        <div style={styles.previewControls}>
          <Line noMargin justifyContent="space-between" alignItems="center">
            <FlatButton
              label={isPlaying ? <Trans>Pause</Trans> : <Trans>Play</Trans>}
              onClick={() => {
                setIsPlaying(!isPlaying);
              }}
              disabled={!hasPreviewClip}
            />
            <FlatButton
              label={<Trans>Restart</Trans>}
              onClick={() => {
                setLocalRestartToken((currentToken) => currentToken + 1);
                setIsPlaying(true);
              }}
              disabled={!gltf}
            />
          </Line>
        </div>
        <Text size="body-small" noMargin color="secondary">
          <Trans>Playback speed</Trans>
        </Text>
        <Slider
          min={0.25}
          max={2}
          step={0.25}
          value={playbackSpeed}
          onChange={(value) => {
            setPlaybackSpeed(value);
          }}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value.toFixed(2)}x`}
        />
        <Checkbox
          label={<Trans>Auto-rotate preview</Trans>}
          checked={autoRotateEnabled}
          onCheck={(_, checked) => {
            setAutoRotateEnabled(checked);
          }}
        />
      </Column>
    </>
  );
};

const Model3DAnimationEditor = ({
  objectConfiguration,
  project,
  layout,
  eventsFunctionsExtension,
  eventsBasedObject,
  object,
  onSizeUpdated,
  onObjectUpdated,
}: EditorProps): React.Node => {
  const { isMobile, isLandscape } = useResponsiveWindowSize();
  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const { showAlert } = useAlertDialog();
  const forceUpdate = useForceUpdate();
  const graphSurfaceRef = React.useRef<?HTMLDivElement>(null);
  const graphViewRef = React.useRef({
    panX: GRAPH_DEFAULT_PAN_X,
    panY: GRAPH_DEFAULT_PAN_Y,
    zoom: GRAPH_DEFAULT_ZOOM,
  });
  const graphInteractionRef = React.useRef<any>({
    mode: null,
    pointerStartX: 0,
    pointerStartY: 0,
    panStartX: GRAPH_DEFAULT_PAN_X,
    panStartY: GRAPH_DEFAULT_PAN_Y,
    stateIndex: -1,
    stateStartPosition: getDefaultAnimatorStatePosition(0),
    fromIndex: null,
  });
  const [justAddedAnimationPointer, setJustAddedAnimationPointer] =
    React.useState<?number>(null);
  const [graphView, setGraphView] = React.useState({
    panX: GRAPH_DEFAULT_PAN_X,
    panY: GRAPH_DEFAULT_PAN_Y,
    zoom: GRAPH_DEFAULT_ZOOM,
  });
  const [connectionPreview, setConnectionPreview] = React.useState<?{|
    fromIndex: number,
    currentPoint: AnimatorGraphPosition,
  |}>(null);
  const [selectedAnimationPointer, setSelectedAnimationPointer] =
    React.useState<?number>(null);
  const [nameErrors, setNameErrors] = React.useState<{ [number]: React.Node }>(
    {}
  );
  // $FlowFixMe[value-as-type]
  const [gltf, setGltf] = React.useState<GLTF | null>(null);
  const [modelLoadingError, setModelLoadingError] =
    React.useState<?Error>(null);
  const [previewRestartToken, setPreviewRestartToken] =
    React.useState<number>(0);
  const [selectedTransitionId, setSelectedTransitionId] =
    React.useState<?string>(null);
  const lastAutoCenteredGraphKeyRef = React.useRef<string>('');

  const model3DConfiguration = gd.asModel3DConfiguration(objectConfiguration);
  const properties = objectConfiguration.getProperties();
  const modelResourceName = properties.get('modelResourceName').getValue();
  const animationsCount = model3DConfiguration.getAnimationsCount();
  const animatorParametersPropertyValue = properties.has(
    'animatorParametersJson'
  )
    ? properties.get('animatorParametersJson').getValue()
    : '[]';
  const animatorTransitionsPropertyValue = properties.has(
    'animatorTransitionsJson'
  )
    ? properties.get('animatorTransitionsJson').getValue()
    : '[]';
  const animatorStatesPropertyValue = properties.has('animatorStatesJson')
    ? properties.get('animatorStatesJson').getValue()
    : '[]';
  const [animatorParameters, setAnimatorParameters] = React.useState<
    AnimatorParameter[],
  >(() => parseAnimatorParameters(animatorParametersPropertyValue));
  const [animatorStates, setAnimatorStates] = React.useState<
    AnimatorStateDefinition[],
  >(() =>
    parseAnimatorStateDefinitions(animatorStatesPropertyValue, animationsCount)
  );
  const [animatorTransitions, setAnimatorTransitions] = React.useState<
    AnimatorTransition[],
  >(() =>
    parseAnimatorTransitions(
      animatorTransitionsPropertyValue,
      animationsCount,
      parseAnimatorParameters(animatorParametersPropertyValue)
    )
  );
  const [, setParameterErrors] = React.useState<{
    [string]: React.Node,
  }>({});
  const [previewParameterValuesById, setPreviewParameterValuesById] =
    React.useState<{ [string]: number | boolean }>(() =>
      buildPreviewParameterValuesById(
        parseAnimatorParameters(animatorParametersPropertyValue)
      )
    );
  const animatorStatesRef = React.useRef<AnimatorStateDefinition[]>(animatorStates);
  const graphContentBounds = React.useMemo(
    () => getAnimatorGraphContentBounds(animatorStates, animationsCount),
    [animatorStates, animationsCount]
  );

  React.useEffect(() => {
    animatorStatesRef.current = animatorStates;
  }, [animatorStates]);

  React.useEffect(() => {
    graphViewRef.current = graphView;
  }, [graphView]);

  const getGraphViewportCenterPosition = React.useCallback((): AnimatorGraphPosition => {
    const graphSurface = graphSurfaceRef.current;
    const currentGraphView = graphViewRef.current;
    if (!graphSurface) {
      return getDefaultAnimatorStatePosition(animationsCount);
    }

    return constrainAnimatorStatePosition({
      x:
        (graphSurface.clientWidth / 2 - currentGraphView.panX) /
          currentGraphView.zoom -
        GRAPH_NODE_WIDTH / 2,
      y:
        (graphSurface.clientHeight / 2 - currentGraphView.panY) /
          currentGraphView.zoom -
        GRAPH_NODE_MIN_HEIGHT / 2,
    });
  }, [animationsCount]);

  const centerGraphView = React.useCallback(
    (zoom: number = GRAPH_DEFAULT_ZOOM) => {
      const graphSurface = graphSurfaceRef.current;
      if (!graphSurface) {
        return;
      }

      setGraphView(
        getCenteredGraphView(
          graphContentBounds,
          Math.max(graphSurface.clientWidth, 1),
          Math.max(graphSurface.clientHeight, 1),
          zoom
        )
      );
    },
    [graphContentBounds]
  );

  React.useLayoutEffect(() => {
    const graphSurface = graphSurfaceRef.current;
    if (!graphSurface) {
      return;
    }

    const autoCenterKey = `${String(object.getName())}:${String(
      modelResourceName
    )}:${animationsCount}`;
    if (lastAutoCenteredGraphKeyRef.current === autoCenterKey) {
      return;
    }
    lastAutoCenteredGraphKeyRef.current = autoCenterKey;

    const frameId = window.requestAnimationFrame(() => {
      centerGraphView();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [animationsCount, centerGraphView, modelResourceName, object]);

  React.useEffect(() => {
    if (justAddedAnimationPointer === null) return;

    let addedAnimationIndex = -1;
    for (let animationIndex = 0; animationIndex < animationsCount; animationIndex++) {
      if (model3DConfiguration.getAnimation(animationIndex).ptr === justAddedAnimationPointer) {
        addedAnimationIndex = animationIndex;
        break;
      }
    }

    if (addedAnimationIndex !== -1 && graphSurfaceRef.current) {
      const graphSurface = graphSurfaceRef.current;
      const statePosition = getAnimatorStatePosition(animatorStates, addedAnimationIndex);
      setGraphView((currentGraphView) => ({
        ...currentGraphView,
        panX:
          graphSurface.clientWidth / 2 -
          (statePosition.x + GRAPH_NODE_WIDTH / 2) * currentGraphView.zoom,
        panY:
          graphSurface.clientHeight / 2 -
          (statePosition.y + GRAPH_NODE_MIN_HEIGHT / 2) * currentGraphView.zoom,
      }));
    }

    setJustAddedAnimationPointer(null);
  }, [
    animationsCount,
    animatorStates,
    justAddedAnimationPointer,
    model3DConfiguration,
  ]);

  React.useEffect(() => {
    let isUnmounted = false;

    (async () => {
      try {
        setModelLoadingError(null);
        const newModel3D = await PixiResourcesLoader.get3DModel(
          project,
          modelResourceName
        );
        if (isUnmounted) return;
        setGltf(newModel3D);
      } catch (error) {
        if (isUnmounted) return;
        setModelLoadingError(error);
        setGltf(null);
      }
    })();

    return () => {
      isUnmounted = true;
    };
  }, [modelResourceName, project]);

  React.useEffect(() => {
    setAnimatorParameters(
      parseAnimatorParameters(animatorParametersPropertyValue)
    );
    setParameterErrors({});
  }, [animatorParametersPropertyValue]);

  React.useEffect(() => {
    setAnimatorStates(
      parseAnimatorStateDefinitions(animatorStatesPropertyValue, animationsCount)
    );
  }, [animationsCount, animatorStatesPropertyValue]);

  React.useEffect(() => {
    setPreviewParameterValuesById((currentPreviewParameterValuesById) =>
      buildPreviewParameterValuesById(
        animatorParameters,
        currentPreviewParameterValuesById
      )
    );
  }, [animatorParameters]);

  React.useEffect(() => {
    setAnimatorTransitions(
      parseAnimatorTransitions(
        animatorTransitionsPropertyValue,
        animationsCount,
        animatorParameters
      )
    );
  }, [animationsCount, animatorParameters, animatorTransitionsPropertyValue]);

  let selectedAnimationIndex = -1;
  for (let index = 0; index < animationsCount; index++) {
    if (
      model3DConfiguration.getAnimation(index).ptr === selectedAnimationPointer
    ) {
      selectedAnimationIndex = index;
      break;
    }
  }

  const selectedAnimation =
    selectedAnimationIndex !== -1
      ? model3DConfiguration.getAnimation(selectedAnimationIndex)
      : null;
  const animatorParametersById = React.useMemo(
    () =>
      new Map(animatorParameters.map((parameter) => [parameter.id, parameter])),
    [animatorParameters]
  );
  const selectedAnimationTransitions = React.useMemo(
    () =>
      selectedAnimationIndex === -1
        ? []
        : animatorTransitions.filter(
            (transition) => transition.fromIndex === selectedAnimationIndex
          ),
    [animatorTransitions, selectedAnimationIndex]
  );
  const anyStateTransitions = React.useMemo(
    () =>
      animatorTransitions.filter(
        (transition) => transition.fromIndex === ANY_STATE_INDEX
      ),
    [animatorTransitions]
  );
  const selectedTransition = React.useMemo(
    () =>
      selectedTransitionId
        ? animatorTransitions.find(
            (transition) => transition.id === selectedTransitionId
          ) || null
        : null,
    [animatorTransitions, selectedTransitionId]
  );
  const selectedAnyStateTransition =
    selectedTransition && selectedTransition.fromIndex === ANY_STATE_INDEX
      ? selectedTransition
      : null;
  const getAnimationDisplayName = React.useCallback(
    (animationIndex: number): string => {
      if (animationIndex < 0 || animationIndex >= animationsCount) {
        return 'Missing state';
      }
      const animation = model3DConfiguration.getAnimation(animationIndex);
      const animationName = String(animation.getName() || '');
      return animationName || `State ${animationIndex + 1}`;
    },
    [animationsCount, model3DConfiguration]
  );
  const selectedAnimationStateDefinition =
    selectedAnimationIndex !== -1
      ? getAnimatorStateDefinitionAt(animatorStates, selectedAnimationIndex)
      : createDefaultAnimatorStateDefinition();
  const selectedBlendDriverParameter =
    selectedAnimationStateDefinition.type === 'blend1d' &&
    selectedAnimationStateDefinition.parameterId
      ? animatorParametersById.get(selectedAnimationStateDefinition.parameterId) ||
        null
      : null;
  const selectedBlendThresholdRange =
    selectedAnimationStateDefinition.type === 'blend1d' &&
    selectedAnimationStateDefinition.motions.length > 0
      ? {
          min: selectedAnimationStateDefinition.motions[0].threshold,
          max:
            selectedAnimationStateDefinition.motions[
              selectedAnimationStateDefinition.motions.length - 1
            ].threshold,
        }
      : null;
  const selectedBlendPreviewValue =
    selectedBlendDriverParameter &&
    isNumericAnimatorParameter(selectedBlendDriverParameter)
      ? Number(
          previewParameterValuesById[selectedBlendDriverParameter.id] ||
            selectedBlendDriverParameter.defaultValue
        )
      : selectedBlendThresholdRange
        ? selectedBlendThresholdRange.min
        : 0;

  React.useEffect(() => {
    if (animationsCount === 0) {
      if (selectedAnimationPointer !== null) setSelectedAnimationPointer(null);
      return;
    }
    if (selectedAnimationIndex === -1) {
      setSelectedAnimationPointer(model3DConfiguration.getAnimation(0).ptr);
    }
  }, [
    animationsCount,
    model3DConfiguration,
    selectedAnimationIndex,
    selectedAnimationPointer,
  ]);

  React.useEffect(() => {
    if (
      selectedTransition &&
      selectedAnimationIndex !== -1 &&
      selectedTransition.fromIndex !== selectedAnimationIndex &&
      selectedTransition.fromIndex !== ANY_STATE_INDEX
    ) {
      setSelectedTransitionId(null);
    }
    if (
      selectedTransitionId &&
      !animatorTransitions.some(
        (transition) => transition.id === selectedTransitionId
      )
    ) {
      setSelectedTransitionId(null);
    }
  }, [
    animatorTransitions,
    selectedAnimationIndex,
    selectedTransition,
    selectedTransitionId,
  ]);

  const onAnimationConfigurationUpdated = React.useCallback(
    (options?: {| shouldRefreshPreview?: boolean |}) => {
      forceUpdate();
      if (onObjectUpdated) onObjectUpdated();
      if (options && options.shouldRefreshPreview) {
        setPreviewRestartToken((currentToken) => currentToken + 1);
      }
    },
    [forceUpdate, onObjectUpdated]
  );

  const saveAnimatorGraphData = React.useCallback(
    (options: {|
      nextAnimatorParameters?: AnimatorParameter[],
      nextAnimatorStates?: AnimatorStateDefinition[],
      nextAnimatorTransitions?: AnimatorTransition[],
      shouldRefreshPreview?: boolean,
    |}) => {
      if (options.nextAnimatorParameters) {
        objectConfiguration.updateProperty(
          'animatorParametersJson',
          serializeAnimatorParameters(options.nextAnimatorParameters)
        );
        setAnimatorParameters(options.nextAnimatorParameters);
      }
      if (options.nextAnimatorStates) {
        objectConfiguration.updateProperty(
          'animatorStatesJson',
          serializeAnimatorStateDefinitions(options.nextAnimatorStates)
        );
        setAnimatorStates(options.nextAnimatorStates);
      }
      if (options.nextAnimatorTransitions) {
        objectConfiguration.updateProperty(
          'animatorTransitionsJson',
          serializeAnimatorTransitions(options.nextAnimatorTransitions)
        );
        setAnimatorTransitions(options.nextAnimatorTransitions);
      }
      onAnimationConfigurationUpdated({
        shouldRefreshPreview: !!options.shouldRefreshPreview,
      });
    },
    [objectConfiguration, onAnimationConfigurationUpdated]
  );

  const saveAnimatorParameters = React.useCallback(
    (nextAnimatorParameters: AnimatorParameter[]) => {
      saveAnimatorGraphData({ nextAnimatorParameters });
    },
    [saveAnimatorGraphData]
  );

  const saveAnimatorStates = React.useCallback(
    (
      nextAnimatorStates: AnimatorStateDefinition[],
      options?: {| shouldRefreshPreview?: boolean |}
    ) => {
      saveAnimatorGraphData({
        nextAnimatorStates,
        shouldRefreshPreview: options && options.shouldRefreshPreview,
      });
    },
    [saveAnimatorGraphData]
  );

  const saveAnimatorTransitions = React.useCallback(
    (
      nextAnimatorTransitions: AnimatorTransition[],
      options?: {| shouldRefreshPreview?: boolean |}
    ) => {
      saveAnimatorGraphData({
        nextAnimatorTransitions,
        shouldRefreshPreview: options && options.shouldRefreshPreview,
      });
    },
    [saveAnimatorGraphData]
  );

  const changeAnimationName = React.useCallback(
    (animationIndex: number, newName: string) => {
      const animation = model3DConfiguration.getAnimation(animationIndex);
      const currentName = String(animation.getName() || '');
      if (currentName === newName) return;

      setNameErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        delete nextErrors[animationIndex];
        return nextErrors;
      });

      if (newName !== '' && model3DConfiguration.hasAnimationNamed(newName)) {
        setNameErrors((previousErrors) => ({
          ...previousErrors,
          [animationIndex]: (
            <Trans>The animation name {newName} is already taken.</Trans>
          ),
        }));
        return;
      }

      animation.setName(newName);
      if (object) {
        if (layout) {
          gd.WholeProjectRefactorer.renameObjectAnimationInScene(
            project,
            layout,
            object,
            currentName,
            newName
          );
        } else if (eventsFunctionsExtension && eventsBasedObject) {
          gd.WholeProjectRefactorer.renameObjectAnimationInEventsBasedObject(
            project,
            eventsFunctionsExtension,
            eventsBasedObject,
            object,
            currentName,
            newName
          );
        }
      }
      onAnimationConfigurationUpdated();
    },
    [
      eventsBasedObject,
      eventsFunctionsExtension,
      layout,
      model3DConfiguration,
      object,
      onAnimationConfigurationUpdated,
      project,
    ]
  );

  const changeSelectedAnimationSource = React.useCallback(
    (newSource: string) => {
      if (!selectedAnimation) return;
      selectedAnimation.setSource(newSource);
      onAnimationConfigurationUpdated({ shouldRefreshPreview: true });
    },
    [onAnimationConfigurationUpdated, selectedAnimation]
  );

  const changeSelectedAnimationLoop = React.useCallback(
    (checked: boolean) => {
      if (!selectedAnimation) return;
      selectedAnimation.setShouldLoop(checked);
      onAnimationConfigurationUpdated({ shouldRefreshPreview: true });
    },
    [onAnimationConfigurationUpdated, selectedAnimation]
  );

  const ensureBlendDriverParameterId = React.useCallback(
    (
      animationIndex: number,
      currentAnimatorParameters: AnimatorParameter[],
      currentStateDefinition: AnimatorStateDefinition
    ): {|
      nextAnimatorParameters: AnimatorParameter[],
      parameterId: string,
    |} => {
      if (currentStateDefinition.type === 'blend1d') {
        const existingBlendDriver =
          currentAnimatorParameters.find(
            (parameter) =>
              parameter.id === currentStateDefinition.parameterId &&
              isNumericAnimatorParameter(parameter)
          ) || null;
        if (existingBlendDriver) {
          return {
            nextAnimatorParameters: currentAnimatorParameters,
            parameterId: existingBlendDriver.id,
          };
        }
      }

      const newBlendDriver = createNamedAnimatorParameter(
        `${getAnimationDisplayName(animationIndex)} Blend`,
        'float',
        currentAnimatorParameters
      );
      return {
        nextAnimatorParameters: [...currentAnimatorParameters, newBlendDriver],
        parameterId: newBlendDriver.id,
      };
    },
    [getAnimationDisplayName]
  );

  const saveAnimationStateDefinition = React.useCallback(
    (
      animationIndex: number,
      nextStateDefinition: AnimatorStateDefinition,
      options?: {| nextAnimatorParameters?: AnimatorParameter[] |}
    ) => {
      saveAnimatorGraphData({
        nextAnimatorParameters: options && options.nextAnimatorParameters,
        nextAnimatorStates: withAnimatorStateDefinitionAt(
          animatorStates,
          animationIndex,
          nextStateDefinition
        ),
        shouldRefreshPreview: true,
      });
    },
    [animatorStates, saveAnimatorGraphData]
  );

  const convertAnimationToClipState = React.useCallback(
    (animationIndex: number, preferredMotion?: ?AnimatorBlendStateMotion) => {
      if (animationIndex < 0 || animationIndex >= animationsCount) return;
      const animation = model3DConfiguration.getAnimation(animationIndex);
      const stateDefinition = getAnimatorStateDefinitionAt(
        animatorStates,
        animationIndex
      );
      const fallbackMotion =
        preferredMotion ||
        (stateDefinition.type === 'blend1d' && stateDefinition.motions.length > 0
          ? stateDefinition.motions[0]
          : null);

      if (fallbackMotion) {
        animation.setSource(fallbackMotion.source);
        animation.setShouldLoop(fallbackMotion.loop);
      }

      saveAnimationStateDefinition(animationIndex, {
        type: 'clip',
        editorPosition: stateDefinition.editorPosition,
      });
    },
    [
      animationsCount,
      animatorStates,
      model3DConfiguration,
      saveAnimationStateDefinition,
    ]
  );

  const convertAnimationToBlendState = React.useCallback(
    (animationIndex: number) => {
      if (animationIndex < 0 || animationIndex >= animationsCount) return;

      const animation = model3DConfiguration.getAnimation(animationIndex);
      const currentStateDefinition = getAnimatorStateDefinitionAt(
        animatorStates,
        animationIndex
      );
      if (currentStateDefinition.type === 'blend1d') {
        return;
      }

      const currentSource = String(animation.getSource() || '').trim();
      const availableSourceAnimationNames = gltf
        ? gltf.animations.map((sourceAnimation) =>
            safeToDisplayString(sourceAnimation.name)
          )
        : [];
      const defaultStateDefinition = createDefaultBlend1DStateDefinition(
        animatorParameters,
        availableSourceAnimationNames,
        currentSource,
        animation.shouldLoop(),
        animationIndex
      );
      const { nextAnimatorParameters, parameterId } = ensureBlendDriverParameterId(
        animationIndex,
        animatorParameters,
        defaultStateDefinition
      );
      saveAnimationStateDefinition(
        animationIndex,
        {
          type: 'blend1d',
          parameterId,
          motions:
            defaultStateDefinition.type === 'blend1d'
              ? defaultStateDefinition.motions
              : [],
          editorPosition: currentStateDefinition.editorPosition,
        },
        { nextAnimatorParameters }
      );
    },
    [
      animationsCount,
      animatorParameters,
      animatorStates,
      ensureBlendDriverParameterId,
      gltf,
      model3DConfiguration,
      saveAnimationStateDefinition,
    ]
  );

  const sourceAnimationNames = React.useMemo(
    () => (gltf ? gltf.animations.map((animation) => animation.name) : []),
    [gltf]
  );

  const makeUniqueAnimationName = React.useCallback(
    (baseName: string): string => {
      const trimmedBaseName = baseName.trim() || 'State';
      if (!model3DConfiguration.hasAnimationNamed(trimmedBaseName)) {
        return trimmedBaseName;
      }

      let suffix = 2;
      let nextName = `${trimmedBaseName} ${suffix}`;
      while (model3DConfiguration.hasAnimationNamed(nextName)) {
        suffix++;
        nextName = `${trimmedBaseName} ${suffix}`;
      }
      return nextName;
    },
    [model3DConfiguration]
  );

  const addAnimation = React.useCallback((editorPosition?: AnimatorGraphPosition) => {
    setNameErrors({});

    const emptyAnimation = new gd.Model3DAnimation();
    model3DConfiguration.addAnimation(emptyAnimation);
    emptyAnimation.delete();

    const addedAnimation = model3DConfiguration.getAnimation(
      model3DConfiguration.getAnimationsCount() - 1
    );
    setSelectedAnimationPointer(addedAnimation.ptr);
    setJustAddedAnimationPointer(addedAnimation.ptr);
    saveAnimatorStates([
      ...animatorStates,
      {
        ...createDefaultAnimatorStateDefinition(animatorStates.length),
        ...(editorPosition
          ? {
              editorPosition: constrainAnimatorStatePosition(editorPosition),
            }
          : {}),
      },
    ]);
    onSizeUpdated();
  }, [animatorStates, model3DConfiguration, onSizeUpdated, saveAnimatorStates]);

  const addBlendState = React.useCallback(
    (editorPosition?: AnimatorGraphPosition) => {
      setNameErrors({});

      const newAnimation = new gd.Model3DAnimation();
      newAnimation.setName(makeUniqueAnimationName('Blend 1D'));
      model3DConfiguration.addAnimation(newAnimation);
      newAnimation.delete();

      const addedAnimationIndex = model3DConfiguration.getAnimationsCount() - 1;
      const addedAnimation = model3DConfiguration.getAnimation(addedAnimationIndex);
      const defaultBlendStateDefinition = createDefaultBlend1DStateDefinition(
        animatorParameters,
        sourceAnimationNames,
        sourceAnimationNames[0] || '',
        true,
        addedAnimationIndex
      );
      const { nextAnimatorParameters, parameterId } = ensureBlendDriverParameterId(
        addedAnimationIndex,
        animatorParameters,
        defaultBlendStateDefinition
      );

      setSelectedAnimationPointer(addedAnimation.ptr);
      setJustAddedAnimationPointer(addedAnimation.ptr);
      saveAnimatorGraphData({
        nextAnimatorParameters,
        nextAnimatorStates: [
          ...animatorStates,
          {
            ...(defaultBlendStateDefinition.type === 'blend1d'
              ? {
                  ...defaultBlendStateDefinition,
                  parameterId,
                }
              : {
                  type: 'blend1d',
                  parameterId,
                  motions: [],
                }),
            ...(editorPosition
              ? {
                  editorPosition: constrainAnimatorStatePosition(editorPosition),
                }
              : {}),
          },
        ],
        shouldRefreshPreview: true,
      });
      onSizeUpdated();
    },
    [
      animatorParameters,
      animatorStates,
      ensureBlendDriverParameterId,
      makeUniqueAnimationName,
      model3DConfiguration,
      onSizeUpdated,
      saveAnimatorGraphData,
      sourceAnimationNames,
    ]
  );

  const addAnimationFromTemplate = React.useCallback(
    (
      templateType: AnimatorGraphBlockTemplateType,
      editorPosition?: AnimatorGraphPosition
    ) => {
      if (templateType === 'blend1d') {
        addBlendState(editorPosition);
        return;
      }
      addAnimation(editorPosition);
    },
    [addAnimation, addBlendState]
  );

  const addAnimationFromSource = React.useCallback(
    (sourceName: string, editorPosition?: AnimatorGraphPosition) => {
      const trimmedSourceName = sourceName.trim();
      if (!trimmedSourceName) return;

      setNameErrors({});

      const newAnimation = new gd.Model3DAnimation();
      newAnimation.setSource(trimmedSourceName);
      if (!model3DConfiguration.hasAnimationNamed(trimmedSourceName)) {
        newAnimation.setName(trimmedSourceName);
      }
      model3DConfiguration.addAnimation(newAnimation);
      newAnimation.delete();

      const addedAnimation = model3DConfiguration.getAnimation(
        model3DConfiguration.getAnimationsCount() - 1
      );
      setSelectedAnimationPointer(addedAnimation.ptr);
      setJustAddedAnimationPointer(addedAnimation.ptr);
      saveAnimatorStates(
        [
          ...animatorStates,
          {
            ...createDefaultAnimatorStateDefinition(animatorStates.length),
            ...(editorPosition
              ? {
                  editorPosition: constrainAnimatorStatePosition(editorPosition),
                }
              : {}),
          },
        ],
        {
          shouldRefreshPreview: true,
        }
      );
      onSizeUpdated();
    },
    [animatorStates, model3DConfiguration, onSizeUpdated, saveAnimatorStates]
  );

  const addBlendMotionToAnimation = React.useCallback(
    (animationIndex: number, sourceName: string) => {
      if (animationIndex < 0 || animationIndex >= animationsCount) return;
      const trimmedSourceName = sourceName.trim();
      if (!trimmedSourceName) return;

      const animation = model3DConfiguration.getAnimation(animationIndex);
      const currentStateDefinition = getAnimatorStateDefinitionAt(
        animatorStates,
        animationIndex
      );

      if (currentStateDefinition.type !== 'blend1d') {
        const currentSource = String(animation.getSource() || '').trim();
        if (!currentSource || currentSource === trimmedSourceName) {
          animation.setSource(trimmedSourceName);
          setSelectedAnimationPointer(animation.ptr);
          onAnimationConfigurationUpdated({ shouldRefreshPreview: true });
          return;
        }

        const { nextAnimatorParameters, parameterId } =
          ensureBlendDriverParameterId(
            animationIndex,
            animatorParameters,
            currentStateDefinition
          );
        saveAnimationStateDefinition(
          animationIndex,
          {
            type: 'blend1d',
            parameterId,
            motions: sortBlendMotions([
              createAnimatorBlendStateMotion(
                currentSource,
                0,
                animation.shouldLoop()
              ),
              createAnimatorBlendStateMotion(trimmedSourceName, 1, true),
            ]),
          },
          { nextAnimatorParameters }
        );
        setSelectedAnimationPointer(animation.ptr);
        return;
      }

      if (
        currentStateDefinition.motions.some(
          (motion) => motion.source === trimmedSourceName
        )
      ) {
        setSelectedAnimationPointer(animation.ptr);
        return;
      }

      const lastThreshold =
        currentStateDefinition.motions.length > 0
          ? currentStateDefinition.motions[
              currentStateDefinition.motions.length - 1
            ].threshold
          : 0;
      const { nextAnimatorParameters, parameterId } = ensureBlendDriverParameterId(
        animationIndex,
        animatorParameters,
        currentStateDefinition
      );
      saveAnimationStateDefinition(
        animationIndex,
        {
          type: 'blend1d',
          parameterId,
          motions: sortBlendMotions([
            ...currentStateDefinition.motions,
            createAnimatorBlendStateMotion(
              trimmedSourceName,
              lastThreshold + 1,
              true
            ),
          ]),
        },
        { nextAnimatorParameters }
      );
      setSelectedAnimationPointer(animation.ptr);
    },
    [
      animationsCount,
      animatorParameters,
      animatorStates,
      ensureBlendDriverParameterId,
      model3DConfiguration,
      onAnimationConfigurationUpdated,
      saveAnimationStateDefinition,
    ]
  );

  const removeAnimation = React.useCallback(
    (animationIndex: number) => {
      setNameErrors({});

      const animationToRemove =
        model3DConfiguration.getAnimation(animationIndex);
      const removedAnimationPointer = animationToRemove.ptr;
      const nextAnimatorTransitions = animatorTransitions
        .filter(
          (transition) =>
            transition.fromIndex !== animationIndex &&
            transition.toIndex !== animationIndex
        )
        .map((transition) => ({
          ...transition,
          fromIndex:
            transition.fromIndex > animationIndex
              ? transition.fromIndex - 1
              : transition.fromIndex,
          toIndex:
            transition.toIndex > animationIndex
              ? transition.toIndex - 1
              : transition.toIndex,
        }));
      const nextAnimatorStates = animatorStates.filter(
        (_, stateIndex) => stateIndex !== animationIndex
      );

      model3DConfiguration.removeAnimation(animationIndex);

      if (selectedAnimationPointer === removedAnimationPointer) {
        if (model3DConfiguration.getAnimationsCount() === 0) {
          setSelectedAnimationPointer(null);
        } else {
          const fallbackIndex = Math.min(
            animationIndex,
            model3DConfiguration.getAnimationsCount() - 1
          );
          setSelectedAnimationPointer(
            model3DConfiguration.getAnimation(fallbackIndex).ptr
          );
        }
      }

      setSelectedTransitionId((currentTransitionId) =>
        currentTransitionId &&
        !nextAnimatorTransitions.some(
          (transition) => transition.id === currentTransitionId
        )
          ? null
          : currentTransitionId
      );
      saveAnimatorGraphData({
        nextAnimatorStates,
        nextAnimatorTransitions,
        shouldRefreshPreview: true,
      });
      onSizeUpdated();
    },
    [
      animatorStates,
      animatorTransitions,
      model3DConfiguration,
      onSizeUpdated,
      saveAnimatorGraphData,
      selectedAnimationPointer,
    ]
  );

  const scanNewAnimations = React.useCallback(() => {
    if (!gltf) {
      return;
    }

    setNameErrors({});

    const animationSources = mapFor(
      0,
      model3DConfiguration.getAnimationsCount(),
      (animationIndex) =>
        String(
          model3DConfiguration.getAnimation(animationIndex).getSource() || ''
        )
    );

    let firstAddedAnimationPointer = null;
    let hasAddedAnimation = false;

    for (const resourceAnimation of gltf.animations) {
      if (animationSources.includes(resourceAnimation.name)) {
        continue;
      }

      const newAnimationName = model3DConfiguration.hasAnimationNamed(
        resourceAnimation.name
      )
        ? ''
        : resourceAnimation.name;

      const newAnimation = new gd.Model3DAnimation();
      newAnimation.setName(newAnimationName);
      newAnimation.setSource(resourceAnimation.name);
      model3DConfiguration.addAnimation(newAnimation);
      newAnimation.delete();

      if (firstAddedAnimationPointer === null) {
        const addedAnimation = model3DConfiguration.getAnimation(
          model3DConfiguration.getAnimationsCount() - 1
        );
        firstAddedAnimationPointer = addedAnimation.ptr;
      }
      hasAddedAnimation = true;
    }

    if (hasAddedAnimation) {
      if (firstAddedAnimationPointer !== null) {
        setSelectedAnimationPointer(firstAddedAnimationPointer);
        setJustAddedAnimationPointer(firstAddedAnimationPointer);
      }
      saveAnimatorStates([
        ...animatorStates,
        ...mapFor(
          0,
          model3DConfiguration.getAnimationsCount() - animatorStates.length,
          (offsetIndex) =>
            createDefaultAnimatorStateDefinition(animatorStates.length + offsetIndex)
        ),
      ]);
      onSizeUpdated();
    } else {
      showAlert({
        title: t`No new clip`,
        message: t`Every animation clip from the GLB file is already imported into this animator.`,
      });
    }
  }, [
    animatorStates,
    gltf,
    model3DConfiguration,
    onSizeUpdated,
    saveAnimatorStates,
    showAlert,
  ]);

  const sourceSelectOptions = React.useMemo(
    () =>
      sourceAnimationNames.map((animationName) => (
        <SelectOption
          key={animationName}
          value={animationName}
          label={animationName}
          shouldNotTranslate
        />
      )),
    [sourceAnimationNames]
  );

  const getGraphPointFromClientCoordinates = React.useCallback(
    (
      clientX: number,
      clientY: number,
      sourceGraphView?: {| panX: number, panY: number, zoom: number |}
    ): AnimatorGraphPosition => {
      const graphSurface = graphSurfaceRef.current;
      const activeGraphView = sourceGraphView || graphViewRef.current;
      if (!graphSurface) {
        return constrainAnimatorStatePosition(
          getDefaultAnimatorStatePosition(animationsCount)
        );
      }

      const rect = graphSurface.getBoundingClientRect();
      return constrainAnimatorStatePosition({
        x: (clientX - rect.left - activeGraphView.panX) / activeGraphView.zoom,
        y: (clientY - rect.top - activeGraphView.panY) / activeGraphView.zoom,
      });
    },
    [animationsCount]
  );

  const getStateOutputAnchor = React.useCallback(
    (animationIndex: number): AnimatorGraphPosition => {
      const statePosition = getAnimatorStatePosition(
        animatorStatesRef.current,
        animationIndex
      );
      return {
        x: statePosition.x + GRAPH_NODE_WIDTH,
        y: statePosition.y + GRAPH_NODE_MIN_HEIGHT / 2,
      };
    },
    []
  );

  const getStateInputAnchor = React.useCallback(
    (animationIndex: number): AnimatorGraphPosition => {
      const statePosition = getAnimatorStatePosition(
        animatorStatesRef.current,
        animationIndex
      );
      return {
        x: statePosition.x,
        y: statePosition.y + GRAPH_NODE_MIN_HEIGHT / 2,
      };
    },
    []
  );

  const commitAnimatorStateLayout = React.useCallback(() => {
    objectConfiguration.updateProperty(
      'animatorStatesJson',
      serializeAnimatorStateDefinitions(animatorStatesRef.current)
    );
    onAnimationConfigurationUpdated();
  }, [objectConfiguration, onAnimationConfigurationUpdated]);

  const createGraphTransition = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        toIndex < 0 ||
        toIndex >= animationsCount ||
        (fromIndex !== ANY_STATE_INDEX && fromIndex === toIndex)
      ) {
        return;
      }

      const existingTransition =
        animatorTransitions.find(
          (transition) =>
            transition.fromIndex === fromIndex && transition.toIndex === toIndex
        ) || null;
      if (existingTransition) {
        setSelectedTransitionId(existingTransition.id);
        if (fromIndex !== ANY_STATE_INDEX) {
          setSelectedAnimationPointer(
            model3DConfiguration.getAnimation(fromIndex).ptr
          );
        }
        return;
      }

      const nextTransition = {
        ...createAnimatorTransition(fromIndex, toIndex, animatorParameters),
        toIndex,
      };
      saveAnimatorTransitions([...animatorTransitions, nextTransition]);
      setSelectedTransitionId(nextTransition.id);
      if (fromIndex !== ANY_STATE_INDEX) {
        setSelectedAnimationPointer(model3DConfiguration.getAnimation(fromIndex).ptr);
      }
    },
    [
      animationsCount,
      animatorParameters,
      animatorTransitions,
      model3DConfiguration,
      saveAnimatorTransitions,
    ]
  );

  const beginGraphPan = React.useCallback(
    (event: SyntheticMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('button') ||
          target.closest('input') ||
          target.closest('[role="button"]') ||
          target.closest('[data-graph-node="true"]'))
      ) {
        return;
      }

      graphInteractionRef.current = {
        mode: 'pan',
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        panStartX: graphViewRef.current.panX,
        panStartY: graphViewRef.current.panY,
        stateIndex: -1,
        stateStartPosition: getDefaultAnimatorStatePosition(0),
        fromIndex: null,
      };
      if (graphSurfaceRef.current) {
        graphSurfaceRef.current.style.cursor = 'grabbing';
      }
    },
    []
  );

  const beginStateDrag = React.useCallback(
    (animationIndex: number, event: SyntheticMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('button') ||
          target.closest('input') ||
          target.closest('[role="button"]') ||
          target.closest('[data-graph-handle="true"]'))
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (graphSurfaceRef.current) {
        graphSurfaceRef.current.style.cursor = 'grabbing';
      }
      graphInteractionRef.current = {
        mode: 'drag-state',
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        panStartX: graphViewRef.current.panX,
        panStartY: graphViewRef.current.panY,
        stateIndex: animationIndex,
        stateStartPosition: getAnimatorStatePosition(animatorStates, animationIndex),
        fromIndex: null,
      };
    },
    [animatorStates]
  );

  const beginTransitionConnection = React.useCallback(
    (fromIndex: number, event: SyntheticMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      graphInteractionRef.current = {
        mode: 'connect',
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        panStartX: graphViewRef.current.panX,
        panStartY: graphViewRef.current.panY,
        stateIndex: -1,
        stateStartPosition: getDefaultAnimatorStatePosition(0),
        fromIndex,
      };
      setConnectionPreview({
        fromIndex,
        currentPoint: getGraphPointFromClientCoordinates(event.clientX, event.clientY),
      });
      if (graphSurfaceRef.current) {
        graphSurfaceRef.current.style.cursor = 'crosshair';
      }
    },
    [getGraphPointFromClientCoordinates]
  );

  const completeTransitionConnection = React.useCallback(
    (targetIndex: number, event: SyntheticMouseEvent<HTMLDivElement>) => {
      const interaction = graphInteractionRef.current;
      if (interaction.mode !== 'connect' || interaction.fromIndex === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      createGraphTransition(interaction.fromIndex, targetIndex);
      graphInteractionRef.current.mode = null;
      graphInteractionRef.current.fromIndex = null;
      setConnectionPreview(null);
      if (graphSurfaceRef.current) {
        graphSurfaceRef.current.style.cursor = 'grab';
      }
    },
    [createGraphTransition]
  );

  const handleGraphWheel = React.useCallback(
    (event: SyntheticWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const graphSurface = graphSurfaceRef.current;
      if (!graphSurface) return;

      const rect = graphSurface.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const zoomDelta = event.deltaY < 0 ? 1.1 : 0.92;

      setGraphView((currentGraphView) => {
        const nextZoom = clamp(
          currentGraphView.zoom * zoomDelta,
          GRAPH_MIN_ZOOM,
          GRAPH_MAX_ZOOM
        );
        const zoomRatio = nextZoom / currentGraphView.zoom;
        return {
          panX: pointerX - (pointerX - currentGraphView.panX) * zoomRatio,
          panY: pointerY - (pointerY - currentGraphView.panY) * zoomRatio,
          zoom: nextZoom,
        };
      });
    },
    []
  );

  React.useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      const interaction = graphInteractionRef.current;
      if (!interaction.mode) return;

      if (interaction.mode === 'pan') {
        setGraphView((currentGraphView) => ({
          ...currentGraphView,
          panX: interaction.panStartX + (event.clientX - interaction.pointerStartX),
          panY: interaction.panStartY + (event.clientY - interaction.pointerStartY),
        }));
        return;
      }

      if (interaction.mode === 'drag-state') {
        const nextPosition = constrainAnimatorStatePosition({
          x:
            interaction.stateStartPosition.x +
            (event.clientX - interaction.pointerStartX) / graphViewRef.current.zoom,
          y:
            interaction.stateStartPosition.y +
            (event.clientY - interaction.pointerStartY) / graphViewRef.current.zoom,
        });
        setAnimatorStates((currentAnimatorStates) =>
          {
            const nextAnimatorStates = withAnimatorStatePositionAt(
              currentAnimatorStates,
              interaction.stateIndex,
              nextPosition
            );
            animatorStatesRef.current = nextAnimatorStates;
            return nextAnimatorStates;
          }
        );
        return;
      }

      if (interaction.mode === 'connect' && interaction.fromIndex !== null) {
        setConnectionPreview({
          fromIndex: interaction.fromIndex,
          currentPoint: getGraphPointFromClientCoordinates(
            event.clientX,
            event.clientY
          ),
        });
      }
    };

    const handleWindowMouseUp = () => {
      const interaction = graphInteractionRef.current;
      if (!interaction.mode) return;

      if (interaction.mode === 'drag-state') {
        commitAnimatorStateLayout();
      }

      graphInteractionRef.current.mode = null;
      graphInteractionRef.current.fromIndex = null;
      setConnectionPreview(null);
      if (graphSurfaceRef.current) {
        graphSurfaceRef.current.style.cursor = 'grab';
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [commitAnimatorStateLayout, getGraphPointFromClientCoordinates]);

  const resetGraphView = React.useCallback(() => {
    centerGraphView();
  }, [centerGraphView]);

  const handleClipDragStart = React.useCallback(
    (
      event: SyntheticDragEvent<HTMLButtonElement>,
      sourceAnimationName: string
    ) => {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        'application/x-gdevelop-3d-animation-clip',
        sourceAnimationName
      );
      event.dataTransfer.setData('text/plain', sourceAnimationName);
    },
    []
  );

  const handleGraphBlockTemplateDragStart = React.useCallback(
    (
      event: SyntheticDragEvent<HTMLButtonElement>,
      templateType: AnimatorGraphBlockTemplateType
    ) => {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        ANIMATOR_GRAPH_BLOCK_MIME_TYPE,
        templateType
      );
      event.dataTransfer.setData('text/plain', templateType);
    },
    []
  );

  const handleGraphDrop = React.useCallback(
    (event: SyntheticDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const templateType = event.dataTransfer.getData(
        ANIMATOR_GRAPH_BLOCK_MIME_TYPE
      );
      const dropPoint = getGraphPointFromClientCoordinates(
        event.clientX,
        event.clientY
      );
      if (templateType === 'state' || templateType === 'blend1d') {
        addAnimationFromTemplate(templateType, {
          x: dropPoint.x - GRAPH_NODE_WIDTH / 2,
          y: dropPoint.y - GRAPH_NODE_MIN_HEIGHT / 2,
        });
        return;
      }

      const sourceAnimationName =
        event.dataTransfer.getData(
          'application/x-gdevelop-3d-animation-clip'
        ) || event.dataTransfer.getData('text/plain');
      if (!sourceAnimationName) return;
      addAnimationFromSource(sourceAnimationName, {
        x: dropPoint.x - GRAPH_NODE_WIDTH / 2,
        y: dropPoint.y - GRAPH_NODE_MIN_HEIGHT / 2,
      });
    },
    [
      addAnimationFromSource,
      addAnimationFromTemplate,
      getGraphPointFromClientCoordinates,
    ]
  );

  const selectedAnimationSourceIsMissing = !!(
    selectedAnimation &&
    selectedAnimationStateDefinition.type !== 'blend1d' &&
    String(selectedAnimation.getSource() || '') &&
    !sourceAnimationNames.includes(String(selectedAnimation.getSource() || ''))
  );
  const selectedBlendHasMissingSources = !!(
    selectedAnimationStateDefinition.type === 'blend1d' &&
    selectedAnimationStateDefinition.motions.some(
      (motion) => !sourceAnimationNames.includes(motion.source)
    )
  );
  const previewAnimations = React.useMemo(
    () =>
      mapFor(0, animationsCount, (animationIndex) => {
        const animation = model3DConfiguration.getAnimation(animationIndex);
        const stateDefinition = getAnimatorStateDefinitionAt(
          animatorStates,
          animationIndex
        );
        return {
          name: String(animation.getName() || ''),
          source: String(animation.getSource() || ''),
          loop: animation.shouldLoop(),
          type: stateDefinition.type,
          blendParameterId:
            stateDefinition.type === 'blend1d' ? stateDefinition.parameterId : '',
          blendMotions:
            stateDefinition.type === 'blend1d' ? stateDefinition.motions : [],
        };
      }),
    [animationsCount, animatorStates, model3DConfiguration]
  );

  const renameAnimatorParameter = React.useCallback(
    (parameterId: string, newName: string) => {
      const trimmedName = newName.trim();
      const duplicateParameter = animatorParameters.find(
        (parameter) =>
          parameter.id !== parameterId && parameter.name === trimmedName
      );
      if (trimmedName && duplicateParameter) {
        setParameterErrors((previousErrors) => ({
          ...previousErrors,
          [parameterId]: (
            <Trans>The parameter name {trimmedName} is already used.</Trans>
          ),
        }));
        setAnimatorParameters((currentAnimatorParameters) =>
          currentAnimatorParameters.map((parameter) =>
            parameter.id === parameterId
              ? {
                  ...parameter,
                  name: newName,
                }
              : parameter
          )
        );
        return;
      }

      setParameterErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        delete nextErrors[parameterId];
        return nextErrors;
      });
      saveAnimatorParameters(
        animatorParameters.map((parameter) =>
          parameter.id === parameterId
            ? {
                ...parameter,
                name: newName,
              }
            : parameter
        )
      );
    },
    [animatorParameters, saveAnimatorParameters]
  );

  const addTransition = React.useCallback(
    (fromIndex: number) => {
      if (
        (fromIndex !== ANY_STATE_INDEX && fromIndex < 0) ||
        fromIndex >= animationsCount
      ) {
        return;
      }

      const defaultTargetIndex =
        animationsCount <= 1
          ? 0
          : fromIndex === ANY_STATE_INDEX
            ? selectedAnimationIndex >= 0
              ? selectedAnimationIndex
              : 0
            : fromIndex === animationsCount - 1
              ? 0
              : fromIndex + 1;
      const nextTransition = createAnimatorTransition(
        fromIndex,
        defaultTargetIndex,
        animatorParameters
      );
      const nextAnimatorTransitions = [...animatorTransitions, nextTransition];
      saveAnimatorTransitions(nextAnimatorTransitions);
      setSelectedTransitionId(nextTransition.id);
      if (fromIndex !== ANY_STATE_INDEX) {
        setSelectedAnimationPointer(
          model3DConfiguration.getAnimation(fromIndex).ptr
        );
      }
    },
    [
      animationsCount,
      animatorParameters,
      animatorTransitions,
      model3DConfiguration,
      saveAnimatorTransitions,
      selectedAnimationIndex,
    ]
  );

  const updateTransitionTarget = React.useCallback(
    (transitionId: string, nextTargetIndex: number) => {
      saveAnimatorTransitions(
        animatorTransitions.map((transition) =>
          transition.id === transitionId
            ? {
                ...transition,
                toIndex: nextTargetIndex,
              }
            : transition
        )
      );
    },
    [animatorTransitions, saveAnimatorTransitions]
  );

  const removeTransition = React.useCallback(
    (transitionId: string) => {
      const nextAnimatorTransitions = animatorTransitions.filter(
        (transition) => transition.id !== transitionId
      );
      setSelectedTransitionId((currentTransitionId) =>
        currentTransitionId === transitionId ? null : currentTransitionId
      );
      saveAnimatorTransitions(nextAnimatorTransitions);
    },
    [animatorTransitions, saveAnimatorTransitions]
  );

  const updatePreviewParameterValue = React.useCallback(
    (parameterId: string, rawValue: string | boolean) => {
      const parameter = animatorParametersById.get(parameterId);
      if (!parameter) return;

      setPreviewParameterValuesById((currentPreviewParameterValuesById) => ({
        ...currentPreviewParameterValuesById,
        [parameterId]:
          parameter.type === 'int'
            ? Number.isFinite(
                typeof rawValue === 'string' ? parseInt(rawValue, 10) : 0
              )
              ? parseInt(String(rawValue), 10) || 0
              : 0
            : parameter.type === 'float'
              ? Number.isFinite(
                  typeof rawValue === 'string' ? parseFloat(rawValue) : 0
                )
                ? parseFloat(String(rawValue)) || 0
                : 0
              : !!rawValue,
      }));
    },
    [animatorParametersById]
  );

  const consumePreviewTriggers = React.useCallback((parameterIds: string[]) => {
    if (parameterIds.length === 0) return;
    setPreviewParameterValuesById((currentPreviewParameterValuesById) => {
      const nextPreviewParameterValuesById = {
        ...currentPreviewParameterValuesById,
      };
      parameterIds.forEach((parameterId) => {
        nextPreviewParameterValuesById[parameterId] = false;
      });
      return nextPreviewParameterValuesById;
    });
  }, []);

  const resetPreviewParameters = React.useCallback(() => {
    setPreviewParameterValuesById(
      buildPreviewParameterValuesById(animatorParameters)
    );
  }, [animatorParameters]);

  const ensureSelectedBlendDriver = React.useCallback(
    (preferredName?: string): ?string => {
      if (
        selectedAnimationIndex === -1 ||
        selectedAnimationStateDefinition.type !== 'blend1d'
      ) {
        return null;
      }
      if (selectedBlendDriverParameter) {
        return selectedBlendDriverParameter.id;
      }

      const newBlendDriver = createNamedAnimatorParameter(
        preferredName || `${getAnimationDisplayName(selectedAnimationIndex)} Blend`,
        'float',
        animatorParameters
      );
      saveAnimatorGraphData({
        nextAnimatorParameters: [...animatorParameters, newBlendDriver],
        nextAnimatorStates: withAnimatorStateDefinitionAt(
          animatorStates,
          selectedAnimationIndex,
          {
            ...selectedAnimationStateDefinition,
            parameterId: newBlendDriver.id,
          }
        ),
        shouldRefreshPreview: true,
      });
      return newBlendDriver.id;
    },
    [
      animatorParameters,
      animatorStates,
      getAnimationDisplayName,
      saveAnimatorGraphData,
      selectedAnimationIndex,
      selectedAnimationStateDefinition,
      selectedBlendDriverParameter,
    ]
  );

  const renameSelectedBlendDriver = React.useCallback(
    (newName: string) => {
      if (selectedAnimationStateDefinition.type !== 'blend1d') return;
      if (selectedBlendDriverParameter) {
        renameAnimatorParameter(selectedBlendDriverParameter.id, newName);
        return;
      }
      ensureSelectedBlendDriver(newName);
    },
    [
      ensureSelectedBlendDriver,
      renameAnimatorParameter,
      selectedAnimationStateDefinition,
      selectedBlendDriverParameter,
    ]
  );

  const updateSelectedBlendMotion = React.useCallback(
    (
      motionId: string,
      patch: {| source?: string, threshold?: number, loop?: boolean |}
    ) => {
      if (
        selectedAnimationIndex === -1 ||
        selectedAnimationStateDefinition.type !== 'blend1d'
      ) {
        return;
      }

      const nextMotions = sortBlendMotions(
        selectedAnimationStateDefinition.motions.map((motion) => {
          if (motion.id !== motionId) return motion;
          const nextSource =
            typeof patch.source === 'string' ? patch.source.trim() : motion.source;
          return {
            ...motion,
            source: nextSource || motion.source,
            threshold:
              typeof patch.threshold === 'number' &&
              Number.isFinite(patch.threshold)
                ? patch.threshold
                : motion.threshold,
            loop: typeof patch.loop === 'boolean' ? patch.loop : motion.loop,
          };
        })
      );
      saveAnimationStateDefinition(selectedAnimationIndex, {
        ...selectedAnimationStateDefinition,
        motions: nextMotions,
      });
    },
    [
      saveAnimationStateDefinition,
      selectedAnimationIndex,
      selectedAnimationStateDefinition,
    ]
  );

  const removeSelectedBlendMotion = React.useCallback(
    (motionId: string) => {
      if (
        selectedAnimationIndex === -1 ||
        selectedAnimationStateDefinition.type !== 'blend1d'
      ) {
        return;
      }

      const nextMotions = selectedAnimationStateDefinition.motions.filter(
        (motion) => motion.id !== motionId
      );
      if (nextMotions.length <= 1) {
        convertAnimationToClipState(
          selectedAnimationIndex,
          nextMotions.length === 1 ? nextMotions[0] : null
        );
        return;
      }
      saveAnimationStateDefinition(selectedAnimationIndex, {
        ...selectedAnimationStateDefinition,
        motions: sortBlendMotions(nextMotions),
      });
    },
    [
      convertAnimationToClipState,
      saveAnimationStateDefinition,
      selectedAnimationIndex,
      selectedAnimationStateDefinition,
    ]
  );

  const addSuggestedBlendMotion = React.useCallback(() => {
    if (
      selectedAnimationIndex === -1 ||
      selectedAnimationStateDefinition.type !== 'blend1d'
    ) {
      return;
    }

    const usedSources = new Set(
      selectedAnimationStateDefinition.motions.map((motion) => motion.source)
    );
    const nextSource =
      sourceAnimationNames.find((sourceName) => !usedSources.has(sourceName)) || '';
    if (!nextSource) return;
    addBlendMotionToAnimation(selectedAnimationIndex, nextSource);
  }, [
    addBlendMotionToAnimation,
    selectedAnimationIndex,
    selectedAnimationStateDefinition,
    sourceAnimationNames,
  ]);

  const graphCanvasStyle = React.useMemo(
    () => ({
      ...styles.graphCanvas,
      transform: `translate(${graphView.panX}px, ${graphView.panY}px) scale(${graphView.zoom})`,
    }),
    [graphView]
  );

  const graphConnections = React.useMemo(() => {
    const renderedConnections = [];

    if (animationsCount > 0) {
      renderedConnections.push({
        id: 'entry-link',
        kind: 'entry',
        path: createGraphCurvePath(
          {
            x: GRAPH_ENTRY_POSITION.x + GRAPH_ENTRY_WIDTH / 2,
            y: GRAPH_ENTRY_POSITION.y + 64,
          },
          {
            x: getStateInputAnchor(0).x + 24,
            y: getStateInputAnchor(0).y,
          }
        ),
      });
    }

    animatorTransitions.forEach((transition) => {
      const startPoint =
        transition.fromIndex === ANY_STATE_INDEX
          ? {
              x: GRAPH_ANY_STATE_POSITION.x + GRAPH_ANY_STATE_WIDTH,
              y: GRAPH_ANY_STATE_POSITION.y + 52,
            }
          : getStateOutputAnchor(transition.fromIndex);
      const endPoint = getStateInputAnchor(transition.toIndex);
      renderedConnections.push({
        id: transition.id,
        kind:
          selectedTransitionId === transition.id ? 'selected-transition' : 'transition',
        path: createGraphCurvePath(startPoint, endPoint),
      });
    });

    if (connectionPreview) {
      const startPoint =
        connectionPreview.fromIndex === ANY_STATE_INDEX
          ? {
              x: GRAPH_ANY_STATE_POSITION.x + GRAPH_ANY_STATE_WIDTH,
              y: GRAPH_ANY_STATE_POSITION.y + 52,
            }
          : getStateOutputAnchor(connectionPreview.fromIndex);
      renderedConnections.push({
        id: 'connection-preview',
        kind: 'preview',
        path: createGraphCurvePath(startPoint, connectionPreview.currentPoint),
      });
    }

    return renderedConnections;
  }, [
    animationsCount,
    animatorTransitions,
    connectionPreview,
    getStateInputAnchor,
    getStateOutputAnchor,
    selectedTransitionId,
  ]);

  const renderAnyStateNode = () => (
    <div
      data-graph-node="true"
      style={{
        ...styles.stateRow,
        left: GRAPH_ANY_STATE_POSITION.x,
        top: GRAPH_ANY_STATE_POSITION.y,
        width: GRAPH_ANY_STATE_WIDTH,
      }}
    >
      <div style={styles.anyStateNode}>
        <Text noMargin>
          <Trans>Any State</Trans>
        </Text>
        <Text size="body-small" noMargin color="secondary">
          <Trans>
            Transitions from here can fire from any active state in the
            animator.
          </Trans>
        </Text>
        <Text size="body-small" noMargin color="secondary">
          {anyStateTransitions.length > 0
            ? `${anyStateTransitions.length} global transition(s)`
            : 'No global transitions yet'}
        </Text>
        <button
          type="button"
          data-graph-handle="true"
          style={{ ...styles.nodeHandle, ...styles.anyStateHandle }}
          onMouseDown={(event) => {
            beginTransitionConnection(ANY_STATE_INDEX, event);
          }}
        />
      </div>
    </div>
  );

  const renderStateCard = (animationIndex: number) => {
    const animation = model3DConfiguration.getAnimation(animationIndex);
    const stateDefinition = getAnimatorStateDefinitionAt(animatorStates, animationIndex);
    const statePosition = getAnimatorStatePosition(animatorStates, animationIndex);
    const isBlendState = stateDefinition.type === 'blend1d';
    const blendDriver =
      isBlendState && stateDefinition.parameterId
        ? animatorParametersById.get(stateDefinition.parameterId) || null
        : null;
    const isSelected = animation.ptr === selectedAnimationPointer;
    const backgroundColor = isSelected
      ? gdevelopTheme.listItem.selectedBackgroundColor
      : gdevelopTheme.list.itemsBackgroundColor;
    const animationName = safeToDisplayString(
      animation.getName(),
      'Unnamed animation state'
    );
    const animationSource = safeToDisplayString(
      animation.getSource(),
      'No source clip assigned'
    );
    const outgoingTransitions = animatorTransitions.filter(
      (transition) => transition.fromIndex === animationIndex
    );

    return (
      <div
        key={animation.ptr}
        data-graph-node="true"
        style={{
          ...styles.stateRow,
          left: statePosition.x,
          top: statePosition.y,
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onMouseDown={(event) => {
            beginStateDrag(animationIndex, event);
          }}
          onMouseUp={(event) => {
            completeTransitionConnection(animationIndex, event);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const sourceAnimationName =
              event.dataTransfer.getData(
                'application/x-gdevelop-3d-animation-clip'
              ) || event.dataTransfer.getData('text/plain');
            if (!sourceAnimationName) return;
            addBlendMotionToAnimation(animationIndex, sourceAnimationName);
          }}
          onClick={() => {
            setSelectedAnimationPointer(animation.ptr);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              setSelectedAnimationPointer(animation.ptr);
              event.preventDefault();
            }
          }}
          style={{
            ...styles.stateCard,
            backgroundColor,
            borderColor: isSelected
              ? gdevelopTheme.palette.primary
              : 'transparent',
          }}
        >
          <Line noMargin alignItems="center" justifyContent="space-between">
            <div style={styles.stateMeta}>
              <Text noMargin allowSelection allowBrowserAutoTranslate={false}>
                {animationName}
              </Text>
              {isBlendState ? (
                <Text
                  noMargin
                  size="body-small"
                  color="secondary"
                  style={styles.blendSummaryText}
                >
                  {blendDriver && blendDriver.name
                    ? `${safeToDisplayString(blendDriver.name)} blend`
                    : 'Blend node'}
                </Text>
              ) : (
                <Text
                  noMargin
                  size="body-small"
                  color="secondary"
                  allowSelection
                  allowBrowserAutoTranslate={false}
                  style={{
                    maxWidth: 320,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {animationSource}
                </Text>
              )}
            </div>
            <div style={styles.stateActions}>
              {isBlendState && (
                <div
                  style={{
                    ...styles.stateTypeBadge,
                    ...styles.stateTypeBadgeBlend,
                  }}
                >
                  <Text noMargin size="body-small">
                    <Trans>Blend 1D</Trans>
                  </Text>
                </div>
              )}
              {animation.shouldLoop() && (
                <div style={styles.loopBadge}>
                  <Text noMargin size="body-small">
                    <Trans>Loop</Trans>
                  </Text>
                </div>
              )}
              <div style={styles.loopBadge}>
                <Text noMargin size="body-small">
                  {`${outgoingTransitions.length} link(s)`}
                </Text>
              </div>
            </div>
          </Line>
          {isBlendState && (
            <div style={styles.blendCardBody}>
              <Text size="body-small" noMargin color="secondary">
                <Trans>
                  This state merges multiple clips together. Drop another clip
                  on it to extend the blend.
                </Trans>
              </Text>
              <div style={styles.blendRail}>
                {stateDefinition.motions.length === 0 ? (
                  <div style={styles.blendMotionChip}>
                    <Text noMargin size="body-small" color="secondary">
                      <Trans>Drop clips here to build the blend</Trans>
                    </Text>
                  </div>
                ) : (
                  stateDefinition.motions.map((motion) => (
                    <div key={motion.id} style={styles.blendMotionChip}>
                      <Text
                        noMargin
                        allowSelection
                        allowBrowserAutoTranslate={false}
                      >
                        {safeToDisplayString(motion.source)}
                      </Text>
                      <Text
                        size="body-small"
                        noMargin
                        color="secondary"
                        style={styles.blendMotionThreshold}
                      >
                        {`Threshold ${motion.threshold}`}
                      </Text>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {outgoingTransitions.length > 0 && (
            <div style={styles.stateTransitionList}>
              {outgoingTransitions.slice(0, 3).map((transition) => (
                <button
                  key={transition.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedAnimationPointer(animation.ptr);
                    setSelectedTransitionId(transition.id);
                  }}
                  style={{
                    ...styles.transitionChip,
                    borderColor:
                      selectedTransitionId === transition.id
                        ? gdevelopTheme.palette.primary
                        : 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Text noMargin size="body-small">
                    {safeToDisplayString(getAnimationDisplayName(transition.toIndex))}
                  </Text>
                  <Text
                    size="body-small"
                    noMargin
                    color="secondary"
                    style={styles.transitionSummary}
                  >
                    {formatTransitionSummary(
                      transition,
                      animatorParametersById,
                      getAnimationDisplayName
                    )}
                  </Text>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            data-graph-handle="true"
            style={styles.nodeHandle}
            onMouseDown={(event) => {
              beginTransitionConnection(animationIndex, event);
            }}
          />
        </div>
      </div>
    );
  };
  return (
    <div
      style={{
        ...styles.root,
        ...(isMobile && !isLandscape ? styles.stackedRoot : {}),
      }}
    >
      <div
        style={{
          ...styles.sidePanel,
          flex: isMobile && !isLandscape ? undefined : 0.68,
        }}
      >
        <Paper background="medium" style={styles.panel}>
          <div style={styles.panelHeader}>
            <Text size="block-title" noMargin>
              <Trans>Clips</Trans>
            </Text>
            <div style={styles.countBadge}>
              <Text size="body-small" noMargin color="secondary">
                {`${sourceAnimationNames.length} / ${animationsCount}`}
              </Text>
            </div>
          </div>
          <div style={styles.clipHint}>
            <Text size="body-small" noMargin color="secondary">
              <Trans>
                Select a state, then click a clip to assign it. This panel is
                now dedicated to clips only to keep the animator cleaner.
              </Trans>
            </Text>
          </div>
          {modelLoadingError && (
            <AlertMessage kind="error">
              <Trans>
                The 3D model could not be loaded for preview. Check the model
                resource and try again.
              </Trans>
            </AlertMessage>
          )}
          <ScrollView style={styles.clipScrollView}>
            <div style={styles.clipList}>
              {!gltf && !modelLoadingError ? (
                <PlaceholderLoader />
              ) : sourceAnimationNames.length === 0 ? (
                <AlertMessage kind="info">
                  <Trans>
                    This GLB file does not expose animation clips yet. Import a
                    rigged model with clips to build this animator.
                  </Trans>
                </AlertMessage>
              ) : (
                sourceAnimationNames.map((sourceAnimationName) => {
                  const isAssignedToSelectedAnimation =
                    !!selectedAnimation &&
                    (selectedAnimationStateDefinition.type === 'blend1d'
                      ? selectedAnimationStateDefinition.motions.some(
                          (motion) => motion.source === sourceAnimationName
                        )
                      : String(selectedAnimation.getSource() || '') ===
                        sourceAnimationName);

                  const clipLabel = safeToDisplayString(sourceAnimationName);
                  return (
                    <button
                      key={clipLabel}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        handleClipDragStart(event, clipLabel);
                      }}
                      onClick={() => {
                        if (!selectedAnimation) return;
                        addBlendMotionToAnimation(
                          selectedAnimationIndex,
                          clipLabel
                        );
                      }}
                      style={{
                        ...styles.clipItem,
                        backgroundColor: isAssignedToSelectedAnimation
                          ? gdevelopTheme.listItem.selectedBackgroundColor
                          : gdevelopTheme.list.itemsBackgroundColor,
                      }}
                    >
                      <Text
                        noMargin
                        allowSelection
                        allowBrowserAutoTranslate={false}
                      >
                        {clipLabel}
                      </Text>
                      <Text size="body-small" noMargin color="secondary">
                        {selectedAnimation ? (
                          isAssignedToSelectedAnimation ? (
                            selectedAnimationStateDefinition.type ===
                            'blend1d' ? (
                              <Trans>Already inside this blend node</Trans>
                            ) : (
                              <Trans>Assigned to the selected state</Trans>
                            )
                          ) : (
                            selectedAnimationStateDefinition.type ===
                            'blend1d' ? (
                              <Trans>Click or drag to merge into the blend</Trans>
                            ) : (
                              <Trans>Click to assign or drag to blend</Trans>
                            )
                          )
                        ) : (
                          <Trans>
                            Drag into the graph or select a state first
                          </Trans>
                        )}
                      </Text>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollView>
        </Paper>
      </div>
      <div
        style={{
          ...styles.sidePanel,
          flex: isMobile && !isLandscape ? undefined : 1.9,
        }}
      >
        <Paper background="dark" style={styles.panel}>
          <div style={styles.graphHeader}>
            <div>
              <Text size="block-title" noMargin>
                <Trans>Animator</Trans>
              </Text>
              <Text size="body-small" noMargin color="secondary">
                <Trans>
                  Build the 3D state flow here. The graph now gets the largest
                  area so editing stays clear and practical.
                </Trans>
              </Text>
            </div>
            <div style={styles.countBadge}>
              <Text size="body-small" noMargin color="secondary">
                <Trans>Base Layer</Trans>
              </Text>
            </div>
          </div>
          <div style={styles.graphToolbar}>
            <div style={styles.graphToolbarTopRow}>
              <div style={styles.graphToolbarDescription}>
                <Text size="body-small" noMargin color="secondary">
                  <Trans>
                    Drag clips from the left into the graph to create states.
                    Drop a second clip on a state to turn it into a visual
                    blend node.
                  </Trans>
                </Text>
              </div>
              <Text size="body-small" noMargin color="secondary">
                {animationsCount} <Trans>state(s)</Trans> /{' '}
                {animatorTransitions.length} <Trans>transition(s)</Trans>
              </Text>
            </div>
            <div style={styles.graphBlockPalette}>
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  handleGraphBlockTemplateDragStart(event, 'state');
                }}
                onClick={() => {
                  addAnimationFromTemplate(
                    'state',
                    getGraphViewportCenterPosition()
                  );
                }}
                style={{
                  ...styles.graphBlockTemplate,
                  ...styles.graphBlockTemplateState,
                }}
              >
                <div style={styles.graphBlockTemplateLabel}>
                  <Text noMargin>
                    <Trans>State</Trans>
                  </Text>
                  <div style={styles.graphBlockTypeBadge}>
                    <Text size="body-small" noMargin color="secondary">
                      <Trans>Clip</Trans>
                    </Text>
                  </div>
                </div>
                <Text size="body-small" noMargin color="secondary">
                  <Trans>
                    Add a regular 3D animation state, then assign or drag a GLB
                    clip onto it.
                  </Trans>
                </Text>
              </button>
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  handleGraphBlockTemplateDragStart(event, 'blend1d');
                }}
                onClick={() => {
                  addAnimationFromTemplate(
                    'blend1d',
                    getGraphViewportCenterPosition()
                  );
                }}
                style={{
                  ...styles.graphBlockTemplate,
                  ...styles.graphBlockTemplateBlend,
                }}
              >
                <div style={styles.graphBlockTemplateLabel}>
                  <Text noMargin>
                    <Trans>Blend 1D</Trans>
                  </Text>
                  <div style={styles.graphBlockTypeBadge}>
                    <Text size="body-small" noMargin color="secondary">
                      <Trans>Blend</Trans>
                    </Text>
                  </div>
                </div>
                <Text size="body-small" noMargin color="secondary">
                  <Trans>
                    Add a functional blend node that mixes multiple clips with a
                    live driver value.
                  </Trans>
                </Text>
              </button>
            </div>
          </div>
          <div
            ref={graphSurfaceRef}
            style={{
              ...styles.graphSurface,
              cursor:
                connectionPreview || graphInteractionRef.current.mode === 'connect'
                  ? 'crosshair'
                  : 'grab',
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={handleGraphDrop}
            onMouseDown={beginGraphPan}
            onWheel={handleGraphWheel}
          >
            <div style={graphCanvasStyle}>
              <div style={styles.graphCanvasBackdrop} />
              <svg style={styles.graphConnectionLayer}>
                <defs>
                  <marker
                    id="animator-graph-arrow"
                    markerWidth="12"
                    markerHeight="12"
                    refX="9"
                    refY="6"
                    orient="auto"
                  >
                    <path d="M0,0 L12,6 L0,12 z" fill="rgba(255,255,255,0.78)" />
                  </marker>
                </defs>
                {graphConnections.map((connection) => (
                  <path
                    key={connection.id}
                    d={connection.path}
                    fill="none"
                    stroke={
                      connection.kind === 'selected-transition'
                        ? gdevelopTheme.palette.primary
                        : connection.kind === 'preview'
                          ? 'rgba(255, 196, 0, 0.92)'
                          : connection.kind === 'entry'
                            ? 'rgba(255, 194, 59, 0.88)'
                            : 'rgba(255,255,255,0.3)'
                    }
                    strokeWidth={
                      connection.kind === 'selected-transition'
                        ? 4
                        : connection.kind === 'preview'
                          ? 3.5
                          : 3
                    }
                    strokeDasharray={
                      connection.kind === 'preview' ? '10 8' : undefined
                    }
                    markerEnd="url(#animator-graph-arrow)"
                  />
                ))}
              </svg>
              {renderAnyStateNode()}
              <div
                data-graph-node="true"
                style={{
                  ...styles.stateRow,
                  left: GRAPH_ENTRY_POSITION.x,
                  top: GRAPH_ENTRY_POSITION.y,
                  width: GRAPH_ENTRY_WIDTH,
                }}
              >
                <div style={styles.entryNode}>
                  <Text noMargin>
                    <Trans>Entry</Trans>
                  </Text>
                </div>
              </div>
              {animationsCount === 0 ? (
                <div
                  style={{
                    ...styles.stateRow,
                    left: GRAPH_STATE_DEFAULT_X - 40,
                    top: GRAPH_FIRST_STATE_Y,
                    width: 460,
                  }}
                >
                  <EmptyPlaceholder
                    title={<Trans>Create your first 3D state</Trans>}
                    description={
                      <Trans>
                        Import clips from the GLB model, then edit and preview
                        them from this dedicated 3D animation tab.
                      </Trans>
                    }
                    actionLabel={<Trans>Add a state</Trans>}
                    onAction={() => {
                      addAnimation(getGraphViewportCenterPosition());
                    }}
                  />
                </div>
              ) : (
                mapFor(0, animationsCount, renderStateCard)
              )}
            </div>
            <div style={styles.graphHintBadge}>
              <Text size="body-small" noMargin color="secondary">
                <Trans>
                  Drag the background to pan. Use the mouse wheel to zoom. Drag
                  nodes freely and pull from the circular handle to create a
                  connection.
                </Trans>
              </Text>
            </div>
            <div style={styles.graphHud}>
              <button
                type="button"
                style={styles.graphHudButton}
                onClick={() => {
                  setGraphView((currentGraphView) => ({
                    ...currentGraphView,
                    zoom: clamp(currentGraphView.zoom * 0.92, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM),
                  }));
                }}
              >
                -
              </button>
              <Text size="body-small" noMargin color="secondary">
                {`${Math.round(graphView.zoom * 100)}%`}
              </Text>
              <button
                type="button"
                style={styles.graphHudButton}
                onClick={() => {
                  setGraphView((currentGraphView) => ({
                    ...currentGraphView,
                    zoom: clamp(currentGraphView.zoom * 1.08, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM),
                  }));
                }}
              >
                +
              </button>
              <button
                type="button"
                style={{
                  ...styles.graphHudButton,
                  ...styles.graphHudButtonWide,
                }}
                onClick={resetGraphView}
              >
                <Trans>Center</Trans>
              </button>
            </div>
          </div>
          <Line noMargin justifyContent="space-between" alignItems="center">
            <FlatButton
              label={<Trans>Scan missing clips</Trans>}
              onClick={scanNewAnimations}
            />
            <Line noMargin alignItems="center" justifyContent="flex-end">
              <FlatButton
                label={<Trans>Center graph</Trans>}
                onClick={resetGraphView}
              />
            </Line>
          </Line>
        </Paper>
      </div>
      <div
        style={{
          ...styles.sidePanel,
          flex: isMobile && !isLandscape ? undefined : 0.92,
        }}
      >
        <Paper background="medium" style={styles.panel}>
          <div style={styles.panelHeader}>
            <Text size="block-title" noMargin>
              <Trans>Inspector</Trans>
            </Text>
            {selectedAnimation && (
              <div style={styles.countBadge}>
                <Text size="body-small" noMargin color="secondary">
                  <Trans>Selected</Trans>
                </Text>
              </div>
            )}
          </div>
          <div style={styles.inspectorContent}>
            <ScrollView style={styles.inspectorScrollView}>
              <Column noMargin>
                <Text size="body-small" noMargin color="secondary">
                  <Trans>Main settings</Trans>
                </Text>
                <PropertyField
                  objectConfiguration={objectConfiguration}
                  propertyName="crossfadeDuration"
                  onChange={() => {
                    onAnimationConfigurationUpdated();
                  }}
                />
                <div style={styles.sectionCard}>
                  <Line
                    noMargin
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text size="body-small" noMargin color="secondary">
                      <Trans>Any State transitions</Trans>
                    </Text>
                    <RaisedButton
                      primary
                      icon={<Add />}
                      label={<Trans>Add transition</Trans>}
                      onClick={() => {
                        addTransition(ANY_STATE_INDEX);
                      }}
                      disabled={animationsCount === 0}
                    />
                  </Line>
                  <div style={styles.transitionList}>
                    {anyStateTransitions.length === 0 ? (
                      <AlertMessage kind="info">
                        <Trans>
                          Add an Any State transition to jump into a target
                          state from anywhere in the animator.
                        </Trans>
                      </AlertMessage>
                    ) : (
                      anyStateTransitions.map((transition) => (
                        <button
                          key={transition.id}
                          type="button"
                          onClick={() => {
                            setSelectedTransitionId(transition.id);
                          }}
                          style={{
                            ...styles.transitionChip,
                            borderColor:
                              selectedTransitionId === transition.id
                                ? gdevelopTheme.palette.primary
                                : 'rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          <Text noMargin>
                            {`To ${getAnimationDisplayName(transition.toIndex)}`}
                          </Text>
                          <Text
                            size="body-small"
                            noMargin
                            color="secondary"
                            style={styles.transitionSummary}
                          >
                            {transition.conditions.length === 0
                              ? 'Automatic'
                              : formatTransitionSummary(
                                  transition,
                                  animatorParametersById,
                                  getAnimationDisplayName
                                )}
                          </Text>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {selectedAnyStateTransition && (
                  <div style={styles.sectionCard}>
                    <Line
                      noMargin
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Text size="body-small" noMargin color="secondary">
                        <Trans>Selected Any State transition</Trans>
                      </Text>
                      <IconButton
                        size="small"
                        style={styles.dangerButton}
                        onClick={() => {
                          removeTransition(selectedAnyStateTransition.id);
                        }}
                      >
                        <Trash />
                      </IconButton>
                    </Line>
                    <SelectField
                      fullWidth
                      value={String(selectedAnyStateTransition.toIndex)}
                      floatingLabelText={<Trans>Target state</Trans>}
                      onChange={(event, index, newValue) => {
                        updateTransitionTarget(
                          selectedAnyStateTransition.id,
                          parseInt(newValue, 10)
                        );
                      }}
                    >
                      {mapFor(0, animationsCount, (animationIndex) => (
                        <SelectOption
                          key={animationIndex}
                          value={String(animationIndex)}
                          label={safeToDisplayString(
                            getAnimationDisplayName(animationIndex)
                          )}
                          shouldNotTranslate
                        />
                      ))}
                    </SelectField>
                    <AlertMessage kind="info">
                      <Trans>
                        This panel keeps Any State focused on graph flow and the
                        target state only.
                      </Trans>
                    </AlertMessage>
                  </div>
                )}
                {selectedAnimation ? (
                  <>
                    <Text size="body-small" noMargin color="secondary">
                      <Trans>State</Trans>
                    </Text>
                    <SemiControlledTextField
                      fullWidth
                      floatingLabelText={<Trans>State name</Trans>}
                      value={safeToDisplayString(selectedAnimation.getName())}
                      errorText={nameErrors[selectedAnimationIndex]}
                      translatableHintText={t`Name this 3D animation state`}
                      onChange={(newName) => {
                        changeAnimationName(selectedAnimationIndex, newName);
                      }}
                    />
                    {selectedAnimationStateDefinition.type === 'blend1d' ? (
                      <div style={styles.sectionCard}>
                        <Line
                          noMargin
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Text size="body-small" noMargin color="secondary">
                            <Trans>Blend 1D</Trans>
                          </Text>
                          <FlatButton
                            label={<Trans>Convert to clip</Trans>}
                            onClick={() => {
                              convertAnimationToClipState(selectedAnimationIndex);
                            }}
                          />
                        </Line>
                        <Text
                          size="body-small"
                          noMargin
                          color="secondary"
                          style={styles.blendInspectorLabel}
                        >
                          <Trans>
                            This node merges clips together. Drag clips from the
                            left panel onto the graph card or add them here.
                          </Trans>
                        </Text>
                        <SemiControlledTextField
                          fullWidth
                          floatingLabelText={<Trans>Blend driver</Trans>}
                          value={
                            selectedBlendDriverParameter
                              ? safeToDisplayString(selectedBlendDriverParameter.name)
                              : ''
                          }
                          translatableHintText={t`Name used to drive this blend`}
                          onChange={(newName) => {
                            renameSelectedBlendDriver(newName);
                          }}
                        />
                        {!selectedBlendDriverParameter && (
                          <AlertMessage kind="warning">
                            <Trans>
                              This blend needs a numeric driver. Create one to
                              make the blend controllable in runtime.
                            </Trans>
                          </AlertMessage>
                        )}
                        {!selectedBlendDriverParameter && (
                          <FlatButton
                            label={<Trans>Create blend driver</Trans>}
                            onClick={() => {
                              ensureSelectedBlendDriver();
                            }}
                          />
                        )}
                        {selectedBlendDriverParameter &&
                          isNumericAnimatorParameter(selectedBlendDriverParameter) &&
                          selectedBlendThresholdRange && (
                            <>
                              <Text size="body-small" noMargin color="secondary">
                                <Trans>Preview blend value</Trans>
                              </Text>
                              <Slider
                                min={selectedBlendThresholdRange.min}
                                max={
                                  selectedBlendThresholdRange.max >
                                  selectedBlendThresholdRange.min
                                    ? selectedBlendThresholdRange.max
                                    : selectedBlendThresholdRange.min + 1
                                }
                                step={0.01}
                                value={selectedBlendPreviewValue}
                                onChange={(value) => {
                                  updatePreviewParameterValue(
                                    selectedBlendDriverParameter.id,
                                    String(value)
                                  );
                                }}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(value) => value.toFixed(2)}
                              />
                              <Line
                                noMargin
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Text size="body-small" noMargin color="secondary">
                                  {selectedBlendThresholdRange.min.toFixed(2)}
                                </Text>
                                <FlatButton
                                  label={<Trans>Reset preview</Trans>}
                                  onClick={resetPreviewParameters}
                                />
                                <Text size="body-small" noMargin color="secondary">
                                  {selectedBlendThresholdRange.max.toFixed(2)}
                                </Text>
                              </Line>
                            </>
                          )}
                        {selectedBlendHasMissingSources && (
                          <AlertMessage kind="warning">
                            <Trans>
                              One or more blend motions point to clips that are
                              no longer present in the GLB file.
                            </Trans>
                          </AlertMessage>
                        )}
                        <div style={styles.motionList}>
                          {selectedAnimationStateDefinition.motions.map((motion) => (
                            <div key={motion.id} style={styles.motionRow}>
                              <SelectField
                                fullWidth
                                value={safeToDisplayString(motion.source)}
                                floatingLabelText={<Trans>Clip</Trans>}
                                onChange={(event, index, newValue) => {
                                  updateSelectedBlendMotion(motion.id, {
                                    source: newValue,
                                  });
                                }}
                              >
                                {sourceSelectOptions}
                              </SelectField>
                              <SemiControlledTextField
                                fullWidth
                                type="number"
                                floatingLabelText={<Trans>Threshold</Trans>}
                                value={String(motion.threshold)}
                                onChange={(newValue) => {
                                  const parsedValue = parseFloat(newValue);
                                  updateSelectedBlendMotion(motion.id, {
                                    threshold: Number.isFinite(parsedValue)
                                      ? parsedValue
                                      : motion.threshold,
                                  });
                                }}
                              />
                              <Line
                                noMargin
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Checkbox
                                  label={<Trans>Loop this motion</Trans>}
                                  checked={motion.loop}
                                  onCheck={(event, checked) => {
                                    updateSelectedBlendMotion(motion.id, {
                                      loop: checked,
                                    });
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  style={styles.dangerButton}
                                  onClick={() => {
                                    removeSelectedBlendMotion(motion.id);
                                  }}
                                >
                                  <Trash />
                                </IconButton>
                              </Line>
                            </div>
                          ))}
                        </div>
                        <RaisedButton
                          primary
                          icon={<Add />}
                          label={<Trans>Add motion</Trans>}
                          onClick={addSuggestedBlendMotion}
                          disabled={
                            sourceAnimationNames.length === 0 ||
                            selectedAnimationStateDefinition.motions.length >=
                              sourceAnimationNames.length
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <SelectField
                          id="model3d-animation-source-field"
                          fullWidth
                          value={safeToDisplayString(selectedAnimation.getSource())}
                          floatingLabelText={<Trans>Source clip</Trans>}
                          translatableHintText={t`Choose a GLB clip`}
                          onChange={(event, index, newValue) => {
                            changeSelectedAnimationSource(newValue);
                          }}
                        >
                          {sourceSelectOptions}
                        </SelectField>
                        <Checkbox
                          label={<Trans>Loop this state</Trans>}
                          checked={selectedAnimation.shouldLoop()}
                          onCheck={(event, checked) => {
                            changeSelectedAnimationLoop(checked);
                          }}
                        />
                        {selectedAnimationSourceIsMissing && (
                          <AlertMessage kind="warning">
                            <Trans>
                              The selected source clip is no longer available in
                              the GLB file. Pick another clip or re-import the
                              model.
                            </Trans>
                          </AlertMessage>
                        )}
                        <FlatButton
                          label={<Trans>Convert to Blend 1D</Trans>}
                          onClick={() => {
                            convertAnimationToBlendState(selectedAnimationIndex);
                          }}
                        />
                      </>
                    )}
                    <div style={styles.sectionCard}>
                      <Line
                        noMargin
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text size="body-small" noMargin color="secondary">
                          <Trans>Transitions</Trans>
                        </Text>
                        <RaisedButton
                          primary
                          icon={<Add />}
                          label={<Trans>Add transition</Trans>}
                          onClick={() => {
                            addTransition(selectedAnimationIndex);
                          }}
                        />
                      </Line>
                      <div style={styles.transitionList}>
                        {selectedAnimationTransitions.length === 0 ? (
                          <AlertMessage kind="info">
                            <Trans>
                              This state has no transitions yet. Add one when
                              you need to move to another state.
                            </Trans>
                          </AlertMessage>
                        ) : (
                          selectedAnimationTransitions.map((transition) => (
                            <button
                              key={transition.id}
                              type="button"
                              onClick={() => {
                                setSelectedTransitionId(transition.id);
                              }}
                              style={{
                                ...styles.transitionChip,
                                borderColor:
                                  selectedTransitionId === transition.id
                                    ? gdevelopTheme.palette.primary
                                    : 'rgba(255, 255, 255, 0.08)',
                              }}
                            >
                              <Text noMargin>
                                {`To ${getAnimationDisplayName(
                                  transition.toIndex
                                )}`}
                              </Text>
                              <Text
                                size="body-small"
                                noMargin
                                color="secondary"
                                style={styles.transitionSummary}
                              >
                                {transition.conditions.length === 0
                                  ? 'Automatic'
                                  : formatTransitionSummary(
                                      transition,
                                      animatorParametersById,
                                      getAnimationDisplayName
                                    )}
                              </Text>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    {selectedTransition &&
                      selectedTransition.fromIndex ===
                        selectedAnimationIndex && (
                        <div style={styles.sectionCard}>
                          <Line
                            noMargin
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Text size="body-small" noMargin color="secondary">
                              <Trans>Selected transition</Trans>
                            </Text>
                            <IconButton
                              size="small"
                              style={styles.dangerButton}
                              onClick={() => {
                                removeTransition(selectedTransition.id);
                              }}
                            >
                              <Trash />
                            </IconButton>
                          </Line>
                          <SelectField
                            fullWidth
                            value={String(selectedTransition.toIndex)}
                            floatingLabelText={<Trans>Target state</Trans>}
                            onChange={(event, index, newValue) => {
                              updateTransitionTarget(
                                selectedTransition.id,
                                parseInt(newValue, 10)
                              );
                            }}
                          >
                            {mapFor(0, animationsCount, (animationIndex) => (
                              <SelectOption
                                key={animationIndex}
                                value={String(animationIndex)}
                                label={safeToDisplayString(
                                  getAnimationDisplayName(animationIndex)
                                )}
                                shouldNotTranslate
                              />
                            ))}
                          </SelectField>
                          <AlertMessage kind="info">
                            <Trans>
                              This transition is configured here as a simple
                              graph link with a target state.
                            </Trans>
                          </AlertMessage>
                        </div>
                      )}
                    <Line
                      noMargin
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <FlatButton
                        label={<Trans>Restart preview</Trans>}
                        onClick={() => {
                          setPreviewRestartToken(
                            (currentToken) => currentToken + 1
                          );
                        }}
                      />
                      <IconButton
                        size="small"
                        style={styles.dangerButton}
                        onClick={() => removeAnimation(selectedAnimationIndex)}
                      >
                        <Trash />
                      </IconButton>
                    </Line>
                  </>
                ) : (
                  <AlertMessage kind="info">
                    <Trans>
                      Select a state in the graph to edit its clip, loop mode,
                      and preview.
                    </Trans>
                  </AlertMessage>
                )}
              </Column>
            </ScrollView>
            <Paper background="dark" style={styles.previewPanel}>
              <Text size="block-title" noMargin>
                <Trans>Preview</Trans>
              </Text>
              <Model3DAnimationPreview
                gltf={gltf}
                animations={previewAnimations}
                animatorTransitions={animatorTransitions}
                initialAnimationIndex={
                  selectedAnimationIndex >= 0 ? selectedAnimationIndex : 0
                }
                previewParameterValuesById={previewParameterValuesById}
                animatorParametersById={animatorParametersById}
                onConsumePreviewTriggers={consumePreviewTriggers}
                restartToken={previewRestartToken}
              />
            </Paper>
          </div>
        </Paper>
      </div>
    </div>
  );
};

export default Model3DAnimationEditor;
