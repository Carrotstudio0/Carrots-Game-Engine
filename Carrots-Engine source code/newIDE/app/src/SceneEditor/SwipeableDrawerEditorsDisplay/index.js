// @flow

import * as React from 'react';
import { Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';

import InstancesEditor from '../../InstancesEditor';
import LayersList, { type LayersListInterface } from '../../LayersList';
import ObjectsList, { type ObjectsListInterface } from '../../ObjectsList';
import ObjectGroupsList, {
  type ObjectGroupsListInterface,
} from '../../ObjectGroupsList';
import InstancesList, {
  type InstancesListInterface,
} from '../../InstancesEditor/InstancesList';
import ObjectsRenderingService from '../../ObjectsRendering/ObjectsRenderingService';
import ProjectResourcesPanel from '../ProjectResourcesPanel';
import EditorConsolePanel from '../EditorConsolePanel';
import BuildPanel from '../BuildPanel';

import Rectangle from '../../Utils/Rectangle';
import BottomToolbar from './BottomToolbar';
import { FullSizeMeasurer } from '../../UI/FullSizeMeasurer';
import PreferencesContext from '../../MainFrame/Preferences/PreferencesContext';
import { useScreenType } from '../../UI/Responsive/ScreenTypeMeasurer';
import Paper from '../../UI/Paper';
import { type EditorId } from '../utils';
import {
  type SceneEditorsDisplayInterface,
  type SceneEditorsDisplayProps,
} from '../EditorsDisplay.flow';
import ErrorBoundary from '../../UI/ErrorBoundary';
import {
  InstanceOrObjectPropertiesEditorContainer,
  type InstanceOrObjectPropertiesEditorInterface,
} from '../InstanceOrObjectPropertiesEditorContainer';
import { useDoNowOrAfterRender } from '../../Utils/UseDoNowOrAfterRender';
import { EmbeddedGameFrameHole } from '../../EmbeddedGame/EmbeddedGameFrameHole';

export const swipeableDrawerContainerId = 'swipeable-drawer-container';

const noop = () => {};

const styles = {
  container: { width: '100%' },
  sidePanel: {
    position: 'absolute',
    top: 8,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'rgba(15, 21, 18, 0.97)',
    border: '1px solid rgba(255, 177, 92, 0.2)',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.32)',
    pointerEvents: 'all',
    fontSize: 12,
    lineHeight: 1.2,
    zIndex: 6,
  },
  sidePanelLeft: {
    left: 8,
  },
  sidePanelRight: {
    right: 8,
  },
  sidePanelContent: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    // Restore pointer events that are removed when using the EmbeddedGameFrame.
    pointerEvents: 'all',
  },
  instancesListContainer: { display: 'flex', flex: 1 },
};

