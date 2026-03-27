// @flow
import * as React from 'react';
import classNames from 'classnames';
import Button from '@material-ui/core/Button';
import InlinePopover from '../../InlinePopover';
import ObjectField from '../../ParameterFields/ObjectField';
import {
  largeSelectedArea,
  largeSelectableArea,
  selectableArea,
} from '../ClassNames';
import { getHelpLink } from '../../../Utils/HelpLink';
import { type EventRendererProps } from './EventRenderer';
import Measure from 'react-measure';
import { CodeEditor } from '../../../CodeEditor';
import { shouldActivate } from '../../../UI/KeyboardShortcuts/InteractionKeys';
import { type ParameterFieldInterface } from '../../ParameterFields/ParameterFieldCommons';
import { Trans } from '@lingui/macro';
import ChevronArrowTop from '../../../UI/CustomSvgIcons/ChevronArrowTop';
import ChevronArrowBottom from '../../../UI/CustomSvgIcons/ChevronArrowBottom';
import {
  type CodeLanguage,
  type TypeScriptDiagnostic,
  buildTypeScriptStoredCode,
  extractTranspiledJavaScriptCode,
  extractTypeScriptSource,
  isTypeScriptStoredCode,
  preloadTypeScriptCompiler,
  transpileTypeScriptCode,
} from '../../../CodeEditor/TypeScriptEventCode';
import {
  type RuntimeBehaviorTypesByType,
  getRuntimeBehaviorTypesByType,
  preloadRuntimeBehaviorTypesByType,
} from '../../../CodeEditor/RuntimeBehaviorTypes';
import { getProjectScriptingMode } from '../../../Utils/ScriptingMode';
const gd: libGDevelop = global.gd;

const fontFamily = '"Lucida Console", Monaco, monospace';
const MINIMUM_EDITOR_HEIGHT = 200;
const EDITOR_PADDING = 100;

const styles = {
  container: {
    minHeight: 30,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
  },
  wrappingText: {
    fontFamily,
    fontSize: '0.95em',
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 2,
    paddingBottom: 2,
    margin: 0,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    overflowX: 'hidden',
    maxWidth: '100%',
    whiteSpace: 'normal',
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
  },
  comment: {
    color: '#777',
  },
  commentLink: {
    cursor: 'pointer',
    color: '#777',
    textDecoration: 'underline',
  },
  expandIcon: {
    color: '#d4d4d4',
  },
  languageToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingBottom: 4,
    backgroundColor: '#1e1e1e',
  },
  languageStatus: {
    marginLeft: 4,
    fontSize: '0.8em',
    color: '#a0a0a0',
    overflowX: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeScriptStatusError: {
    color: '#ffb3b3',
  },
  legacyNotice: {
    fontFamily,
    fontSize: '0.75em',
    color: '#9fb0c6',
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 4,
  },
};

type State = {|
  editingObject: boolean,
  editingPreviousValue: ?string,
  anchorEl: ?any,
  codeLanguageOverride: ?CodeLanguage,
  transpileError: ?string,
  isCompilingTypeScript: boolean,
  typeScriptDraftCode: ?string,
  typeScriptDiagnostics: Array<TypeScriptDiagnostic>,
  runtimeBehaviorTypesByType: RuntimeBehaviorTypesByType,
|};

export default class JsCodeEvent extends React.Component<
  EventRendererProps,
  State
