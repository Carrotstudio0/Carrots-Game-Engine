// @flow
import * as React from 'react';
import CinematicTimeline3DEditor from '../../CinematicTimeline3D/CinematicTimeline3DEditor';
import {
  type RenderEditorContainerProps,
  type RenderEditorContainerPropsWithRef,
  type SceneEventsOutsideEditorChanges,
  type InstancesOutsideEditorChanges,
  type ObjectsOutsideEditorChanges,
  type ObjectGroupsOutsideEditorChanges,
} from './BaseEditor';
import { type ObjectWithContext } from '../../ObjectsList/EnumerateObjects';
import {
  setEditorHotReloadNeeded,
  type HotReloadSteps,
} from '../../EmbeddedGame/EmbeddedGameFrame';

export class CinematicTimeline3DEditorContainer extends React.Component<RenderEditorContainerProps> {
  shouldComponentUpdate(nextProps: RenderEditorContainerProps): any {
    return this.props.isActive || nextProps.isActive;
  }

  getProject(): ?gdProject {
    return this.props.project;
  }

  getLayout(): ?gdLayout {
    return null;
  }

  updateToolbar() {
    this.props.setToolbar(null);
  }

  forceUpdateEditor() {
    // No updates to be done.
  }

  onEventsBasedObjectChildrenEdited() {
    // No thing to be done.
  }

  onSceneObjectEdited(scene: gdLayout, objectWithContext: ObjectWithContext) {
    // No thing to be done.
  }

  onSceneObjectsDeleted(scene: gdLayout) {
    // No thing to be done.
  }

  onSceneEventsModifiedOutsideEditor(changes: SceneEventsOutsideEditorChanges) {
    // No thing to be done.
  }

  notifyChangesToInGameEditor(hotReloadSteps: HotReloadSteps) {
    setEditorHotReloadNeeded(hotReloadSteps);
  }

  switchInGameEditorIfNoHotReloadIsNeeded() {}

  onInstancesModifiedOutsideEditor(changes: InstancesOutsideEditorChanges) {
    // No thing to be done.
  }

  onObjectsModifiedOutsideEditor(changes: ObjectsOutsideEditorChanges) {
    // No thing to be done.
  }

  onObjectGroupsModifiedOutsideEditor(
    changes: ObjectGroupsOutsideEditorChanges
  ) {
    // No thing to be done.
  }

  render(): React.Node {
    const { project } = this.props;
    if (!project) return null;

    return (
      <CinematicTimeline3DEditor
        project={project}
        previewDebuggerServer={this.props.previewDebuggerServer}
        isActive={this.props.isActive}
      />
    );
  }
}

export const renderCinematicTimeline3DEditorContainer = (
  props: RenderEditorContainerPropsWithRef
): React.Node => <CinematicTimeline3DEditorContainer {...props} />;
