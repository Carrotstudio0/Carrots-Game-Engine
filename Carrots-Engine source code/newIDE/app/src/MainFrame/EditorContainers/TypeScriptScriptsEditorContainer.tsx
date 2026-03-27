import * as React from 'react';
import { setEditorHotReloadNeeded } from '../../EmbeddedGame/EmbeddedGameFrame';
import ProjectTypeScriptScriptsEditor from '../../TypeScriptProjectScripts/ProjectTypeScriptScriptsEditor';

type RenderEditorContainerProps = any;
type RenderEditorContainerPropsWithRef = any;
type HotReloadSteps = any;

export class TypeScriptScriptsEditorContainer extends React.Component<RenderEditorContainerProps> {
  editor: any | null = null;

  _getPreferredScriptTarget = () => {
    const extraEditorProps = this.props.extraEditorProps || {};
    return extraEditorProps.preferredTypeScriptScriptTarget || null;
  };

  _syncContextScripts = () => {
    if (this.editor) {
      this.editor.syncContextScripts(
        this.props.projectItemName || null,
        this._getPreferredScriptTarget()
      );
    }
  };

  shouldComponentUpdate(nextProps: RenderEditorContainerProps): boolean {
    return this.props.isActive || nextProps.isActive;
  }

  getProject(): any | null {
    return this.props.project;
  }

  getLayout(): any | null {
    return null;
  }

  updateToolbar(): void {
    if (this.editor) {
      this.editor.updateToolbar();
    } else {
      this.props.setToolbar(null);
    }
  }

  forceUpdateEditor(): void {
    // No updates to be done.
  }

  onEventsBasedObjectChildrenEdited(): void {
    // Nothing to do.
  }

  onSceneObjectEdited(scene: any, objectWithContext: any): void {
    void scene;
    void objectWithContext;
    // Nothing to do.
  }

  onSceneObjectsDeleted(scene: any): void {
    void scene;
    // Nothing to do.
  }

  onSceneEventsModifiedOutsideEditor(changes: any): void {
    void changes;
    this._syncContextScripts();
  }

  notifyChangesToInGameEditor(hotReloadSteps: HotReloadSteps): void {
    setEditorHotReloadNeeded(hotReloadSteps);
  }

  switchInGameEditorIfNoHotReloadIsNeeded(): void {}

  onInstancesModifiedOutsideEditor(changes: any): void {
    void changes;
    // Nothing to do.
  }

  onObjectsModifiedOutsideEditor(changes: any): void {
    void changes;
    this._syncContextScripts();
  }

  onObjectGroupsModifiedOutsideEditor(changes: any): void {
    void changes;
    // Nothing to do.
  }

  _onScriptsChanged = () => {
    this.notifyChangesToInGameEditor({
      shouldReloadProjectData: false,
      shouldReloadLibraries: true,
      shouldReloadResources: false,
      shouldHardReload: false,
      reasons: ['typescript-project-scripts-updated'],
    });
  };

  render(): React.ReactNode {
    const { project } = this.props;
    if (!project) return null;

    return (
      <ProjectTypeScriptScriptsEditor
        ref={editor => {
          this.editor = editor;
        }}
        project={project}
        projectFilePath={
          (this.props.fileMetadata && this.props.fileMetadata.fileIdentifier) ||
          (typeof project.getProjectFile === 'function'
            ? project.getProjectFile()
            : null)
        }
        preferredSceneName={this.props.projectItemName || null}
        preferredScriptTarget={this._getPreferredScriptTarget()}
        setToolbar={this.props.setToolbar}
        unsavedChanges={this.props.unsavedChanges}
        onScriptsChanged={this._onScriptsChanged}
      />
    );
  }
}

export const renderTypeScriptScriptsEditorContainer = (
  props: RenderEditorContainerPropsWithRef
): React.ReactNode => <TypeScriptScriptsEditorContainer {...props} />;
