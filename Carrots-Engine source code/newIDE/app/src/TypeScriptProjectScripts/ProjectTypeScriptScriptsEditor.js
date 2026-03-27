// @flow
import * as React from 'react';
import { Trans, t } from '@lingui/macro';
import Measure from 'react-measure';
import RaisedButton from '../UI/RaisedButton';
import IconButton from '../UI/IconButton';
import Text from '../UI/Text';
import CompactSemiControlledTextField from '../UI/CompactSemiControlledTextField';
import CompactSelectField from '../UI/CompactSelectField';
import SelectOption from '../UI/SelectOption';
import Add from '../UI/CustomSvgIcons/Add';
import Trash from '../UI/CustomSvgIcons/Trash';
import ArrowTop from '../UI/CustomSvgIcons/ArrowTop';
import ArrowBottom from '../UI/CustomSvgIcons/ArrowBottom';
import FileWithLines from '../UI/CustomSvgIcons/FileWithLines';
import BackgroundText from '../UI/BackgroundText';
import newNameGenerator from '../Utils/NewNameGenerator';
import { showWarningBox } from '../UI/Messages/MessageBox';
import { CodeEditor } from '../CodeEditor';
import {
  type TypeScriptDiagnostic,
  preloadTypeScriptCompiler,
  transpileTypeScriptCode,
} from '../CodeEditor/TypeScriptEventCode';
import {
  type RuntimeBehaviorTypesByType,
  getRuntimeBehaviorTypesByType,
  preloadRuntimeBehaviorTypesByType,
} from '../CodeEditor/RuntimeBehaviorTypes';
import {
  type ProjectTypeScriptScript,
  type ProjectTypeScriptScriptIncludePosition,
  generateTypeScriptProjectScriptId,
  loadProjectTypeScriptScripts,
  saveProjectTypeScriptScripts,
} from './ProjectTypeScriptScriptsMetadata';
import { refreshTypeScriptProjectBehaviorsExtension } from './TypeScriptProjectBehaviorsRegistry';
import { type UnsavedChanges } from '../MainFrame/UnsavedChangesContext';

const styles = {
  container: {
    display: 'flex',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: '#1f2330',
  },
  filesPane: {
    width: 310,
    minWidth: 270,
    maxWidth: 420,
    borderRight: '1px solid #2d3446',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    backgroundColor: '#202634',
  },
  filesPaneMenuBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    padding: '0 12px',
    borderBottom: '1px solid #2d3446',
    color: '#a8b3c9',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  filesPaneToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px 10px 10px',
    borderBottom: '1px solid #2d3446',
  },
  filesList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 8px 4px 8px',
  },
  filesPaneFooter: {
    borderTop: '1px solid #2d3446',
    minHeight: 96,
    maxHeight: 180,
    overflowY: 'auto',
    padding: '6px 8px',
  },
  filesPaneFooterTitle: {
    fontSize: 11,
    color: '#8a97b3',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '7px 8px',
    marginBottom: 3,
    minHeight: 44,
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid transparent',
    color: '#d6deef',
    fontFamily: 'Consolas, "Cascadia Code", monospace',
  },
  selectedFileRow: {
    backgroundColor: '#283042',
    borderColor: '#59677f',
    boxShadow: 'inset 2px 0 0 #d4b85f',
  },
  fileRowName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
  },
  fileRowStatus: {
    fontSize: 10,
    color: '#92a4c7',
    whiteSpace: 'nowrap',
  },
  scriptContextBadge: {
    marginRight: 6,
    padding: '1px 5px',
    borderRadius: 4,
    fontSize: 9,
    backgroundColor: '#3b465d',
    color: '#d1d9ec',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  editorPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1b2130',
  },
  editorTopMenu: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    height: 32,
    padding: '0 12px',
    borderBottom: '1px solid #2d3446',
    color: '#a6b4ce',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  menuTitle: {
    fontSize: 11,
    color: '#d2ddef',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menuMeta: {
    fontSize: 10,
    color: '#8ea0be',
    whiteSpace: 'nowrap',
  },
  editorHeader: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '8px 10px',
    borderBottom: '1px solid #2d3446',
    minHeight: 56,
    backgroundColor: '#1d2433',
  },
  editorHeaderControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 260,
  },
  editorStatus: {
    fontSize: 12,
    color: '#9aa9c3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 220,
  },
  editorStatusError: {
    color: '#ffb3b3',
  },
  emptyState: {
    padding: 20,
  },
  emptyStateTitle: {
    marginBottom: 8,
  },
  codeEditorContainer: {
    flex: 1,
    minHeight: 0,
  },
  diagnosticsPanel: {
    maxHeight: 180,
    minHeight: 72,
    overflowY: 'auto',
    borderTop: '1px solid #2d3446',
    padding: '8px 10px',
    backgroundColor: '#1a2130',
  },
  diagnosticsEmptyState: {
    fontSize: 12,
    color: '#7f7f7f',
  },
  diagnosticEntry: {
    padding: '4px 0',
    fontSize: 12,
    color: '#ffb3b3',
    cursor: 'pointer',
    wordBreak: 'break-word',
  },
  diagnosticEntryPath: {
    color: '#ffd2d2',
    marginRight: 6,
    fontWeight: 500,
  },
  editorFooter: {
    height: 24,
    borderTop: '1px solid #2d3446',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 10px',
    fontSize: 11,
    color: '#9eb2d3',
    backgroundColor: '#182031',
    fontFamily: 'Consolas, "Cascadia Code", monospace',
  },
  outlineEntry: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    padding: '4px 6px',
    borderRadius: 4,
    cursor: 'pointer',
    color: '#cad5eb',
    fontSize: 11,
    fontFamily: 'Consolas, "Cascadia Code", monospace',
  },
  outlineEntryLine: {
    color: '#7f8fb0',
    fontSize: 10,
  },
};

type ScriptCompilationState = {|
  isCompiling: boolean,
  errorMessage: ?string,
  diagnostics: Array<TypeScriptDiagnostic>,
|};

const defaultCompilationState: ScriptCompilationState = {
  isCompiling: false,
  errorMessage: null,
  diagnostics: [],
};

type ContextScriptTarget = {|
  contextKind: 'scene' | 'object' | 'behavior',
  sceneName: string,
  objectName: string,
  behaviorName: string,
|};

type PreferredScriptTarget = {|
  contextKind: 'scene' | 'object' | 'behavior',
  sceneName?: string,
  objectName?: string,
  behaviorName?: string,
|};

type Props = {|
  project: gdProject,
  projectFilePath: ?string,
  preferredSceneName: ?string,
  preferredScriptTarget?: ?PreferredScriptTarget,
  setToolbar: (?React.Node) => void,
  unsavedChanges: ?UnsavedChanges,
  onScriptsChanged: () => void,
|};

type State = {|
  scripts: Array<ProjectTypeScriptScript>,
  selectedScriptId: ?string,
  codeEditorWidth: number,
  codeEditorHeight: number,
  filesListHeight: number,
  filesListScrollTop: number,
  compilationByScriptId: { [string]: ScriptCompilationState },
  runtimeBehaviorTypesByType: RuntimeBehaviorTypesByType,
  revealedPosition: ?{|
    scriptId: string,
    lineNumber: number,
    column: number,
  |},
  cursorPosition: {|
    lineNumber: number,
    column: number,
  |},
|};

export default class ProjectTypeScriptScriptsEditor extends React.Component<
  Props,
  State
