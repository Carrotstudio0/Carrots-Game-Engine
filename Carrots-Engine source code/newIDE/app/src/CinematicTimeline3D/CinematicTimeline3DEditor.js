// @flow
/* eslint-disable no-unused-vars */
import * as React from 'react';
import { Timeliner } from './vendor/timeliner/timeliner';
import { type PreviewDebuggerServer } from '../ExportAndShare/PreviewLauncher.flow';
import optionalRequire from '../Utils/OptionalRequire';
import './CinematicTimeline3DEditor.css';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

type CinematicTimelineEasing =
  | 'linear'
  | 'step'
  | 'quadEaseIn'
  | 'quadEaseOut'
  | 'quadEaseInOut'
  | 'none';

type Vec3 = {|
  x: number,
  y: number,
  z: number,
|};

type TransformValue = {|
  position: Vec3,
  rotation: Vec3,
  scale: Vec3,
|};

type Keyframe<T> = {|
  frame: number,
  easing: CinematicTimelineEasing,
  value: T,
|};

type TransformTrack = {|
  id: string,
  type: 'transform',
  name?: string,
  targetId: string,
  keyframes: Array<Keyframe<TransformValue>>,
|};

type Track = TransformTrack;

type TrackSettings = {|
  muted?: boolean,
  solo?: boolean,
  locked?: boolean,
|};

type CinematicTimelineLoopRange = {|
  enabled: boolean,
  inFrame: number,
  outFrame: number,
|};

type CinematicTimelineShot = {|
  id: string,
  name: string,
  startFrame: number,
  endFrame: number,
|};

type CinematicTimelineEventMarker = {|
  id: string,
  name: string,
  action: string,
  condition: string,
  frame: number,
  payload?: string,
|};

type CinematicScene = {|
  version: 1,
  name: string,
  fps: number,
  duration: number,
  tracks: Array<Track>,
  loopRange?: CinematicTimelineLoopRange,
  shots?: Array<CinematicTimelineShot>,
  events?: Array<CinematicTimelineEventMarker>,
|};

type TimelinerLayerValue = {|
  time: number,
  value: number,
  tween?: string,
  _color?: string,
|};

type TimelinerLayer = {|
  name: string,
  values: Array<TimelinerLayerValue>,
  _value?: number,
  _color?: string,
  _mute?: boolean,
  _solo?: boolean,
|};

type TimelinerUi = {|
  currentTime?: number,
  totalTime?: number,
  scrollTime?: number,
  timeScale?: number,
|};

type TimelinerData = {|
  version?: string,
  modified?: string,
  title?: string,
  ui: TimelinerUi,
  layers: Array<TimelinerLayer>,
  gdCinematicMeta?: {|
    fps?: number,
    sceneName?: string,
    loopRange?: {|
      enabled?: boolean,
      inFrame?: number,
      outFrame?: number,
    |},
    shots?: Array<{
      id?: string,
      name?: string,
      startFrame?: number,
      endFrame?: number,
    }>,
    events?: Array<{
      id?: string,
      name?: string,
      action?: string,
      condition?: string,
      frame?: number,
      payload?: string,
    }>,
    trackSettingsByLayer?: {
      [string]: {| muted?: boolean, solo?: boolean, locked?: boolean |},
    },
  |},
|};

export type ActiveObjectSnapshot = {|
  targetId: string,
  objectName: string,
  transform: TransformValue,
|};

type Props = {|
  project: gdProject,
  previewDebuggerServer: ?PreviewDebuggerServer,
  isActive: boolean,
  displayMode?: 'tab' | 'overlay',
  projectFilePath?: ?string,
  onRequestClose?: () => void,
  activeObjectSnapshot?: ?ActiveObjectSnapshot,
|};

const PROJECT_STORAGE_VARIABLE = '__carrots_cinematic_timeliner_v1';
const DEFAULT_FPS = 30;
const DEFAULT_DURATION_SECONDS = 32;
const DEFAULT_TIME_SCALE = 36;
const MIN_TIME_SCALE = 6;
const MAX_TIME_SCALE = 420;
const MIN_FPS = 1;
const MAX_FPS = 240;
const MIN_DURATION_SECONDS = 1 / DEFAULT_FPS;
const TRACK_FRAME_LIMIT = 1000000000;
const MAX_DURATION_SECONDS = TRACK_FRAME_LIMIT / MIN_FPS;
const EPSILON = 0.00001;
const DEFAULT_LOOP_RANGE = { enabled: false, inFrame: 0, outFrame: 120 };
const DEFAULT_EVENT_ACTION = 'Trigger';
const DEFAULT_EVENT_CONDITION = 'Always';
const PROJECT_TIMELINES_FOLDER = '.carrots/cinematics';
const PROJECT_TIMELINE_FILE_EXTENSION = '.timeline.json';
const TIMELINE_FILE_FORMAT = 'carrots-cinematic-timeliner-v1';

const transformPropertyDefinitions = [
  {
    path: 'position.x',
    read: (value: TransformValue): number => value.position.x,
    write: (value: TransformValue, nextValue: number): void => {
      value.position.x = nextValue;
    },
  },
  {
    path: 'position.y',
    read: (value: TransformValue): number => value.position.y,
    write: (value: TransformValue, nextValue: number): void => {
      value.position.y = nextValue;
    },
  },
  {
    path: 'position.z',
    read: (value: TransformValue): number => value.position.z,
    write: (value: TransformValue, nextValue: number): void => {
      value.position.z = nextValue;
    },
  },
  {
    path: 'rotation.x',
    read: (value: TransformValue): number => value.rotation.x,
    write: (value: TransformValue, nextValue: number): void => {
      value.rotation.x = nextValue;
    },
  },
  {
    path: 'rotation.y',
    read: (value: TransformValue): number => value.rotation.y,
    write: (value: TransformValue, nextValue: number): void => {
      value.rotation.y = nextValue;
    },
  },
  {
    path: 'rotation.z',
    read: (value: TransformValue): number => value.rotation.z,
    write: (value: TransformValue, nextValue: number): void => {
      value.rotation.z = nextValue;
    },
  },
  {
    path: 'scale.x',
    read: (value: TransformValue): number => value.scale.x,
    write: (value: TransformValue, nextValue: number): void => {
      value.scale.x = nextValue;
    },
  },
  {
    path: 'scale.y',
    read: (value: TransformValue): number => value.scale.y,
    write: (value: TransformValue, nextValue: number): void => {
      value.scale.y = nextValue;
    },
  },
  {
    path: 'scale.z',
    read: (value: TransformValue): number => value.scale.z,
    write: (value: TransformValue, nextValue: number): void => {
      value.scale.z = nextValue;
    },
  },
];

const createDefaultTransformValue = (): TransformValue => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
});

const cloneTransformValue = (value: TransformValue): TransformValue => ({
  position: { ...value.position },
  rotation: { ...value.rotation },
  scale: { ...value.scale },
});

const clampNumber = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const clampInteger = (value: number, min: number, max: number): number =>
  Math.round(clampNumber(value, min, max));

