import { Trans } from '@lingui/macro';
import * as React from 'react';
import { setupAutocompletions } from './LocalCodeEditorAutocompletions';
import PlaceholderLoader from '../UI/PlaceholderLoader';
import RaisedButton from '../UI/RaisedButton';
import Text from '../UI/Text';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import { getAllThemes } from './Theme';
import type { CodeLanguage } from './TypeScriptEventCode';

type CodeEditorPosition = {
  lineNumber: number;
  column: number;
};

type ExtraLib = {
  content: string;
  filePath: string;
};

type CodeEditorMarker = {
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage;
  revealedPosition?: CodeEditorPosition | null;
  extraLibs?: Array<ExtraLib>;
  markers?: Array<CodeEditorMarker>;
  width?: number;
  height?: number;
  onEditorMounted?: () => void;
  onCursorPositionChanged?: (position: CodeEditorPosition) => void;
  enableTypoAutoFix?: boolean;
  onFocus: () => void;
  onBlur: () => void;
};

type State = {
  MonacoEditor: any | null;
  error: Error | null;
};

const fallbackStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  textarea: {
    width: '100%',
    minHeight: 200,
    resize: 'vertical' as const,
    background: '#111722',
    color: '#dce6ff',
    border: '1px solid #344260',
    borderRadius: 6,
    padding: 10,
    fontFamily: 'Consolas, "Cascadia Code", monospace',
    fontSize: 13,
    lineHeight: 1.45,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
};

const monacoEditorOptions = {
  scrollBeyondLastLine: false,
  automaticLayout: true,
  quickSuggestions: {
    other: true,
    comments: true,
    strings: true,
  },
  parameterHints: {
    enabled: true,
  },
  suggestOnTriggerCharacters: true,
  tabCompletion: 'on',
  wordBasedSuggestions: true,
  inlineSuggest: {
    enabled: true,
  },
  lightbulb: {
    enabled: true,
  },
  minimap: {
    enabled: false,
  },
  smoothScrolling: false,
};

let monacoCompletionsInitialized = false;
let monacoThemesInitialized = false;

export class CodeEditor extends React.Component<Props, State> {
  _editor: any | null = null;
  _monaco: any | null = null;
  _extraLibDisposers: Array<{ dispose: () => void }> = [];
  _markersChangeDisposer: { dispose: () => void } | null = null;
  _modelContentChangeDisposer: { dispose: () => void } | null = null;
  _cursorPositionChangeDisposer: { dispose: () => void } | null = null;
  _autoFixTypoTimeout: ReturnType<typeof setTimeout> | null = null;
  _lastAutoFixVersionId = -1;
  _lastExtraLibsSignature = '__not-initialized__';

  state: State = {
    MonacoEditor: null,
    error: null,
  };

  setupEditorThemes = (monaco: any) => {
    if (monacoThemesInitialized) return;
    monacoThemesInitialized = true;

    getAllThemes().forEach(codeEditorTheme => {
      if (codeEditorTheme.themeData) {
        monaco.editor.defineTheme(
          codeEditorTheme.themeName,
          codeEditorTheme.themeData
        );
      }
    });
  };

  setUpSaveOnEditorBlur = (editor: any) => {
    editor.onDidBlurEditorText(this.props.onBlur);
  };

  setUpEditorFocus = (editor: any) => {
    editor.onDidFocusEditorText(this.props.onFocus);
  };

