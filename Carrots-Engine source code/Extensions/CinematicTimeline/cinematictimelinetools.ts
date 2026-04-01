namespace gdjs {
  type CinematicTimelineEasing =
    | 'linear'
    | 'step'
    | 'quadEaseIn'
    | 'quadEaseOut'
    | 'quadEaseInOut'
    | 'none';

  type CinematicTimelineVec3 = {
    x: float;
    y: float;
    z: float;
  };

  type CinematicTimelineTransformValue = {
    position: CinematicTimelineVec3;
    rotation: CinematicTimelineVec3;
    scale: CinematicTimelineVec3;
  };

  type CinematicTimelineIKValue = {
    target: CinematicTimelineVec3;
    pole: CinematicTimelineVec3;
    weight: float;
  };

  type CinematicTimelineKeyframe<T> = {
    frame: float;
    easing: CinematicTimelineEasing;
    value: T;
  };

  type CinematicTimelineTransformTrack = {
    id: string;
    type: 'transform';
    targetId: string;
    name?: string;
    keyframes: Array<CinematicTimelineKeyframe<CinematicTimelineTransformValue>>;
  };

  type CinematicTimelineIKTrack = {
    id: string;
    type: 'ik';
    targetId: string;
    name?: string;
    chainRoot?: string;
    endEffector?: string;
    keyframes: Array<CinematicTimelineKeyframe<CinematicTimelineIKValue>>;
  };

  type CinematicTimelineTrack =
    | CinematicTimelineTransformTrack
    | CinematicTimelineIKTrack;

  type CinematicTimelineLoopRange = {
    enabled: boolean;
    inFrame: float;
    outFrame: float;
  };

  type CinematicTimelineShot = {
    id: string;
    name: string;
    startFrame: float;
    endFrame: float;
  };

  type CinematicTimelineEventMarker = {
    id: string;
    name: string;
    action: string;
    condition: string;
    frame: float;
    payload: string;
  };

  type CinematicTimelinePlaybackRange = {
    inFrame: float;
    outFrame: float;
  };

  type CinematicTimelineTriggeredEvent = {
    id: string;
    name: string;
    action: string;
    condition: string;
    frame: float;
    payload: string;
  };

  type CinematicTimelineScene = {
    version: number;
    name: string;
    fps: float;
    duration: float;
    tracks: Array<CinematicTimelineTrack>;
    loopRange: CinematicTimelineLoopRange;
    shots: Array<CinematicTimelineShot>;
    events: Array<CinematicTimelineEventMarker>;
  };

  type CinematicTimelineState = {
    scene: CinematicTimelineScene | null;
    isPlaying: boolean;
    loopPlayback: boolean;
    playbackSpeed: float;
    currentFrame: float;
    frameCursor: float;
    playbackRange: CinematicTimelinePlaybackRange;
    activeShotId: string;
    configuredIKChains: Set<string>;
    triggeredEventIdsThisFrame: Set<string>;
    triggeredEventNamesThisFrame: Set<string>;
    lastTriggeredEvent: CinematicTimelineTriggeredEvent | null;
  };

  export interface RuntimeScene {
    _cinematicTimelineState?: CinematicTimelineState;
  }

  type IKTimelineRuntimeObject = gdjs.RuntimeObject & {
    configureIKChain: Function;
    setIKEnabled: Function;
    setIKIterationCount: Function;
    setIKBlendFactor: Function;
    setIKAngleLimits: Function;
    setIKTargetTolerance: Function;
    setIKTargetPosition: Function;
  };

  export namespace evtTools {
    export namespace cinematicTimeline {
      const logger = new gdjs.Logger('CinematicTimeline');
      const TRACK_FRAME_LIMIT = 20000;
      const MIN_FPS = 1;
      const MAX_FPS = 240;
      const EPSILON = 0.00001;
      const MAX_PLAYBACK_SPEED = 8;
      const DEFAULT_EVENT_ACTION = 'Trigger';
      const DEFAULT_EVENT_CONDITION = 'Always';
      const PROJECT_STORAGE_VARIABLE = '__carrots_cinematic_timeliner_v1';
      const TIMELINE_FILE_FORMAT = 'carrots-cinematic-timeliner-v1';
      const TIMELINE_STORAGE_VERSION = 2;

      const clampNumber = (value: number, min: number, max: number): number =>
        Math.max(min, Math.min(max, value));

      const clampInteger = (value: number, min: number, max: number): number =>
        Math.round(clampNumber(value, min, max));

      const parseFiniteNumber = (value: any, fallbackValue: number): number => {
        const parsedValue =
          typeof value === 'number' ? value : Number.parseFloat(value);
        return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
      };

      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          return (
            normalized === 'true' ||
            normalized === 'yes' ||
            normalized === '1' ||
            normalized === 'on'
          );
        }
        return !!value;
      };

      const easeProgress = (
        alpha: number,
        easing: CinematicTimelineEasing
      ): number => {
        const clampedAlpha = clampNumber(alpha, 0, 1);
        if (easing === 'step' || easing === 'none') return 0;
        if (easing === 'quadEaseIn') return clampedAlpha * clampedAlpha;
        if (easing === 'quadEaseOut')
          return -clampedAlpha * (clampedAlpha - 2);
        if (easing === 'quadEaseInOut') {
          const doubleAlpha = clampedAlpha * 2;
          if (doubleAlpha < 1) return 0.5 * doubleAlpha * doubleAlpha;
          const normalized = doubleAlpha - 1;
          return -0.5 * (normalized * (normalized - 2) - 1);
        }
        return clampedAlpha;
      };

      const createDefaultTransformValue =
        (): CinematicTimelineTransformValue => ({
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        });

      const createDefaultIKValue = (): CinematicTimelineIKValue => ({
        target: { x: 0, y: 0, z: 0 },
        pole: { x: 0, y: 1, z: 0 },
        weight: 1,
      });

      const createDefaultPlaybackRange = (): CinematicTimelinePlaybackRange => ({
        inFrame: 0,
        outFrame: 0,
      });

      const getDefaultState = (): CinematicTimelineState => ({
        scene: null,
        isPlaying: false,
        loopPlayback: true,
        playbackSpeed: 1,
        currentFrame: 0,
        frameCursor: 0,
        playbackRange: createDefaultPlaybackRange(),
        activeShotId: '',
        configuredIKChains: new Set<string>(),
        triggeredEventIdsThisFrame: new Set<string>(),
        triggeredEventNamesThisFrame: new Set<string>(),
        lastTriggeredEvent: null,
      });

      const getState = (runtimeScene: gdjs.RuntimeScene): CinematicTimelineState =>
        runtimeScene._cinematicTimelineState ||
        (runtimeScene._cinematicTimelineState = getDefaultState());

      const clearTriggeredEvents = (state: CinematicTimelineState): void => {
        state.triggeredEventIdsThisFrame.clear();
        state.triggeredEventNamesThisFrame.clear();
        state.lastTriggeredEvent = null;
      };

      const cloneTransformValue = (
        value: CinematicTimelineTransformValue
      ): CinematicTimelineTransformValue => ({
        position: { ...value.position },
        rotation: { ...value.rotation },
        scale: { ...value.scale },
      });

      const cloneIKValue = (
        value: CinematicTimelineIKValue
      ): CinematicTimelineIKValue => ({
        target: { ...value.target },
        pole: { ...value.pole },
        weight: value.weight,
      });

      const normalizeVec3 = (
        value: any,
        fallbackValue: CinematicTimelineVec3
      ): CinematicTimelineVec3 => ({
        x: parseFiniteNumber(value && value.x, fallbackValue.x),
        y: parseFiniteNumber(value && value.y, fallbackValue.y),
        z: parseFiniteNumber(value && value.z, fallbackValue.z),
      });

      const normalizeTransformValue = (value: any): CinematicTimelineTransformValue => {
        const defaultValue = createDefaultTransformValue();
        return {
          position: normalizeVec3(value && value.position, defaultValue.position),
          rotation: normalizeVec3(value && value.rotation, defaultValue.rotation),
          scale: normalizeVec3(value && value.scale, defaultValue.scale),
        };
      };

      const normalizeIKValue = (value: any): CinematicTimelineIKValue => {
        const defaultValue = createDefaultIKValue();
        return {
          target: normalizeVec3(value && value.target, defaultValue.target),
          pole: normalizeVec3(value && value.pole, defaultValue.pole),
          weight: clampNumber(
            parseFiniteNumber(value && value.weight, defaultValue.weight),
            0,
            1
          ),
        };
      };

      const normalizeEasing = (easing: any): CinematicTimelineEasing => {
        if (
          easing === 'step' ||
          easing === 'none' ||
          easing === 'quadEaseIn' ||
          easing === 'quadEaseOut' ||
          easing === 'quadEaseInOut'
        ) {
          return easing;
        }
        return 'linear';
      };

      const normalizeLoopRange = (
        value: any,
        duration: number
      ): CinematicTimelineLoopRange => {
        const fallbackLoopRange = {
          enabled: false,
          inFrame: 0,
          outFrame: duration,
        };
        if (!value || typeof value !== 'object') return fallbackLoopRange;
        const inFrame = clampInteger(
          parseFiniteNumber(value.inFrame, fallbackLoopRange.inFrame),
          0,
          duration
        );
        const outFrame = clampInteger(
          parseFiniteNumber(value.outFrame, fallbackLoopRange.outFrame),
          0,
          duration
        );
        return {
          enabled: value.enabled === true,
          inFrame: Math.min(inFrame, outFrame),
          outFrame: Math.max(inFrame, outFrame),
        };
      };

      const normalizeShots = (
        value: any,
        duration: number
      ): Array<CinematicTimelineShot> => {
        if (!Array.isArray(value)) return [];
        return value
          .map((rawShot, index) => {
            if (!rawShot || typeof rawShot !== 'object') return null;
            const startFrame = clampInteger(
              parseFiniteNumber(rawShot.startFrame, 0),
              0,
              duration
            );
            const endFrame = clampInteger(
              parseFiniteNumber(rawShot.endFrame, startFrame),
              0,
              duration
            );
            return {
              id:
                typeof rawShot.id === 'string' && rawShot.id
                  ? String(rawShot.id)
                  : `shot-${index + 1}`,
              name:
                typeof rawShot.name === 'string' && rawShot.name
                  ? String(rawShot.name)
                  : `Shot ${index + 1}`,
              startFrame: Math.min(startFrame, endFrame),
              endFrame: Math.max(startFrame, endFrame),
            };
          })
          .filter((shot): shot is CinematicTimelineShot => !!shot)
          .sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame);
      };

      const normalizeEvents = (
        value: any,
        duration: number
      ): Array<CinematicTimelineEventMarker> => {
        if (!Array.isArray(value)) return [];
        return value
          .map((rawEvent, index) => {
            if (!rawEvent || typeof rawEvent !== 'object') return null;
            return {
              id:
                typeof rawEvent.id === 'string' && rawEvent.id
                  ? String(rawEvent.id)
                  : `event-${index + 1}`,
              name:
                typeof rawEvent.name === 'string' && rawEvent.name
                  ? String(rawEvent.name)
                  : `Event ${index + 1}`,
              action:
                typeof rawEvent.action === 'string' && rawEvent.action
                  ? String(rawEvent.action)
                  : DEFAULT_EVENT_ACTION,
              condition:
                typeof rawEvent.condition === 'string' && rawEvent.condition
                  ? String(rawEvent.condition)
                  : DEFAULT_EVENT_CONDITION,
              frame: clampInteger(
                parseFiniteNumber(rawEvent.frame, 0),
                0,
                duration
              ),
              payload:
                typeof rawEvent.payload === 'string'
                  ? String(rawEvent.payload)
                  : '',
            };
          })
          .filter((eventMarker): eventMarker is CinematicTimelineEventMarker => !!eventMarker)
          .sort((a, b) => a.frame - b.frame);
      };

      const normalizeScene = (scene: any): CinematicTimelineScene | null => {
        if (!scene || typeof scene !== 'object') return null;
        if (!Array.isArray(scene.tracks)) return null;

        const fps = clampInteger(
          parseFiniteNumber(scene.fps, 30),
          MIN_FPS,
          MAX_FPS
        );
        const duration = clampInteger(
          parseFiniteNumber(scene.duration, 0),
          0,
          TRACK_FRAME_LIMIT
        );

        const tracks: Array<CinematicTimelineTrack> = [];
        for (const rawTrack of scene.tracks) {
          if (!rawTrack || typeof rawTrack !== 'object') continue;
          if (!Array.isArray(rawTrack.keyframes) || !rawTrack.targetId) continue;

          if (rawTrack.type === 'ik') {
            const keyframes = rawTrack.keyframes
              .map(rawKeyframe => {
                if (!rawKeyframe || typeof rawKeyframe !== 'object') return null;
                return {
                  frame: clampInteger(
                    parseFiniteNumber(rawKeyframe.frame, 0),
                    0,
                    duration
                  ),
                  easing: normalizeEasing(rawKeyframe.easing),
                  value: normalizeIKValue(rawKeyframe.value),
                };
              })
              .filter((keyframe): keyframe is CinematicTimelineKeyframe<CinematicTimelineIKValue> => !!keyframe)
              .sort((a, b) => a.frame - b.frame);
            if (!keyframes.length) continue;
            tracks.push({
              id: String(rawTrack.id || `ik-${tracks.length}`),
              type: 'ik',
              targetId: String(rawTrack.targetId),
              name: rawTrack.name ? String(rawTrack.name) : undefined,
              chainRoot: rawTrack.chainRoot ? String(rawTrack.chainRoot) : '',
              endEffector: rawTrack.endEffector
                ? String(rawTrack.endEffector)
                : '',
              keyframes,
            });
          } else {
            const keyframes = rawTrack.keyframes
              .map(rawKeyframe => {
                if (!rawKeyframe || typeof rawKeyframe !== 'object') return null;
                return {
                  frame: clampInteger(
                    parseFiniteNumber(rawKeyframe.frame, 0),
                    0,
                    duration
                  ),
                  easing: normalizeEasing(rawKeyframe.easing),
                  value: normalizeTransformValue(rawKeyframe.value),
                };
              })
              .filter((keyframe): keyframe is CinematicTimelineKeyframe<CinematicTimelineTransformValue> => !!keyframe)
              .sort((a, b) => a.frame - b.frame);
            if (!keyframes.length) continue;
            tracks.push({
              id: String(rawTrack.id || `transform-${tracks.length}`),
              type: 'transform',
              targetId: String(rawTrack.targetId),
              name: rawTrack.name ? String(rawTrack.name) : undefined,
              keyframes,
            });
          }
        }

        const loopRange = normalizeLoopRange(scene.loopRange, duration);
        const shots = normalizeShots(scene.shots, duration);
        const events = normalizeEvents(scene.events, duration);

        return {
          version: clampInteger(parseFiniteNumber(scene.version, 1), 1, 1),
          name: scene.name ? String(scene.name) : 'Cinematic',
          fps,
          duration,
          tracks,
          loopRange,
          shots,
          events,
        };
      };

      const normalizePlaybackRange = (
        inFrame: number,
        outFrame: number,
        sceneDuration: number
      ): CinematicTimelinePlaybackRange => {
        const clampedInFrame = clampInteger(inFrame, 0, sceneDuration);
        const clampedOutFrame = clampInteger(outFrame, 0, sceneDuration);
        return {
          inFrame: Math.min(clampedInFrame, clampedOutFrame),
          outFrame: Math.max(clampedInFrame, clampedOutFrame),
        };
      };

      const getDefaultPlaybackRangeForScene = (
        scene: CinematicTimelineScene
      ): CinematicTimelinePlaybackRange =>
        scene.loopRange.enabled
          ? normalizePlaybackRange(
              scene.loopRange.inFrame,
              scene.loopRange.outFrame,
              scene.duration
            )
          : normalizePlaybackRange(0, scene.duration, scene.duration);

      const setPlaybackRange = (
        state: CinematicTimelineState,
        scene: CinematicTimelineScene,
        inFrame: number,
        outFrame: number
      ): void => {
        state.playbackRange = normalizePlaybackRange(inFrame, outFrame, scene.duration);
      };

      const clampFrameToPlaybackRange = (
        frame: number,
        playbackRange: CinematicTimelinePlaybackRange
      ): number =>
        clampInteger(frame, playbackRange.inFrame, playbackRange.outFrame);

      const getShotForFrame = (
        scene: CinematicTimelineScene,
        frame: number
      ): CinematicTimelineShot | null =>
        scene.shots.find(
          shot => frame >= shot.startFrame && frame <= shot.endFrame
        ) || null;

      const getShotByIdOrName = (
        scene: CinematicTimelineScene,
        shotIdOrName: string
      ): CinematicTimelineShot | null => {
        const normalizedValue = String(shotIdOrName || '').trim();
        if (!normalizedValue) return null;
        const lowerCaseValue = normalizedValue.toLowerCase();
        return (
          scene.shots.find(
            shot =>
              shot.id === normalizedValue ||
              shot.name.toLowerCase() === lowerCaseValue
          ) || null
        );
      };

      const getEventByIdOrName = (
        scene: CinematicTimelineScene,
        eventIdOrName: string
      ): CinematicTimelineEventMarker | null => {
        const normalizedValue = String(eventIdOrName || '').trim();
        if (!normalizedValue) return null;
        const lowerCaseValue = normalizedValue.toLowerCase();
        return (
          scene.events.find(
            eventMarker =>
              eventMarker.id === normalizedValue ||
              eventMarker.name.toLowerCase() === lowerCaseValue
          ) || null
        );
      };

      const registerTriggeredEvent = (
        state: CinematicTimelineState,
        eventMarker: CinematicTimelineEventMarker
      ): void => {
        state.triggeredEventIdsThisFrame.add(eventMarker.id);
        state.triggeredEventNamesThisFrame.add(eventMarker.name.toLowerCase());
        state.lastTriggeredEvent = {
          id: eventMarker.id,
          name: eventMarker.name,
          action: eventMarker.action,
          condition: eventMarker.condition,
          frame: eventMarker.frame,
          payload: eventMarker.payload,
        };
      };

      const triggerEventsAtFrame = (
        state: CinematicTimelineState,
        frame: number
      ): void => {
        clearTriggeredEvents(state);
        if (!state.scene || !state.scene.events.length) return;

        state.scene.events.forEach(eventMarker => {
          if (Math.abs(eventMarker.frame - frame) > EPSILON) return;
          registerTriggeredEvent(state, eventMarker);
        });
      };

      const triggerEventsInRange = (
        state: CinematicTimelineState,
        fromFrame: number,
        toFrame: number,
        wrapped: boolean
      ): void => {
        if (!state.scene || !state.scene.events.length) {
          clearTriggeredEvents(state);
          return;
        }

        clearTriggeredEvents(state);
        if (fromFrame === toFrame) return;

        const playbackRange = normalizePlaybackRange(
          state.playbackRange.inFrame,
          state.playbackRange.outFrame,
          state.scene.duration
        );
        const isWithinSegment = (eventFrame: number): boolean => {
          if (!wrapped) {
            return eventFrame > fromFrame + EPSILON && eventFrame <= toFrame + EPSILON;
          }
          const fromStartToEnd =
            eventFrame > fromFrame + EPSILON &&
            eventFrame <= playbackRange.outFrame + EPSILON;
          const fromLoopStartToCurrent =
            eventFrame >= playbackRange.inFrame - EPSILON &&
            eventFrame <= toFrame + EPSILON;
          return fromStartToEnd || fromLoopStartToCurrent;
        };

        state.scene.events.forEach(eventMarker => {
          if (!isWithinSegment(eventMarker.frame)) return;
          registerTriggeredEvent(state, eventMarker);
        });
      };

      const interpolateTransformValue = (
        from: CinematicTimelineTransformValue,
        to: CinematicTimelineTransformValue,
        alpha: number
      ): CinematicTimelineTransformValue => ({
        position: {
          x: gdjs.evtTools.common.lerp(from.position.x, to.position.x, alpha),
          y: gdjs.evtTools.common.lerp(from.position.y, to.position.y, alpha),
          z: gdjs.evtTools.common.lerp(from.position.z, to.position.z, alpha),
        },
        rotation: {
          x: gdjs.evtTools.common.lerp(from.rotation.x, to.rotation.x, alpha),
          y: gdjs.evtTools.common.lerp(from.rotation.y, to.rotation.y, alpha),
          z: gdjs.evtTools.common.lerp(from.rotation.z, to.rotation.z, alpha),
        },
        scale: {
          x: gdjs.evtTools.common.lerp(from.scale.x, to.scale.x, alpha),
          y: gdjs.evtTools.common.lerp(from.scale.y, to.scale.y, alpha),
          z: gdjs.evtTools.common.lerp(from.scale.z, to.scale.z, alpha),
        },
      });

      const interpolateIKValue = (
        from: CinematicTimelineIKValue,
        to: CinematicTimelineIKValue,
        alpha: number
      ): CinematicTimelineIKValue => ({
        target: {
          x: gdjs.evtTools.common.lerp(from.target.x, to.target.x, alpha),
          y: gdjs.evtTools.common.lerp(from.target.y, to.target.y, alpha),
          z: gdjs.evtTools.common.lerp(from.target.z, to.target.z, alpha),
        },
        pole: {
          x: gdjs.evtTools.common.lerp(from.pole.x, to.pole.x, alpha),
          y: gdjs.evtTools.common.lerp(from.pole.y, to.pole.y, alpha),
          z: gdjs.evtTools.common.lerp(from.pole.z, to.pole.z, alpha),
        },
        weight: gdjs.evtTools.common.lerp(from.weight, to.weight, alpha),
      });

      const evaluateKeyframes = <T>(
        keyframes: Array<CinematicTimelineKeyframe<T>>,
        frame: number,
        interpolate: (from: T, to: T, alpha: number) => T
      ): T | null => {
        if (!keyframes.length) return null;
        const first = keyframes[0];
        const last = keyframes[keyframes.length - 1];
        if (frame <= first.frame) return first.value;
        if (frame >= last.frame) return last.value;

        for (let index = 0; index < keyframes.length - 1; index++) {
          const from = keyframes[index];
          const to = keyframes[index + 1];
          if (Math.abs(frame - from.frame) <= EPSILON) return from.value;
          if (Math.abs(frame - to.frame) <= EPSILON) return to.value;
          if (frame < from.frame || frame > to.frame) continue;

          if (Math.abs(to.frame - from.frame) <= EPSILON) return to.value;
          const easing = from.easing || 'linear';
          if (easing === 'step' || easing === 'none') return from.value;
          const progress = (frame - from.frame) / (to.frame - from.frame);
          return interpolate(from.value, to.value, easeProgress(progress, easing));
        }

        return last.value;
      };

      const evaluateTransformTrackAtFrame = (
        track: CinematicTimelineTransformTrack,
        frame: number
      ): CinematicTimelineTransformValue => {
        const value = evaluateKeyframes(track.keyframes, frame, interpolateTransformValue);
        return value ? cloneTransformValue(value) : createDefaultTransformValue();
      };

      const evaluateIKTrackAtFrame = (
        track: CinematicTimelineIKTrack,
        frame: number
      ): CinematicTimelineIKValue => {
        const value = evaluateKeyframes(track.keyframes, frame, interpolateIKValue);
        return value ? cloneIKValue(value) : createDefaultIKValue();
      };

      const buildTargetMaps = (runtimeScene: gdjs.RuntimeScene) => {
        const byName = new Map<string, Array<gdjs.RuntimeObject>>();
        const byId = new Map<number, gdjs.RuntimeObject>();
        const byPersistentUuid = new Map<string, gdjs.RuntimeObject>();

        const instances = runtimeScene.getAdhocListOfAllInstances();
        for (const object of instances) {
          const objectName = object.getName();
          if (!byName.has(objectName)) byName.set(objectName, []);
          const existingByName = byName.get(objectName);
          if (existingByName) existingByName.push(object);
          byId.set(object.id, object);
          if (object.persistentUuid) {
            byPersistentUuid.set(object.persistentUuid, object);
          }
        }

        return { byName, byId, byPersistentUuid };
      };

      const resolveTrackTargets = (
        track: CinematicTimelineTrack,
        targetMaps: {
          byName: Map<string, Array<gdjs.RuntimeObject>>;
          byId: Map<number, gdjs.RuntimeObject>;
          byPersistentUuid: Map<string, gdjs.RuntimeObject>;
        }
      ): Array<gdjs.RuntimeObject> => {
        const targetId = String(track.targetId || '').trim();
        if (!targetId) return [];

        let resolverMode: 'auto' | 'name' | 'id' | 'uuid' = 'auto';
        let resolverValue = targetId;
        const separatorIndex = targetId.indexOf(':');
        if (separatorIndex > 0) {
          const prefix = targetId.slice(0, separatorIndex).toLowerCase();
          const value = targetId.slice(separatorIndex + 1).trim();
          if (value && (prefix === 'name' || prefix === 'id' || prefix === 'uuid')) {
            resolverMode = prefix;
            resolverValue = value;
          }
        }

        if (resolverMode === 'uuid') {
          const object = targetMaps.byPersistentUuid.get(resolverValue);
          return object ? [object] : [];
        }
        if (resolverMode === 'id') {
          const numericId = Number.parseInt(resolverValue, 10);
          if (!Number.isFinite(numericId)) return [];
          const object = targetMaps.byId.get(numericId);
          return object ? [object] : [];
        }
        if (resolverMode === 'name') {
          return targetMaps.byName.get(resolverValue) || [];
        }

        const fromUuid = targetMaps.byPersistentUuid.get(resolverValue);
        if (fromUuid) return [fromUuid];
        const numericId = Number.parseInt(resolverValue, 10);
        if (Number.isFinite(numericId)) {
          const fromId = targetMaps.byId.get(numericId);
          if (fromId) return [fromId];
        }
        return targetMaps.byName.get(resolverValue) || [];
      };

      const isIKTimelineRuntimeObject = (
        object: gdjs.RuntimeObject
      ): object is IKTimelineRuntimeObject => {
        const castObject: any = object;
        return (
          typeof castObject.configureIKChain === 'function' &&
          typeof castObject.setIKEnabled === 'function' &&
          typeof castObject.setIKTargetPosition === 'function'
        );
      };

      const applyTransformToObject = (
        object: gdjs.RuntimeObject,
        value: CinematicTimelineTransformValue
      ): void => {
        object.setX(value.position.x);
        object.setY(value.position.y);
        object.setAngle(value.rotation.z);

        const scalableObject: any = object;
        const hasScaleXSetter = typeof scalableObject.setScaleX === 'function';
        const hasScaleYSetter = typeof scalableObject.setScaleY === 'function';
        if (hasScaleXSetter) scalableObject.setScaleX(value.scale.x);
        if (hasScaleYSetter) scalableObject.setScaleY(value.scale.y);
        if (
          !hasScaleXSetter &&
          !hasScaleYSetter &&
          typeof scalableObject.setScale === 'function'
        ) {
          scalableObject.setScale((value.scale.x + value.scale.y) / 2);
        }

        if (gdjs.Base3DHandler && gdjs.Base3DHandler.is3D(object)) {
          object.setZ(value.position.z);
          object.setRotationX(value.rotation.x);
          object.setRotationY(value.rotation.y);
          object.setScaleZ(value.scale.z);
        }
      };

      const ensureIKChain = (
        state: CinematicTimelineState,
        object: IKTimelineRuntimeObject,
        track: CinematicTimelineIKTrack,
        value: CinematicTimelineIKValue
      ): string => {
        const chainName = (track.name || track.id || 'IKChain').trim() || 'IKChain';
        const cacheKey = `${object.id}:${chainName}`;
        if (state.configuredIKChains.has(cacheKey)) return chainName;

        const links = (track.chainRoot || '').trim();
        const effectorBoneName = (track.endEffector || '').trim() || 'Hand.R';
        object.configureIKChain(
          chainName,
          effectorBoneName,
          '',
          links,
          12,
          value.weight,
          -180,
          180
        );
        object.setIKEnabled(chainName, true);
        object.setIKIterationCount(chainName, 12);
        object.setIKBlendFactor(chainName, value.weight);
        object.setIKAngleLimits(chainName, -180, 180);
        object.setIKTargetTolerance(chainName, 0.002);
        state.configuredIKChains.add(cacheKey);
        return chainName;
      };

      const applyIKToObject = (
        state: CinematicTimelineState,
        object: gdjs.RuntimeObject,
        track: CinematicTimelineIKTrack,
        value: CinematicTimelineIKValue
      ): void => {
        if (!isIKTimelineRuntimeObject(object)) return;
        const chainName = ensureIKChain(state, object, track, value);
        object.setIKTargetPosition(
          chainName,
          value.target.x,
          value.target.y,
          value.target.z
        );
        object.setIKBlendFactor(chainName, value.weight);
        object.setIKEnabled(chainName, value.weight > 0.0001);
      };

      const applyFrame = (
        runtimeScene: gdjs.RuntimeScene,
        state: CinematicTimelineState,
        frame: number
      ): void => {
        if (!state.scene) return;
        const maps = buildTargetMaps(runtimeScene);
        for (const track of state.scene.tracks) {
          const targetObjects = resolveTrackTargets(track, maps);
          if (!targetObjects.length) continue;
          if (track.type === 'ik') {
            const ikValue = evaluateIKTrackAtFrame(track, frame);
            targetObjects.forEach(object =>
              applyIKToObject(state, object, track, ikValue)
            );
          } else {
            const transformValue = evaluateTransformTrackAtFrame(track, frame);
            targetObjects.forEach(object =>
              applyTransformToObject(object, transformValue)
            );
          }
        }
      };

      const applyStateFrame = (
        runtimeScene: gdjs.RuntimeScene,
        state: CinematicTimelineState,
        frame: number,
        options?: {
          clearTriggeredEvents?: boolean,
          triggerEventsAtCurrentFrame?: boolean,
        }
      ): void => {
        if (!state.scene) return;
        const nextFrame = clampFrameToPlaybackRange(frame, state.playbackRange);
        state.currentFrame = nextFrame;
        state.frameCursor = nextFrame;
        const activeShot = getShotForFrame(state.scene, nextFrame);
        state.activeShotId = activeShot ? activeShot.id : '';

        if (options && options.triggerEventsAtCurrentFrame) {
          triggerEventsAtFrame(state, nextFrame);
        } else if (!options || options.clearTriggeredEvents !== false) {
          clearTriggeredEvents(state);
        }

        applyFrame(runtimeScene, state, nextFrame);
      };

      const updatePlayback = (runtimeScene: gdjs.RuntimeScene): void => {
        const state = getState(runtimeScene);
        const scene = state.scene;
        if (!scene || !state.isPlaying) return;

        const elapsedTimeSeconds =
          parseFiniteNumber(runtimeScene.getElapsedTime(), 0) / 1000;
        if (elapsedTimeSeconds <= 0) return;

        const playbackRange = normalizePlaybackRange(
          state.playbackRange.inFrame,
          state.playbackRange.outFrame,
          scene.duration
        );
        state.playbackRange = playbackRange;

        const playbackSpeed = Math.max(0, state.playbackSpeed);
        if (playbackSpeed <= EPSILON) return;

        const frameDelta = elapsedTimeSeconds * scene.fps * playbackSpeed;
        if (frameDelta <= EPSILON) return;

        const previousFrame = state.currentFrame;
        const rawCursor = state.frameCursor + frameDelta;

        let wrapped = false;
        if (state.loopPlayback) {
          const frameRange = Math.max(
            1,
            playbackRange.outFrame - playbackRange.inFrame + 1
          );
          if (
            rawCursor > playbackRange.outFrame + EPSILON ||
            rawCursor < playbackRange.inFrame - EPSILON
          ) {
            wrapped = true;
          }
          const wrappedCursor =
            ((rawCursor - playbackRange.inFrame) % frameRange + frameRange) %
            frameRange;
          state.frameCursor = playbackRange.inFrame + wrappedCursor;
        } else {
          state.frameCursor = clampNumber(
            rawCursor,
            playbackRange.inFrame,
            playbackRange.outFrame
          );
          if (state.frameCursor >= playbackRange.outFrame - EPSILON) {
            state.isPlaying = false;
          }
        }

        const nextFrame = clampInteger(
          Math.floor(state.frameCursor + EPSILON),
          playbackRange.inFrame,
          playbackRange.outFrame
        );
        if (nextFrame === previousFrame) return;

        state.currentFrame = nextFrame;
        const activeShot = getShotForFrame(scene, nextFrame);
        state.activeShotId = activeShot ? activeShot.id : '';
        triggerEventsInRange(state, previousFrame, nextFrame, wrapped);
        applyFrame(runtimeScene, state, nextFrame);
      };

      gdjs.registerRuntimeScenePostEventsCallback(runtimeScene => {
        updatePlayback(runtimeScene);
      });

      export const loadFromJson = (
        runtimeScene: gdjs.RuntimeScene,
        jsonString: string
      ): void => {
        const state = getState(runtimeScene);
        try {
          const parsedValue = JSON.parse(String(jsonString || '').trim());
          const scene = extractRuntimeScenePayload(parsedValue);
          if (!scene) {
            logger.warn('Cinematic Timeline: invalid cinematic JSON format.');
            return;
          }
          applyLoadedSceneToState(runtimeScene, state, scene);
        } catch (error) {
          logger.warn('Cinematic Timeline: unable to parse cinematic JSON.');
        }
      };

      const normalizeSceneName = (value: any): string =>
        String(value || '').trim();

      const getScenesByNameFromPayload = (
        rawValue: any
      ): { [sceneName: string]: any } => {
        if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue))
          return {};
        const scenesByName = rawValue.scenesByName;
        if (
          !scenesByName ||
          typeof scenesByName !== 'object' ||
          Array.isArray(scenesByName)
        )
          return {};
        return scenesByName;
      };

      const findSceneEntryInPayload = (
        rawValue: any,
        preferredSceneName?: string
      ): { sceneName: string; entry: any } | null => {
        const scenesByName = getScenesByNameFromPayload(rawValue);
        const sceneKeys = Object.keys(scenesByName);
        if (!sceneKeys.length) return null;

        const findSceneKey = (sceneNameToFind: string): string => {
          if (!sceneNameToFind) return '';
          if (
            Object.prototype.hasOwnProperty.call(scenesByName, sceneNameToFind)
          ) {
            return sceneNameToFind;
          }
          const lowerCaseSceneNameToFind = sceneNameToFind.toLowerCase();
          for (let i = 0; i < sceneKeys.length; i++) {
            const sceneKey = sceneKeys[i];
            if (sceneKey.toLowerCase() === lowerCaseSceneNameToFind) {
              return sceneKey;
            }
            const entry = scenesByName[sceneKey];
            const entrySceneName = normalizeSceneName(entry && entry.sceneName);
            if (
              entrySceneName &&
              entrySceneName.toLowerCase() === lowerCaseSceneNameToFind
            ) {
              return sceneKey;
            }
          }
          return '';
        };

        let selectedSceneKey = findSceneKey(normalizeSceneName(preferredSceneName));
        if (!selectedSceneKey) {
          selectedSceneKey = findSceneKey(
            normalizeSceneName(rawValue && rawValue.activeSceneName)
          );
        }
        if (!selectedSceneKey) {
          selectedSceneKey = findSceneKey(
            normalizeSceneName(rawValue && rawValue.sceneName)
          );
        }
        if (!selectedSceneKey) {
          selectedSceneKey = sceneKeys[0];
        }
        if (!selectedSceneKey) return null;

        const entry = scenesByName[selectedSceneKey];
        if (!entry || typeof entry !== 'object') return null;
        const entrySceneName = normalizeSceneName(entry.sceneName) || selectedSceneKey;

        return {
          sceneName: entrySceneName,
          entry,
        };
      };

      const extractRuntimeScenePayload = (
        rawValue: any,
        preferredSceneName?: string
      ): CinematicTimelineScene | null => {
        if (!rawValue || typeof rawValue !== 'object') return normalizeScene(rawValue);

        const sceneEntry = findSceneEntryInPayload(rawValue, preferredSceneName);
        if (sceneEntry) {
          const sceneFromEntry =
            normalizeScene(sceneEntry.entry.runtimeScene) ||
            normalizeScene(sceneEntry.entry);
          if (sceneFromEntry) return sceneFromEntry;
        }

        if (
          rawValue.format === TIMELINE_FILE_FORMAT &&
          rawValue.runtimeScene &&
          typeof rawValue.runtimeScene === 'object'
        ) {
          return normalizeScene(rawValue.runtimeScene);
        }

        if (rawValue.runtimeScene && typeof rawValue.runtimeScene === 'object') {
          return normalizeScene(rawValue.runtimeScene);
        }

        return normalizeScene(rawValue);
      };

      const applyLoadedSceneToState = (
        runtimeScene: gdjs.RuntimeScene,
        state: CinematicTimelineState,
        scene: CinematicTimelineScene
      ): void => {
        state.scene = scene;
        state.isPlaying = false;
        state.loopPlayback = scene.loopRange.enabled;
        const playbackRange = getDefaultPlaybackRangeForScene(scene);
        state.playbackRange = playbackRange;
        state.currentFrame = playbackRange.inFrame;
        state.frameCursor = playbackRange.inFrame;
        state.activeShotId = '';
        state.configuredIKChains.clear();
        applyStateFrame(runtimeScene, state, playbackRange.inFrame);
      };

      export const loadFromProjectStorage = (
        runtimeScene: gdjs.RuntimeScene,
        sceneName?: string
      ): void => {
        const state = getState(runtimeScene);
        const rawText = runtimeScene
          .getGame()
          .getVariables()
          .get(PROJECT_STORAGE_VARIABLE)
          .getAsString();
        if (!rawText || !String(rawText).trim()) {
          logger.warn(
            `Cinematic Timeline: project storage "${PROJECT_STORAGE_VARIABLE}" is empty.`
          );
          return;
        }

        try {
          const parsedValue = JSON.parse(String(rawText));
          const scene = extractRuntimeScenePayload(parsedValue, sceneName);
          if (!scene) {
            const normalizedSceneName = normalizeSceneName(sceneName);
            logger.warn(
              normalizedSceneName
                ? `Cinematic Timeline: scene "${normalizedSceneName}" was not found in project storage payload.`
                : 'Cinematic Timeline: project storage contains an invalid timeline payload.'
            );
            return;
          }
          applyLoadedSceneToState(runtimeScene, state, scene);
        } catch (error) {
          logger.warn(
            'Cinematic Timeline: unable to parse timeline from project storage.'
          );
        }
      };

      export const loadAndPlayFromProjectStorage = (
        runtimeScene: gdjs.RuntimeScene,
        sceneName?: string
      ): void => {
        loadFromProjectStorage(runtimeScene, sceneName);
        if (hasLoadedScene(runtimeScene)) play(runtimeScene);
      };

      export const saveLoadedToProjectStorage = (
        runtimeScene: gdjs.RuntimeScene,
        sceneName?: string
      ): void => {
        const state = getState(runtimeScene);
        if (!state.scene) {
          logger.warn(
            'Cinematic Timeline: save requested but no timeline is currently loaded.'
          );
          return;
        }

        const normalizedSceneName =
          normalizeSceneName(sceneName) ||
          normalizeSceneName(state.scene.name) ||
          'Cinematic Scene';
        const savedAt = new Date().toISOString();
        const projectStorageVariable = runtimeScene
          .getGame()
          .getVariables()
          .get(PROJECT_STORAGE_VARIABLE);

        let existingPayload: any = null;
        const existingRawText = projectStorageVariable.getAsString();
        if (existingRawText && String(existingRawText).trim()) {
          try {
            const parsedValue = JSON.parse(String(existingRawText));
            if (parsedValue && typeof parsedValue === 'object') {
              existingPayload = parsedValue;
            }
          } catch (error) {
            // Ignore invalid payload and overwrite it.
          }
        }

        const nextScenesByName = {
          ...getScenesByNameFromPayload(existingPayload),
        };
        const hasLegacyRootScene =
          existingPayload &&
          typeof existingPayload.sceneName === 'string' &&
          normalizeSceneName(existingPayload.sceneName) &&
          existingPayload.runtimeScene &&
          typeof existingPayload.runtimeScene === 'object';
        if (hasLegacyRootScene) {
          const legacySceneName = normalizeSceneName(existingPayload.sceneName);
          if (!nextScenesByName[legacySceneName]) {
            nextScenesByName[legacySceneName] = {
              sceneName: legacySceneName,
              fps: parseFiniteNumber(existingPayload.fps, state.scene.fps),
              savedAt:
                typeof existingPayload.savedAt === 'string'
                  ? existingPayload.savedAt
                  : savedAt,
              runtimeScene: existingPayload.runtimeScene,
            };
          }
        }

        nextScenesByName[normalizedSceneName] = {
          sceneName: normalizedSceneName,
          fps: state.scene.fps,
          savedAt,
          runtimeScene: state.scene,
        };

        const payload = {
          format: TIMELINE_FILE_FORMAT,
          version: TIMELINE_STORAGE_VERSION,
          sceneName: normalizedSceneName,
          activeSceneName: normalizedSceneName,
          fps: state.scene.fps,
          savedAt,
          runtimeScene: state.scene,
          scenesByName: nextScenesByName,
        };

        projectStorageVariable.setString(JSON.stringify(payload));
      };

      export const play = (runtimeScene: gdjs.RuntimeScene): void => {
        const state = getState(runtimeScene);
        const scene = state.scene;
        if (!scene) return;
        if (
          state.playbackRange.outFrame < state.playbackRange.inFrame ||
          state.playbackRange.outFrame > scene.duration
        ) {
          state.playbackRange = getDefaultPlaybackRangeForScene(scene);
        }
        const nextFrame = clampFrameToPlaybackRange(
          state.currentFrame,
          state.playbackRange
        );
        const shouldTriggerCurrentFrameEvents =
          !state.isPlaying &&
          Math.abs(nextFrame - state.playbackRange.inFrame) <= EPSILON;
        state.currentFrame = nextFrame;
        state.frameCursor = nextFrame;
        if (shouldTriggerCurrentFrameEvents) {
          triggerEventsAtFrame(state, nextFrame);
          applyFrame(runtimeScene, state, nextFrame);
        }
        state.isPlaying = true;
      };

      export const playShot = (
        runtimeScene: gdjs.RuntimeScene,
        shotIdOrName: string,
        shouldLoop?: any
      ): void => {
        const state = getState(runtimeScene);
        const scene = state.scene;
        if (!scene) return;
        const shot = getShotByIdOrName(scene, shotIdOrName);
        if (!shot) {
          logger.warn(`Cinematic Timeline: shot "${shotIdOrName}" was not found.`);
          return;
        }
        setPlaybackRange(state, scene, shot.startFrame, shot.endFrame);
        state.loopPlayback =
          typeof shouldLoop !== 'undefined' ? toBoolean(shouldLoop) : false;
        applyStateFrame(runtimeScene, state, state.playbackRange.inFrame, {
          triggerEventsAtCurrentFrame: true,
        });
        state.activeShotId = shot.id;
        state.isPlaying = true;
      };

      export const playRange = (
        runtimeScene: gdjs.RuntimeScene,
        startFrame: number,
        endFrame: number,
        shouldLoop?: any
      ): void => {
        const state = getState(runtimeScene);
        const scene = state.scene;
        if (!scene) return;
        setPlaybackRange(
          state,
          scene,
          parseFiniteNumber(startFrame, 0),
          parseFiniteNumber(endFrame, scene.duration)
        );
        state.loopPlayback =
          typeof shouldLoop !== 'undefined' ? toBoolean(shouldLoop) : false;
        applyStateFrame(runtimeScene, state, state.playbackRange.inFrame, {
          triggerEventsAtCurrentFrame: true,
        });
        state.isPlaying = true;
      };

      export const pause = (runtimeScene: gdjs.RuntimeScene): void => {
        const state = getState(runtimeScene);
        state.isPlaying = false;
      };

      export const stop = (runtimeScene: gdjs.RuntimeScene): void => {
        const state = getState(runtimeScene);
        state.isPlaying = false;
        state.configuredIKChains.clear();
        if (state.scene) {
          state.playbackRange = getDefaultPlaybackRangeForScene(state.scene);
          applyStateFrame(runtimeScene, state, state.playbackRange.inFrame);
        } else {
          state.currentFrame = 0;
          state.frameCursor = 0;
          state.playbackRange = createDefaultPlaybackRange();
          state.activeShotId = '';
          clearTriggeredEvents(state);
        }
      };

      export const setCurrentFrame = (
        runtimeScene: gdjs.RuntimeScene,
        frame: number
      ): void => {
        const state = getState(runtimeScene);
        if (!state.scene) return;
        applyStateFrame(
          runtimeScene,
          state,
          parseFiniteNumber(frame, 0),
          {
            triggerEventsAtCurrentFrame: true,
          }
        );
      };

      export const setLooping = (
        runtimeScene: gdjs.RuntimeScene,
        enableLooping: any
      ): void => {
        getState(runtimeScene).loopPlayback = toBoolean(enableLooping);
      };

      export const setLoopRange = (
        runtimeScene: gdjs.RuntimeScene,
        enableLoopRange: any,
        inFrame: number,
        outFrame: number
      ): void => {
        const state = getState(runtimeScene);
        if (!state.scene) return;
        state.scene.loopRange = normalizeLoopRange(
          {
            enabled: toBoolean(enableLoopRange),
            inFrame,
            outFrame,
          },
          state.scene.duration
        );
        state.playbackRange = getDefaultPlaybackRangeForScene(state.scene);
        applyStateFrame(runtimeScene, state, state.currentFrame);
      };

      export const setPlaybackSpeed = (
        runtimeScene: gdjs.RuntimeScene,
        playbackSpeed: number
      ): void => {
        getState(runtimeScene).playbackSpeed = clampNumber(
          parseFiniteNumber(playbackSpeed, 1),
          0,
          MAX_PLAYBACK_SPEED
        );
      };

      export const clearTriggeredEventsLog = (
        runtimeScene: gdjs.RuntimeScene
      ): void => {
        clearTriggeredEvents(getState(runtimeScene));
      };

      export const isPlaying = (runtimeScene: gdjs.RuntimeScene): boolean =>
        getState(runtimeScene).isPlaying;

      export const hasLoadedScene = (
        runtimeScene: gdjs.RuntimeScene
      ): boolean => !!getState(runtimeScene).scene;

      export const hasSceneInProjectStorage = (
        runtimeScene: gdjs.RuntimeScene,
        sceneName: string
      ): boolean => {
        const normalizedSceneName = normalizeSceneName(sceneName);
        if (!normalizedSceneName) return false;
        const rawText = runtimeScene
          .getGame()
          .getVariables()
          .get(PROJECT_STORAGE_VARIABLE)
          .getAsString();
        if (!rawText || !String(rawText).trim()) return false;

        try {
          const parsedValue = JSON.parse(String(rawText));
          return !!findSceneEntryInPayload(parsedValue, normalizedSceneName);
        } catch (error) {
          return false;
        }
      };

      export const isLoopRangeEnabled = (
        runtimeScene: gdjs.RuntimeScene
      ): boolean => {
        const scene = getState(runtimeScene).scene;
        return !!(scene && scene.loopRange.enabled);
      };

      export const isInShot = (
        runtimeScene: gdjs.RuntimeScene,
        shotIdOrName: string
      ): boolean => {
        const state = getState(runtimeScene);
        if (!state.scene) return false;
        const shot = getShotByIdOrName(state.scene, shotIdOrName);
        if (!shot) return false;
        return (
          state.currentFrame >= shot.startFrame &&
          state.currentFrame <= shot.endFrame
        );
      };

      export const wasEventTriggered = (
        runtimeScene: gdjs.RuntimeScene,
        eventIdOrName: string
      ): boolean => {
        const state = getState(runtimeScene);
        const normalizedEventIdOrName = String(eventIdOrName || '').trim();
        if (!normalizedEventIdOrName) {
          return !!state.lastTriggeredEvent;
        }
        const lowerCaseEventName = normalizedEventIdOrName.toLowerCase();
        return (
          state.triggeredEventIdsThisFrame.has(normalizedEventIdOrName) ||
          state.triggeredEventNamesThisFrame.has(lowerCaseEventName)
        );
      };

      export const getCurrentFrame = (
        runtimeScene: gdjs.RuntimeScene
      ): number => getState(runtimeScene).currentFrame;

      export const getDuration = (runtimeScene: gdjs.RuntimeScene): number => {
        const scene = getState(runtimeScene).scene;
        return scene ? scene.duration : 0;
      };

      export const getFps = (runtimeScene: gdjs.RuntimeScene): number => {
        const scene = getState(runtimeScene).scene;
        return scene ? scene.fps : 0;
      };

      export const getActiveShotName = (
        runtimeScene: gdjs.RuntimeScene
      ): string => {
        const state = getState(runtimeScene);
        if (!state.scene || !state.activeShotId) return '';
        const shot =
          state.scene.shots.find(candidate => candidate.id === state.activeShotId) ||
          null;
        return shot ? shot.name : '';
      };

      export const getLastTriggeredEventName = (
        runtimeScene: gdjs.RuntimeScene
      ): string => {
        const eventMarker = getState(runtimeScene).lastTriggeredEvent;
        return eventMarker ? eventMarker.name : '';
      };

      export const getLastTriggeredEventPayload = (
        runtimeScene: gdjs.RuntimeScene
      ): string => {
        const eventMarker = getState(runtimeScene).lastTriggeredEvent;
        return eventMarker ? eventMarker.payload : '';
      };

      export const getLoopInFrame = (runtimeScene: gdjs.RuntimeScene): number => {
        const scene = getState(runtimeScene).scene;
        return scene ? scene.loopRange.inFrame : 0;
      };

      export const getLoopOutFrame = (
        runtimeScene: gdjs.RuntimeScene
      ): number => {
        const scene = getState(runtimeScene).scene;
        return scene ? scene.loopRange.outFrame : 0;
      };

      export const triggerEventByIdOrName = (
        runtimeScene: gdjs.RuntimeScene,
        eventIdOrName: string
      ): void => {
        const state = getState(runtimeScene);
        if (!state.scene) return;
        const eventMarker = getEventByIdOrName(state.scene, eventIdOrName);
        if (!eventMarker) return;
        clearTriggeredEvents(state);
        registerTriggeredEvent(state, eventMarker);
      };
    }
  }

  export namespace cinematicTimeline {
    export const loadFromJson = (
      runtimeScene: gdjs.RuntimeScene,
      jsonString: string
    ): void => evtTools.cinematicTimeline.loadFromJson(runtimeScene, jsonString);

    export const loadFromProjectStorage = (
      runtimeScene: gdjs.RuntimeScene,
      sceneName?: string
    ): void =>
      evtTools.cinematicTimeline.loadFromProjectStorage(runtimeScene, sceneName);

    export const loadAndPlayFromProjectStorage = (
      runtimeScene: gdjs.RuntimeScene,
      sceneName?: string
    ): void =>
      evtTools.cinematicTimeline.loadAndPlayFromProjectStorage(
        runtimeScene,
        sceneName
      );

    export const saveLoadedToProjectStorage = (
      runtimeScene: gdjs.RuntimeScene,
      sceneName?: string
    ): void =>
      evtTools.cinematicTimeline.saveLoadedToProjectStorage(
        runtimeScene,
        sceneName
      );

    export const playShot = (
      runtimeScene: gdjs.RuntimeScene,
      shotIdOrName: string,
      shouldLoop?: any
    ): void =>
      evtTools.cinematicTimeline.playShot(
        runtimeScene,
        shotIdOrName,
        shouldLoop
      );

    export const playRange = (
      runtimeScene: gdjs.RuntimeScene,
      startFrame: number,
      endFrame: number,
      shouldLoop?: any
    ): void =>
      evtTools.cinematicTimeline.playRange(
        runtimeScene,
        startFrame,
        endFrame,
        shouldLoop
      );

    export const play = (runtimeScene: gdjs.RuntimeScene): void =>
      evtTools.cinematicTimeline.play(runtimeScene);
    export const pause = (runtimeScene: gdjs.RuntimeScene): void =>
      evtTools.cinematicTimeline.pause(runtimeScene);
    export const stop = (runtimeScene: gdjs.RuntimeScene): void =>
      evtTools.cinematicTimeline.stop(runtimeScene);
    export const setCurrentFrame = (
      runtimeScene: gdjs.RuntimeScene,
      frame: number
    ): void => evtTools.cinematicTimeline.setCurrentFrame(runtimeScene, frame);
    export const setLooping = (
      runtimeScene: gdjs.RuntimeScene,
      enableLooping: any
    ): void => evtTools.cinematicTimeline.setLooping(runtimeScene, enableLooping);
    export const setPlaybackSpeed = (
      runtimeScene: gdjs.RuntimeScene,
      playbackSpeed: number
    ): void =>
      evtTools.cinematicTimeline.setPlaybackSpeed(runtimeScene, playbackSpeed);
    export const clearTriggeredEventsLog = (
      runtimeScene: gdjs.RuntimeScene
    ): void => evtTools.cinematicTimeline.clearTriggeredEventsLog(runtimeScene);
    export const isPlaying = (runtimeScene: gdjs.RuntimeScene): boolean =>
      evtTools.cinematicTimeline.isPlaying(runtimeScene);
    export const hasLoadedScene = (runtimeScene: gdjs.RuntimeScene): boolean =>
      evtTools.cinematicTimeline.hasLoadedScene(runtimeScene);
    export const hasSceneInProjectStorage = (
      runtimeScene: gdjs.RuntimeScene,
      sceneName: string
    ): boolean =>
      evtTools.cinematicTimeline.hasSceneInProjectStorage(
        runtimeScene,
        sceneName
      );
    export const isLoopRangeEnabled = (
      runtimeScene: gdjs.RuntimeScene
    ): boolean => evtTools.cinematicTimeline.isLoopRangeEnabled(runtimeScene);
    export const wasEventTriggered = (
      runtimeScene: gdjs.RuntimeScene,
      eventIdOrName: string
    ): boolean =>
      evtTools.cinematicTimeline.wasEventTriggered(runtimeScene, eventIdOrName);
    export const getCurrentFrame = (runtimeScene: gdjs.RuntimeScene): number =>
      evtTools.cinematicTimeline.getCurrentFrame(runtimeScene);
    export const getDuration = (runtimeScene: gdjs.RuntimeScene): number =>
      evtTools.cinematicTimeline.getDuration(runtimeScene);
    export const getFps = (runtimeScene: gdjs.RuntimeScene): number =>
      evtTools.cinematicTimeline.getFps(runtimeScene);
    export const getActiveShotName = (
      runtimeScene: gdjs.RuntimeScene
    ): string => evtTools.cinematicTimeline.getActiveShotName(runtimeScene);
    export const getLastTriggeredEventName = (
      runtimeScene: gdjs.RuntimeScene
    ): string =>
      evtTools.cinematicTimeline.getLastTriggeredEventName(runtimeScene);
    export const getLastTriggeredEventPayload = (
      runtimeScene: gdjs.RuntimeScene
    ): string =>
      evtTools.cinematicTimeline.getLastTriggeredEventPayload(runtimeScene);
    export const getLoopInFrame = (runtimeScene: gdjs.RuntimeScene): number =>
      evtTools.cinematicTimeline.getLoopInFrame(runtimeScene);
    export const getLoopOutFrame = (runtimeScene: gdjs.RuntimeScene): number =>
      evtTools.cinematicTimeline.getLoopOutFrame(runtimeScene);
    export const triggerEventByIdOrName = (
      runtimeScene: gdjs.RuntimeScene,
      eventIdOrName: string
    ): void =>
      evtTools.cinematicTimeline.triggerEventByIdOrName(
        runtimeScene,
        eventIdOrName
      );
  }
}