const parseFiniteNumber = (
  value: string | number,
  fallbackValue: number
): number => {
  const parsedValue =
    typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const clampTimeScale = (value: string | number): number =>
  clampNumber(
    parseFiniteNumber(value, DEFAULT_TIME_SCALE),
    MIN_TIME_SCALE,
    MAX_TIME_SCALE
  );

const normalizeTransformValue = (value: any): TransformValue => {
  const fallbackValue = createDefaultTransformValue();
  if (!value || typeof value !== 'object') return fallbackValue;
  const asObject = value;
  return {
    position: {
      x: parseFiniteNumber(
        asObject.position && asObject.position.x,
        fallbackValue.position.x
      ),
      y: parseFiniteNumber(
        asObject.position && asObject.position.y,
        fallbackValue.position.y
      ),
      z: parseFiniteNumber(
        asObject.position && asObject.position.z,
        fallbackValue.position.z
      ),
    },
    rotation: {
      x: parseFiniteNumber(
        asObject.rotation && asObject.rotation.x,
        fallbackValue.rotation.x
      ),
      y: parseFiniteNumber(
        asObject.rotation && asObject.rotation.y,
        fallbackValue.rotation.y
      ),
      z: parseFiniteNumber(
        asObject.rotation && asObject.rotation.z,
        fallbackValue.rotation.z
      ),
    },
    scale: {
      x: parseFiniteNumber(
        asObject.scale && asObject.scale.x,
        fallbackValue.scale.x
      ),
      y: parseFiniteNumber(
        asObject.scale && asObject.scale.y,
        fallbackValue.scale.y
      ),
      z: parseFiniteNumber(
        asObject.scale && asObject.scale.z,
        fallbackValue.scale.z
      ),
    },
  };
};

const sortByTime = (
  values: Array<TimelinerLayerValue>
): Array<TimelinerLayerValue> => [...values].sort((a, b) => a.time - b.time);

const mapTweenToEasing = (tween: ?string): CinematicTimelineEasing => {
  if (tween === 'none' || tween === 'step') return 'step';
  if (
    tween === 'quadEaseIn' ||
    tween === 'quadEaseOut' ||
    tween === 'quadEaseInOut'
  ) {
    return tween;
  }
  return 'linear';
};

const mapEasingToTween = (easing: ?CinematicTimelineEasing): string => {
  if (easing === 'step' || easing === 'none') return 'none';
  if (
    easing === 'quadEaseIn' ||
    easing === 'quadEaseOut' ||
    easing === 'quadEaseInOut'
  ) {
    return easing;
  }
  return 'linear';
};

const easeProgress = (alpha: number, easing: CinematicTimelineEasing): number => {
  const clampedAlpha = clampNumber(alpha, 0, 1);
  if (easing === 'step' || easing === 'none') return 0;
  if (easing === 'quadEaseIn') return clampedAlpha * clampedAlpha;
  if (easing === 'quadEaseOut') return -clampedAlpha * (clampedAlpha - 2);
  if (easing === 'quadEaseInOut') {
    const doubleAlpha = clampedAlpha * 2;
    if (doubleAlpha < 1) return 0.5 * doubleAlpha * doubleAlpha;
    const normalized = doubleAlpha - 1;
    return -0.5 * (normalized * (normalized - 2) - 1);
  }
  return clampedAlpha;
};

const frameToSeconds = (frame: number, fps: number): number =>
  frame / Math.max(1, fps);

const secondsToFrame = (seconds: number, fps: number): number =>
  clampInteger(seconds * Math.max(1, fps), 0, TRACK_FRAME_LIMIT);

const randomColor = (): string =>
  `#${((Math.random() * 0xffffff) | 0).toString(16).padStart(6, '0')}`;

const makeLayerName = (
  targetId: string,
  objectName: string,
  propertyPath: string
): string => `[${targetId}] ${objectName}.${propertyPath}`;

const parseLayerName = (
  layerName: string
): ?{|
  targetId: string,
  objectName: string,
  propertyPath: string,
  trackType: 'transform',
|} => {
  const match = /^\[(.+?)\]\s+(.+)$/.exec(layerName);
  if (!match) return null;
  const targetId = match[1];
  const descriptor = match[2];
  for (const definition of transformPropertyDefinitions) {
    const suffix = `.${definition.path}`;
    if (descriptor.endsWith(suffix)) {
      return {
        targetId,
        objectName: descriptor.slice(0, descriptor.length - suffix.length),
        propertyPath: definition.path,
        trackType: 'transform',
      };
    }
  }
  return null;
};

const shortenTargetId = (targetId: string): string => {
  if (!targetId) return '';
  if (targetId.length <= 12) return targetId;
  return `${targetId.slice(0, 8)}...`;
};

const createRuntimeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const normalizeLoopRange = (
  rawLoopRange: any,
  durationFrames: number
): CinematicTimelineLoopRange => {
  const defaultOutFrame = clampInteger(
    Math.max(1, durationFrames) - 1,
    0,
    TRACK_FRAME_LIMIT
  );
  if (!rawLoopRange || typeof rawLoopRange !== 'object') {
    return {
      enabled: false,
      inFrame: 0,
      outFrame: defaultOutFrame,
    };
  }
  const inFrame = clampInteger(
    parseFiniteNumber(rawLoopRange.inFrame, 0),
    0,
    TRACK_FRAME_LIMIT
  );
  const outFrame = clampInteger(
    parseFiniteNumber(rawLoopRange.outFrame, defaultOutFrame),
    0,
    TRACK_FRAME_LIMIT
  );
  return {
    enabled: !!rawLoopRange.enabled,
    inFrame: Math.min(inFrame, outFrame),
    outFrame: Math.max(inFrame, outFrame),
  };
};

const normalizeShots = (
  rawShots: any,
  durationFrames: number
): Array<CinematicTimelineShot> => {
  if (!Array.isArray(rawShots)) return [];
  return rawShots
    .map((rawShot, index) => {
      if (!rawShot || typeof rawShot !== 'object') return null;
      const startFrame = clampInteger(
        parseFiniteNumber(rawShot.startFrame, 0),
        0,
        TRACK_FRAME_LIMIT
      );
      const maxEndFrame = Math.max(startFrame, durationFrames);
      const endFrame = clampInteger(
        parseFiniteNumber(rawShot.endFrame, maxEndFrame),
        startFrame,
        TRACK_FRAME_LIMIT
      );
      return {
        id:
          typeof rawShot.id === 'string' && rawShot.id
            ? rawShot.id
            : `shot-${index + 1}`,
        name:
          typeof rawShot.name === 'string' && rawShot.name
            ? rawShot.name
            : `Shot ${index + 1}`,
        startFrame,
        endFrame,
      };
    })
    .filter((shot): boolean => !!shot)
    .sort((a, b) => a.startFrame - b.startFrame);
};

const normalizeEvents = (
  rawEvents: any,
  durationFrames: number
): Array<CinematicTimelineEventMarker> => {
  if (!Array.isArray(rawEvents)) return [];
  return rawEvents
    .map((rawEvent, index) => {
      if (!rawEvent || typeof rawEvent !== 'object') return null;
      return {
        id:
          typeof rawEvent.id === 'string' && rawEvent.id
            ? rawEvent.id
            : `event-${index + 1}`,
        name:
          typeof rawEvent.name === 'string' && rawEvent.name
            ? rawEvent.name
            : `Event ${index + 1}`,
        action:
          typeof rawEvent.action === 'string' && rawEvent.action
            ? rawEvent.action
            : DEFAULT_EVENT_ACTION,
        condition:
          typeof rawEvent.condition === 'string' && rawEvent.condition
            ? rawEvent.condition
            : DEFAULT_EVENT_CONDITION,
        frame: clampInteger(
          parseFiniteNumber(rawEvent.frame, 0),
          0,
          Math.max(0, durationFrames)
        ),
        payload:
          typeof rawEvent.payload === 'string' ? rawEvent.payload : undefined,
      };
    })
    .filter((event): boolean => !!event)
    .sort((a, b) => a.frame - b.frame);
};

const getMetaObject = (data: TimelinerData): Object =>
  data && data.gdCinematicMeta && typeof data.gdCinematicMeta === 'object'
    ? data.gdCinematicMeta
    : {};

const getTrackSettingsByLayer = (data: TimelinerData): {
  [string]: TrackSettings,
} => {
  const metaObject = getMetaObject(data);
  const trackSettingsByLayer =
    metaObject.trackSettingsByLayer &&
    typeof metaObject.trackSettingsByLayer === 'object'
      ? metaObject.trackSettingsByLayer
      : {};
  return trackSettingsByLayer;
};

const applyTrackSettingsToLayers = (
  layers: Array<TimelinerLayer>,
  trackSettingsByLayer: { [string]: TrackSettings }
): Array<TimelinerLayer> =>
  layers.map(layer => {
    const settings = trackSettingsByLayer[layer.name] || {};
    return {
      ...layer,
      _mute: !!settings.muted,
      _solo: !!settings.solo,
    };
  });

const isTargetLocked = (
  data: TimelinerData,
  targetId: string
): boolean => {
  if (!targetId) return false;
  const layerNamePrefix = `[${targetId}] `;
  const trackSettingsByLayer = getTrackSettingsByLayer(data);
  return Object.keys(trackSettingsByLayer).some(
    layerName =>
      layerName.startsWith(layerNamePrefix) &&
      !!(trackSettingsByLayer[layerName] && trackSettingsByLayer[layerName].locked)
  );
};

const collectLayerGroups = (
  data: TimelinerData
): Array<{|
  id: string,
  targetId: string,
  objectName: string,
  trackType: 'transform',
  layerNames: Array<string>,
  keyframesCount: number,
  muted: boolean,
  solo: boolean,
  locked: boolean,
|}> => {
  const groupsById = new Map<
    string,
    {|
      id: string,
      targetId: string,
      objectName: string,
      trackType: 'transform',
      layerNames: Array<string>,
      keyframesCount: number,
      muted: boolean,
      solo: boolean,
      locked: boolean,
    |}
  >();
  const trackSettingsByLayer = getTrackSettingsByLayer(data);
  const layers = Array.isArray(data.layers) ? data.layers : [];
  layers.forEach(layer => {
    const parsedLayer = parseLayerName(layer.name);
    if (!parsedLayer) return;
    const groupId = `${parsedLayer.trackType}:${parsedLayer.targetId}:${parsedLayer.objectName}`;
    const layerSettings = trackSettingsByLayer[layer.name] || {};
    const keyframesCount = Array.isArray(layer.values) ? layer.values.length : 0;
    const existingGroup = groupsById.get(groupId);
    if (existingGroup) {
      existingGroup.layerNames.push(layer.name);
      existingGroup.keyframesCount += keyframesCount;
      existingGroup.muted = existingGroup.muted || !!layerSettings.muted;
      existingGroup.solo = existingGroup.solo || !!layerSettings.solo;
      existingGroup.locked = existingGroup.locked || !!layerSettings.locked;
      return;
    }
    groupsById.set(groupId, {
      id: groupId,
      targetId: parsedLayer.targetId,
      objectName: parsedLayer.objectName,
      trackType: parsedLayer.trackType,
      layerNames: [layer.name],
      keyframesCount,
      muted: !!layerSettings.muted,
      solo: !!layerSettings.solo,
      locked: !!layerSettings.locked,
    });
  });

  return Array.from(groupsById.values());
};

const buildDataWithDefaults = (
  data: TimelinerData,
  fps: number
): TimelinerData => {
  const safeFps = clampInteger(parseFiniteNumber(fps, DEFAULT_FPS), MIN_FPS, MAX_FPS);
  const totalTimeSeconds = clampNumber(
    parseFiniteNumber(data && data.ui && data.ui.totalTime, DEFAULT_DURATION_SECONDS),
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS
  );
  const durationFrames = clampInteger(
    Math.max(1, totalTimeSeconds * safeFps),
    1,
    TRACK_FRAME_LIMIT
  );
  const safeCurrentTime = clampNumber(
    parseFiniteNumber(data && data.ui && data.ui.currentTime, 0),
    0,
    totalTimeSeconds
  );
  const safeScrollTime = clampNumber(
    parseFiniteNumber(data && data.ui && data.ui.scrollTime, 0),
    0,
    totalTimeSeconds
  );
  const safeTimeScale = clampTimeScale(
    parseFiniteNumber(data && data.ui && data.ui.timeScale, DEFAULT_TIME_SCALE)
  );
  const metaObject = getMetaObject(data);
  const trackSettingsByLayer = getTrackSettingsByLayer(data);
  const normalizedLoopRange = normalizeLoopRange(metaObject.loopRange, durationFrames);
  const normalizedShots = normalizeShots(metaObject.shots, durationFrames);
  const normalizedEvents = normalizeEvents(metaObject.events, durationFrames);

  return {
    ...data,
    title:
      (metaObject.sceneName && String(metaObject.sceneName)) ||
      data.title ||
      'Cinematic',
    ui: {
      ...(data && data.ui ? data.ui : {}),
      currentTime: safeCurrentTime,
      totalTime: totalTimeSeconds,
      scrollTime: safeScrollTime,
      timeScale: safeTimeScale,
    },
    layers: applyTrackSettingsToLayers(
      Array.isArray(data.layers) ? data.layers : [],
      trackSettingsByLayer
    ),
    gdCinematicMeta: {
      ...metaObject,
      fps: safeFps,
      sceneName:
        (metaObject.sceneName && String(metaObject.sceneName)) ||
        data.title ||
        'Cinematic',
      loopRange: normalizedLoopRange,
      shots: normalizedShots,
      events: normalizedEvents,
      trackSettingsByLayer,
    },
  };
};

const hasKeyframeForTargetAtFrame = (
  data: TimelinerData,
  targetId: string,
  frame: number,
  fps: number
): boolean => {
  if (!data || !targetId) return false;
  const expectedTime = frameToSeconds(frame, fps);
  const layerNamePrefix = `[${targetId}] `;
  const layers = Array.isArray(data.layers) ? data.layers : [];
  return layers.some(layer => {
    if (!layer || typeof layer.name !== 'string') return false;
    if (!layer.name.startsWith(layerNamePrefix)) return false;
    const values = Array.isArray(layer.values) ? layer.values : [];
    return values.some(value => {
      const time = parseFiniteNumber(value && value.time, -1);
      return Math.abs(time - expectedTime) <= EPSILON;
    });
  });
};

const createEmptyTimelinerData = (sceneName: string): TimelinerData => ({
  version: '2.0.0-dev',
  modified: new Date().toISOString(),
  title: sceneName,
  ui: {
    currentTime: 0,
    totalTime: DEFAULT_DURATION_SECONDS,
    scrollTime: 0,
    timeScale: DEFAULT_TIME_SCALE,
  },
  layers: [],
  gdCinematicMeta: {
    fps: DEFAULT_FPS,
    sceneName,
    loopRange: {
      ...DEFAULT_LOOP_RANGE,
      outFrame: DEFAULT_DURATION_SECONDS * DEFAULT_FPS,
    },
    shots: [],
    events: [],
    trackSettingsByLayer: {},
  },
});

const evaluateChannelAtTime = (
  values: Array<TimelinerLayerValue>,
  timeInSeconds: number,
  fallbackValue: number
): number => {
  if (!values.length) return fallbackValue;
  const sortedValues = sortByTime(values);
  const firstValue = sortedValues[0];
  const lastValue = sortedValues[sortedValues.length - 1];
  if (timeInSeconds <= firstValue.time) return firstValue.value;
  if (timeInSeconds >= lastValue.time) return lastValue.value;

  for (let index = 0; index < sortedValues.length - 1; index++) {
    const from = sortedValues[index];
    const to = sortedValues[index + 1];
    if (Math.abs(timeInSeconds - from.time) <= EPSILON) return from.value;
    if (Math.abs(timeInSeconds - to.time) <= EPSILON) return to.value;
    if (timeInSeconds < from.time || timeInSeconds > to.time) continue;

    const easing = mapTweenToEasing(from.tween);
    if (easing === 'step' || easing === 'none') return from.value;

    const alpha = (timeInSeconds - from.time) / (to.time - from.time);
    const easedAlpha = easeProgress(alpha, easing);
    return from.value + (to.value - from.value) * easedAlpha;
  }

  return lastValue.value;
};

const findKeyframeEasingAtTime = (
  values: Array<TimelinerLayerValue>,
  timeInSeconds: number
): ?CinematicTimelineEasing => {
  for (const value of values) {
    if (Math.abs(value.time - timeInSeconds) <= EPSILON) {
      return mapTweenToEasing(value.tween);
    }
  }
  return null;
};

const timelinerDataToRuntimeScene = (
  data: TimelinerData,
  fps: number,
  sceneName: string
): CinematicScene => {
  const normalizedData = buildDataWithDefaults(data, fps);
  const safeFps = clampInteger(parseFiniteNumber(fps, DEFAULT_FPS), MIN_FPS, MAX_FPS);
  const durationSeconds = clampNumber(
    parseFiniteNumber(
      normalizedData && normalizedData.ui && normalizedData.ui.totalTime,
      DEFAULT_DURATION_SECONDS
    ),
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS
  );
  const durationFrames = clampInteger(
    durationSeconds * safeFps,
    1,
    TRACK_FRAME_LIMIT
  );

  const loopRange = normalizeLoopRange(
    normalizedData.gdCinematicMeta && normalizedData.gdCinematicMeta.loopRange,
    durationFrames
  );
  const shots = normalizeShots(
    normalizedData.gdCinematicMeta && normalizedData.gdCinematicMeta.shots,
    durationFrames
  );
  const events = normalizeEvents(
    normalizedData.gdCinematicMeta && normalizedData.gdCinematicMeta.events,
    durationFrames
  );
  const targetChannels = new Map<
    string,
    {|
      objectName: string,
      transformChannelsByPropertyPath: { [string]: Array<TimelinerLayerValue> },
    |}
  >();

  const layers = Array.isArray(normalizedData.layers) ? normalizedData.layers : [];
  layers.forEach(layer => {
    const parsedLayer = parseLayerName(layer.name);
    if (!parsedLayer) return;
    const { targetId, objectName, propertyPath, trackType } = parsedLayer;
    let targetChannel = targetChannels.get(targetId);
    if (!targetChannel) {
      targetChannel = {
        objectName,
        transformChannelsByPropertyPath: {},
      };
      targetChannels.set(targetId, targetChannel);
    }
    if (trackType !== 'transform') return;
    targetChannel.transformChannelsByPropertyPath[propertyPath] = sortByTime(
      Array.isArray(layer.values) ? layer.values : []
    );
  });

  const tracks: Array<Track> = [];
  let trackIndex = 0;
  targetChannels.forEach((targetChannel, targetId) => {
    const transformTimesSet = new Set<number>();
    transformPropertyDefinitions.forEach(({ path }) => {
      const channel = targetChannel.transformChannelsByPropertyPath[path];
      if (!channel || !channel.length) return;
      channel.forEach(value => {
        transformTimesSet.add(value.time);
      });
    });

    const transformTimes = Array.from(transformTimesSet.values()).sort(
      (a, b) => a - b
    );
    if (transformTimes.length) {
      const keyframesByFrame = new Map<number, Keyframe<TransformValue>>();
      transformTimes.forEach(timeInSeconds => {
        const transform = createDefaultTransformValue();
        transformPropertyDefinitions.forEach(definition => {
          const channel =
            targetChannel.transformChannelsByPropertyPath[definition.path] || [];
          definition.write(
            transform,
            evaluateChannelAtTime(
              channel,
              timeInSeconds,
              definition.read(createDefaultTransformValue())
            )
          );
        });

        let easing: CinematicTimelineEasing = 'linear';
        for (const definition of transformPropertyDefinitions) {
          const channel =
            targetChannel.transformChannelsByPropertyPath[definition.path] || [];
          const channelEasing = findKeyframeEasingAtTime(channel, timeInSeconds);
          if (channelEasing) {
            easing = channelEasing;
            break;
          }
        }

        const frame = clampInteger(timeInSeconds * safeFps, 0, durationFrames);
        keyframesByFrame.set(frame, {
          frame,
          easing,
          value: cloneTransformValue(transform),
        });
      });

      const keyframes = Array.from(keyframesByFrame.values()).sort(
        (a, b) => a.frame - b.frame
      );
      if (keyframes.length) {
        trackIndex++;
        tracks.push({
          id: `transform-track-${trackIndex}`,
          type: 'transform',
          name: targetChannel.objectName,
          targetId,
          keyframes,
        });
      }
    }

  });

  return {
    version: 1,
    name: sceneName,
    fps: safeFps,
    duration: durationFrames,
    tracks,
    loopRange,
    shots,
    events,
  };
};

const runtimeSceneToTimelinerData = (
  scene: any,
  fallbackSceneName: string
): {| data: TimelinerData, fps: number, sceneName: string |} => {
  const safeFps = clampInteger(
    parseFiniteNumber(scene && scene.fps, DEFAULT_FPS),
    MIN_FPS,
    MAX_FPS
  );
  const safeSceneName =
    scene && typeof scene.name === 'string' && scene.name
      ? scene.name
      : fallbackSceneName;
  const durationFrames = clampInteger(
    parseFiniteNumber(scene && scene.duration, DEFAULT_DURATION_SECONDS * safeFps),
    1,
    TRACK_FRAME_LIMIT
  );
  const durationSeconds = frameToSeconds(durationFrames, safeFps);

  const layers: Array<TimelinerLayer> = [];
  const tracks = Array.isArray(scene && scene.tracks) ? scene.tracks : [];
  tracks.forEach((track, trackIndex) => {
    if (!track || track.type !== 'transform') return;
    const targetId =
      typeof track.targetId === 'string' && track.targetId
        ? track.targetId
        : `target-${trackIndex + 1}`;
    const objectName =
      typeof track.name === 'string' && track.name
        ? track.name
        : targetId;
    const keyframes = Array.isArray(track.keyframes) ? track.keyframes : [];

    transformPropertyDefinitions.forEach(definition => {
      const values: Array<TimelinerLayerValue> = keyframes
        .map(keyframe => {
          const safeTransform = normalizeTransformValue(keyframe.value);
          return {
            time: frameToSeconds(
              clampInteger(
                parseFiniteNumber(keyframe.frame, 0),
                0,
                durationFrames
              ),
              safeFps
            ),
            value: parseFiniteNumber(
              definition.read(safeTransform),
              definition.read(createDefaultTransformValue())
            ),
            tween: mapEasingToTween(keyframe.easing),
            _color: randomColor(),
          };
        })
        .sort((a, b) => a.time - b.time);

      layers.push({
        name: makeLayerName(targetId, objectName, definition.path),
        values,
        _value: values.length ? values[values.length - 1].value : 0,
        _color: randomColor(),
      });
    });
  });

  const normalizedLoopRange = normalizeLoopRange(
    scene && scene.loopRange,
    durationFrames
  );
  const normalizedShots = normalizeShots(scene && scene.shots, durationFrames);
  const normalizedEvents = normalizeEvents(scene && scene.events, durationFrames);

  return {
    data: {
      version: '2.0.0-dev',
      modified: new Date().toISOString(),
      title: safeSceneName,
      ui: {
        currentTime: 0,
        totalTime: durationSeconds,
        scrollTime: 0,
        timeScale: DEFAULT_TIME_SCALE,
      },
      layers,
      gdCinematicMeta: {
        fps: safeFps,
        sceneName: safeSceneName,
        loopRange: normalizedLoopRange,
        shots: normalizedShots,
        events: normalizedEvents,
        trackSettingsByLayer: {},
      },
    },
    fps: safeFps,
    sceneName: safeSceneName,
  };
};

const isTimelinerData = (value: any): boolean =>
  !!value &&
  typeof value === 'object' &&
  value.ui &&
  typeof value.ui === 'object' &&
  Array.isArray(value.layers);

const isRuntimeCinematicScene = (value: any): boolean =>
  !!value &&
  typeof value === 'object' &&
  Array.isArray(value.tracks) &&
  Number.isFinite(parseFiniteNumber(value.fps, NaN));

const getProjectStorageVariable = (
  project: gdProject,
  createIfMissing: boolean
): any => {
  const variablesContainer = project.getVariables();
  if (!variablesContainer) return null;
  if (variablesContainer.has(PROJECT_STORAGE_VARIABLE)) {
    return variablesContainer.get(PROJECT_STORAGE_VARIABLE);
  }
  if (!createIfMissing) return null;
  return variablesContainer.insertNew(PROJECT_STORAGE_VARIABLE, 0);
};

const saveTimelinerDataToProject = (
  project: gdProject,
  data: TimelinerData,
  fps: number,
  sceneName: string
) => {
  const variable = getProjectStorageVariable(project, true);
  if (!variable) return;
  const normalizedData = buildDataWithDefaults(data, fps);
  const existingMeta =
    normalizedData.gdCinematicMeta &&
    typeof normalizedData.gdCinematicMeta === 'object'
      ? normalizedData.gdCinematicMeta
      : {};
  const normalizedTimelinerData = {
    ...normalizedData,
    title: sceneName,
    gdCinematicMeta: {
      ...existingMeta,
      fps,
      sceneName,
    },
  };
  const payload = {
    format: TIMELINE_FILE_FORMAT,
    sceneName,
    fps,
    savedAt: new Date().toISOString(),
    timelinerData: normalizedTimelinerData,
    runtimeScene: timelinerDataToRuntimeScene(
      normalizedTimelinerData,
      fps,
      sceneName
    ),
  };
  variable.setString(JSON.stringify(payload));
};

const loadTimelinerDataFromProject = (
  project: gdProject
): ?{| data: TimelinerData, fps: number, sceneName: string |} => {
  const defaultSceneName = `${project.getName()} Cinematic`;
  const variable = getProjectStorageVariable(project, false);
  if (!variable) return null;
  const rawString = variable.getString();
  if (!rawString || typeof rawString !== 'string') return null;

  try {
    const parsedValue = JSON.parse(rawString);
    const wrappedPayload =
      parsedValue &&
      typeof parsedValue === 'object' &&
      parsedValue.format === TIMELINE_FILE_FORMAT
        ? parsedValue
        : null;
    const wrappedTimelinerData =
      wrappedPayload && isTimelinerData(wrappedPayload.timelinerData)
        ? wrappedPayload.timelinerData
        : null;
    const wrappedRuntimeScene =
      wrappedPayload && isRuntimeCinematicScene(wrappedPayload.runtimeScene)
        ? wrappedPayload.runtimeScene
        : null;

    if (wrappedTimelinerData) {
      const wrappedFps = clampInteger(
        parseFiniteNumber(
          wrappedPayload && wrappedPayload.fps,
          parseFiniteNumber(
            wrappedTimelinerData.gdCinematicMeta &&
              wrappedTimelinerData.gdCinematicMeta.fps,
            DEFAULT_FPS
          )
        ),
        MIN_FPS,
        MAX_FPS
      );
      const parsedData = buildDataWithDefaults(wrappedTimelinerData, wrappedFps);
      return {
        data: parsedData,
        fps: wrappedFps,
        sceneName:
          (wrappedPayload &&
            typeof wrappedPayload.sceneName === 'string' &&
            wrappedPayload.sceneName) ||
          (parsedData.gdCinematicMeta &&
            parsedData.gdCinematicMeta.sceneName) ||
          parsedData.title ||
          defaultSceneName,
      };
    }

    if (wrappedRuntimeScene) {
      return runtimeSceneToTimelinerData(wrappedRuntimeScene, defaultSceneName);
    }

    if (isTimelinerData(parsedValue)) {
      const parsedData = buildDataWithDefaults(
        parsedValue,
        clampInteger(
          parseFiniteNumber(
            parsedValue.gdCinematicMeta && parsedValue.gdCinematicMeta.fps,
            DEFAULT_FPS
          ),
          MIN_FPS,
          MAX_FPS
        )
      );
      return {
        data: parsedData,
        fps: clampInteger(
          parseFiniteNumber(
            parsedData.gdCinematicMeta && parsedData.gdCinematicMeta.fps,
            DEFAULT_FPS
          ),
          MIN_FPS,
          MAX_FPS
        ),
        sceneName:
          (parsedData.gdCinematicMeta &&
            parsedData.gdCinematicMeta.sceneName) ||
          parsedData.title ||
          defaultSceneName,
      };
    }
    if (isRuntimeCinematicScene(parsedValue)) {
      return runtimeSceneToTimelinerData(parsedValue, defaultSceneName);
    }
  } catch (error) {
    console.warn('Invalid cinematic timeline JSON in project variable.', error);
  }
  return null;
};

const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

const toSafeFileNameSegment = (value: string): string => {
  const sanitized = (value || '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\r\n\t]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return sanitized || 'timeline';
};

const isLikelyLocalProjectFilePath = (projectFilePath: ?string): boolean => {
  if (!projectFilePath || typeof projectFilePath !== 'string') return false;
  const trimmedPath = projectFilePath.trim();
  if (!trimmedPath) return false;
  const hasPathSeparator =
    trimmedPath.includes('/') || trimmedPath.includes('\\');
  return hasPathSeparator && !!path;
};

const getProjectTimelineFilePath = (
  projectFilePath: ?string,
  sceneName: string
): ?string => {
  if (!path || !isLikelyLocalProjectFilePath(projectFilePath)) return null;
  const projectRootPath = path.dirname((projectFilePath: any));
  const timelinesDirectoryPath = path.join(
    projectRootPath,
    PROJECT_TIMELINES_FOLDER
  );
  const timelineFileName = `${toSafeFileNameSegment(
    sceneName
  )}${PROJECT_TIMELINE_FILE_EXTENSION}`;
  return path.join(timelinesDirectoryPath, timelineFileName);
};

const saveTimelinerDataToProjectFile = (
  projectFilePath: ?string,
  data: TimelinerData,
  fps: number,
  sceneName: string
): ?{| filePath: string, relativePath: string |} => {
  if (!fs || !path) return null;
  const resolvedFilePath = getProjectTimelineFilePath(projectFilePath, sceneName);
  if (!resolvedFilePath) return null;

  const projectRootPath = path.dirname((projectFilePath: any));
  const normalizedData = buildDataWithDefaults(data, fps);
  const payload = {
    format: TIMELINE_FILE_FORMAT,
    sceneName,
    fps,
    savedAt: new Date().toISOString(),
    timelinerData: normalizedData,
  };

  const targetDirectory = path.dirname(resolvedFilePath);
  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.writeFileSync(
    resolvedFilePath,
    JSON.stringify(payload, null, 2),
    'utf8'
  );
  return {
    filePath: resolvedFilePath,
    relativePath: path.relative(projectRootPath, resolvedFilePath),
  };
};

const loadTimelinerDataFromProjectFile = (
  projectFilePath: ?string,
  sceneName: string
): ?string => {
  if (!fs) return null;
  const resolvedFilePath = getProjectTimelineFilePath(projectFilePath, sceneName);
  if (!resolvedFilePath || !fs.existsSync(resolvedFilePath)) return null;
  return fs.readFileSync(resolvedFilePath, 'utf8');
};

const getSnapshotLayerEntries = (
  snapshot: ActiveObjectSnapshot
): Array<{| layerName: string, value: number |}> =>
  transformPropertyDefinitions.map(definition => ({
    layerName: makeLayerName(
      snapshot.targetId,
      snapshot.objectName,
      definition.path
    ),
    value: definition.read(snapshot.transform),
  }));

const shouldIgnoreKeyboardShortcut = (target: any): boolean => {
  if (!target) return false;
  const tagName =
    typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    !!target.isContentEditable
  );
};

const CinematicTimeline3DEditor = ({
  project,
  previewDebuggerServer,
  isActive,
  displayMode = 'tab',
  projectFilePath = null,
  onRequestClose,
  activeObjectSnapshot = null,
}: Props): React.Node => {
  const timelinerHostRef = React.useRef<?HTMLDivElement>(null);
  const timelinerRef = React.useRef<?any>(null);
  const resizeObserverRef = React.useRef<?ResizeObserver>(null);
  const latestDataRef = React.useRef<TimelinerData>(
    createEmptyTimelinerData(`${project.getName()} Cinematic`)
  );
  const previousAutoKeySnapshotRef = React.useRef<string>('');

  const isPlayingRef = React.useRef<boolean>(false);
  const autoSyncRef = React.useRef<boolean>(true);
  const autoKeyRef = React.useRef<boolean>(true);
  const fpsRef = React.useRef<number>(DEFAULT_FPS);
  const sceneNameRef = React.useRef<string>(`${project.getName()} Cinematic`);
  const loopRangeRef = React.useRef<CinematicTimelineLoopRange>({
    ...DEFAULT_LOOP_RANGE,
  });
  const shotsRef = React.useRef<Array<CinematicTimelineShot>>([]);
  const eventsRef = React.useRef<Array<CinematicTimelineEventMarker>>([]);
  const isActiveRef = React.useRef<boolean>(isActive);
  const previewDebuggerServerRef = React.useRef<?PreviewDebuggerServer>(
    previewDebuggerServer
  );

  const [fps, setFps] = React.useState<number>(DEFAULT_FPS);
  const [sceneName, setSceneName] = React.useState<string>(
    `${project.getName()} Cinematic`
  );
  const [durationSeconds, setDurationSeconds] = React.useState<number>(
    DEFAULT_DURATION_SECONDS
  );
  const [currentFrame, setCurrentFrame] = React.useState<number>(0);
  const [autoSync, setAutoSync] = React.useState<boolean>(true);
  const [autoKey, setAutoKey] = React.useState<boolean>(true);
  const [loopRange, setLoopRange] = React.useState<CinematicTimelineLoopRange>({
    ...DEFAULT_LOOP_RANGE,
  });
  const [shots, setShots] = React.useState<Array<CinematicTimelineShot>>([]);
  const [events, setEvents] = React.useState<Array<CinematicTimelineEventMarker>>(
    []
  );
  const [selectedTrackGroupId, setSelectedTrackGroupId] = React.useState<string>(
    ''
  );
  const [eventNameDraft, setEventNameDraft] = React.useState<string>('Cue');
  const [eventActionDraft, setEventActionDraft] = React.useState<string>(
    DEFAULT_EVENT_ACTION
  );
  const [eventConditionDraft, setEventConditionDraft] = React.useState<string>(
    DEFAULT_EVENT_CONDITION
  );
  const [eventPayloadDraft, setEventPayloadDraft] = React.useState<string>('');
  const [dataRevision, setDataRevision] = React.useState<number>(0);
  const [statusText, setStatusText] = React.useState<string>('Timeliner ready.');

  React.useEffect(
    () => {
      previewDebuggerServerRef.current = previewDebuggerServer;
    },
    [previewDebuggerServer]
  );
  React.useEffect(
    () => {
      isActiveRef.current = isActive;
    },
    [isActive]
  );
  React.useEffect(
    () => {
      fpsRef.current = fps;
    },
    [fps]
  );
  React.useEffect(
    () => {
      sceneNameRef.current = sceneName;
    },
    [sceneName]
  );
  React.useEffect(
    () => {
      autoSyncRef.current = autoSync;
    },
    [autoSync]
  );
  React.useEffect(
    () => {
      autoKeyRef.current = autoKey;
    },
    [autoKey]
  );
  React.useEffect(
    () => {
      loopRangeRef.current = loopRange;
    },
    [loopRange]
  );
  React.useEffect(
    () => {
      shotsRef.current = shots;
    },
    [shots]
  );
  React.useEffect(
    () => {
      eventsRef.current = events;
    },
    [events]
  );

  const buildRuntimeScene = React.useCallback((): CinematicScene => {
    return timelinerDataToRuntimeScene(
      latestDataRef.current,
      fpsRef.current,
      sceneNameRef.current
    );
  }, []);

  const sendRuntimeCommand = React.useCallback(
    (command: string, payload: Object): boolean => {
      const debuggerServer = previewDebuggerServerRef.current;
      if (!debuggerServer) {
        setStatusText('Preview debugger is not available.');
        return false;
      }
      const debuggerIds = debuggerServer.getExistingDebuggerIds();
      if (!debuggerIds.length) {
        setStatusText('No runtime connected. Open embedded game or preview first.');
        return false;
      }

      debuggerIds.forEach(debuggerId => {
        debuggerServer.sendMessage(debuggerId, {
          command,
          payload,
          source: 'cinematic-timeline-3d',
        });
      });
      return true;
    },
    []
  );

  const sendCurrentFrameToRuntime = React.useCallback(
    (scene: CinematicScene, frame: number): void => {
      sendRuntimeCommand('cinematicTimeline.setFrame', {
        scene,
        frame,
        fps: scene.fps,
        duration: scene.duration,
        loopPlayback: true,
      });
    },
    [sendRuntimeCommand]
  );

  const captureSelectedTransform = React.useCallback(
    (snapshot: ?ActiveObjectSnapshot, source: string) => {
      const timeliner = timelinerRef.current;
      if (!timeliner) return;
      if (!snapshot) {
        if (source === 'manual') {
          const currentTrackGroups = collectLayerGroups(latestDataRef.current);
          const selectedGroup =
            currentTrackGroups.find(group => group.id === selectedTrackGroupId) ||
            currentTrackGroups[0] ||
            null;
          if (!selectedGroup) {
            setStatusText('Select an object in the 3D editor first.');
            return;
          }
          if (isTargetLocked(latestDataRef.current, selectedGroup.targetId)) {
            setStatusText(`"${selectedGroup.objectName}" track is locked.`);
            return;
          }
          const selectedLayerNames = new Set(selectedGroup.layerNames);
          const currentTime = timeliner.getCurrentTime();
          const layers = Array.isArray(latestDataRef.current.layers)
            ? latestDataRef.current.layers
            : [];
          let insertedLayerCount = 0;
          layers.forEach(layer => {
            if (!selectedLayerNames.has(layer.name)) return;
            const values = sortByTime(Array.isArray(layer.values) ? layer.values : []);
            const fallbackValue = parseFiniteNumber(layer._value, 0);
            const valueAtCurrentTime = evaluateChannelAtTime(
              values,
              currentTime,
              fallbackValue
            );
            timeliner.ensureLayer(layer.name);
            timeliner.setLayerValueAtCurrentTime(layer.name, valueAtCurrentTime);
            insertedLayerCount++;
          });
          if (!insertedLayerCount) {
            setStatusText('Select an object in the 3D editor first.');
            return;
          }
          setStatusText(
            `Added keyframe on "${selectedGroup.objectName}" at frame ${secondsToFrame(
              currentTime,
              fpsRef.current
            )}.`
          );
          if (autoSyncRef.current && !isPlayingRef.current && isActiveRef.current) {
            const scene = buildRuntimeScene();
            sendCurrentFrameToRuntime(
              scene,
              secondsToFrame(currentTime, scene.fps)
            );
          }
        }
        return;
      }
      if (isTargetLocked(latestDataRef.current, snapshot.targetId)) {
        if (source === 'manual') {
          setStatusText(`"${snapshot.objectName}" track is locked.`);
        }
        return;
      }

      const layerEntries = getSnapshotLayerEntries(snapshot);
      layerEntries.forEach(entry => {
        timeliner.ensureLayer(entry.layerName);
      });
      layerEntries.forEach(entry => {
        timeliner.setLayerValueAtCurrentTime(entry.layerName, entry.value);
      });
      setStatusText(
        `Captured ${snapshot.objectName} at frame ${secondsToFrame(
          timeliner.getCurrentTime(),
          fpsRef.current
        )}.`
      );

      if (autoSyncRef.current && !isPlayingRef.current && isActiveRef.current) {
        const scene = buildRuntimeScene();
        sendCurrentFrameToRuntime(
          scene,
          secondsToFrame(timeliner.getCurrentTime(), scene.fps)
        );
      }
    },
    [buildRuntimeScene, selectedTrackGroupId, sendCurrentFrameToRuntime]
  );

  React.useEffect(
    () => {
      const timeliner = timelinerRef.current;
      if (!timeliner || !activeObjectSnapshot) return;
      const serializedSnapshot = JSON.stringify({
        targetId: activeObjectSnapshot.targetId,
        transform: activeObjectSnapshot.transform,
      });
      if (previousAutoKeySnapshotRef.current === serializedSnapshot) return;
      previousAutoKeySnapshotRef.current = serializedSnapshot;
      if (!autoKeyRef.current) return;
      captureSelectedTransform(activeObjectSnapshot, 'auto');
    },
    [activeObjectSnapshot, captureSelectedTransform]
  );

  const applyTimelinerData = React.useCallback(
    (nextData: TimelinerData, options?: {| showStatus?: boolean |}) => {
      const timeliner = timelinerRef.current;
      if (!timeliner) return;
      const mergedData = buildDataWithDefaults(
        {
          ...latestDataRef.current,
          ...nextData,
          gdCinematicMeta: {
            ...getMetaObject(latestDataRef.current),
            ...getMetaObject(nextData),
            fps: fpsRef.current,
            sceneName: sceneNameRef.current,
          },
        },
        fpsRef.current
      );
      timeliner.load(mergedData);
      latestDataRef.current = buildDataWithDefaults(
        {
          ...timeliner.getData(),
          gdCinematicMeta: {
            ...getMetaObject(mergedData),
            ...getMetaObject(timeliner.getData()),
            fps: fpsRef.current,
            sceneName: sceneNameRef.current,
          },
        },
        fpsRef.current
      );
      const totalTime = clampNumber(
        parseFiniteNumber(
          latestDataRef.current.ui && latestDataRef.current.ui.totalTime,
          DEFAULT_DURATION_SECONDS
        ),
        MIN_DURATION_SECONDS,
        MAX_DURATION_SECONDS
      );
      setDurationSeconds(totalTime);
      const currentTimeInSeconds = parseFiniteNumber(
        latestDataRef.current.ui && latestDataRef.current.ui.currentTime,
        0
      );
      const metaObject = getMetaObject(latestDataRef.current);
      const durationFrames = clampInteger(
        Math.max(1, totalTime * fpsRef.current),
        1,
        TRACK_FRAME_LIMIT
      );
      const nextLoopRange = normalizeLoopRange(metaObject.loopRange, durationFrames);
      const nextShots = normalizeShots(metaObject.shots, durationFrames);
      const nextEvents = normalizeEvents(metaObject.events, durationFrames);
      setCurrentFrame(secondsToFrame(currentTimeInSeconds, fpsRef.current));
      setLoopRange(nextLoopRange);
      loopRangeRef.current = nextLoopRange;
      setShots(nextShots);
      shotsRef.current = nextShots;
      setEvents(nextEvents);
      eventsRef.current = nextEvents;
      setDataRevision(previousValue => previousValue + 1);

      saveTimelinerDataToProject(
        project,
        latestDataRef.current,
        fpsRef.current,
        sceneNameRef.current
      );
      if (options && options.showStatus) {
        setStatusText('Timeline data loaded.');
      }
    },
    [project]
  );

  const trackGroups = React.useMemo(
    () => {
      // Recompute from mutable timeline data whenever revision changes.
      if (dataRevision < 0) return [];
      return collectLayerGroups(latestDataRef.current);
    },
    [dataRevision]
  );

  React.useEffect(
    () => {
      if (!trackGroups.length) {
        if (selectedTrackGroupId) setSelectedTrackGroupId('');
        return;
      }
      const hasCurrentSelectedGroup = trackGroups.some(
        group => group.id === selectedTrackGroupId
      );
      if (hasCurrentSelectedGroup) return;

      if (activeObjectSnapshot) {
        const preferredGroup = trackGroups.find(
          group => group.targetId === activeObjectSnapshot.targetId
        );
        if (preferredGroup) {
          setSelectedTrackGroupId(preferredGroup.id);
          return;
        }
      }

      setSelectedTrackGroupId(trackGroups[0].id);
    },
    [trackGroups, selectedTrackGroupId, activeObjectSnapshot]
  );

  React.useEffect(
    () => {
      const hostElement = timelinerHostRef.current;
      if (!hostElement || timelinerRef.current) return;

      const loaded = loadTimelinerDataFromProject(project);
      const initialSceneName = loaded
        ? loaded.sceneName
        : `${project.getName()} Cinematic`;
      const initialFps = loaded ? loaded.fps : DEFAULT_FPS;
      const initialData = loaded
        ? loaded.data
        : createEmptyTimelinerData(initialSceneName);

      setSceneName(initialSceneName);
      sceneNameRef.current = initialSceneName;
      setFps(initialFps);
      fpsRef.current = initialFps;

      const timeliner = new Timeliner(
        {},
        {
          container: hostElement,
          isEmbedded: true,
          compactEmbeddedControls: true,
          disableGlobalKeybindings: true,
          onDataChanged: (data: TimelinerData) => {
            latestDataRef.current = buildDataWithDefaults(
              {
                ...data,
                gdCinematicMeta: {
                  ...getMetaObject(latestDataRef.current),
                  ...getMetaObject(data),
                  fps: fpsRef.current,
                  sceneName: sceneNameRef.current,
                },
              },
              fpsRef.current
            );
            const totalTime = clampNumber(
              parseFiniteNumber(
                data.ui && data.ui.totalTime,
                DEFAULT_DURATION_SECONDS
              ),
              MIN_DURATION_SECONDS,
              MAX_DURATION_SECONDS
            );
            const durationFrames = clampInteger(
              Math.max(1, totalTime * fpsRef.current),
              1,
              TRACK_FRAME_LIMIT
            );
            const metaObject = getMetaObject(latestDataRef.current);
            const nextLoopRange = normalizeLoopRange(
              metaObject.loopRange,
              durationFrames
            );
            const nextShots = normalizeShots(metaObject.shots, durationFrames);
            const nextEvents = normalizeEvents(metaObject.events, durationFrames);
            setDurationSeconds(totalTime);
            setLoopRange(nextLoopRange);
            loopRangeRef.current = nextLoopRange;
            setShots(nextShots);
            shotsRef.current = nextShots;
            setEvents(nextEvents);
            eventsRef.current = nextEvents;
            setDataRevision(previousValue => previousValue + 1);
            saveTimelinerDataToProject(
              project,
              latestDataRef.current,
              fpsRef.current,
              sceneNameRef.current
            );
          },
          onTimeChanged: (seconds: number) => {
            let frame = secondsToFrame(seconds, fpsRef.current);
            const currentLoopRange = loopRangeRef.current;
            if (
              isPlayingRef.current &&
              currentLoopRange.enabled &&
              frame > currentLoopRange.outFrame
            ) {
              frame = currentLoopRange.inFrame;
              if (timelinerRef.current) {
                timelinerRef.current.setCurrentTime(
                  frameToSeconds(frame, fpsRef.current)
                );
              }
            }
            setCurrentFrame(frame);
            if (
              !autoSyncRef.current ||
              isPlayingRef.current ||
              !isActiveRef.current
            ) {
              return;
            }
            sendCurrentFrameToRuntime(buildRuntimeScene(), frame);
          },
          onPlaybackChanged: (isPlaying: boolean) => {
            isPlayingRef.current = isPlaying;
            if (!isActiveRef.current) return;
            const scene = buildRuntimeScene();
            const frame = timelinerRef.current
              ? secondsToFrame(timelinerRef.current.getCurrentTime(), scene.fps)
              : 0;
            const shouldLoopRange = loopRangeRef.current.enabled;
            setCurrentFrame(frame);
            if (isPlaying) {
              sendRuntimeCommand('cinematicTimeline.play', {
                scene,
                frame,
                fps: scene.fps,
                duration: scene.duration,
                loopPlayback: shouldLoopRange,
                startFrame: shouldLoopRange ? loopRangeRef.current.inFrame : 0,
                endFrame: shouldLoopRange
                  ? loopRangeRef.current.outFrame
                  : scene.duration,
              });
            } else {
              sendRuntimeCommand('cinematicTimeline.pause', {
                scene,
                frame,
                fps: scene.fps,
                duration: scene.duration,
                loopPlayback: shouldLoopRange,
                startFrame: shouldLoopRange ? loopRangeRef.current.inFrame : 0,
                endFrame: shouldLoopRange
                  ? loopRangeRef.current.outFrame
                  : scene.duration,
              });
            }
          },
        }
      );

      timelinerRef.current = timeliner;
      const resizeTimelinerToHost = () => {
        if (!timelinerRef.current || !timelinerHostRef.current) return;
        const nextWidth = Math.max(
          320,
          Math.round(
            timelinerHostRef.current.clientWidth ||
              timelinerHostRef.current.offsetWidth ||
              0
          )
        );
        const nextHeight = Math.max(
          120,
          Math.round(
            timelinerHostRef.current.clientHeight ||
              timelinerHostRef.current.offsetHeight ||
              0
          )
        );
        timelinerRef.current.resize(nextWidth, nextHeight);
      };
      resizeTimelinerToHost();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          resizeTimelinerToHost();
        });
      }
      applyTimelinerData(initialData);
      setStatusText(loaded ? 'Timeline loaded from project.' : 'Timeline initialized.');

      let fallbackResizeHandler = null;
      if (window.ResizeObserver) {
        const observer = new window.ResizeObserver(entries => {
          const entry = entries && entries[0];
          if (!entry || !timelinerRef.current) return;
          const bounds = entry.contentRect;
          timelinerRef.current.resize(
            Math.max(320, Math.round(bounds.width || 0)),
            Math.max(120, Math.round(bounds.height || 0))
          );
        });
        observer.observe(hostElement);
        resizeObserverRef.current = observer;
      } else {
        fallbackResizeHandler = () => {
          resizeTimelinerToHost();
        };
        window.addEventListener('resize', fallbackResizeHandler);
      }

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (fallbackResizeHandler) {
          window.removeEventListener('resize', fallbackResizeHandler);
        }
        if (timelinerRef.current) {
          timelinerRef.current.dispose();
          timelinerRef.current = null;
        }
      };
    },
    [
      applyTimelinerData,
      buildRuntimeScene,
      project,
      sendCurrentFrameToRuntime,
      sendRuntimeCommand,
    ]
  );

  const onAddSelectedObjectLayers = React.useCallback(() => {
    const timeliner = timelinerRef.current;
    if (!timeliner) return;
    const snapshot = activeObjectSnapshot;
    if (!snapshot) {
      setStatusText('Select an object in the 3D editor first.');
      return;
    }
    if (isTargetLocked(latestDataRef.current, snapshot.targetId)) {
      setStatusText(`"${snapshot.objectName}" track is locked.`);
      return;
    }
    const layerEntries = getSnapshotLayerEntries(snapshot);
    layerEntries.forEach(entry => {
      timeliner.ensureLayer(entry.layerName);
    });
    layerEntries.forEach(entry => {
      timeliner.setLayerValueAtCurrentTime(entry.layerName, entry.value);
    });
    setStatusText(
      `Tracking "${snapshot.objectName}" and inserted keyframe at frame ${secondsToFrame(
        timeliner.getCurrentTime(),
        fpsRef.current
      )}.`
    );
  }, [activeObjectSnapshot]);

  const mutateTimelineData = React.useCallback(
    (
      mutate: (data: TimelinerData) => void,
      statusMessage?: string
    ): void => {
      const baseData = buildDataWithDefaults(latestDataRef.current, fpsRef.current);
      const mutableData = JSON.parse(JSON.stringify(baseData));
      mutate(mutableData);
      const nextData = buildDataWithDefaults(mutableData, fpsRef.current);
      applyTimelinerData(nextData);
      if (statusMessage) setStatusText(statusMessage);
    },
    [applyTimelinerData]
  );

  const getSelectedTrackGroup = React.useCallback(
    () => trackGroups.find(group => group.id === selectedTrackGroupId) || null,
    [trackGroups, selectedTrackGroupId]
  );

  const onJumpToSelectedTrack = React.useCallback(() => {
    const selectedTrackGroup = getSelectedTrackGroup();
    const timeliner = timelinerRef.current;
    if (!selectedTrackGroup || !timeliner) return;
    const selectedLayerNames = new Set(selectedTrackGroup.layerNames);
    const layers = Array.isArray(latestDataRef.current.layers)
      ? latestDataRef.current.layers
      : [];
    let firstTime = Number.POSITIVE_INFINITY;
    layers.forEach(layer => {
      if (!selectedLayerNames.has(layer.name)) return;
      const values = Array.isArray(layer.values) ? layer.values : [];
      values.forEach(value => {
        const keyTime = parseFiniteNumber(value.time, Number.NaN);
        if (!Number.isFinite(keyTime)) return;
        firstTime = Math.min(firstTime, keyTime);
      });
    });
    if (!Number.isFinite(firstTime)) {
      setStatusText('Selected track has no keyframes.');
      return;
    }
    timeliner.setCurrentTime(firstTime);
    setCurrentFrame(secondsToFrame(firstTime, fpsRef.current));
    setStatusText(`Jumped to "${selectedTrackGroup.objectName}".`);
  }, [getSelectedTrackGroup]);

  const setTrackGroupFlag = React.useCallback(
    (flag: 'muted' | 'solo' | 'locked', enabled: boolean): void => {
      const selectedTrackGroup = getSelectedTrackGroup();
      if (!selectedTrackGroup) return;
      mutateTimelineData(data => {
        const metaObject = getMetaObject(data);
        const trackSettingsByLayer = {
          ...(getTrackSettingsByLayer(data): Object),
        };

        if (flag === 'solo' && enabled) {
          Object.keys(trackSettingsByLayer).forEach(layerName => {
            trackSettingsByLayer[layerName] = {
              ...(trackSettingsByLayer[layerName] || {}),
              solo: false,
            };
          });
        }

        selectedTrackGroup.layerNames.forEach(layerName => {
          trackSettingsByLayer[layerName] = {
            ...(trackSettingsByLayer[layerName] || {}),
            [flag]: enabled,
          };
        });

        data.gdCinematicMeta = {
          ...metaObject,
          trackSettingsByLayer,
        };
      });
      setStatusText(
        `${selectedTrackGroup.objectName} ${
          enabled ? `${flag} enabled` : `${flag} disabled`
        }.`
      );
    },
    [getSelectedTrackGroup, mutateTimelineData]
  );

  const onRemoveSelectedTrackGroup = React.useCallback(() => {
    const selectedTrackGroup = getSelectedTrackGroup();
    if (!selectedTrackGroup) return;
    mutateTimelineData(data => {
      const selectedLayerNames = new Set(selectedTrackGroup.layerNames);
      data.layers = (Array.isArray(data.layers) ? data.layers : []).filter(
        layer => !selectedLayerNames.has(layer.name)
      );
      const metaObject = getMetaObject(data);
      const trackSettingsByLayer = getTrackSettingsByLayer(data);
      selectedTrackGroup.layerNames.forEach(layerName => {
        delete trackSettingsByLayer[layerName];
      });
      data.gdCinematicMeta = {
        ...metaObject,
        trackSettingsByLayer,
      };
    });
    setStatusText(`Removed "${selectedTrackGroup.objectName}" track.`);
  }, [getSelectedTrackGroup, mutateTimelineData]);

  const onDeleteKeyframeAtCurrentFrame = React.useCallback(() => {
    const selectedTrackGroup = getSelectedTrackGroup();
    if (!selectedTrackGroup) return;
    const targetTime = frameToSeconds(currentFrame, fpsRef.current);
    mutateTimelineData(data => {
      const selectedLayerNames = new Set(selectedTrackGroup.layerNames);
      data.layers = (Array.isArray(data.layers) ? data.layers : []).map(layer => {
        if (!selectedLayerNames.has(layer.name)) return layer;
        return {
          ...layer,
          values: (Array.isArray(layer.values) ? layer.values : []).filter(
            value =>
              Math.abs(parseFiniteNumber(value.time, -1) - targetTime) > EPSILON
          ),
        };
      });
    });
    setStatusText(`Deleted keyframe at frame ${currentFrame}.`);
  }, [currentFrame, getSelectedTrackGroup, mutateTimelineData]);

  const onDuplicateKeyframeAtCurrentFrame = React.useCallback(() => {
    const selectedTrackGroup = getSelectedTrackGroup();
    if (!selectedTrackGroup) return;
    const sourceTime = frameToSeconds(currentFrame, fpsRef.current);
    const targetFrame = clampInteger(currentFrame + 1, 0, TRACK_FRAME_LIMIT);
    const targetTime = frameToSeconds(targetFrame, fpsRef.current);
    mutateTimelineData(data => {
      const selectedLayerNames = new Set(selectedTrackGroup.layerNames);
      data.layers = (Array.isArray(data.layers) ? data.layers : []).map(layer => {
        if (!selectedLayerNames.has(layer.name)) return layer;
        const sortedValues = sortByTime(Array.isArray(layer.values) ? layer.values : []);
        if (!sortedValues.length) return layer;
        const sourceMatch = sortedValues.find(
          value => Math.abs(parseFiniteNumber(value.time, -1) - sourceTime) <= EPSILON
        );
        const copiedValue = sourceMatch
          ? parseFiniteNumber(sourceMatch.value, 0)
          : evaluateChannelAtTime(sortedValues, sourceTime, 0);
        const nextValues = sortedValues.filter(
          value => Math.abs(parseFiniteNumber(value.time, -1) - targetTime) > EPSILON
        );
        nextValues.push({
          time: targetTime,
          value: copiedValue,
          tween: sourceMatch ? sourceMatch.tween : 'linear',
          _color: sourceMatch && sourceMatch._color ? sourceMatch._color : randomColor(),
        });
        return {
          ...layer,
          values: sortByTime(nextValues),
        };
      });
    });
    setStatusText(`Duplicated keyframe to frame ${targetFrame}.`);
  }, [currentFrame, getSelectedTrackGroup, mutateTimelineData]);

  const onNudgeCurrentFrame = React.useCallback(
    (delta: -1 | 1) => {
      const timeliner = timelinerRef.current;
      if (!timeliner) return;
      const nextFrame = clampInteger(currentFrame + delta, 0, TRACK_FRAME_LIMIT);
      timeliner.setCurrentTime(frameToSeconds(nextFrame, fpsRef.current));
      setCurrentFrame(nextFrame);
      if (autoSyncRef.current && isActiveRef.current) {
        sendCurrentFrameToRuntime(buildRuntimeScene(), nextFrame);
      }
    },
    [buildRuntimeScene, currentFrame, sendCurrentFrameToRuntime]
  );

  const onUpdateLoopRange = React.useCallback(
    (partialLoopRange: $Shape<CinematicTimelineLoopRange>) => {
      const durationFrames = clampInteger(
        Math.max(1, durationSeconds * fpsRef.current),
        1,
        TRACK_FRAME_LIMIT
      );
      const nextLoopRange = normalizeLoopRange(
        {
          ...loopRangeRef.current,
          ...partialLoopRange,
        },
        durationFrames
      );
      mutateTimelineData(data => {
        const metaObject = getMetaObject(data);
        data.gdCinematicMeta = {
          ...metaObject,
          loopRange: nextLoopRange,
        };
      });
      setLoopRange(nextLoopRange);
      loopRangeRef.current = nextLoopRange;
    },
    [durationSeconds, mutateTimelineData]
  );

  const onAddShotFromLoopRange = React.useCallback(() => {
    const nextShot: CinematicTimelineShot = {
      id: createRuntimeId('shot'),
      name: `Shot ${shotsRef.current.length + 1}`,
      startFrame: loopRangeRef.current.inFrame,
      endFrame: loopRangeRef.current.outFrame,
    };
    mutateTimelineData(data => {
      const metaObject = getMetaObject(data);
      const nextShots = normalizeShots(
        [...normalizeShots(metaObject.shots, TRACK_FRAME_LIMIT), nextShot],
        TRACK_FRAME_LIMIT
      );
      data.gdCinematicMeta = {
        ...metaObject,
        shots: nextShots,
      };
    });
    setStatusText(`Added ${nextShot.name}.`);
  }, [mutateTimelineData]);

  const onJumpToShot = React.useCallback(
    (shot: CinematicTimelineShot) => {
      const timeliner = timelinerRef.current;
      if (!timeliner) return;
      timeliner.setCurrentTime(frameToSeconds(shot.startFrame, fpsRef.current));
      setCurrentFrame(shot.startFrame);
      setStatusText(`Jumped to ${shot.name}.`);
    },
    []
  );

  const onRemoveShot = React.useCallback(
    (shotId: string) => {
      mutateTimelineData(data => {
        const metaObject = getMetaObject(data);
        const nextShots = normalizeShots(metaObject.shots, TRACK_FRAME_LIMIT).filter(
          shot => shot.id !== shotId
        );
        data.gdCinematicMeta = {
          ...metaObject,
          shots: nextShots,
        };
      });
    },
    [mutateTimelineData]
  );

  const onAddEventMarker = React.useCallback(() => {
    const nextMarker: CinematicTimelineEventMarker = {
      id: createRuntimeId('evt'),
      name: eventNameDraft || `Event ${eventsRef.current.length + 1}`,
      action: eventActionDraft || DEFAULT_EVENT_ACTION,
      condition: eventConditionDraft || DEFAULT_EVENT_CONDITION,
      frame: currentFrame,
      payload: eventPayloadDraft || undefined,
    };
    mutateTimelineData(data => {
      const metaObject = getMetaObject(data);
      const nextEvents = normalizeEvents(
        [...normalizeEvents(metaObject.events, TRACK_FRAME_LIMIT), nextMarker],
        TRACK_FRAME_LIMIT
      );
      data.gdCinematicMeta = {
        ...metaObject,
        events: nextEvents,
      };
    });
    setStatusText(`Added event "${nextMarker.name}" at frame ${currentFrame}.`);
  }, [
    currentFrame,
    eventActionDraft,
    eventConditionDraft,
    eventNameDraft,
    eventPayloadDraft,
    mutateTimelineData,
  ]);

  const onRemoveEventMarker = React.useCallback(
    (eventId: string) => {
      mutateTimelineData(data => {
        const metaObject = getMetaObject(data);
        const nextEvents = normalizeEvents(metaObject.events, TRACK_FRAME_LIMIT).filter(
          event => event.id !== eventId
        );
        data.gdCinematicMeta = {
          ...metaObject,
          events: nextEvents,
        };
      });
    },
    [mutateTimelineData]
  );

  const onJumpToEventMarker = React.useCallback((eventMarker: CinematicTimelineEventMarker) => {
    const timeliner = timelinerRef.current;
    if (!timeliner) return;
    const seconds = frameToSeconds(eventMarker.frame, fpsRef.current);
    timeliner.setCurrentTime(seconds);
    setCurrentFrame(eventMarker.frame);
    setStatusText(`Jumped to event "${eventMarker.name}".`);
  }, []);

  const onCaptureSelectedTransform = React.useCallback(() => {
    captureSelectedTransform(activeObjectSnapshot || null, 'manual');
  }, [activeObjectSnapshot, captureSelectedTransform]);

  const onPlayPreview = React.useCallback(() => {
    const timeliner = timelinerRef.current;
    if (!timeliner) return;
    timeliner.play();
  }, []);

  const onPlayShot = React.useCallback(
    (shot: CinematicTimelineShot) => {
      const timeliner = timelinerRef.current;
      if (!timeliner) return;
      timeliner.setCurrentTime(frameToSeconds(shot.startFrame, fpsRef.current));
      setCurrentFrame(shot.startFrame);
      const scene = buildRuntimeScene();
      sendRuntimeCommand('cinematicTimeline.playShot', {
        scene,
        shotId: shot.id,
        frame: shot.startFrame,
        loopPlayback: false,
      });
      timeliner.play();
      setStatusText(`Playing ${shot.name}.`);
    },
    [buildRuntimeScene, sendRuntimeCommand]
  );

  const onPausePreview = React.useCallback(() => {
    const timeliner = timelinerRef.current;
    if (!timeliner) return;
    timeliner.pause();
    const scene = buildRuntimeScene();
    sendRuntimeCommand('cinematicTimeline.pause', {
      scene,
      frame: secondsToFrame(timeliner.getCurrentTime(), scene.fps),
      fps: scene.fps,
      duration: scene.duration,
      loopPlayback: loopRangeRef.current.enabled,
      startFrame: loopRangeRef.current.enabled ? loopRangeRef.current.inFrame : 0,
      endFrame: loopRangeRef.current.enabled
        ? loopRangeRef.current.outFrame
        : scene.duration,
    });
  }, [buildRuntimeScene, sendRuntimeCommand]);

  const onStopPreview = React.useCallback(() => {
    const timeliner = timelinerRef.current;
    if (!timeliner) return;
    timeliner.stop();
    const scene = buildRuntimeScene();
    sendRuntimeCommand('cinematicTimeline.stop', {
      scene,
      frame: 0,
      fps: scene.fps,
      duration: scene.duration,
      loopPlayback: loopRangeRef.current.enabled,
      startFrame: loopRangeRef.current.enabled ? loopRangeRef.current.inFrame : 0,
      endFrame: loopRangeRef.current.enabled
        ? loopRangeRef.current.outFrame
        : scene.duration,
    });
  }, [buildRuntimeScene, sendRuntimeCommand]);

  const onSendCurrentFrame = React.useCallback(() => {
    const timeliner = timelinerRef.current;
    if (!timeliner) return;
    const scene = buildRuntimeScene();
    const frame = secondsToFrame(timeliner.getCurrentTime(), scene.fps);
    setCurrentFrame(frame);
    sendCurrentFrameToRuntime(scene, frame);
    setStatusText(`Sent frame ${frame} to runtime.`);
  }, [buildRuntimeScene, sendCurrentFrameToRuntime]);

  const onExportRuntimeJson = React.useCallback(() => {
    const scene = buildRuntimeScene();
    const fileName =
      scene.name.replace(/\s+/g, '_').toLowerCase() || 'cinematic_scene';
    downloadTextFile(
      JSON.stringify(scene, null, 2),
      `${fileName}_timeline.json`
    );
    setStatusText('Exported cinematic runtime JSON.');
  }, [buildRuntimeScene]);

  const onImportJsonText = React.useCallback(
    (jsonText: string) => {
      if (!jsonText) return;
      try {
        const parsedPayload = JSON.parse(jsonText);
        const parsedData =
          parsedPayload &&
          typeof parsedPayload === 'object' &&
          parsedPayload.format === TIMELINE_FILE_FORMAT &&
          isTimelinerData(parsedPayload.timelinerData)
            ? parsedPayload.timelinerData
            : parsedPayload;

        if (isTimelinerData(parsedData)) {
          const importedFps = clampInteger(
            parseFiniteNumber(
              parsedData.gdCinematicMeta && parsedData.gdCinematicMeta.fps,
              fpsRef.current
            ),
            MIN_FPS,
            MAX_FPS
          );
          const importedSceneName =
            (parsedData.gdCinematicMeta &&
              parsedData.gdCinematicMeta.sceneName) ||
            (parsedPayload &&
              parsedPayload.sceneName &&
              typeof parsedPayload.sceneName === 'string' &&
              parsedPayload.sceneName) ||
            parsedData.title ||
            sceneNameRef.current;
          setFps(importedFps);
          fpsRef.current = importedFps;
          setSceneName(importedSceneName);
          sceneNameRef.current = importedSceneName;
          applyTimelinerData(parsedData, { showStatus: true });
          setStatusText('Imported Timeliner JSON.');
          return;
        }

        if (isRuntimeCinematicScene(parsedData)) {
          const converted = runtimeSceneToTimelinerData(
            parsedData,
            sceneNameRef.current
          );
          setFps(converted.fps);
          fpsRef.current = converted.fps;
          setSceneName(converted.sceneName);
          sceneNameRef.current = converted.sceneName;
          applyTimelinerData(converted.data, { showStatus: true });
          setStatusText('Imported runtime cinematic JSON.');
          return;
        }

        setStatusText('JSON format is not recognized.');
      } catch (error) {
        console.warn('Failed to import timeline JSON.', error);
        setStatusText('Invalid JSON.');
      }
    },
    [applyTimelinerData]
  );

  const onImportJsonFile = React.useCallback(
    (event: SyntheticInputEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file =
        input.files && input.files.length ? input.files[0] : null;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result;
        if (typeof content === 'string') {
          onImportJsonText(content);
        }
      };
      reader.readAsText(file);
      input.value = '';
    },
    [onImportJsonText]
  );

  const projectTimelineFilePath = React.useMemo(
    () => getProjectTimelineFilePath(projectFilePath, sceneName),
    [projectFilePath, sceneName]
  );

  const onSaveToProjectFile = React.useCallback(() => {
    saveTimelinerDataToProject(
      project,
      latestDataRef.current,
      fpsRef.current,
      sceneNameRef.current
    );

    try {
      const saveResult = saveTimelinerDataToProjectFile(
        projectFilePath,
        latestDataRef.current,
        fpsRef.current,
        sceneNameRef.current
      );
      if (!saveResult) {
        setStatusText(
          'Saved in project state. Local project file path is unavailable.'
        );
        return;
      }
      setStatusText(`Saved timeline to ${saveResult.relativePath}.`);
    } catch (error) {
      console.warn('Unable to save cinematic timeline project file.', error);
      setStatusText('Failed to save timeline file. Check write permissions.');
    }
  }, [project, projectFilePath]);

  const onLoadFromProjectFile = React.useCallback(() => {
    try {
      const rawText = loadTimelinerDataFromProjectFile(
        projectFilePath,
        sceneNameRef.current
      );
      if (rawText) {
        onImportJsonText(rawText);
        setStatusText('Loaded timeline from project file.');
        return;
      }

      const storedData = loadTimelinerDataFromProject(project);
      if (storedData) {
        setFps(storedData.fps);
        fpsRef.current = storedData.fps;
        setSceneName(storedData.sceneName);
        sceneNameRef.current = storedData.sceneName;
        applyTimelinerData(storedData.data, { showStatus: false });
        setStatusText('Loaded timeline from project state.');
        return;
      }

      setStatusText('No timeline file found for this cinematic yet.');
    } catch (error) {
      console.warn('Unable to load cinematic timeline project file.', error);
      setStatusText('Failed to load timeline file.');
    }
  }, [applyTimelinerData, onImportJsonText, project, projectFilePath]);

  const onChangeFps = React.useCallback(
    (event: SyntheticInputEvent<HTMLInputElement>) => {
      const nextFps = clampInteger(
        parseFiniteNumber(event.currentTarget.value, fpsRef.current),
        MIN_FPS,
        MAX_FPS
      );
      setFps(nextFps);
      fpsRef.current = nextFps;
      saveTimelinerDataToProject(
        project,
        latestDataRef.current,
        nextFps,
        sceneNameRef.current
      );
      if (timelinerRef.current) {
        setCurrentFrame(
          secondsToFrame(timelinerRef.current.getCurrentTime(), nextFps)
        );
      }
    },
    [project]
  );

  const onChangeDuration = React.useCallback(
    (event: SyntheticInputEvent<HTMLInputElement>) => {
      const nextDuration = clampNumber(
        parseFiniteNumber(event.currentTarget.value, durationSeconds),
        MIN_DURATION_SECONDS,
        MAX_DURATION_SECONDS
      );
      setDurationSeconds(nextDuration);
      if (timelinerRef.current) {
        timelinerRef.current.setDuration(nextDuration);
      }
    },
    [durationSeconds]
  );

  const onChangeSceneName = React.useCallback(
    (event: SyntheticInputEvent<HTMLInputElement>) => {
      const nextSceneName = event.currentTarget.value || `${project.getName()} Cinematic`;
      setSceneName(nextSceneName);
      sceneNameRef.current = nextSceneName;
      saveTimelinerDataToProject(
        project,
        latestDataRef.current,
        fpsRef.current,
        nextSceneName
      );
    },
    [project]
  );

  const onToggleAutoSync = React.useCallback(() => {
    setAutoSync(previousValue => !previousValue);
  }, []);

  const onToggleAutoKey = React.useCallback(() => {
    setAutoKey(previousValue => !previousValue);
  }, []);

  const onKeyDownAddKeyframe = React.useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (!isActiveRef.current) return;
      if (shouldIgnoreKeyboardShortcut(event.target)) return;
      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        captureSelectedTransform(activeObjectSnapshot || null, 'manual');
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onDeleteKeyframeAtCurrentFrame();
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        onDuplicateKeyframeAtCurrentFrame();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNudgeCurrentFrame(-1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNudgeCurrentFrame(1);
      }
    },
    [
      activeObjectSnapshot,
      captureSelectedTransform,
      onDeleteKeyframeAtCurrentFrame,
      onDuplicateKeyframeAtCurrentFrame,
      onNudgeCurrentFrame,
    ]
  );

  React.useEffect(
    () => {
      window.addEventListener('keydown', onKeyDownAddKeyframe);
      return () => {
        window.removeEventListener('keydown', onKeyDownAddKeyframe);
      };
    },
    [onKeyDownAddKeyframe]
  );

  const selectedTrackGroup =
    trackGroups.find(group => group.id === selectedTrackGroupId) || null;

  const rootClassName =
    displayMode === 'overlay' ? 'ct3d-root ct3d-root--overlay' : 'ct3d-root';

  return (
    <div className={rootClassName}>
      <div className="ct3d-toolbar">
        <div className="ct3d-headerRow">
          {displayMode === 'overlay' && onRequestClose ? (
            <button className="ct3d-btn ct3d-btn-ghost ct3d-btn-square" onClick={onRequestClose}>
              X
            </button>
          ) : null}
          <span className="ct3d-titleText">{sceneName || `${project.getName()} Cinematic`}</span>
          <span className="ct3d-headerMeta">
            {fps} FPS | {durationSeconds.toFixed(2)}s
          </span>
        </div>

        <div className="ct3d-toolbarRow ct3d-toolbarRow-main">
          <label className="ct3d-inlineField ct3d-field-trackSelect">
            <select
              className="ct3d-input ct3d-trackSelectInput"
              value={selectedTrackGroupId}
              onChange={event => setSelectedTrackGroupId(event.currentTarget.value)}
            >
              {trackGroups.length ? null : <option value="">No tracked object</option>}
              {trackGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.objectName}
                </option>
              ))}
            </select>
          </label>

          <button className="ct3d-btn" onClick={onAddSelectedObjectLayers}>
            Add Object
          </button>
          <button className="ct3d-btn" onClick={onCaptureSelectedTransform}>
            Add Keyframe (K)
          </button>
          <button
            className="ct3d-btn ct3d-btn-primary ct3d-btn-icon"
            onClick={onPlayPreview}
            title="Run"
            aria-label="Run"
          >
            <span className="ct3d-icon-play" />
          </button>
          <button
            className="ct3d-btn ct3d-btn-icon"
            onClick={onPausePreview}
            title="Pause"
            aria-label="Pause"
          >
            <span className="ct3d-icon-pause" />
          </button>
          <button
            className="ct3d-btn ct3d-btn-icon"
            onClick={onStopPreview}
            title="Stop"
            aria-label="Stop"
          >
            <span className="ct3d-icon-stop" />
          </button>
        </div>
      </div>

      <div className="ct3d-timelineDock">
        <div ref={timelinerHostRef} className="ct3d-host" />
      </div>
      <div className="ct3d-statusBar">{statusText}</div>
    </div>
  );
};

export default CinematicTimeline3DEditor;