> {
  _objectField: ?ParameterFieldInterface = null;
  // $FlowFixMe[missing-local-annot]
  state = {
    editingObject: false,
    editingPreviousValue: null,
    anchorEl: null,
    codeLanguageOverride: null,
    transpileError: null,
    isCompilingTypeScript: false,
    typeScriptDraftCode: null,
    typeScriptDiagnostics: [],
    runtimeBehaviorTypesByType: {},
  };

  _input: ?any;
  _inlineCodeBeforeChanges: ?string;
  _typeScriptTranspileRequestId = 0;

  componentDidMount() {
    if (this._getCodeLanguage() === 'typescript') {
      preloadTypeScriptCompiler();
    }
    preloadRuntimeBehaviorTypesByType();
    getRuntimeBehaviorTypesByType().then(runtimeBehaviorTypesByType => {
      this.setState({ runtimeBehaviorTypesByType });
    });
  }

  componentDidUpdate(prevProps: EventRendererProps) {
    if (prevProps.event !== this.props.event) {
      this.setState({
        codeLanguageOverride: null,
        transpileError: null,
        typeScriptDraftCode: null,
        typeScriptDiagnostics: [],
      });
    }
  }

  _getDefaultCodeLanguage = (): CodeLanguage =>
    getProjectScriptingMode(this.props.project) === 'typescript'
      ? 'typescript'
      : 'javascript';

  _getJsCodeEvent = (): any => gd.asJsCodeEvent(this.props.event);

  _supportsNativeTypeScriptStorage = (jsCodeEvent: any): boolean =>
    typeof jsCodeEvent.getCodeLanguage === 'function' &&
    typeof jsCodeEvent.setCodeLanguage === 'function' &&
    typeof jsCodeEvent.getTranspiledCode === 'function' &&
    typeof jsCodeEvent.setTranspiledCode === 'function';

  _getStoredCode = (): string =>
    gd.asJsCodeEvent(this.props.event).getInlineCode();

  _getCodeLanguage = (): CodeLanguage => {
    const { codeLanguageOverride } = this.state;
    if (codeLanguageOverride) return codeLanguageOverride;

    const jsCodeEvent = this._getJsCodeEvent();
    if (this._supportsNativeTypeScriptStorage(jsCodeEvent)) {
      if (jsCodeEvent.getCodeLanguage() === 'typescript') return 'typescript';
    }

    const storedCode = this._getStoredCode();
    if (isTypeScriptStoredCode(storedCode)) return 'typescript';
    if (!storedCode.trim() && this._getDefaultCodeLanguage() === 'typescript') {
      return 'typescript';
    }
    return 'javascript';
  };

  _getCodeEditorValue = (): string => {
    const jsCodeEvent = this._getJsCodeEvent();
    const storedCode = jsCodeEvent.getInlineCode();
    if (this._getCodeLanguage() === 'typescript') {
      if (this._supportsNativeTypeScriptStorage(jsCodeEvent)) {
        return storedCode;
      }
      const extractedSource = extractTypeScriptSource(storedCode);
      return extractedSource !== null
        ? extractedSource
        : this.state.typeScriptDraftCode || '';
    }
    return storedCode;
  };

  onFocus = () => {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    this._inlineCodeBeforeChanges = jsCodeEvent.getInlineCode();
  };

  onBlur = () => {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    const inlineCodeAfterChanges = jsCodeEvent.getInlineCode();
    if (this._inlineCodeBeforeChanges !== inlineCodeAfterChanges)
      this.props.onEndEditingEvent();
  };

  _transpileAndStoreTypeScript = async (typeScriptSource: string) => {
    const jsCodeEvent = this._getJsCodeEvent();
    const transpileRequestId = ++this._typeScriptTranspileRequestId;
    this.setState({
      isCompilingTypeScript: true,
      typeScriptDraftCode: typeScriptSource,
    });

    const {
      transpiledJavaScriptCode,
      errorMessage,
      diagnostics,
    } = await transpileTypeScriptCode(typeScriptSource, {
      moduleKind: 'none',
      inlineSourceMap: true,
      fileName: `events-sheet-js-code-event-${this.props.event.ptr || 'unknown'}.ts`,
    });

    if (transpileRequestId !== this._typeScriptTranspileRequestId) {
      return;
    }

    if (this._supportsNativeTypeScriptStorage(jsCodeEvent)) {
      jsCodeEvent.setCodeLanguage('typescript');
      jsCodeEvent.setInlineCode(typeScriptSource);
      jsCodeEvent.setTranspiledCode(transpiledJavaScriptCode);
    } else {
      jsCodeEvent.setInlineCode(
        buildTypeScriptStoredCode({
          typeScriptSource,
          transpiledJavaScriptCode,
        })
      );
    }

    this.setState({
      transpileError: errorMessage,
      isCompilingTypeScript: false,
      typeScriptDraftCode: null,
      typeScriptDiagnostics: diagnostics,
    });
  };

  _switchCodeLanguage = (nextCodeLanguage: CodeLanguage) => {
    const jsCodeEvent = this._getJsCodeEvent();
    const currentCodeLanguage = this._getCodeLanguage();
    if (currentCodeLanguage === nextCodeLanguage) return;

    const currentEditorValue = this._getCodeEditorValue();
    if (nextCodeLanguage === 'typescript') {
      preloadTypeScriptCompiler();
      this.setState({
        codeLanguageOverride: 'typescript',
      });
      this._transpileAndStoreTypeScript(currentEditorValue);
      return;
    }

    this._typeScriptTranspileRequestId += 1;
    if (this._supportsNativeTypeScriptStorage(jsCodeEvent)) {
      const codeToKeep =
        jsCodeEvent.getCodeLanguage() === 'typescript' &&
        jsCodeEvent.getTranspiledCode()
          ? jsCodeEvent.getTranspiledCode()
          : jsCodeEvent.getInlineCode();
      jsCodeEvent.setCodeLanguage('javascript');
      jsCodeEvent.setTranspiledCode('');
      jsCodeEvent.setInlineCode(codeToKeep);
    } else {
      const storedCode = jsCodeEvent.getInlineCode();
      jsCodeEvent.setInlineCode(extractTranspiledJavaScriptCode(storedCode));
    }
    this.setState({
      codeLanguageOverride: 'javascript',
      transpileError: null,
      isCompilingTypeScript: false,
      typeScriptDraftCode: null,
      typeScriptDiagnostics: [],
    });
  };

  onChange = (newValue: string) => {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    if (this._getCodeLanguage() === 'typescript') {
      this._transpileAndStoreTypeScript(newValue);
      return;
    }

    jsCodeEvent.setInlineCode(newValue);
  };

  _getTypeScriptStatus = (): React.Node => {
    const {
      isCompilingTypeScript,
      transpileError,
      typeScriptDiagnostics,
    } = this.state;
    if (isCompilingTypeScript) {
      return <Trans>Compiling TypeScript...</Trans>;
    }
    if (transpileError) {
      return (
        <span style={styles.typeScriptStatusError}>
          <Trans>TypeScript compile errors:</Trans>{' '}
          {typeScriptDiagnostics.length || 1} - {transpileError}
        </span>
      );
    }
    return <Trans>TypeScript ready</Trans>;
  };

  _quoteTypeProperty = (name: string): string =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);

  _resolveRuntimeBehaviorType = (behaviorType: string): string =>
    this.state.runtimeBehaviorTypesByType[behaviorType] ||
    'gdjs.RuntimeBehavior';

  _collectSceneObjectsAndBehaviorsFromContainer = (
    objectsContainer: ?any
  ): {|
    objectNames: Array<string>,
    behaviorTypesByName: { [string]: Set<string> },
  |} => {
    if (
      !objectsContainer ||
      typeof objectsContainer.getObjectsCount !== 'function' ||
      typeof objectsContainer.getObjectAt !== 'function'
    ) {
      return {
        objectNames: [],
        behaviorTypesByName: {},
      };
    }

    const objectNames = [];
    const behaviorTypesByName = {};
    const objectsCount = objectsContainer.getObjectsCount();
    for (let i = 0; i < objectsCount; i++) {
      const object = objectsContainer.getObjectAt(i);
      if (object && typeof object.getName === 'function') {
        objectNames.push(object.getName());
      }

      if (!object || typeof object.getAllBehaviorNames !== 'function') {
        continue;
      }

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

    return {
      objectNames,
      behaviorTypesByName,
    };
  };

  _getSceneObjectsTypeDefinitions = (): Array<{| content: string, filePath: string |}> => {
    const objectNames = [];
    const behaviorTypesByName = {};
    const appendFromContainer = (objectsContainer: ?any) => {
      const {
        objectNames: containerObjectNames,
        behaviorTypesByName: containerBehaviorTypesByName,
      } = this._collectSceneObjectsAndBehaviorsFromContainer(objectsContainer);
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

    appendFromContainer(this.props.globalObjectsContainer);
    appendFromContainer(this.props.objectsContainer);

    const uniqueNames = Array.from(new Set(objectNames)).filter(name => !!name);
    const uniqueBehaviorNames = Object.keys(behaviorTypesByName).filter(
      behaviorName => !!behaviorName
    );
    if (!uniqueNames.length && !uniqueBehaviorNames.length) return [];

    const objectFields = uniqueNames
      .map(name => `  ${this._quoteTypeProperty(name)}: gdjs.RuntimeObject[];`)
      .join('\n');
    const behaviorFields = uniqueBehaviorNames
      .map(behaviorName => {
        const typeNames = Array.from(behaviorTypesByName[behaviorName]);
        const typeExpression = typeNames.length
          ? typeNames.join(' | ')
          : 'gdjs.RuntimeBehavior';
        return `  ${this._quoteTypeProperty(
          behaviorName
        )}: ${typeExpression};`;
      })
      .join('\n');
    const eventPtr = this.props.event && this.props.event.ptr ? this.props.event.ptr : 'unknown';

    return [
      {
        filePath: `gdevelop://scene-objects-${eventPtr}.d.ts`,
        content: `
type __GDevelopSceneObjectLists = {
${objectFields}
};

type __GDevelopSceneBehaviorByName = {
${behaviorFields}
};

declare const sceneObjects: __GDevelopSceneObjectLists;
declare const scene: gdjs.RuntimeScene & __GDevelopSceneObjectLists;
declare const evtTools: typeof gdjs.evtTools;

declare namespace gdjs {
  interface RuntimeObject {
    getBehavior<Name extends keyof __GDevelopSceneBehaviorByName>(name: Name): __GDevelopSceneBehaviorByName[Name];
  }
}
`,
      },
    ];
  };

  _getRuntimeBehaviorTemplate = (): string => `class MyBehavior extends gdjs.RuntimeBehavior {
  doStepPreEvents(runtimeScene: gdjs.RuntimeScene): void {
    const owner = this.owner;
    // TODO: Write your behavior logic.
  }

  onDeActivate(): void {}
  onActivate(): void {}
}
`;

  _insertRuntimeBehaviorTemplate = () => {
    if (this._getCodeLanguage() !== 'typescript') return;
    const currentCode = this._getCodeEditorValue();
    if (currentCode.trim()) return;
    this.onChange(this._getRuntimeBehaviorTemplate());
  };

  editObject = (domEvent: any) => {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    const parameterObjects = jsCodeEvent.getParameterObjects();

    // We should not need to use a timeout, but
    // if we don't do this, the InlinePopover's clickaway listener
    // is immediately picking up the event and closing.
    // Search the rest of the codebase for inlinepopover-event-hack
    const anchorEl = domEvent.currentTarget;
    setTimeout(
      () =>
        this.setState(
          {
            editingObject: true,
            editingPreviousValue: parameterObjects,
            anchorEl,
          },
          () => {
            // Give a bit of time for the popover to mount itself
            setTimeout(() => {
              if (this._objectField) this._objectField.focus();
            }, 10);
          }
        ),
      10
    );
  };

  cancelObjectEditing = () => {
    this.endObjectEditing();

    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    const { editingPreviousValue } = this.state;
    if (editingPreviousValue != null) {
      jsCodeEvent.setParameterObjects(editingPreviousValue);
      this.forceUpdate();
    }
  };

  endObjectEditing = () => {
    const { anchorEl } = this.state;

    // Put back the focus after closing the inline popover.
    // $FlowFixMe[incompatible-type]
    if (anchorEl) anchorEl.focus();
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    const { editingPreviousValue } = this.state;
    if (editingPreviousValue !== jsCodeEvent.getParameterObjects()) {
      this.props.onEndEditingEvent();
    }
    this.setState({
      editingObject: false,
      editingPreviousValue: null,
      anchorEl: null,
    });
  };

  toggleExpanded = () => {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    jsCodeEvent.setEventsSheetExpanded(!jsCodeEvent.isEventsSheetExpanded());
  };

  _getCodeEditorHeight = (): any => {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);

    // Always use the minimum height when collapsed.
    if (!jsCodeEvent.isEventsSheetExpanded()) {
      return MINIMUM_EDITOR_HEIGHT;
    }

    // Shrink the editor enough for the additional event elements to fit in the sheet space.
    const heightToFillSheet = this.props.eventsSheetHeight - EDITOR_PADDING;
    return Math.max(MINIMUM_EDITOR_HEIGHT, heightToFillSheet);
  };

  render(): any {
    const jsCodeEvent = gd.asJsCodeEvent(this.props.event);
    const parameterObjects = jsCodeEvent.getParameterObjects();
    const codeLanguage = this._getCodeLanguage();
    const codeEditorValue = this._getCodeEditorValue();
    const sceneObjectsTypeDefinitions =
      codeLanguage === 'typescript' ? this._getSceneObjectsTypeDefinitions() : [];

    const textStyle = this.props.disabled ? styles.comment : undefined;

    const objects = (
      <span
        className={classNames({
          [selectableArea]: true,
        })}
        onClick={this.editObject}
        onKeyPress={event => {
          if (shouldActivate(event)) {
            this.editObject(event);
          }
        }}
        tabIndex={0}
        style={textStyle}
      >
        {parameterObjects ? (
          <Trans>, objects /*{parameterObjects}*/</Trans>
        ) : (
          <>
            {' '}
            {codeLanguage === 'typescript' ? (
              <Trans>
                {'/* Click here to choose objects to pass to TypeScript */'}
              </Trans>
            ) : (
              <Trans>
                {'/* Click here to choose objects to pass to JavaScript */'}
              </Trans>
            )}
          </>
        )}
      </span>
    );

    const eventsFunctionContext = this.props.scope.eventsFunction ? (
      <span style={textStyle}>, eventsFunctionContext</span>
    ) : null;

    const functionStart = (
      <p style={styles.wrappingText}>
        <span style={textStyle}>
          {this.props.disabled ? '/*' : ''}
          {'(function(runtimeScene'}
        </span>
        {objects}
        {eventsFunctionContext}
        <span style={textStyle}>{') {'}</span>
      </p>
    );

    const languageToolbar = (
      <div style={styles.languageToolbar}>
        <Button
          size="small"
          variant={codeLanguage === 'javascript' ? 'contained' : 'text'}
          color="primary"
          onClick={() => this._switchCodeLanguage('javascript')}
          disabled={this.props.disabled}
        >
          <Trans>JavaScript</Trans>
        </Button>
        <Button
          size="small"
          variant={codeLanguage === 'typescript' ? 'contained' : 'text'}
          color="primary"
          onClick={() => this._switchCodeLanguage('typescript')}
          disabled={this.props.disabled}
        >
          <Trans>TypeScript</Trans>
        </Button>
        {codeLanguage === 'typescript' && (
          <Button
            size="small"
            variant="text"
            color="primary"
            onClick={this._insertRuntimeBehaviorTemplate}
            disabled={this.props.disabled}
          >
            <Trans>Insert Behavior Template</Trans>
          </Button>
        )}
        {codeLanguage === 'typescript' && (
          <span style={styles.languageStatus}>{this._getTypeScriptStatus()}</span>
        )}
      </div>
    );
    const functionEnd = (
      <p style={styles.wrappingText}>
        <span style={textStyle}>{'})(runtimeScene'}</span>
        {objects}
        {eventsFunctionContext}
        <span style={textStyle}>
          {');'}
          {this.props.disabled ? '*/' : ''}
        </span>
        <span style={styles.comment}>
          {' // '}
          <a
            href={getHelpLink('/events/js-code')}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.commentLink}
          >
            Read the documentation and help
          </a>
        </span>
      </p>
    );

    const expandIcon = (
      <div style={styles.expandIcon}>
        {jsCodeEvent.isEventsSheetExpanded() ? (
          <ChevronArrowTop fontSize="small" color="inherit" />
        ) : (
          <ChevronArrowBottom fontSize="small" color="inherit" />
        )}
      </div>
    );

    return (
      <Measure bounds>
        {({ measureRef, contentRect }) => (
          <div
            style={styles.container}
            className={classNames({
              [largeSelectableArea]: true,
              [largeSelectedArea]: this.props.selected,
              'event-kind-jscode': true,
            })}
            ref={measureRef}
            id={`${this.props.idPrefix}-js-code`}
          >
            <p style={styles.legacyNotice}>
              <Trans>
                Legacy script event. Use the Script tab in the scene toolbar for
                full project scripting.
              </Trans>
            </p>
            {functionStart}
            {languageToolbar}
            <CodeEditor
              value={codeEditorValue}
              onChange={this.onChange}
              language={codeLanguage}
              extraLibs={sceneObjectsTypeDefinitions}
              markers={
                codeLanguage === 'typescript'
                  ? this.state.typeScriptDiagnostics
                  : []
              }
              width={contentRect.bounds.width - 5}
              height={this._getCodeEditorHeight()}
              onEditorMounted={() => {
                this.props.onUpdate();
              }}
              onFocus={this.onFocus}
              onBlur={this.onBlur}
            />
            {functionEnd}
            <Button onClick={this.toggleExpanded} fullWidth size="small">
              {expandIcon}
            </Button>
            <InlinePopover
              open={this.state.editingObject}
              anchorEl={this.state.anchorEl}
              onRequestClose={this.cancelObjectEditing}
              onApply={this.endObjectEditing}
            >
              <ObjectField
                project={this.props.project}
                scope={this.props.scope}
                globalObjectsContainer={this.props.globalObjectsContainer}
                objectsContainer={this.props.objectsContainer}
                projectScopedContainersAccessor={
                  this.props.projectScopedContainersAccessor
                }
                value={parameterObjects}
                onChange={text => {
                  jsCodeEvent.setParameterObjects(text);
                  this.props.onUpdate();
                }}
                isInline
                onRequestClose={this.cancelObjectEditing}
                onApply={this.endObjectEditing}
                ref={objectField => (this._objectField = objectField)}
              />
            </InlinePopover>
          </div>
        )}
      </Measure>
    );
  }
}