  _extractSuggestedIdentifierFromDiagnostic = (
    markerMessage: string
  ): string | null => {
    const suggestionMatch = markerMessage.match(
      /Did you mean ['"`]([A-Za-z_$][A-Za-z0-9_$]*)['"`]\??/i
    );
    return suggestionMatch && suggestionMatch[1] ? suggestionMatch[1] : null;
  };

  _computeLevenshteinDistance = (
    sourceText: string,
    targetText: string
  ): number => {
    if (sourceText === targetText) return 0;
    if (!sourceText.length) return targetText.length;
    if (!targetText.length) return sourceText.length;

    const sourceLength = sourceText.length;
    const targetLength = targetText.length;
    const matrix = new Array(sourceLength + 1);
    for (let i = 0; i <= sourceLength; i++) {
      matrix[i] = new Array(targetLength + 1);
      matrix[i][0] = i;
    }
    for (let j = 0; j <= targetLength; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= sourceLength; i++) {
      for (let j = 1; j <= targetLength; j++) {
        const substitutionCost =
          sourceText[i - 1].toLowerCase() === targetText[j - 1].toLowerCase()
            ? 0
            : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + substitutionCost
        );
      }
    }
    return matrix[sourceLength][targetLength];
  };

  _shouldApplyTypoAutoFix = (
    currentIdentifier: string,
    suggestedIdentifier: string
  ): boolean => {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(currentIdentifier)) return false;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(suggestedIdentifier)) return false;
    if (currentIdentifier === suggestedIdentifier) return false;
    if (currentIdentifier.length > 64 || suggestedIdentifier.length > 64)
      return false;

    return (
      this._computeLevenshteinDistance(currentIdentifier, suggestedIdentifier) <=
      2
    );
  };

  _tryApplyTypoAutoFix = () => {
    if (!this._editor || !this._monaco || !this.props.enableTypoAutoFix) return;
    if (
      !this._monaco.editor ||
      typeof this._monaco.editor.getModelMarkers !== 'function'
    ) {
      return;
    }

    const model = this._editor.getModel();
    if (!model) return;

    const markers = this._monaco.editor.getModelMarkers({
      resource: model.uri,
    });
    if (!markers || !markers.length) return;

    const edits = markers
      .slice(0, 80)
      .filter((marker: any) => marker && marker.message)
      .map((marker: any) => {
        const suggestedIdentifier = this._extractSuggestedIdentifierFromDiagnostic(
          marker.message
        );
        if (!suggestedIdentifier) return null;

        const range = {
          startLineNumber: marker.startLineNumber,
          startColumn: marker.startColumn,
          endLineNumber: marker.endLineNumber,
          endColumn: marker.endColumn,
        };
        const currentIdentifier = model.getValueInRange(range);
        if (
          !this._shouldApplyTypoAutoFix(currentIdentifier, suggestedIdentifier)
        ) {
          return null;
        }
        return {
          range,
          text: suggestedIdentifier,
          forceMoveMarkers: true,
        };
      })
      .filter(Boolean)
      .slice(0, 8);

    if (!edits.length) return;

    const currentVersionId = model.getVersionId();
    if (this._lastAutoFixVersionId === currentVersionId) return;
    this._lastAutoFixVersionId = currentVersionId;
    this._editor.executeEdits('gdevelop-typo-autofix', edits);
    this._editor.pushUndoStop();
  };

  _scheduleTypoAutoFix = () => {
    if (!this.props.enableTypoAutoFix) return;
    if (this._autoFixTypoTimeout) {
      clearTimeout(this._autoFixTypoTimeout);
    }
    this._autoFixTypoTimeout = setTimeout(() => {
      this._autoFixTypoTimeout = null;
      this._tryApplyTypoAutoFix();
    }, 320);
  };

  _setupTypoAutoFix = (editor: any, monaco: any) => {
    if (!this.props.enableTypoAutoFix) return;
    const model = editor.getModel();
    if (!model) return;

    if (
      monaco.editor &&
      typeof monaco.editor.onDidChangeMarkers === 'function'
    ) {
      this._markersChangeDisposer = monaco.editor.onDidChangeMarkers(
        (changedResources: Array<any>) => {
          const modelUriString = model.uri.toString();
          if (
            !changedResources.some(
              (resource: any) => resource.toString() === modelUriString
            )
          ) {
            return;
          }
          this._scheduleTypoAutoFix();
        }
      );
    } else if (typeof editor.onDidChangeModelDecorations === 'function') {
      this._markersChangeDisposer = editor.onDidChangeModelDecorations(() => {
        this._scheduleTypoAutoFix();
      });
    }

    if (this._modelContentChangeDisposer) {
      this._modelContentChangeDisposer.dispose();
      this._modelContentChangeDisposer = null;
    }
    this._modelContentChangeDisposer = editor.onDidChangeModelContent(() => {
      this._scheduleTypoAutoFix();
    });
  };

  setupEditorCompletions = (editor: any, monaco: any) => {
    this._editor = editor;
    this._monaco = monaco;
    this.setUpEditorFocus(editor);
    this.setUpSaveOnEditorBlur(editor);

    if (this._cursorPositionChangeDisposer) {
      this._cursorPositionChangeDisposer.dispose();
      this._cursorPositionChangeDisposer = null;
    }
    this._cursorPositionChangeDisposer = editor.onDidChangeCursorPosition(
      (event: any) => {
        if (!this.props.onCursorPositionChanged) return;
        const { position } = event;
        if (!position) return;
        this.props.onCursorPositionChanged({
          lineNumber: position.lineNumber,
          column: position.column,
        });
      }
    );

    if (!monacoCompletionsInitialized) {
      monacoCompletionsInitialized = true;

      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES6,
        allowNonTsExtensions: true,
        allowJs: true,
        // JavaScript in Events is dynamic by design (runtime-injected symbols),
        // so full JS type-checking creates many false positives.
        checkJs: false,
      });
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES6,
        allowNonTsExtensions: true,
        allowJs: false,
        checkJs: false,
      });
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSuggestionDiagnostics: true,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSuggestionDiagnostics: false,
        noSyntaxValidation: false,
      });

      setupAutocompletions(monaco);
    }

    this._applyExtraLibs();
    this._applyModelLanguage();
    this._applyMarkers();
    this._revealPosition();
    this._setupTypoAutoFix(editor, monaco);
    if (this.props.onEditorMounted) this.props.onEditorMounted();
  };

  _disposeExtraLibs = () => {
    this._extraLibDisposers.forEach(disposer => {
      if (disposer && typeof disposer.dispose === 'function') disposer.dispose();
    });
    this._extraLibDisposers = [];
  };

  _buildExtraLibsSignature = (extraLibs?: Array<ExtraLib>): string => {
    if (!extraLibs || !extraLibs.length) return '';
    return extraLibs
      .map(({ content, filePath }) => {
        const safeContent = content || '';
        const head = safeContent.slice(0, 32);
        const tail = safeContent.slice(Math.max(0, safeContent.length - 32));
        return `${filePath}|${safeContent.length}|${head}|${tail}`;
      })
      .join('\n');
  };

  _applyExtraLibs = () => {
    if (!this._monaco) return;
    const extraLibs = this.props.extraLibs;
    const extraLibsSignature = this._buildExtraLibsSignature(extraLibs);
    if (extraLibsSignature === this._lastExtraLibsSignature) return;
    this._lastExtraLibsSignature = extraLibsSignature;

    this._disposeExtraLibs();
    if (!extraLibs || !extraLibs.length) return;

    extraLibs.forEach(({ content, filePath }) => {
      this._extraLibDisposers.push(
        this._monaco.languages.typescript.javascriptDefaults.addExtraLib(
          content,
          filePath
        )
      );
      this._extraLibDisposers.push(
        this._monaco.languages.typescript.typescriptDefaults.addExtraLib(
          content,
          filePath
        )
      );
    });
  };

  _applyMarkers = () => {
    if (!this._editor || !this._monaco) return;
    const model = this._editor.getModel();
    if (!model) return;

    const markers = this.props.markers || [];
    this._monaco.editor.setModelMarkers(
      model,
      'gdevelop-code-editor',
      markers.map(marker => ({
        ...marker,
        severity: this._monaco.MarkerSeverity.Error,
      }))
    );
  };

  _applyModelLanguage = () => {
    if (!this._editor || !this._monaco) return;
    const model = this._editor.getModel();
    if (!model) return;

    const targetLanguage = this.props.language || 'javascript';
    if (
      typeof model.getLanguageId === 'function' &&
      model.getLanguageId() === targetLanguage
    ) {
      return;
    }

    this._monaco.editor.setModelLanguage(model, targetLanguage);
  };

  _revealPosition = () => {
    if (!this._editor) return;
    const revealedPosition = this.props.revealedPosition;
    if (!revealedPosition) return;

    this._editor.revealPositionInCenter(revealedPosition);
    this._editor.setPosition(revealedPosition);
    this._editor.focus();
  };

  componentDidMount() {
    this.loadMonacoEditor();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.language !== this.props.language) {
      this._applyModelLanguage();
    }
    if (prevProps.extraLibs !== this.props.extraLibs) {
      this._applyExtraLibs();
    }
    if (prevProps.markers !== this.props.markers) {
      this._applyMarkers();
    }
    if (prevProps.revealedPosition !== this.props.revealedPosition) {
      this._revealPosition();
    }
  }

  componentWillUnmount() {
    if (this._markersChangeDisposer) {
      this._markersChangeDisposer.dispose();
      this._markersChangeDisposer = null;
    }
    if (this._modelContentChangeDisposer) {
      this._modelContentChangeDisposer.dispose();
      this._modelContentChangeDisposer = null;
    }
    if (this._cursorPositionChangeDisposer) {
      this._cursorPositionChangeDisposer.dispose();
      this._cursorPositionChangeDisposer = null;
    }
    if (this._autoFixTypoTimeout) {
      clearTimeout(this._autoFixTypoTimeout);
      this._autoFixTypoTimeout = null;
    }
    this._disposeExtraLibs();
    this._editor = null;
    this._monaco = null;
  }

  handleLoadError = (error: Error) => {
    console.error('Unable to load Monaco editor module.', error);
    this.setState({ error });
  };

  loadMonacoEditor() {
    this.setState({ error: null });
    window.MonacoEnvironment = {
      getWorkerUrl: function () {
        return 'external/monaco-editor-min/vs/base/worker/workerMain.js';
      },
    };

    import(/* webpackChunkName: "react-monaco-editor" */ 'react-monaco-editor')
      .then(module =>
        this.setState({
          MonacoEditor: module.default,
        })
      )
      .catch(this.handleLoadError);
  }

  _handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  render(): React.ReactNode {
    const { MonacoEditor, error } = this.state;
    if (error) {
      return (
        <div style={fallbackStyles.container}>
          <Text>
            <Trans>Unable to load the code editor</Trans>
          </Text>
          <RaisedButton
            label={<Trans>Retry</Trans>}
            onClick={this.loadMonacoEditor.bind(this)}
          />
          <textarea
            style={{
              ...fallbackStyles.textarea,
              minHeight: this.props.height || fallbackStyles.textarea.minHeight,
            }}
            value={this.props.value}
            onChange={event => this.props.onChange(event.target.value)}
            onFocus={this.props.onFocus}
            onBlur={this.props.onBlur}
            spellCheck={false}
          />
        </div>
      );
    }

    if (!MonacoEditor) return <PlaceholderLoader />;

    return (
      <div onContextMenu={this._handleContextMenu}>
        <PreferencesContext.Consumer>
          {({ values: preferences }: any) => (
            <MonacoEditor
              width={this.props.width || 600}
              height={this.props.height || 200}
              language={this.props.language || 'javascript'}
              theme={preferences.codeEditorThemeName}
              value={this.props.value}
              onChange={this.props.onChange}
              editorWillMount={this.setupEditorThemes}
              editorDidMount={this.setupEditorCompletions}
              options={{
                ...monacoEditorOptions,
                fontSize: preferences.eventsSheetZoomLevel,
                wordWrap: 'off',
              }}
            />
          )}
        </PreferencesContext.Consumer>
      </div>
    );
  }
}