// Forward ref to allow Scene editor to force update some editors
const SwipeableDrawerEditorsDisplay: React.ComponentType<{
  ...SceneEditorsDisplayProps,
  +ref?: React.RefSetter<SceneEditorsDisplayInterface>,
}> = React.forwardRef<SceneEditorsDisplayProps, SceneEditorsDisplayInterface>(
  (props, ref) => {
    const {
      gameEditorMode,
      project,
      resourceManagementProps,
      layout,
      eventsFunctionsExtension,
      eventsBasedObject,
      eventsBasedObjectVariant,
      updateBehaviorsSharedData,
      layersContainer,
      globalObjectsContainer,
      objectsContainer,
      projectScopedContainersAccessor,
      initialInstances,
      chosenLayer,
      selectedLayer,
      onSelectInstances,
      onInstancesModified,

      onWillInstallExtension,
      onExtensionInstalled,
      isActive,
      onRestartInGameEditor,
      showRestartInGameEditorAfterErrorButton,
    } = props;
    const selectedInstances = props.instancesSelection.getSelectedInstances();
    const { values } = React.useContext(PreferencesContext);
    const screenType = useScreenType();

    const instanceOrObjectPropertiesEditorRef = React.useRef<?InstanceOrObjectPropertiesEditorInterface>(
      null
    );
    const layersListRef = React.useRef<?LayersListInterface>(null);
    const instancesListRef = React.useRef<?InstancesListInterface>(null);
    const editorRef = React.useRef<?InstancesEditor>(null);
    const objectsListRef = React.useRef<?ObjectsListInterface>(null);
    const objectGroupsListRef = React.useRef<?ObjectGroupsListInterface>(null);
    const objectsListDoNowOrAfterRender = useDoNowOrAfterRender<?ObjectsListInterface>(
      objectsListRef
    );
    const bottomContainerRef = React.useRef<?HTMLDivElement>(null);
    const [bottomContainerHeight, setBottomContainerHeight] = React.useState(0);

    const [openedEditors, setOpenedEditors] = React.useState<Array<EditorId>>(
      []
    );

    const toggleEditorSidePanel = React.useCallback((editorId: ?EditorId) => {
      if (!editorId) return;

      setOpenedEditors(previousOpenedEditors => {
        if (previousOpenedEditors.includes(editorId)) {
          return previousOpenedEditors.filter(
            openedEditorId => openedEditorId !== editorId
          );
        }

        if (previousOpenedEditors.length === 0) return [editorId];
        if (previousOpenedEditors.length === 1)
          return [previousOpenedEditors[0], editorId];

        // Keep only the two most recent editors visible.
        return [previousOpenedEditors[1], editorId];
      });
    }, []);

    const forceUpdatePropertiesEditor = React.useCallback(() => {
      if (instanceOrObjectPropertiesEditorRef.current)
        instanceOrObjectPropertiesEditorRef.current.forceUpdate();
    }, []);
    const forceUpdateInstancesList = React.useCallback(() => {
      if (instancesListRef.current) instancesListRef.current.forceUpdate();
    }, []);
    const forceUpdateObjectsList = React.useCallback(() => {
      if (objectsListRef.current) objectsListRef.current.forceUpdateList();
    }, []);
    const forceUpdateObjectGroupsList = React.useCallback(() => {
      if (objectGroupsListRef.current)
        objectGroupsListRef.current.forceUpdate();
    }, []);
    const scrollObjectGroupsListToObjectGroup = React.useCallback(
      (objectGroup: gdObjectGroup) => {
        if (objectGroupsListRef.current)
          objectGroupsListRef.current.scrollToObjectGroup(objectGroup);
      },
      []
    );
    const forceUpdateLayersList = React.useCallback(() => {
      if (layersListRef.current) layersListRef.current.forceUpdateList();
    }, []);
    const getInstanceSize = React.useCallback((instance: gdInitialInstance) => {
      return editorRef.current
        ? editorRef.current.getInstanceSize(instance)
        : [
            instance.getDefaultWidth(),
            instance.getDefaultHeight(),
            instance.getDefaultDepth(),
          ];
    }, []);
    const isEditorVisible = React.useCallback(
      (editorId: EditorId) => {
        return openedEditors.includes(editorId);
      },
      [openedEditors]
    );
    const ensureEditorVisible = React.useCallback(
      (editorId: EditorId) => {
        if (!isEditorVisible(editorId)) {
          toggleEditorSidePanel(editorId);
        }
      },
      [toggleEditorSidePanel, isEditorVisible]
    );
    const openNewObjectDialog = React.useCallback(
      () => {
        if (!isEditorVisible('objects-list')) {
          // Objects list is not opened. Open it now.
          toggleEditorSidePanel('objects-list');
        }

        // Open the new object dialog when the objects list is opened.
        objectsListDoNowOrAfterRender((objectsList: ?ObjectsListInterface) => {
          if (objectsList) objectsList.openNewObjectDialog();
        });
      },
      [
        toggleEditorSidePanel,
        isEditorVisible,
        objectsListDoNowOrAfterRender,
      ]
    );

    const startSceneRendering = React.useCallback((start: boolean) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (start) editor.restartSceneRendering();
      else editor.pauseSceneRendering();
    }, []);

    React.useLayoutEffect(
      () => {
        if (bottomContainerRef.current) {
          setBottomContainerHeight(
            bottomContainerRef.current.clientHeight || 0
          );
        }
      },
      [openedEditors]
    );

    // $FlowFixMe[incompatible-type]
    React.useImperativeHandle(ref, () => {
      const { current: editor } = editorRef;

      return {
        getName: () => 'swipeableDrawer',
        forceUpdateInstancesList,
        forceUpdatePropertiesEditor,
        forceUpdateObjectsList,
        forceUpdateObjectGroupsList,
        scrollObjectGroupsListToObjectGroup,
        forceUpdateLayersList,
        openNewObjectDialog,
        toggleEditorView: toggleEditorSidePanel,
        isEditorVisible,
        ensureEditorVisible,
        startSceneRendering,
        viewControls: {
          zoomBy: editor ? editor.zoomBy : noop,
          setZoomFactor: editor ? editor.setZoomFactor : noop,
          zoomToInitialPosition: editor ? editor.zoomToInitialPosition : noop,
          zoomToFitContent: editor ? editor.zoomToFitContent : noop,
          zoomToFitSelection: editor ? editor.zoomToFitSelection : noop,
          centerViewOnLastInstance: editor
            ? editor.centerViewOnLastInstance
            : noop,
          getLastCursorSceneCoordinates: editor
            ? editor.getLastCursorSceneCoordinates
            : () => [0, 0],
          getLastContextMenuSceneCoordinates: editor
            ? editor.getLastContextMenuSceneCoordinates
            : () => [0, 0],
          getViewPosition: editor ? editor.getViewPosition : noop,
        },
        instancesHandlers: {
          getContentAABB: editor ? editor.getContentAABB : () => null,
          getSelectionAABB: editor
            ? editor.selectedInstances.getSelectionAABB
            : () => new Rectangle(),
          addInstances: editor ? editor.addInstances : () => [],
          clearHighlightedInstance: editor
            ? editor.clearHighlightedInstance
            : noop,
          resetInstanceRenderersFor: editor
            ? editor.resetInstanceRenderersFor
            : noop,
          forceRemountInstancesRenderers: editor ? editor.forceRemount : noop,
          addSerializedInstances: editor
            ? editor.addSerializedInstances
            : () => [],
          snapSelection: editor ? editor.snapSelection : noop,
        },
      };
    });

    const selectInstances = React.useCallback(
      (instances: Array<gdInitialInstance>, multiSelect: boolean) => {
        onSelectInstances(instances, multiSelect, 'upperCenter');
        forceUpdateInstancesList();
        forceUpdatePropertiesEditor();
      },
      [forceUpdateInstancesList, forceUpdatePropertiesEditor, onSelectInstances]
    );

    const selectedObjects = props.selectedObjectFolderOrObjectsWithContext
      .map(objectFolderOrObjectWithContext => {
        const { objectFolderOrObject } = objectFolderOrObjectWithContext;
        if (!objectFolderOrObject) return null; // Protect ourselves from an unexpected null value.
        if (objectFolderOrObject.isFolder()) return null;
        return objectFolderOrObject.getObject();
      })
      .filter(Boolean);

    const selectedObjectNames = selectedObjects.map(object => object.getName());
    const leftEditorId =
      openedEditors.length > 1 ? openedEditors[openedEditors.length - 2] : null;
    const rightEditorId =
      openedEditors.length > 0 ? openedEditors[openedEditors.length - 1] : null;

    const isCustomVariant = eventsBasedObject
      ? eventsBasedObject.getDefaultVariant() !== eventsBasedObjectVariant
      : false;

    const renderEditorPanelContent = (editorId: EditorId): React.Node => {
      if (editorId === 'objects-list') {
        return (
          <I18n>
            {({ i18n }) => (
              <ObjectsList
                getThumbnail={ObjectsRenderingService.getThumbnail.bind(
                  ObjectsRenderingService
                )}
                project={project}
                projectScopedContainersAccessor={projectScopedContainersAccessor}
                globalObjectsContainer={globalObjectsContainer}
                objectsContainer={objectsContainer}
                layout={layout}
                eventsFunctionsExtension={eventsFunctionsExtension}
                eventsBasedObject={eventsBasedObject}
                initialInstances={initialInstances}
                onSelectAllInstancesOfObjectInLayout={
                  props.onSelectAllInstancesOfObjectInLayout
                }
                resourceManagementProps={props.resourceManagementProps}
                selectedObjectFolderOrObjectsWithContext={
                  props.selectedObjectFolderOrObjectsWithContext
                }
                onEditObject={props.onEditObject}
                onOpenEventBasedObjectEditor={props.onOpenEventBasedObjectEditor}
                onOpenEventBasedObjectVariantEditor={
                  props.onOpenEventBasedObjectVariantEditor
                }
                onOpenTypeScriptScripts={props.onOpenTypeScriptScripts}
                onExportAssets={props.onExportAssets}
                onImportAssets={props.onImportAssets}
                onDeleteObjects={(objectWithContext, cb) =>
                  props.onDeleteObjects(i18n, objectWithContext, cb)
                }
                getValidatedObjectOrGroupName={(newName, global) =>
                  props.getValidatedObjectOrGroupName(newName, global, i18n)
                }
                onObjectCreated={props.onObjectCreated}
                onObjectEdited={props.onObjectEdited}
                onObjectFolderOrObjectWithContextSelected={
                  props.onObjectFolderOrObjectWithContextSelected
                }
                onRenameObjectFolderOrObjectWithContextFinish={
                  props.onRenameObjectFolderOrObjectWithContextFinish
                }
                onAddObjectInstance={objectName =>
                  props.onAddObjectInstance(objectName, 'upperCenter')
                }
                onObjectPasted={props.updateBehaviorsSharedData}
                beforeSetAsGlobalObject={objectName =>
                  props.canObjectOrGroupBeGlobal(i18n, objectName)
                }
                onSetAsGlobalObject={props.onSetAsGlobalObject}
                ref={objectsListRef}
                unsavedChanges={props.unsavedChanges}
                hotReloadPreviewButtonProps={props.hotReloadPreviewButtonProps}
                isListLocked={isCustomVariant}
                onWillInstallExtension={onWillInstallExtension}
                onExtensionInstalled={onExtensionInstalled}
              />
            )}
          </I18n>
        );
      }

      if (editorId === 'properties') {
        return (
          <I18n>
            {({ i18n }) => (
              <InstanceOrObjectPropertiesEditorContainer
                i18n={i18n}
                project={project}
                resourceManagementProps={resourceManagementProps}
                layout={layout}
                eventsFunctionsExtension={eventsFunctionsExtension}
                onUpdateBehaviorsSharedData={updateBehaviorsSharedData}
                objectsContainer={objectsContainer}
                globalObjectsContainer={globalObjectsContainer}
                layersContainer={layersContainer}
                projectScopedContainersAccessor={projectScopedContainersAccessor}
                initialInstances={initialInstances}
                objects={selectedObjects}
                instances={selectedInstances}
                layer={selectedLayer}
                editInstanceVariables={props.editInstanceVariables}
                editObjectInPropertiesPanel={props.editObjectInPropertiesPanel}
                onEditObject={props.onEditObject}
                onObjectsModified={props.onObjectsModified}
                onEffectAdded={props.onEffectAdded}
                onInstancesModified={forceUpdateInstancesList}
                onGetInstanceSize={getInstanceSize}
                ref={instanceOrObjectPropertiesEditorRef}
                historyHandler={props.historyHandler}
                tileMapTileSelection={props.tileMapTileSelection}
                onSelectTileMapTile={props.onSelectTileMapTile}
                lastSelectionType={props.lastSelectionType}
                onWillInstallExtension={props.onWillInstallExtension}
                onExtensionInstalled={props.onExtensionInstalled}
                onOpenEventBasedObjectVariantEditor={
                  props.onOpenEventBasedObjectVariantEditor
                }
                onDeleteEventsBasedObjectVariant={
                  props.onDeleteEventsBasedObjectVariant
                }
                isVariableListLocked={isCustomVariant}
                isBehaviorListLocked={isCustomVariant}
                onEditLayerEffects={props.editLayerEffects}
                onEditLayer={props.editLayer}
                onLayersModified={props.onLayersModified}
                eventsBasedObject={props.eventsBasedObject}
                eventsBasedObjectVariant={props.eventsBasedObjectVariant}
                getContentAABB={
                  editorRef.current
                    ? editorRef.current.getContentAABB
                    : () => null
                }
                onEventsBasedObjectChildrenEdited={
                  props.onEventsBasedObjectChildrenEdited
                }
              />
            )}
          </I18n>
        );
      }

      if (editorId === 'object-groups-list') {
        return (
          <I18n>
            {({ i18n }) => (
              <ObjectGroupsList
                ref={objectGroupsListRef}
                globalObjectGroups={
                  globalObjectsContainer &&
                  globalObjectsContainer.getObjectGroups()
                }
                projectScopedContainersAccessor={projectScopedContainersAccessor}
                objectGroups={objectsContainer.getObjectGroups()}
                onCreateGroup={props.onCreateObjectGroup}
                onEditGroup={props.onEditObjectGroup}
                onDeleteGroup={props.onDeleteObjectGroup}
                onRenameGroup={props.onRenameObjectGroup}
                getValidatedObjectOrGroupName={(newName, global) =>
                  props.getValidatedObjectOrGroupName(newName, global, i18n)
                }
                beforeSetAsGlobalGroup={groupName =>
                  props.canObjectOrGroupBeGlobal(i18n, groupName)
                }
                unsavedChanges={props.unsavedChanges}
                isListLocked={isCustomVariant}
              />
            )}
          </I18n>
        );
      }

      if (editorId === 'instances-list') {
        return (
          <Paper background="medium" square style={styles.instancesListContainer}>
            <InstancesList
              instances={initialInstances}
              selectedInstances={selectedInstances}
              onSelectInstances={selectInstances}
              onInstancesModified={onInstancesModified || noop}
              ref={instancesListRef}
            />
          </Paper>
        );
      }

      if (editorId === 'layers-list') {
        return (
          <LayersList
            project={project}
            layout={layout}
            eventsFunctionsExtension={eventsFunctionsExtension}
            eventsBasedObject={eventsBasedObject}
            chosenLayer={chosenLayer}
            onChooseLayer={props.onChooseLayer}
            selectedLayer={selectedLayer}
            onSelectLayer={props.onSelectLayer}
            onEditLayerEffects={props.editLayerEffects}
            onLayersModified={props.onLayersModified}
            onLayersVisibilityInEditorChanged={
              props.onLayersVisibilityInEditorChanged
            }
            onEditLayer={props.editLayer}
            onRemoveLayer={props.onRemoveLayer}
            onLayerRenamed={props.onLayerRenamed}
            onCreateLayer={forceUpdatePropertiesEditor}
            layersContainer={layersContainer}
            ref={layersListRef}
            hotReloadPreviewButtonProps={props.hotReloadPreviewButtonProps}
            onBackgroundColorChanged={props.onBackgroundColorChanged}
            gameEditorMode={props.gameEditorMode}
          />
        );
      }

      if (editorId === 'project-resources') {
        return (
          <ProjectResourcesPanel
            project={project}
            resourceManagementProps={resourceManagementProps}
            fileMetadata={null}
            unsavedChanges={props.unsavedChanges}
          />
        );
      }

      if (editorId === 'console') return <EditorConsolePanel />;
      if (editorId === 'build') return <BuildPanel />;
      return null;
    };

    return (
      <FullSizeMeasurer>
        {({ width, height }) => (
          <div style={styles.container}>
            <ErrorBoundary
              componentTitle={<Trans>Instances editor.</Trans>}
              scope="scene-editor-canvas"
            >
              {gameEditorMode === 'embedded-game' ? (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <EmbeddedGameFrameHole
                    marginBottom={bottomContainerHeight}
                    isActive={isActive}
                    onRestartInGameEditor={onRestartInGameEditor}
                    showRestartInGameEditorAfterErrorButton={
                      showRestartInGameEditorAfterErrorButton
                    }
                  />
                  {props.embeddedEditorOverlay || null}
                </div>
              ) : (
                <InstancesEditor
                  ref={editorRef}
                  height={height}
                  width={width}
                  project={project}
                  layout={layout}
                  eventsBasedObject={eventsBasedObject}
                  eventsBasedObjectVariant={eventsBasedObjectVariant}
                  globalObjectsContainer={globalObjectsContainer}
                  objectsContainer={objectsContainer}
                  layersContainer={layersContainer}
                  chosenLayer={chosenLayer}
                  screenType={screenType}
                  initialInstances={initialInstances}
                  instancesEditorSettings={props.instancesEditorSettings}
                  onInstancesEditorSettingsMutated={
                    props.onInstancesEditorSettingsMutated
                  }
                  instancesSelection={props.instancesSelection}
                  onInstancesAdded={props.onInstancesAdded}
                  onInstancesSelected={props.onInstancesSelected}
                  onInstanceDoubleClicked={props.onInstanceDoubleClicked}
                  onInstancesMoved={props.onInstancesMoved}
                  onInstancesResized={props.onInstancesResized}
                  onInstancesRotated={props.onInstancesRotated}
                  canAdd2DObjectsToScene={props.canAdd2DObjectsToScene}
                  canAdd3DObjectsToScene={props.canAdd3DObjectsToScene}
                  selectedObjectNames={selectedObjectNames}
                  onContextMenu={props.onContextMenu}
                  isInstanceOf3DObject={props.isInstanceOf3DObject}
                  instancesEditorShortcutsCallbacks={
                    props.instancesEditorShortcutsCallbacks
                  }
                  pauseRendering={!props.isActive}
                  showObjectInstancesIn3D={
                    values.use3DEditor && props.canAdd3DObjectsToScene
                  }
                  showBasicProfilingCounters={values.showBasicProfilingCounters}
                  tileMapTileSelection={props.tileMapTileSelection}
                  onSelectTileMapTile={props.onSelectTileMapTile}
                  editorViewPosition2D={props.editorViewPosition2D}
                />
              )}
            </ErrorBoundary>
            {leftEditorId && (
              <div
                className="carrots-mobile-side-panel"
                style={{
                  ...styles.sidePanel,
                  ...styles.sidePanelLeft,
                  width: Math.max(190, Math.min(280, Math.round(width * 0.32))),
                  bottom: bottomContainerHeight + 8,
                }}
              >
                <div style={styles.sidePanelContent}>
                  {renderEditorPanelContent(leftEditorId)}
                </div>
              </div>
            )}
            {rightEditorId && (
              <div
                className="carrots-mobile-side-panel"
                style={{
                  ...styles.sidePanel,
                  ...styles.sidePanelRight,
                  width: Math.max(190, Math.min(280, Math.round(width * 0.32))),
                  bottom: bottomContainerHeight + 8,
                }}
              >
                <div style={styles.sidePanelContent}>
                  {renderEditorPanelContent(rightEditorId)}
                </div>
              </div>
            )}
            <div
              style={styles.bottomContainer}
              id={swipeableDrawerContainerId}
              ref={bottomContainerRef}
            >
              <BottomToolbar
                selectedEditorIds={openedEditors}
                onSelectEditor={toggleEditorSidePanel}
              />
            </div>
          </div>
        )}
      </FullSizeMeasurer>
    );
  }
);

export default SwipeableDrawerEditorsDisplay;