> {
  _transpileRequestIdByScriptId: { [string]: number } = {};
  _lastContextTargetsFingerprint: string = '';
  _compileTimeoutByScriptId: { [string]: TimeoutID } = {};
  _compileAllScriptsTimeouts: Array<TimeoutID> = [];
  _persistScriptsTimeout: ?TimeoutID = null;
  _persistScriptsShouldNotifyChanges: boolean = false;
  _persistScriptsShouldRefreshBehaviorsRegistry: boolean = false;
  _projectTypingExtraLibCache: ?{| content: string, filePath: string |} = null;
  _projectTypingExtraLibCacheKey: string = '';
  _projectScriptsExtraLibsCacheKey: string = '';
  _projectScriptsExtraLibsCache: Array<{| content: string, filePath: string |}> = [];
  _cursorPositionUpdateTimeout: ?TimeoutID = null;
  _pendingCursorPosition: ?{| lineNumber: number, column: number |} = null;
  _resizeAnimationFrameId: ?number = null;
  _lastMeasuredEditorSize: {| width: number, height: number |} = {
    width: 900,
    height: 600,
  };
  _cachedDiagnosticsCompilationByScriptIdRef: ?{
    [string]: ScriptCompilationState,
  } = null;
  _cachedDiagnosticsScriptsRef: ?Array<ProjectTypeScriptScript> = null;
  _cachedDiagnostics: Array<{|
    scriptId: string,
    scriptName: string,
    diagnostic: TypeScriptDiagnostic,
  |}> = [];
  _outlineCacheScriptId: ?string = null;
  _outlineCacheSource: string = '';
  _outlineCacheEntries: Array<{| name: string, lineNumber: number |}> = [];
  _filesListScrollAnimationFrameId: ?number = null;
  _backgroundPreloadTimeout: ?TimeoutID = null;
  _compileInFlightByScriptId: { [string]: boolean } = {};
  _queuedCompileSourceByScriptId: { [string]: string } = {};
  _lastAppliedPreferredScriptTargetKey: string = '';

  state = {
    scripts: loadProjectTypeScriptScripts(this.props.project, {
      projectFilePath: this.props.projectFilePath,
    }),
    selectedScriptId: null,
    codeEditorWidth: 900,
    codeEditorHeight: 600,
    filesListHeight: 420,
    filesListScrollTop: 0,
    compilationByScriptId: {},
    runtimeBehaviorTypesByType: {},
    revealedPosition: null,
    cursorPosition: {
      lineNumber: 1,
      column: 1,
    },
  };

  _sanitizePathSegment = (name: string): string => {
    const sanitized = (name || '')
      .trim()
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ');
    return sanitized || 'Untitled';
  };

  _toIdentifier = (name: string): string => {
    const normalized = this._sanitizePathSegment(name).replace(/[^A-Za-z0-9_$]/g, '_');
    if (!normalized) return 'ScriptTarget';
    if (/^[0-9]/.test(normalized)) return `_${normalized}`;
    return normalized;
  };

  _getScriptContextKey = ({
    contextKind,
    sceneName,
    objectName,
    behaviorName,
  }: any): string =>
    `${contextKind}|${sceneName || ''}|${objectName || ''}|${behaviorName || ''}`;

  _getContextTargetKey = (target: ContextScriptTarget): string =>
    this._getScriptContextKey({
      contextKind: target.contextKind,
      sceneName: target.sceneName,
      objectName: target.objectName,
      behaviorName: target.behaviorName,
    });

  _normalizePreferredScriptTarget = (
    target: ?PreferredScriptTarget
  ): ?ContextScriptTarget => {
    if (!target) return null;
    return {
      contextKind: target.contextKind,
      sceneName: target.sceneName || '',
      objectName: target.objectName || '',
      behaviorName: target.behaviorName || '',
    };
  };

  _getContextTargetFromScript = (
    script: ProjectTypeScriptScript
  ): ?ContextScriptTarget => {
    if (
      script.contextKind !== 'scene' &&
      script.contextKind !== 'object' &&
      script.contextKind !== 'behavior'
    ) {
      return null;
    }
    return {
      contextKind: script.contextKind,
      sceneName: script.sceneName || '',
      objectName: script.objectName || '',
      behaviorName: script.behaviorName || '',
    };
  };

  _findScriptByContextTarget = (
    scripts: Array<ProjectTypeScriptScript>,
    target: ContextScriptTarget
  ): ?ProjectTypeScriptScript => {
    const targetKey = this._getContextTargetKey(target);
    return (
      scripts.find(script => {
        const scriptTarget = this._getContextTargetFromScript(script);
        return (
          !!scriptTarget && this._getContextTargetKey(scriptTarget) === targetKey
        );
      }) || null
    );
  };

  _isContextTargetAvailableInProject = (target: ContextScriptTarget): boolean => {
    const availableTargets = this._computeProjectContextTargets({
      includeObjectAndBehaviorTargets: true,
    });
    const targetKey = this._getContextTargetKey(target);
    return availableTargets.some(
      contextTarget => this._getContextTargetKey(contextTarget) === targetKey
    );
  };

  _getPreferredScriptTargetKey = (
    target: ?PreferredScriptTarget
  ): string => {
    const normalizedTarget = this._normalizePreferredScriptTarget(target);
    return normalizedTarget ? this._getContextTargetKey(normalizedTarget) : '';
  };

  _openContextScript = (
    preferredScriptTarget: ?PreferredScriptTarget,
    options?: {| notifyScriptsChanged?: boolean |}
  ): boolean => {
    const notifyScriptsChanged =
      options && options.notifyScriptsChanged !== undefined
        ? !!options.notifyScriptsChanged
        : true;
    const target = this._normalizePreferredScriptTarget(preferredScriptTarget);
    if (!target) return false;
    if (!this._isContextTargetAvailableInProject(target)) return false;

    const existingScript = this._findScriptByContextTarget(this.state.scripts, target);
    if (existingScript) {
      if (this.state.selectedScriptId !== existingScript.id) {
        this.setState({
          selectedScriptId: existingScript.id,
        });
      }
      return true;
    }

    const nextScript = this._createContextScript(target);
    const nextScripts = [...this.state.scripts, nextScript];
    this.setState(
      {
        selectedScriptId: nextScript.id,
      },
      () => {
        this._saveScripts(nextScripts, {
          notifyScriptsChanged,
        });
        this._compileScript(nextScript.id, nextScript.source);
      }
    );
    return true;
  };

  _applyPreferredScriptTarget = () => {
    const targetKey = this._getPreferredScriptTargetKey(
      this.props.preferredScriptTarget
    );
    if (!targetKey || targetKey === this._lastAppliedPreferredScriptTargetKey) {
      return;
    }
    const didOpenTarget = this._openContextScript(this.props.preferredScriptTarget, {
      notifyScriptsChanged: true,
    });
    if (didOpenTarget) {
      this._lastAppliedPreferredScriptTargetKey = targetKey;
    }
  };

  _buildContextScriptFileName = (target: ContextScriptTarget): string => {
    if (target.contextKind === 'scene') {
      return `scenes/${this._sanitizePathSegment(target.sceneName)}/scene.ts`;
    }

    const contextFolder = target.sceneName
      ? `scenes/${this._sanitizePathSegment(target.sceneName)}`
      : 'global';

    if (target.contextKind === 'object') {
      return `${contextFolder}/objects/${this._sanitizePathSegment(
        target.objectName
      )}.ts`;
    }

    return `${contextFolder}/behaviors/${this._sanitizePathSegment(
      target.objectName
    )}.${this._sanitizePathSegment(target.behaviorName)}.ts`;
  };

  _buildContextScriptTemplate = (target: ContextScriptTarget): string => {
    if (target.contextKind === 'scene') {
      return `// Scene script: ${target.sceneName}
// Auto-wired by the engine for this scene.

export function onSceneLoaded(runtimeScene: gdjs.RuntimeScene): void {
  const scene = runtimeScene;
  void scene;
  // Example:
  // const playerObjects = scene.getObjects('Player');
  // if (playerObjects.length) playerObjects[0].setX(120);
}

export function onScenePreEvents(runtimeScene: gdjs.RuntimeScene): void {
  const scene = runtimeScene;
  void scene;
}

export function onScenePostEvents(runtimeScene: gdjs.RuntimeScene): void {
  const scene = runtimeScene;
  void scene;
}

export function onSceneUnloading(runtimeScene: gdjs.RuntimeScene): void {
  const scene = runtimeScene;
  void scene;
}

export function onSceneUnloaded(runtimeScene: gdjs.RuntimeScene): void {
  const scene = runtimeScene;
  void scene;
}
`;
    }

    if (target.contextKind === 'object') {
      const scenePrefix = target.sceneName
        ? `scene "${target.sceneName}"`
        : 'global objects';
      const objectTypeName = JSON.stringify(target.objectName || '');
      return `// Object script: ${target.objectName} (${scenePrefix})
// Auto-wired by the engine for this object.

type CurrentObject = __GDevelopProjectObjectLists[${objectTypeName}][number];

export function onObjectCreated(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  void scene;
  void object;
}

export function onObjectPreEvents(
  runtimeScene: gdjs.RuntimeScene,
  objects: gdjs.RuntimeObject[]
): void {
  const scene = runtimeScene;
  const objectInstances = objects as CurrentObject[];
  void scene;
  void objectInstances;
}

export function onObjectPostEvents(
  runtimeScene: gdjs.RuntimeScene,
  objects: gdjs.RuntimeObject[]
): void {
  const scene = runtimeScene;
  const objectInstances = objects as CurrentObject[];
  void scene;
  void objectInstances;
}

export function onObjectDestroyed(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  void scene;
  void object;
}
`;
    }

    const scenePrefix = target.sceneName
      ? `scene "${target.sceneName}"`
      : 'global objects';
    const objectTypeName = JSON.stringify(target.objectName || '');
    const behaviorTypeName = JSON.stringify(target.behaviorName || '');
    return `// Behavior script: ${target.behaviorName} on ${target.objectName} (${scenePrefix})
// Auto-wired by the engine for this behavior.

type CurrentObject = __GDevelopProjectObjectLists[${objectTypeName}][number];
type CurrentBehavior = __GDevelopProjectBehaviorByName[${behaviorTypeName}];

export function onBehaviorCreated(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  const currentBehavior = behavior as CurrentBehavior;
  void scene;
  void object;
  void currentBehavior;
}

export function onBehaviorActivate(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  const currentBehavior = behavior as CurrentBehavior;
  void scene;
  void object;
  void currentBehavior;
}

export function onBehaviorDeActivate(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  const currentBehavior = behavior as CurrentBehavior;
  void scene;
  void object;
  void currentBehavior;
}

export function doStepPreEvents(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  const currentBehavior = behavior as CurrentBehavior;
  void scene;
  void object;
  void currentBehavior;
}

export function doStepPostEvents(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  const currentBehavior = behavior as CurrentBehavior;
  void scene;
  void object;
  void currentBehavior;
}

export function onBehaviorDestroy(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  const scene = runtimeScene;
  const object = owner as CurrentObject;
  const currentBehavior = behavior as CurrentBehavior;
  void scene;
  void object;
  void currentBehavior;
}
`;
  };

  _createContextScript = (target: ContextScriptTarget): ProjectTypeScriptScript => ({
    id: generateTypeScriptProjectScriptId(),
    name: this._buildContextScriptFileName(target),
    source: this._buildContextScriptTemplate(target),
    transpiledCode: '',
    includePosition: 'last',
    contextKind: target.contextKind,
    sceneName: target.sceneName,
    objectName: target.objectName,
    behaviorName: target.behaviorName,
  });

  _enumerateContextTargetsFromContainer = (
    sceneName: string,
    objectsContainer: any
  ): Array<ContextScriptTarget> => {
    if (
      !objectsContainer ||
      typeof objectsContainer.getObjectsCount !== 'function' ||
      typeof objectsContainer.getObjectAt !== 'function'
    ) {
      return [];
    }

    const targets = [];
    const objectsCount = objectsContainer.getObjectsCount();
    for (let i = 0; i < objectsCount; i++) {
      const object = objectsContainer.getObjectAt(i);
      if (!object || typeof object.getName !== 'function') continue;

      const objectName = object.getName();
      if (!objectName) continue;

      targets.push({
        contextKind: 'object',
        sceneName,
        objectName,
        behaviorName: '',
      });

      if (typeof object.getAllBehaviorNames !== 'function') continue;
      const behaviorNamesVector = object.getAllBehaviorNames();
      if (
        !behaviorNamesVector ||
        typeof behaviorNamesVector.size !== 'function' ||
        typeof behaviorNamesVector.at !== 'function'
      ) {
        continue;
      }

      for (let j = 0; j < behaviorNamesVector.size(); j++) {
        const behaviorName = behaviorNamesVector.at(j);
        if (!behaviorName) continue;

        targets.push({
          contextKind: 'behavior',
          sceneName,
          objectName,
          behaviorName,
        });
      }
    }

    return targets;
  };

  _computeProjectContextTargets = (
    options: {| includeObjectAndBehaviorTargets?: boolean |} = {}
  ): Array<ContextScriptTarget> => {
    const includeObjectAndBehaviorTargets =
      options.includeObjectAndBehaviorTargets === undefined
        ? true
        : !!options.includeObjectAndBehaviorTargets;
    const targets = [];

    const layoutsCount = this.props.project.getLayoutsCount();
    for (let i = 0; i < layoutsCount; i++) {
      const layout = this.props.project.getLayoutAt(i);
      const sceneName = layout.getName();
      if (!sceneName) continue;

      targets.push({
        contextKind: 'scene',
        sceneName,
        objectName: '',
        behaviorName: '',
      });

      if (includeObjectAndBehaviorTargets) {
        targets.push(
          ...this._enumerateContextTargetsFromContainer(
            sceneName,
            layout.getObjects()
          )
        );
      }
    }

    if (includeObjectAndBehaviorTargets) {
      targets.push(
        ...this._enumerateContextTargetsFromContainer(
          '',
          this.props.project.getObjects()
        )
      );
    }

    const dedupedTargetsByKey = new Map<string, ContextScriptTarget>();
    targets.forEach(target => {
      dedupedTargetsByKey.set(this._getContextTargetKey(target), target);
    });

    return Array.from(dedupedTargetsByKey.values()).sort((a, b) =>
      this._getContextTargetKey(a).localeCompare(this._getContextTargetKey(b))
    );
  };

  _computeContextTargetsFingerprint = (
    targets: Array<ContextScriptTarget>
  ): string => targets.map(target => this._getContextTargetKey(target)).join('\n');

  _getPreferredSceneScriptId = (
    scripts: Array<ProjectTypeScriptScript>,
    preferredSceneName: ?string
  ): ?string => {
    if (!preferredSceneName) return null;
    const matchingScript = scripts.find(
      script =>
        script.contextKind === 'scene' && script.sceneName === preferredSceneName
    );
    return matchingScript ? matchingScript.id : null;
  };

  _ensureContextScripts = (
    options: {|
      preferredSceneName?: ?string,
      notifyScriptsChanged?: boolean,
      includeObjectAndBehaviorTargets?: boolean,
    |} = {}
  ) => {
    const preferredSceneName =
      options.preferredSceneName !== undefined
        ? options.preferredSceneName
        : this.props.preferredSceneName;
    const notifyScriptsChanged =
      options.notifyScriptsChanged === undefined
        ? true
        : !!options.notifyScriptsChanged;
    const includeObjectAndBehaviorTargets =
      options.includeObjectAndBehaviorTargets === undefined
        ? false
        : !!options.includeObjectAndBehaviorTargets;

    const targets = this._computeProjectContextTargets({
      includeObjectAndBehaviorTargets,
    });
    this._lastContextTargetsFingerprint =
      this._computeContextTargetsFingerprint(targets);

    const existingScripts = this.state.scripts;
    const scriptsByContextKey = new Map<string, ProjectTypeScriptScript>();
    existingScripts.forEach(script => {
      const isContextScript =
        script.contextKind === 'scene' ||
        script.contextKind === 'object' ||
        script.contextKind === 'behavior';
      if (!isContextScript) return;
      scriptsByContextKey.set(this._getScriptContextKey(script), script);
    });

    const createdScripts = [];
    targets.forEach(target => {
      const key = this._getContextTargetKey(target);
      if (scriptsByContextKey.has(key)) return;

      const script = this._createContextScript(target);
      scriptsByContextKey.set(key, script);
      createdScripts.push(script);
    });

    const nextScripts =
      createdScripts.length > 0
        ? [...existingScripts, ...createdScripts]
        : existingScripts;
    const preferredSceneScriptId = this._getPreferredSceneScriptId(
      nextScripts,
      preferredSceneName
    );
    const nextSelectedScriptId =
      preferredSceneScriptId ||
      this.state.selectedScriptId ||
      (nextScripts.length ? nextScripts[0].id : null);

    if (createdScripts.length > 0) {
      this.setState(
        {
          selectedScriptId: nextSelectedScriptId,
        },
        () => {
          this._saveScripts(nextScripts, {
            notifyScriptsChanged,
          });
          this._compileSelectedScriptIfNeeded();
        }
      );
      return;
    }

    if (nextSelectedScriptId !== this.state.selectedScriptId) {
      this.setState({
        selectedScriptId: nextSelectedScriptId,
      });
    }
  };

  _clearAllScheduledScriptCompiles = () => {
    Object.keys(this._compileTimeoutByScriptId).forEach(scriptId => {
      clearTimeout(this._compileTimeoutByScriptId[scriptId]);
      delete this._compileTimeoutByScriptId[scriptId];
    });
    this._compileInFlightByScriptId = {};
    this._queuedCompileSourceByScriptId = {};
    this._transpileRequestIdByScriptId = {};
  };

  _clearCompileAllScriptsQueue = () => {
    this._compileAllScriptsTimeouts.forEach(timeout => clearTimeout(timeout));
    this._compileAllScriptsTimeouts = [];
  };

  _invalidateDerivedCaches = () => {
    this._cachedDiagnosticsCompilationByScriptIdRef = null;
    this._cachedDiagnosticsScriptsRef = null;
    this._cachedDiagnostics = [];
    this._outlineCacheScriptId = null;
    this._outlineCacheSource = '';
    this._outlineCacheEntries = [];
  };

  _scheduleCompileScript = (scriptId: string, source: string) => {
    const existingTimeout = this._compileTimeoutByScriptId[scriptId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      delete this._compileTimeoutByScriptId[scriptId];
    }

    this._compileTimeoutByScriptId[scriptId] = setTimeout(() => {
      delete this._compileTimeoutByScriptId[scriptId];
      this._compileScript(scriptId, source);
    }, 260);
  };

  _persistScriptsToProject = (
    scripts: Array<ProjectTypeScriptScript>,
    options: {|
      notifyScriptsChanged: boolean,
      previousScripts?: ?Array<ProjectTypeScriptScript>,
      refreshBehaviorsRegistry?: boolean,
    |}
  ) => {
    saveProjectTypeScriptScripts(this.props.project, scripts, {
      projectFilePath: this.props.projectFilePath,
      previousScripts: options.previousScripts || scripts,
    });
    if (options.refreshBehaviorsRegistry !== false) {
      refreshTypeScriptProjectBehaviorsExtension(this.props.project);
    }
    if (this.props.unsavedChanges) {
      this.props.unsavedChanges.triggerUnsavedChanges();
    }
    if (options.notifyScriptsChanged) {
      this.props.onScriptsChanged();
    }
  };

  _clearScheduledPersistScripts = () => {
    if (this._persistScriptsTimeout) {
      clearTimeout(this._persistScriptsTimeout);
      this._persistScriptsTimeout = null;
    }
    this._persistScriptsShouldNotifyChanges = false;
    this._persistScriptsShouldRefreshBehaviorsRegistry = false;
  };

  _flushScheduledPersistScripts = () => {
    if (!this._persistScriptsTimeout) return;
    clearTimeout(this._persistScriptsTimeout);
    this._persistScriptsTimeout = null;
    const shouldNotify = this._persistScriptsShouldNotifyChanges;
    const shouldRefreshBehaviorsRegistry =
      this._persistScriptsShouldRefreshBehaviorsRegistry;
    this._persistScriptsShouldNotifyChanges = false;
    this._persistScriptsShouldRefreshBehaviorsRegistry = false;
    this._persistScriptsToProject(this.state.scripts, {
      notifyScriptsChanged: shouldNotify,
      previousScripts: this.state.scripts,
      refreshBehaviorsRegistry: shouldRefreshBehaviorsRegistry,
    });
  };

  _schedulePersistScripts = (
    options: {|
      notifyScriptsChanged: boolean,
      refreshBehaviorsRegistry?: boolean,
    |} = {
      notifyScriptsChanged: false,
      refreshBehaviorsRegistry: false,
    }
  ) => {
    if (options.notifyScriptsChanged) {
      this._persistScriptsShouldNotifyChanges = true;
    }
    if (options.refreshBehaviorsRegistry) {
      this._persistScriptsShouldRefreshBehaviorsRegistry = true;
    }

    if (this._persistScriptsTimeout) {
      clearTimeout(this._persistScriptsTimeout);
    }

    this._persistScriptsTimeout = setTimeout(() => {
      this._persistScriptsTimeout = null;
      const shouldNotify = this._persistScriptsShouldNotifyChanges;
      const shouldRefreshBehaviorsRegistry =
        this._persistScriptsShouldRefreshBehaviorsRegistry;
      this._persistScriptsShouldNotifyChanges = false;
      this._persistScriptsShouldRefreshBehaviorsRegistry = false;
      this._persistScriptsToProject(this.state.scripts, {
        notifyScriptsChanged: shouldNotify,
        previousScripts: this.state.scripts,
        refreshBehaviorsRegistry: shouldRefreshBehaviorsRegistry,
      });
    }, 2000);
  };

  componentDidMount() {
    this._backgroundPreloadTimeout = setTimeout(() => {
      this._backgroundPreloadTimeout = null;
      preloadTypeScriptCompiler();
      preloadRuntimeBehaviorTypesByType();
      getRuntimeBehaviorTypesByType().then(runtimeBehaviorTypesByType => {
        this._projectTypingExtraLibCache = null;
        this._projectTypingExtraLibCacheKey = '';
        this._projectScriptsExtraLibsCacheKey = '';
        this._projectScriptsExtraLibsCache = [];
        this.setState({ runtimeBehaviorTypesByType });
      });
    }, 250);
    this.setState(
      state => ({
        selectedScriptId:
          state.selectedScriptId ||
          (state.scripts.length ? state.scripts[0].id : null),
      }),
      () => {
        this._ensureContextScripts({
          preferredSceneName: this.props.preferredSceneName,
          notifyScriptsChanged: true,
          includeObjectAndBehaviorTargets: false,
        });
        this.updateToolbar();
        this._compileSelectedScriptIfNeeded();
        this._applyPreferredScriptTarget();
      }
    );
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.project !== this.props.project) {
      this._flushScheduledPersistScripts();
      this._clearAllScheduledScriptCompiles();
      this._clearCompileAllScriptsQueue();
      this._invalidateDerivedCaches();
      this._projectTypingExtraLibCache = null;
      this._projectTypingExtraLibCacheKey = '';
      this._projectScriptsExtraLibsCacheKey = '';
      this._projectScriptsExtraLibsCache = [];
      const scripts = loadProjectTypeScriptScripts(this.props.project, {
        projectFilePath: this.props.projectFilePath,
      });
      this.setState(
        {
          scripts,
          selectedScriptId:
            this._getPreferredSceneScriptId(
              scripts,
              this.props.preferredSceneName
            ) || (scripts.length ? scripts[0].id : null),
          compilationByScriptId: {},
          revealedPosition: null,
        },
        () => {
          this._ensureContextScripts({
            preferredSceneName: this.props.preferredSceneName,
            notifyScriptsChanged: true,
            includeObjectAndBehaviorTargets: false,
          });
          this.updateToolbar();
          this._compileSelectedScriptIfNeeded();
          this._lastAppliedPreferredScriptTargetKey = '';
          this._applyPreferredScriptTarget();
        }
      );
      return;
    }

    if (prevProps.projectFilePath !== this.props.projectFilePath) {
      this._flushScheduledPersistScripts();
      this._clearAllScheduledScriptCompiles();
      this._clearCompileAllScriptsQueue();
      this._invalidateDerivedCaches();
      this._projectTypingExtraLibCache = null;
      this._projectTypingExtraLibCacheKey = '';
      this._projectScriptsExtraLibsCacheKey = '';
      this._projectScriptsExtraLibsCache = [];
      const scripts = loadProjectTypeScriptScripts(this.props.project, {
        projectFilePath: this.props.projectFilePath,
      });
      this.setState(
        {
          scripts,
          selectedScriptId:
            this._getPreferredSceneScriptId(
              scripts,
              this.props.preferredSceneName
            ) || (scripts.length ? scripts[0].id : null),
        },
        () => {
          this._lastAppliedPreferredScriptTargetKey = '';
          this._applyPreferredScriptTarget();
        }
      );
      return;
    }

    if (prevProps.preferredSceneName !== this.props.preferredSceneName) {
      this._ensureContextScripts({
        preferredSceneName: this.props.preferredSceneName,
        notifyScriptsChanged: false,
        includeObjectAndBehaviorTargets: false,
      });
    }

    if (
      this._getPreferredScriptTargetKey(prevProps.preferredScriptTarget) !==
      this._getPreferredScriptTargetKey(this.props.preferredScriptTarget)
    ) {
      this._lastAppliedPreferredScriptTargetKey = '';
      this._applyPreferredScriptTarget();
    }

    if (prevState.selectedScriptId !== this.state.selectedScriptId) {
      this._compileSelectedScriptIfNeeded();
    }

    if (
      prevState.scripts !== this.state.scripts ||
      prevState.selectedScriptId !== this.state.selectedScriptId
    ) {
      this.updateToolbar();
    }
  }

  componentWillUnmount() {
    if (this._backgroundPreloadTimeout) {
      clearTimeout(this._backgroundPreloadTimeout);
      this._backgroundPreloadTimeout = null;
    }
    this._flushPendingCursorPositionUpdate();
    if (this._cursorPositionUpdateTimeout) {
      clearTimeout(this._cursorPositionUpdateTimeout);
      this._cursorPositionUpdateTimeout = null;
    }
    if (
      this._resizeAnimationFrameId !== null &&
      typeof cancelAnimationFrame === 'function'
    ) {
      cancelAnimationFrame(this._resizeAnimationFrameId);
      this._resizeAnimationFrameId = null;
    }
    if (
      this._filesListScrollAnimationFrameId !== null &&
      typeof cancelAnimationFrame === 'function'
    ) {
      cancelAnimationFrame(this._filesListScrollAnimationFrameId);
      this._filesListScrollAnimationFrameId = null;
    }
    this._clearCompileAllScriptsQueue();
    this._clearAllScheduledScriptCompiles();
    this._flushScheduledPersistScripts();
    this.props.setToolbar(null);
  }

  updateToolbar() {
    this.props.setToolbar(null);
  }

  syncContextScripts(
    preferredSceneName?: ?string,
    preferredScriptTarget?: ?PreferredScriptTarget
  ) {
    this._ensureContextScripts({
      preferredSceneName:
        typeof preferredSceneName === 'undefined'
          ? this.props.preferredSceneName
          : preferredSceneName,
      notifyScriptsChanged: true,
      includeObjectAndBehaviorTargets: true,
    });
    if (preferredScriptTarget) {
      this._lastAppliedPreferredScriptTargetKey = '';
      this._openContextScript(preferredScriptTarget, {
        notifyScriptsChanged: true,
      });
    }
  }

  _saveScripts = (
    nextScripts: Array<ProjectTypeScriptScript>,
    options: {| notifyScriptsChanged: boolean |} = {
      notifyScriptsChanged: true,
    }
  ) => {
    this._clearScheduledPersistScripts();
    this._persistScriptsToProject(nextScripts, {
      notifyScriptsChanged: options.notifyScriptsChanged,
      previousScripts: this.state.scripts,
      refreshBehaviorsRegistry: true,
    });
    this.setState({
      scripts: nextScripts,
    });
  };

  _setCompilationState = (
    scriptId: string,
    statePatch: $Shape<ScriptCompilationState>
  ) => {
    const previousState =
      this.state.compilationByScriptId[scriptId] || defaultCompilationState;
    this.setState(state => ({
      compilationByScriptId: {
        ...state.compilationByScriptId,
        [scriptId]: {
          ...previousState,
          ...statePatch,
        },
      },
    }));
  };

  _compileAllScripts = () => {
    this._clearCompileAllScriptsQueue();
    const selectedScript = this._getSelectedScript();
    const orderedScripts = selectedScript
      ? [
          selectedScript,
          ...this.state.scripts.filter(script => script.id !== selectedScript.id),
        ]
      : this.state.scripts;

    orderedScripts.forEach((script, index) => {
      if (index === 0) {
        this._compileScript(script.id, script.source);
        return;
      }

      const timeout = setTimeout(() => {
        this._compileAllScriptsTimeouts = this._compileAllScriptsTimeouts.filter(
          pendingTimeout => pendingTimeout !== timeout
        );
        this._compileScript(script.id, script.source);
      }, Math.min(2200, 120 + index * 45));
      this._compileAllScriptsTimeouts.push(timeout);
    });
  };

  _compileSelectedScriptIfNeeded = () => {
    const selectedScript = this._getSelectedScript();
    if (!selectedScript) return;
    if (this._isDeclarationScript(selectedScript)) return;
    if (this._compileInFlightByScriptId[selectedScript.id]) return;

    const compilationState = this.state.compilationByScriptId[selectedScript.id];
    if (compilationState && compilationState.isCompiling) return;
    if (selectedScript.transpiledCode) return;

    this._compileScript(selectedScript.id, selectedScript.source);
  };

  _isDeclarationScript = (script: ProjectTypeScriptScript): boolean =>
    /\.d\.[cm]?[jt]sx?$/i.test(script.name.trim());

  _normalizeScriptPath = (
    scriptName: string,
    fallbackName: string
  ): string => {
    const trimmed = scriptName.trim();
    const normalized = (trimmed || fallbackName)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
    if (/\.[cm]?[jt]sx?$/i.test(normalized)) {
      return normalized;
    }
    return `${normalized}.ts`;
  };

  _getScriptCompilerFileName = (script: ProjectTypeScriptScript): string =>
    this._normalizeScriptPath(script.name, `${script.id}.ts`);

  _getVirtualScriptFilePath = (script: ProjectTypeScriptScript): string =>
    `gdevelop://project-typescript/${this._getScriptCompilerFileName(script)}`;

  _compileScript = async (scriptId: string, source: string) => {
    if (this._compileInFlightByScriptId[scriptId]) {
      this._queuedCompileSourceByScriptId[scriptId] = source;
      return;
    }

    const script = this.state.scripts.find(
      currentScript => currentScript.id === scriptId
    );
    if (!script) return;

    if (this._isDeclarationScript(script)) {
      this._setCompilationState(scriptId, {
        isCompiling: false,
        errorMessage: null,
        diagnostics: [],
      });
      if (script.transpiledCode) {
        const nextScripts = this.state.scripts.map(currentScript =>
          currentScript.id === scriptId
            ? {
                ...currentScript,
                transpiledCode: '',
              }
            : currentScript
        );
        this.setState(
          {
            scripts: nextScripts,
          },
          () => {
            this._schedulePersistScripts({ notifyScriptsChanged: false });
          }
        );
      }
      delete this._queuedCompileSourceByScriptId[scriptId];
      return;
    }

    this._compileInFlightByScriptId[scriptId] = true;
    const fileName = this._getScriptCompilerFileName(script);
    const requestId = (this._transpileRequestIdByScriptId[scriptId] || 0) + 1;
    this._transpileRequestIdByScriptId[scriptId] = requestId;
    this._setCompilationState(scriptId, {
      isCompiling: true,
    });

    let transpiledJavaScriptCode = '';
    let errorMessage = null;
    let diagnostics: Array<TypeScriptDiagnostic> = [];
    try {
      const transpilationResult = await transpileTypeScriptCode(source, {
        moduleKind: 'commonjs',
        inlineSourceMap: true,
        fileName,
      });
      transpiledJavaScriptCode = transpilationResult.transpiledJavaScriptCode;
      errorMessage = transpilationResult.errorMessage;
      diagnostics = transpilationResult.diagnostics;
    } catch (error) {
      const fallbackMessage =
        (error && error.message) || 'Unable to transpile TypeScript code.';
      errorMessage = fallbackMessage;
      diagnostics = [
        {
          message: fallbackMessage,
          filePath: fileName,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
      ];
      transpiledJavaScriptCode = '';
    } finally {
      this._compileInFlightByScriptId[scriptId] = false;
    }

    if (this._transpileRequestIdByScriptId[scriptId] !== requestId) return;

    const queuedCompileSource = this._queuedCompileSourceByScriptId[scriptId];
    if (typeof queuedCompileSource === 'string' && queuedCompileSource !== source) {
      delete this._queuedCompileSourceByScriptId[scriptId];
      this._compileScript(scriptId, queuedCompileSource);
      return;
    }

    const currentScript = this.state.scripts.find(
      currentProjectScript => currentProjectScript.id === scriptId
    );
    if (!currentScript) {
      this._setCompilationState(scriptId, {
        isCompiling: false,
        errorMessage,
        diagnostics,
      });
      return;
    }

    if (currentScript.source !== source) {
      this._compileScript(scriptId, currentScript.source);
      return;
    }

    this._setCompilationState(scriptId, {
      isCompiling: false,
      errorMessage,
      diagnostics,
    });

    if (currentScript.transpiledCode === transpiledJavaScriptCode) return;

    const nextScripts = this.state.scripts.map(script =>
      script.id === scriptId
        ? {
            ...script,
            transpiledCode: transpiledJavaScriptCode,
          }
        : script
    );
    this.setState(
      {
        scripts: nextScripts,
      },
      () => {
        this._schedulePersistScripts({ notifyScriptsChanged: false });
      }
    );
  };

  _createDefaultScript = (name: string): ProjectTypeScriptScript => ({
    id: generateTypeScriptProjectScriptId(),
    name,
    source: `// ${name}\n// This file is compiled to JavaScript during build/preview.\n\n// Example TypeScript behavior registration:\n// class MyBehavior extends gdjs.RuntimeBehavior {}\n// registerProjectBehavior('TypeScriptBehaviors::MyBehavior', MyBehavior);\n\n`,
    transpiledCode: '',
    includePosition: 'last',
    contextKind: 'project',
    sceneName: '',
    objectName: '',
    behaviorName: '',
  });

  _createSharedTypesScript = (): ProjectTypeScriptScript => ({
    id: generateTypeScriptProjectScriptId(),
    name: 'types.ts',
    source: `// Shared types between project scripts.\n// Import from './types' in other files.\n\nexport type EntityId = string;\n`,
    transpiledCode: '',
    includePosition: 'first',
    contextKind: 'project',
    sceneName: '',
    objectName: '',
    behaviorName: '',
  });

  _addScript = () => {
    const existingNames = this.state.scripts.map(script => script.name);
    const uniqueName = newNameGenerator('NewScript.ts', name =>
      existingNames.includes(name)
    );
    const script = this._createDefaultScript(uniqueName);
    const nextScripts = [...this.state.scripts, script];
    this.setState(
      {
        selectedScriptId: script.id,
      },
      () => {
        this._saveScripts(nextScripts, { notifyScriptsChanged: true });
        this._compileScript(script.id, script.source);
      }
    );
  };

  _addSharedTypesScript = () => {
    const existingSharedTypesScript = this.state.scripts.find(
      script => script.name === 'types.ts'
    );
    if (existingSharedTypesScript) {
      this.setState({
        selectedScriptId: existingSharedTypesScript.id,
      });
      return;
    }

    const script = this._createSharedTypesScript();
    const nextScripts = [script, ...this.state.scripts];
    this.setState(
      {
        selectedScriptId: script.id,
      },
      () => {
        this._saveScripts(nextScripts, { notifyScriptsChanged: true });
        this._compileScript(script.id, script.source);
      }
    );
  };

  _deleteScript = (scriptId: string) => {
    const nextScripts = this.state.scripts.filter(script => script.id !== scriptId);
    const nextSelectedScriptId =
      this.state.selectedScriptId === scriptId
        ? nextScripts.length
          ? nextScripts[0].id
          : null
        : this.state.selectedScriptId;

    this.setState(
      {
        selectedScriptId: nextSelectedScriptId,
        revealedPosition:
          this.state.revealedPosition &&
          this.state.revealedPosition.scriptId === scriptId
            ? null
            : this.state.revealedPosition,
      },
      () => {
        this._saveScripts(nextScripts, { notifyScriptsChanged: true });
      }
    );
  };

  _moveScript = (scriptId: string, direction: -1 | 1) => {
    const currentIndex = this.state.scripts.findIndex(
      script => script.id === scriptId
    );
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.state.scripts.length) return;

    const nextScripts = [...this.state.scripts];
    const [script] = nextScripts.splice(currentIndex, 1);
    nextScripts.splice(nextIndex, 0, script);
    this._saveScripts(nextScripts, { notifyScriptsChanged: true });
  };

  _renameScript = (scriptId: string, newName: string) => {
    if (!newName) return;

    const hasNameConflict = this.state.scripts.some(
      script => script.id !== scriptId && script.name === newName
    );
    if (hasNameConflict) {
      showWarningBox('This file name is already in use.', {
        delayToNextTick: true,
      });
      return;
    }

    const nextScripts = this.state.scripts.map(script =>
      script.id === scriptId
        ? {
            ...script,
            name: newName,
          }
        : script
    );
    this._saveScripts(nextScripts, { notifyScriptsChanged: true });
  };

  _setIncludePosition = (
    scriptId: string,
    includePosition: ProjectTypeScriptScriptIncludePosition
  ) => {
    const nextScripts = this.state.scripts.map(script =>
      script.id === scriptId
        ? {
            ...script,
            includePosition,
          }
        : script
    );
    this._saveScripts(nextScripts, { notifyScriptsChanged: true });
  };

  _setScriptSource = (scriptId: string, source: string) => {
    const currentScript = this.state.scripts.find(script => script.id === scriptId);
    if (!currentScript) return;
    if (currentScript.source === source) return;

    const nextScripts = this.state.scripts.map(script =>
      script.id === scriptId
        ? {
            ...script,
            source,
          }
        : script
    );
    this.setState(
      {
        scripts: nextScripts,
      },
      () => {
        this._schedulePersistScripts({ notifyScriptsChanged: false });
        this._scheduleCompileScript(scriptId, source);
      }
    );
  };

  _getSelectedScript = (): ?ProjectTypeScriptScript => {
    const { selectedScriptId, scripts } = this.state;
    if (!selectedScriptId) return null;
    return scripts.find(script => script.id === selectedScriptId) || null;
  };

  _getSelectedScriptCompilationState = (): ScriptCompilationState => {
    const selectedScript = this._getSelectedScript();
    if (!selectedScript) return defaultCompilationState;
    return (
      this.state.compilationByScriptId[selectedScript.id] ||
      defaultCompilationState
    );
  };

  _quoteTypeProperty = (name: string): string =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);

  _resolveRuntimeBehaviorType = (behaviorType: string): string =>
    this.state.runtimeBehaviorTypesByType[behaviorType] ||
    'gdjs.RuntimeBehavior';

  _collectObjectAndBehaviorNamesFromContainer = (
    objectsContainer: any
  ): {|
    objectNames: Array<string>,
    behaviorTypesByName: { [string]: Set<string> },
  |} => {
    if (
      !objectsContainer ||
      typeof objectsContainer.getObjectsCount !== 'function' ||
      typeof objectsContainer.getObjectAt !== 'function'
    ) {
      return { objectNames: [], behaviorTypesByName: {} };
    }

    const objectNames = [];
    const behaviorTypesByName = {};
    const objectsCount = objectsContainer.getObjectsCount();
    for (let i = 0; i < objectsCount; i++) {
      const object = objectsContainer.getObjectAt(i);
      if (!object) continue;

      if (typeof object.getName === 'function') {
        objectNames.push(object.getName());
      }
      if (typeof object.getAllBehaviorNames === 'function') {
        const behaviorNamesVector = object.getAllBehaviorNames();
        if (
          behaviorNamesVector &&
          typeof behaviorNamesVector.size === 'function' &&
          typeof behaviorNamesVector.at === 'function'
        ) {
          for (let j = 0; j < behaviorNamesVector.size(); j++) {
            const behaviorName = behaviorNamesVector.at(j);
            if (!behaviorName) continue;

            let behaviorType = '';
            try {
              const behavior =
                typeof object.getBehavior === 'function'
                  ? object.getBehavior(behaviorName)
                  : null;
              behaviorType =
                behavior && typeof behavior.getTypeName === 'function'
                  ? behavior.getTypeName()
                  : '';
            } catch (error) {
              behaviorType = '';
            }

            const runtimeBehaviorType = this._resolveRuntimeBehaviorType(
              behaviorType
            );
            if (!behaviorTypesByName[behaviorName]) {
              behaviorTypesByName[behaviorName] = new Set();
            }
            behaviorTypesByName[behaviorName].add(runtimeBehaviorType);
          }
        }
      }
    }

    return { objectNames, behaviorTypesByName };
  };

  _getProjectTypingExtraLib = (): {|
    content: string,
    filePath: string,
  |} => {
    const runtimeBehaviorTypesByTypeFingerprint = Object.keys(
      this.state.runtimeBehaviorTypesByType
    )
      .sort()
      .map(
        runtimeBehaviorType =>
          `${runtimeBehaviorType}:${
            this.state.runtimeBehaviorTypesByType[runtimeBehaviorType]
          }`
      )
      .join('|');
    const cacheKey = `${this._lastContextTargetsFingerprint}::${runtimeBehaviorTypesByTypeFingerprint}`;
    if (
      this._projectTypingExtraLibCache &&
      this._projectTypingExtraLibCacheKey === cacheKey
    ) {
      return this._projectTypingExtraLibCache;
    }

    const objectNames = [];
    const behaviorTypesByName = {};
    const appendNamesFromContainer = (objectsContainer: any) => {
      const {
        objectNames: containerObjectNames,
        behaviorTypesByName: containerBehaviorTypesByName,
      } = this._collectObjectAndBehaviorNamesFromContainer(objectsContainer);
      objectNames.push(...containerObjectNames);
      Object.keys(containerBehaviorTypesByName).forEach(behaviorName => {
        if (!behaviorTypesByName[behaviorName]) {
          behaviorTypesByName[behaviorName] = new Set();
        }
        containerBehaviorTypesByName[behaviorName].forEach(typeName => {
          behaviorTypesByName[behaviorName].add(typeName);
        });
      });
    };

    appendNamesFromContainer(this.props.project.getObjects());
    const layoutsCount = this.props.project.getLayoutsCount();
    for (let i = 0; i < layoutsCount; i++) {
      appendNamesFromContainer(this.props.project.getLayoutAt(i).getObjects());
    }

    const uniqueObjectNames = Array.from(new Set(objectNames)).filter(
      name => !!name
    );
    const uniqueBehaviorNames = Object.keys(behaviorTypesByName).filter(name => !!name);

    const objectFields = uniqueObjectNames
      .map(
        name => `  ${this._quoteTypeProperty(name)}: gdjs.RuntimeObject[];`
      )
      .join('\n');
    const behaviorFields = uniqueBehaviorNames
      .map(name => {
        const typeNames = Array.from(behaviorTypesByName[name]);
        const typeExpression = typeNames.length
          ? typeNames.join(' | ')
          : 'gdjs.RuntimeBehavior';
        return `  ${this._quoteTypeProperty(name)}: ${typeExpression};`;
      })
      .join('\n');

    const projectTypingExtraLib = {
      filePath: 'gdevelop://project-typescript/project-runtime-context.d.ts',
      content: `
type __GDevelopProjectObjectLists = {
${objectFields}
};

type __GDevelopProjectBehaviorByName = {
${behaviorFields}
};

declare const sceneObjects: __GDevelopProjectObjectLists;
declare const scene: gdjs.RuntimeScene & __GDevelopProjectObjectLists;
declare const evtTools: typeof gdjs.evtTools;
declare const tsModules: {
  setExternal(moduleName: string, moduleValue: any): void;
  evalJavaScript(code: string): any;
  registerTest(testName: string, testFunction: () => void): void;
  runTests(): {
    total: number;
    passed: number;
    failed: number;
    failures: Array<{ name: string; message: string }>;
  };
  clearTests(): void;
};
declare function registerProjectBehavior(
  behaviorType: string,
  behaviorConstructor: typeof gdjs.RuntimeBehavior
): void;
declare function liveRepl(code: string): any;

type SceneScriptLifecycleHooks = {
  onSceneLoaded?: (runtimeScene: gdjs.RuntimeScene) => void,
  onScenePreEvents?: (runtimeScene: gdjs.RuntimeScene) => void,
  onScenePostEvents?: (runtimeScene: gdjs.RuntimeScene) => void,
  onSceneUnloading?: (runtimeScene: gdjs.RuntimeScene) => void,
  onSceneUnloaded?: (runtimeScene: gdjs.RuntimeScene) => void,
};

type ObjectScriptLifecycleHooks = {
  onObjectCreated?: (runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject) => void,
  onObjectPreEvents?: (runtimeScene: gdjs.RuntimeScene, objects: gdjs.RuntimeObject[]) => void,
  onObjectPostEvents?: (runtimeScene: gdjs.RuntimeScene, objects: gdjs.RuntimeObject[]) => void,
  onObjectDestroyed?: (runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject) => void,
};

type BehaviorScriptLifecycleHooks = {
  onBehaviorCreated?: (
    runtimeScene: gdjs.RuntimeScene,
    owner: gdjs.RuntimeObject,
    behavior: gdjs.RuntimeBehavior
  ) => void,
  onBehaviorActivate?: (
    runtimeScene: gdjs.RuntimeScene,
    owner: gdjs.RuntimeObject,
    behavior: gdjs.RuntimeBehavior
  ) => void,
  onBehaviorDeActivate?: (
    runtimeScene: gdjs.RuntimeScene,
    owner: gdjs.RuntimeObject,
    behavior: gdjs.RuntimeBehavior
  ) => void,
  doStepPreEvents?: (
    runtimeScene: gdjs.RuntimeScene,
    owner: gdjs.RuntimeObject,
    behavior: gdjs.RuntimeBehavior
  ) => void,
  doStepPostEvents?: (
    runtimeScene: gdjs.RuntimeScene,
    owner: gdjs.RuntimeObject,
    behavior: gdjs.RuntimeBehavior
  ) => void,
  onBehaviorDestroy?: (
    runtimeScene: gdjs.RuntimeScene,
    owner: gdjs.RuntimeObject,
    behavior: gdjs.RuntimeBehavior
  ) => void,
};

declare namespace gdjs {
  interface RuntimeScene {}

  interface RuntimeObject {
    getBehavior(name: string): RuntimeBehavior;
  }

  interface RuntimeBehavior {
    owner: RuntimeObject;
  }

  const evtTools: any;

  namespace ts {
    function setExternalModule(moduleName: string, moduleValue: any): void;
    function registerProjectBehavior(
      behaviorType: string,
      behaviorConstructor: typeof gdjs.RuntimeBehavior
    ): void;
    function evalJavaScript(code: string): any;
    function test(testName: string, testFunction: () => void): void;
    function runTests(): {
      total: number;
      passed: number;
      failed: number;
      failures: Array<{ name: string; message: string }>;
    };
    function clearTests(): void;
  }

  interface RuntimeObject {
    getBehavior<Name extends keyof __GDevelopProjectBehaviorByName>(name: Name): __GDevelopProjectBehaviorByName[Name];
  }
}
`,
    };
    this._projectTypingExtraLibCache = projectTypingExtraLib;
    this._projectTypingExtraLibCacheKey = cacheKey;
    return projectTypingExtraLib;
  };

  _getScriptContextSummary = (script: ProjectTypeScriptScript): string => {
    if (script.contextKind === 'scene') {
      return `Scene: ${script.sceneName}`;
    }
    if (script.contextKind === 'object') {
      return script.sceneName
        ? `Object: ${script.objectName} (${script.sceneName})`
        : `Object: ${script.objectName} (global)`;
    }
    if (script.contextKind === 'behavior') {
      const target = `${script.objectName}.${script.behaviorName}`;
      return script.sceneName
        ? `Behavior: ${target} (${script.sceneName})`
        : `Behavior: ${target} (global)`;
    }
    return 'Project script';
  };

  _getScriptContextBadgeLabel = (script: ProjectTypeScriptScript): string =>
    script.contextKind === 'project'
      ? 'Project'
      : script.contextKind === 'scene'
      ? 'Scene'
      : script.contextKind === 'object'
      ? 'Object'
      : 'Behavior';

  _getScriptContextExtraLib = (
    script: ?ProjectTypeScriptScript
  ): ?{| content: string, filePath: string |} => {
    if (!script) return null;

    const kind = script.contextKind || 'project';
    return {
      filePath: 'gdevelop://project-typescript/current-script-context.d.ts',
      content: `
declare const scriptContext: {
  kind: ${JSON.stringify(kind)},
  sceneName: ${JSON.stringify(script.sceneName || '')},
  objectName: ${JSON.stringify(script.objectName || '')},
  behaviorName: ${JSON.stringify(script.behaviorName || '')},
};
`,
    };
  };

  _buildSourceFingerprint = (source: string): string => {
    const safeSource = source || '';
    const head = safeSource.slice(0, 24);
    const tail = safeSource.slice(Math.max(0, safeSource.length - 24));
    return `${safeSource.length}:${head}:${tail}`;
  };

  _getProjectScriptsExtraLibs = (
    selectedScriptId: ?string
  ): Array<{| content: string, filePath: string |}> => {
    const selectedScript = selectedScriptId
      ? this.state.scripts.find(script => script.id === selectedScriptId) || null
      : null;
    const scriptContextExtraLib = this._getScriptContextExtraLib(selectedScript);
    const projectTypingExtraLib = this._getProjectTypingExtraLib();

    const otherScripts = this.state.scripts.filter(
      script => script.id !== selectedScriptId
    );
    const otherScriptsFingerprint = otherScripts
      .map(
        script =>
          `${script.id}:${script.name}:${this._buildSourceFingerprint(
            script.source
          )}`
      )
      .join('|');
    const contextScriptFingerprint = selectedScript
      ? `${selectedScript.contextKind}:${selectedScript.sceneName}:${selectedScript.objectName}:${selectedScript.behaviorName}`
      : '';
    const cacheKey = `${selectedScriptId || ''}::${this._projectTypingExtraLibCacheKey}::${otherScriptsFingerprint}::${contextScriptFingerprint}`;
    if (cacheKey === this._projectScriptsExtraLibsCacheKey) {
      return this._projectScriptsExtraLibsCache;
    }

    const nextExtraLibs = [
      projectTypingExtraLib,
      ...(scriptContextExtraLib ? [scriptContextExtraLib] : []),
      ...otherScripts.map(script => ({
        content: script.source,
        filePath: this._getVirtualScriptFilePath(script),
      })),
    ];
    this._projectScriptsExtraLibsCacheKey = cacheKey;
    this._projectScriptsExtraLibsCache = nextExtraLibs;
    return nextExtraLibs;
  };

  _getAllDiagnostics = (): Array<{|
    scriptId: string,
    scriptName: string,
    diagnostic: TypeScriptDiagnostic,
  |}> => {
    if (
      this._cachedDiagnosticsCompilationByScriptIdRef ===
        this.state.compilationByScriptId &&
      this._cachedDiagnosticsScriptsRef === this.state.scripts
    ) {
      return this._cachedDiagnostics;
    }

    const allDiagnostics = [];
    this.state.scripts.forEach(script => {
      const compilationState = this.state.compilationByScriptId[script.id];
      if (!compilationState || !compilationState.diagnostics.length) return;
      compilationState.diagnostics.forEach(diagnostic => {
        allDiagnostics.push({
          scriptId: script.id,
          scriptName: script.name,
          diagnostic,
        });
      });
    });
    this._cachedDiagnosticsCompilationByScriptIdRef =
      this.state.compilationByScriptId;
    this._cachedDiagnosticsScriptsRef = this.state.scripts;
    this._cachedDiagnostics = allDiagnostics;
    return allDiagnostics;
  };

  _goToDiagnostic = (
    scriptId: string,
    diagnostic: TypeScriptDiagnostic
  ): void => {
    const scriptIdFromDiagnosticFilePath = diagnostic.filePath
      ? this.state.scripts.find(
          script =>
            this._getScriptCompilerFileName(script) === diagnostic.filePath ||
            script.name === diagnostic.filePath
        )
      : null;
    const resolvedScriptId = scriptIdFromDiagnosticFilePath
      ? scriptIdFromDiagnosticFilePath.id
      : scriptId;

    this.setState({
      selectedScriptId: resolvedScriptId,
      revealedPosition: {
        scriptId: resolvedScriptId,
        lineNumber: diagnostic.startLineNumber,
        column: diagnostic.startColumn,
      },
    });
  };

  _renderScriptStatus = (scriptId: string): React.Node => {
    const script = this.state.scripts.find(currentScript => currentScript.id === scriptId);
    if (script && this._isDeclarationScript(script)) return <Trans>Types</Trans>;

    const compilationState = this.state.compilationByScriptId[scriptId];
    if (!compilationState) return null;
    if (compilationState.isCompiling) return <Trans>Compiling...</Trans>;
    if (compilationState.errorMessage) {
      return (
        <Trans>
          {compilationState.diagnostics.length || 1} error(s)
        </Trans>
      );
    }
    return <Trans>Ready</Trans>;
  };

  _renderEditorStatus = (): React.Node => {
    const selectedScript = this._getSelectedScript();
    const selectedCompilationState = this._getSelectedScriptCompilationState();
    if (!selectedScript) return null;

    if (this._isDeclarationScript(selectedScript)) {
      return <Trans>Declaration file (.d.ts) shared between scripts.</Trans>;
    }

    if (selectedCompilationState.isCompiling) {
      return <Trans>Compiling TypeScript...</Trans>;
    }
    if (selectedCompilationState.errorMessage) {
      return (
        <span style={styles.editorStatusError}>
          <Trans>
            TypeScript compile errors: {selectedCompilationState.diagnostics.length || 1}
          </Trans>
        </span>
      );
    }
    return (
      <React.Fragment>
        {this._getScriptContextSummary(selectedScript)}{' - '}
        <Trans>Compiled JavaScript is linked to the build path.</Trans>
      </React.Fragment>
    );
  };

  _renderDiagnosticsPanel = (): React.Node => {
    const diagnostics = this._getAllDiagnostics();
    if (!diagnostics.length) {
      return (
        <div style={styles.diagnosticsPanel}>
          <div style={styles.diagnosticsEmptyState}>
            <Trans>No TypeScript errors detected.</Trans>
          </div>
        </div>
      );
    }

    return (
      <div style={styles.diagnosticsPanel}>
        {diagnostics.map((diagnosticEntry, index) => {
          const { scriptId, scriptName, diagnostic } = diagnosticEntry;
          const filePath = diagnostic.filePath || scriptName;
          const diagnosticKey = `${scriptId}:${index}:${diagnostic.startLineNumber}:${diagnostic.startColumn}`;
          return (
            <div
              key={diagnosticKey}
              style={styles.diagnosticEntry}
              onClick={() => this._goToDiagnostic(scriptId, diagnostic)}
            >
              <span style={styles.diagnosticEntryPath}>
                {filePath}:{diagnostic.startLineNumber}:{diagnostic.startColumn}
              </span>
              {diagnostic.message}
            </div>
          );
        })}
      </div>
    );
  };

  _toLineNumberFromIndex = (text: string, index: number): number =>
    text.slice(0, Math.max(0, index)).split('\n').length;

  _getSelectedScriptOutlineEntries = (): Array<{| name: string, lineNumber: number |}> => {
    const selectedScript = this._getSelectedScript();
    if (!selectedScript || !selectedScript.source) return [];

    if (
      this._outlineCacheScriptId === selectedScript.id &&
      this._outlineCacheSource === selectedScript.source
    ) {
      return this._outlineCacheEntries;
    }

    const source = selectedScript.source;
    const outlineEntries = [];
    const patterns = [
      /export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
      /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
      /class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:extends|\{)/g,
      /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/g,
    ];

    const seen = new Set<string>();
    patterns.forEach(pattern => {
      pattern.lastIndex = 0;
      let match = pattern.exec(source);
      while (match) {
        const name = match[1];
        const lineNumber = this._toLineNumberFromIndex(source, match.index || 0);
        const key = `${name}:${lineNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          outlineEntries.push({
            name,
            lineNumber,
          });
        }
        match = pattern.exec(source);
      }
    });

    const cachedEntries = outlineEntries
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .slice(0, 120);
    this._outlineCacheScriptId = selectedScript.id;
    this._outlineCacheSource = selectedScript.source;
    this._outlineCacheEntries = cachedEntries;
    return cachedEntries;
  };

  _goToScriptLine = (lineNumber: number) => {
    const selectedScript = this._getSelectedScript();
    if (!selectedScript) return;
    this.setState({
      revealedPosition: {
        scriptId: selectedScript.id,
        lineNumber: Math.max(1, lineNumber),
        column: 1,
      },
    });
  };

  _flushPendingCursorPositionUpdate = () => {
    if (!this._pendingCursorPosition) return;
    const nextCursorPosition = this._pendingCursorPosition;
    this._pendingCursorPosition = null;
    if (
      this.state.cursorPosition.lineNumber === nextCursorPosition.lineNumber &&
      this.state.cursorPosition.column === nextCursorPosition.column
    ) {
      return;
    }
    this.setState({
      cursorPosition: nextCursorPosition,
    });
  };

  _onCursorPositionChanged = (position: {|
    lineNumber: number,
    column: number,
  |}) => {
    const { lineNumber, column } = position;
    if (lineNumber < 1 || column < 1) return;
    this._pendingCursorPosition = {
      lineNumber,
      column,
    };
    if (this._cursorPositionUpdateTimeout) return;
    this._cursorPositionUpdateTimeout = setTimeout(() => {
      this._cursorPositionUpdateTimeout = null;
      this._flushPendingCursorPositionUpdate();
    }, 70);
  };

  _handleEditorPaneResize = (contentRect: any) => {
    const bounds = contentRect && contentRect.bounds;
    if (!bounds) return;
    const nextWidth = Math.max(360, Math.round(bounds.width) - 2);
    const nextHeight = Math.max(240, Math.round(bounds.height) - 114);
    if (
      this._lastMeasuredEditorSize.width === nextWidth &&
      this._lastMeasuredEditorSize.height === nextHeight
    ) {
      return;
    }

    this._lastMeasuredEditorSize = {
      width: nextWidth,
      height: nextHeight,
    };
    if (
      this._resizeAnimationFrameId !== null &&
      typeof cancelAnimationFrame === 'function'
    ) {
      cancelAnimationFrame(this._resizeAnimationFrameId);
    }
    if (typeof requestAnimationFrame !== 'function') {
      if (
        this.state.codeEditorWidth === nextWidth &&
        this.state.codeEditorHeight === nextHeight
      ) {
        return;
      }
      this.setState({
        codeEditorWidth: nextWidth,
        codeEditorHeight: nextHeight,
      });
      return;
    }
    this._resizeAnimationFrameId = requestAnimationFrame(() => {
      this._resizeAnimationFrameId = null;
      if (
        this.state.codeEditorWidth === nextWidth &&
        this.state.codeEditorHeight === nextHeight
      ) {
        return;
      }
      this.setState({
        codeEditorWidth: nextWidth,
        codeEditorHeight: nextHeight,
      });
    });
  };

  _handleFilesListResize = (contentRect: any) => {
    const bounds = contentRect && contentRect.bounds;
    if (!bounds) return;
    const nextFilesListHeight = Math.max(120, Math.round(bounds.height));
    if (nextFilesListHeight === this.state.filesListHeight) return;
    this.setState({
      filesListHeight: nextFilesListHeight,
    });
  };

  _onFilesListScroll = (event: SyntheticUIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    if (nextScrollTop === this.state.filesListScrollTop) return;

    if (
      this._filesListScrollAnimationFrameId !== null &&
      typeof cancelAnimationFrame === 'function'
    ) {
      cancelAnimationFrame(this._filesListScrollAnimationFrameId);
      this._filesListScrollAnimationFrameId = null;
    }

    if (typeof requestAnimationFrame !== 'function') {
      this.setState({
        filesListScrollTop: nextScrollTop,
      });
      return;
    }

    this._filesListScrollAnimationFrameId = requestAnimationFrame(() => {
      this._filesListScrollAnimationFrameId = null;
      this.setState({
        filesListScrollTop: nextScrollTop,
      });
    });
  };

  render() {
    const {
      scripts,
      selectedScriptId,
      codeEditorWidth,
      codeEditorHeight,
      filesListHeight,
      filesListScrollTop,
    } = this.state;
    const selectedScript = this._getSelectedScript();
    const selectedCompilationState = this._getSelectedScriptCompilationState();
    const outlineEntries = this._getSelectedScriptOutlineEntries();
    const filesListRowHeight = 47;
    const filesListOverscan = 8;
    const totalScriptsCount = scripts.length;
    const firstVisibleScriptIndex = Math.max(
      0,
      Math.floor(filesListScrollTop / filesListRowHeight) - filesListOverscan
    );
    const maxVisibleScriptsCount =
      Math.ceil(filesListHeight / filesListRowHeight) + filesListOverscan * 2;
    const lastVisibleScriptIndex = Math.min(
      totalScriptsCount,
      firstVisibleScriptIndex + maxVisibleScriptsCount
    );
    const visibleScripts = scripts.slice(
      firstVisibleScriptIndex,
      lastVisibleScriptIndex
    );
    const filesListTopSpacerHeight =
      firstVisibleScriptIndex * filesListRowHeight;
    const filesListBottomSpacerHeight =
      Math.max(0, totalScriptsCount - lastVisibleScriptIndex) *
      filesListRowHeight;

    const markers = selectedCompilationState.diagnostics.map(diagnostic => ({
      message: diagnostic.message,
      startLineNumber: diagnostic.startLineNumber,
      startColumn: diagnostic.startColumn,
      endLineNumber: diagnostic.endLineNumber,
      endColumn: diagnostic.endColumn,
    }));

    return (
      <div style={styles.container}>
        <div style={styles.filesPane}>
          <div style={styles.filesPaneMenuBar}>
            <span style={styles.menuTitle}>TypeScript Scripts</span>
            <span style={styles.menuMeta}>{scripts.length} file(s)</span>
          </div>
          <div style={styles.filesPaneToolbar}>
            <RaisedButton
              primary
              icon={<Add />}
              label={<Trans>Add</Trans>}
              onClick={this._addScript}
            />
            <RaisedButton
              icon={<Add />}
              label={<Trans>types.ts</Trans>}
              onClick={this._addSharedTypesScript}
            />
            <RaisedButton
              label={<Trans>Sync</Trans>}
              onClick={() =>
                this._ensureContextScripts({
                  preferredSceneName: this.props.preferredSceneName,
                  notifyScriptsChanged: true,
                  includeObjectAndBehaviorTargets: true,
                })
              }
            />
          </div>
          <Measure bounds onResize={this._handleFilesListResize}>
            {({ measureRef }) => (
              <div
                ref={measureRef}
                style={styles.filesList}
                onScroll={this._onFilesListScroll}
              >
                {scripts.length === 0 ? (
                  <div style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>
                      <Trans>No TypeScript files yet.</Trans>
                    </Text>
                    <BackgroundText>
                      <Trans>
                        Add one or more files, write TypeScript, and they will be
                        compiled and injected in build/preview automatically.
                      </Trans>
                    </BackgroundText>
                  </div>
                ) : (
                  <>
                    <div style={{ height: filesListTopSpacerHeight }} />
                    {visibleScripts.map((script, visibleScriptIndex) => {
                      const index = firstVisibleScriptIndex + visibleScriptIndex;
                      return (
                        <div
                          key={script.id}
                          style={{
                            ...styles.fileRow,
                            ...(script.id === selectedScriptId
                              ? styles.selectedFileRow
                              : null),
                          }}
                          onClick={() =>
                            this.setState({ selectedScriptId: script.id })
                          }
                        >
                          <FileWithLines />
                          <div style={styles.fileRowName}>{script.name}</div>
                          <div style={styles.fileRowStatus}>
                            <span style={styles.scriptContextBadge}>
                              {this._getScriptContextBadgeLabel(script)}
                            </span>
                            {this._renderScriptStatus(script.id)}
                          </div>
                          <IconButton
                            size="small"
                            disabled={index === 0}
                            onClick={event => {
                              event.stopPropagation();
                              this._moveScript(script.id, -1);
                            }}
                            tooltip={t`Move up`}
                          >
                            <ArrowTop />
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={index === scripts.length - 1}
                            onClick={event => {
                              event.stopPropagation();
                              this._moveScript(script.id, 1);
                            }}
                            tooltip={t`Move down`}
                          >
                            <ArrowBottom />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={event => {
                              event.stopPropagation();
                              this._deleteScript(script.id);
                            }}
                            tooltip={t`Delete`}
                          >
                            <Trash />
                          </IconButton>
                        </div>
                      );
                    })}
                    <div style={{ height: filesListBottomSpacerHeight }} />
                  </>
                )}
              </div>
            )}
          </Measure>
          <div style={styles.filesPaneFooter}>
            <div style={styles.filesPaneFooterTitle}>Outline</div>
            {outlineEntries.length ? (
              outlineEntries.map(outlineEntry => (
                <div
                  key={`${outlineEntry.name}:${outlineEntry.lineNumber}`}
                  style={styles.outlineEntry}
                  onClick={() => this._goToScriptLine(outlineEntry.lineNumber)}
                >
                  <span>{outlineEntry.name}</span>
                  <span style={styles.outlineEntryLine}>Ln {outlineEntry.lineNumber}</span>
                </div>
              ))
            ) : (
              <div style={styles.diagnosticsEmptyState}>
                <Trans>No symbols in this file.</Trans>
              </div>
            )}
          </div>
        </div>
        <Measure
          bounds
          onResize={this._handleEditorPaneResize}
        >
          {({ measureRef }) => (
            <div ref={measureRef} style={styles.editorPane}>
              <div style={styles.editorTopMenu}>
                <span style={styles.menuTitle}>
                  {selectedScript ? selectedScript.name : 'Script Workspace'}
                </span>
                <span style={styles.menuMeta}>
                  {selectedScript
                    ? `${this._getScriptContextBadgeLabel(selectedScript)} Mode`
                    : ''}
                </span>
              </div>
              {selectedScript ? (
                <>
                  <div style={styles.editorHeader}>
                    <div style={styles.editorHeaderControls}>
                      <div style={{ width: 280, minWidth: 220 }}>
                        <CompactSemiControlledTextField
                          commitOnBlur
                          value={selectedScript.name}
                          onChange={newName =>
                            this._renameScript(selectedScript.id, newName)
                          }
                          fullWidth
                        />
                      </div>
                      <div style={{ width: 250, minWidth: 220 }}>
                        <CompactSelectField
                          value={selectedScript.includePosition}
                          disabled={this._isDeclarationScript(selectedScript)}
                          onChange={newIncludePosition =>
                            this._setIncludePosition(
                              selectedScript.id,
                              newIncludePosition
                            )
                          }
                        >
                          <SelectOption
                            value="first"
                            label={t`Load first (before other scripts)`}
                          />
                          <SelectOption
                            value="last"
                            label={t`Load last (after other scripts)`}
                          />
                        </CompactSelectField>
                      </div>
                    </div>
                    <div style={styles.editorStatus}>
                      {this._renderEditorStatus()}
                    </div>
                  </div>
                  <div style={styles.codeEditorContainer}>
                    <CodeEditor
                      value={selectedScript.source}
                      onChange={newValue =>
                        this._setScriptSource(selectedScript.id, newValue)
                      }
                      language="typescript"
                      enableTypoAutoFix={false}
                      extraLibs={this._getProjectScriptsExtraLibs(selectedScript.id)}
                      width={codeEditorWidth}
                      height={codeEditorHeight}
                      markers={markers}
                      revealedPosition={
                        this.state.revealedPosition &&
                        this.state.revealedPosition.scriptId === selectedScript.id
                          ? {
                              lineNumber: this.state.revealedPosition.lineNumber,
                              column: this.state.revealedPosition.column,
                            }
                          : null
                      }
                      onFocus={() => {}}
                      onBlur={() => this._flushScheduledPersistScripts()}
                      onCursorPositionChanged={this._onCursorPositionChanged}
                    />
                  </div>
                  <div style={styles.editorFooter}>
                    <span>{this._getScriptContextSummary(selectedScript)}</span>
                    <span>
                      Ln {this.state.cursorPosition.lineNumber}, Col{' '}
                      {this.state.cursorPosition.column}
                    </span>
                  </div>
                  {this._renderDiagnosticsPanel()}
                </>
              ) : (
                <div style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>
                    <Trans>Create your first TypeScript file.</Trans>
                  </Text>
                  <RaisedButton
                    primary
                    icon={<Add />}
                    label={<Trans>Add TypeScript file</Trans>}
                    onClick={this._addScript}
                  />
                </div>
              )}
            </div>
          )}
        </Measure>
      </div>
    );
  }
}
