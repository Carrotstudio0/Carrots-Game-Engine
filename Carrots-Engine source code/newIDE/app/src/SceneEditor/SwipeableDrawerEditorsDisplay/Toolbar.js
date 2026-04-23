// @flow
import { t, Trans } from '@lingui/macro';
import { type I18n as I18nType } from '@lingui/core';
import * as React from 'react';
import { ToolbarGroup } from '../../UI/Toolbar';
import ToolbarSeparator from '../../UI/ToolbarSeparator';
import IconButton from '../../UI/IconButton';
import TextButton from '../../UI/TextButton';
import ElementWithMenu from '../../UI/Menu/ElementWithMenu';
import ToolbarCommands from '../ToolbarCommands';
import { type MenuItemTemplate } from '../../UI/Menu/Menu.flow';
import UndoIcon from '../../UI/CustomSvgIcons/Undo';
import RedoIcon from '../../UI/CustomSvgIcons/Redo';
import TrashIcon from '../../UI/CustomSvgIcons/Trash';
import GridIcon from '../../UI/CustomSvgIcons/Grid';
import ZoomInIcon from '../../UI/CustomSvgIcons/ZoomIn';
import EditSceneIcon from '../../UI/CustomSvgIcons/EditScene';
import EventsIcon from '../../UI/CustomSvgIcons/Events';
import FileWithLinesIcon from '../../UI/CustomSvgIcons/FileWithLines';
import RectangleIcon from '../../UI/CustomSvgIcons/Rectangle';
import VideoIcon from '../../UI/CustomSvgIcons/Video';
import CompactToggleButtons from '../../UI/CompactToggleButtons';
import Grid2d from '../../UI/CustomSvgIcons/Grid2d';
import Grid3d from '../../UI/CustomSvgIcons/Grid3d';
import ProfilerIcon from '../../UI/CustomSvgIcons/Profiler';
import ThreeDotsMenu from '../../UI/CustomSvgIcons/ThreeDotsMenu';
import PreferencesContext from '../../MainFrame/Preferences/PreferencesContext';
import { useResponsiveWindowSize } from '../../UI/Responsive/ResponsiveWindowMeasurer';

type Props = {|
  gameEditorMode: 'embedded-game' | 'instances-editor',
  setGameEditorMode: ('embedded-game' | 'instances-editor') => void,
  canUse2DEditor: boolean,
  canUse3DEditor: boolean,
  toggleObjectsList: () => void,
  toggleObjectGroupsList: () => void,
  toggleCinematicTimeline: () => void,
  isCinematicTimelineShown: boolean,
  toggleProperties: () => void,
  onOpenSceneEvents: () => void,
  onOpenSceneScript: () => void,
  sceneEventsEnabled: boolean,
  sceneScriptEnabled: boolean,
  toggleInstancesList: () => void,
  toggleLayersList: () => void,
  toggleProjectPanel: () => void,
  toggleConsolePanel: () => void,
  toggleBuildPanel: () => void,
  undo: () => void,
  canUndo: boolean,
  redo: () => void,
  canRedo: boolean,
  deleteSelection: () => void,
  selectedInstancesCount: number,
  isWindowMaskShown: boolean,
  toggleWindowMask: () => void,
  isGridShown: boolean,
  toggleGrid: () => void,
  toggleSelectedPhysicsHitboxes: () => void,
  canToggleSelectedPhysicsHitboxes: boolean,
  areSelectedPhysicsHitboxesShown: boolean,
  openSetupGrid: () => void,
  getContextMenuZoomItems: I18nType => Array<MenuItemTemplate>,
  setZoomFactor: number => void,
  onOpenSettings: () => void,
  settingsIcon: React.Node,
  onOpenSceneVariables: () => void,
|};

const styles = {
  compactTextButton: {
    minWidth: 0,
    marginLeft: 1,
    marginRight: 1,
  },
  compactMoreButton: {
    marginLeft: 2,
    marginRight: 0,
  },
};

const Toolbar: React.ComponentType<Props> = React.memo<Props>(function(props) {
  const { values, setShowBasicProfilingCounters } = React.useContext(
    PreferencesContext
  );
  const { isMobile, isMediumScreen, isLandscape } = useResponsiveWindowSize();
  const isCompactToolbar = (isMobile || isMediumScreen) && isLandscape;
  const zoomMenuTemplate = (i18n: I18nType): Array<MenuItemTemplate> => [
    ...props.getContextMenuZoomItems(i18n),
    { type: 'separator' },
    { label: '5%', click: () => props.setZoomFactor(0.05) },
    { label: '10%', click: () => props.setZoomFactor(0.1) },
    { label: '25%', click: () => props.setZoomFactor(0.25) },
    { label: '50%', click: () => props.setZoomFactor(0.5) },
    { label: '100%', click: () => props.setZoomFactor(1.0) },
    { label: '150%', click: () => props.setZoomFactor(1.5) },
    { label: '200%', click: () => props.setZoomFactor(2.0) },
    { label: '400%', click: () => props.setZoomFactor(4.0) },
  ];
  const gridMenuTemplate = (i18n: I18nType): Array<MenuItemTemplate> => [
    {
      type: 'checkbox',
      label: i18n._(t`Show Mask`),
      checked: props.isWindowMaskShown,
      click: () => props.toggleWindowMask(),
    },
    {
      type: 'checkbox',
      label: i18n._(t`Show grid`),
      checked: props.isGridShown,
      click: () => props.toggleGrid(),
    },
    { type: 'separator' },
    {
      label: i18n._(t`Setup grid`),
      click: () => props.openSetupGrid(),
    },
  ];
  const compactOverflowMenuTemplate = (
    i18n: I18nType
  ): Array<MenuItemTemplate> => [
      {
        type: 'checkbox',
        label: i18n._(t`Cinematic Timeline`),
        enabled: props.gameEditorMode === 'embedded-game',
        checked: props.isCinematicTimelineShown,
        click: () => props.toggleCinematicTimeline(),
      },
      {
        type: 'checkbox',
        label: i18n._(t`Show 3D physics hitboxes`),
        enabled: props.canToggleSelectedPhysicsHitboxes,
        checked: props.areSelectedPhysicsHitboxesShown,
        click: () => props.toggleSelectedPhysicsHitboxes(),
      },
      {
        type: 'checkbox',
        label: i18n._(t`Show performance counters`),
        checked: values.showBasicProfilingCounters,
        click: () =>
          setShowBasicProfilingCounters(!values.showBasicProfilingCounters),
      },
      { type: 'separator' },
      {
        label: i18n._(t`Delete selection`),
        enabled: !!props.selectedInstancesCount,
        click: () => props.deleteSelection(),
      },
      {
        label: i18n._(t`Panels`),
        submenu: [
          { label: i18n._(t`Objects`), click: () => props.toggleObjectsList() },
          {
            label: i18n._(t`Object groups`),
            click: () => props.toggleObjectGroupsList(),
          },
          {
            label: i18n._(t`Inspector`),
            click: () => props.toggleProperties(),
          },
          {
            label: i18n._(t`Scene objects`),
            click: () => props.toggleInstancesList(),
          },
          { label: i18n._(t`Layers`), click: () => props.toggleLayersList() },
          { type: 'separator' },
          { label: i18n._(t`Project`), click: () => props.toggleProjectPanel() },
          { label: i18n._(t`Console`), click: () => props.toggleConsolePanel() },
          { label: i18n._(t`Build`), click: () => props.toggleBuildPanel() },
        ],
      },
      {
        label: i18n._(t`Zoom`),
        submenu: zoomMenuTemplate(i18n),
      },
      {
        label: i18n._(t`Grid and mask`),
        submenu: gridMenuTemplate(i18n),
      },
      { type: 'separator' },
      {
        label: i18n._(t`Scene variables`),
        click: () => props.onOpenSceneVariables(),
      },
      {
        label: i18n._(t`Scene settings`),
        click: () => props.onOpenSettings(),
      },
    ];

  const toolbarCommands = (
    <ToolbarCommands
      toggleObjectsList={props.toggleObjectsList}
      toggleObjectGroupsList={props.toggleObjectGroupsList}
      togglePropertiesPanel={props.toggleProperties}
      toggleInstancesList={props.toggleInstancesList}
      toggleLayersList={props.toggleLayersList}
      toggleProjectPanel={props.toggleProjectPanel}
      toggleConsolePanel={props.toggleConsolePanel}
      toggleBuildPanel={props.toggleBuildPanel}
      undo={props.undo}
      canUndo={props.canUndo}
      redo={props.redo}
      canRedo={props.canRedo}
      deleteSelection={props.deleteSelection}
      toggleWindowMask={props.toggleWindowMask}
      toggleGrid={props.toggleGrid}
      setupGrid={props.openSetupGrid}
      canDeleteSelection={props.selectedInstancesCount !== 0}
      onOpenSceneVariables={props.onOpenSceneVariables}
    />
  );
  const editorModeToggle = (
    <CompactToggleButtons
      id="game-editor-toggle"
      noSeparator
      buttons={[
        ...(props.canUse2DEditor
          ? [
              {
                id: '2d-instances-editor',
                renderIcon: className => <Grid2d className={className} />,
                tooltip: <Trans>Top-down, classic editor</Trans>,
                label: '2D',
                onClick: () => {
                  props.setGameEditorMode('instances-editor');
                },
                isActive: props.gameEditorMode === 'instances-editor',
              },
            ]
          : []),
        ...(props.canUse3DEditor
          ? [
              {
                id: '3d-game-editor',
                renderIcon: className => <Grid3d className={className} />,
                tooltip: <Trans>3D, real-time editor (new)</Trans>,
                label: '3D',
                onClick: () => {
                  props.setGameEditorMode('embedded-game');
                },
                isActive: props.gameEditorMode === 'embedded-game',
              },
            ]
          : []),
      ]}
    />
  );

  if (isCompactToolbar) {
    return (
      <>
        {toolbarCommands}
        {editorModeToggle}
        <TextButton
          id="scene-toolbar-open-events-button-mobile"
          label={<Trans>Events</Trans>}
          icon={<EventsIcon />}
          onClick={props.onOpenSceneEvents}
          disabled={!props.sceneEventsEnabled}
          style={styles.compactTextButton}
        />
        <TextButton
          id="scene-toolbar-open-script-button-mobile"
          label={<Trans>Script</Trans>}
          icon={<FileWithLinesIcon />}
          onClick={props.onOpenSceneScript}
          disabled={!props.sceneScriptEnabled}
          style={styles.compactTextButton}
        />
        <IconButton
          size="small"
          color="default"
          onClick={props.undo}
          disabled={!props.canUndo}
          tooltip={t`Undo the last changes`}
        >
          <UndoIcon />
        </IconButton>
        <IconButton
          size="small"
          color="default"
          onClick={props.redo}
          disabled={!props.canRedo}
          tooltip={t`Redo the last changes`}
        >
          <RedoIcon />
        </IconButton>
        <ElementWithMenu
          element={
            <IconButton
              size="small"
              color="default"
              tooltip={t`More tools`}
              style={styles.compactMoreButton}
            >
              <ThreeDotsMenu />
            </IconButton>
          }
          buildMenuTemplate={compactOverflowMenuTemplate}
        />
      </>
    );
  }

  return (
    <>
      {toolbarCommands}
      {editorModeToggle}
      <TextButton
        id="scene-toolbar-open-events-button-mobile"
        label={<Trans>Events</Trans>}
        icon={<EventsIcon />}
        onClick={props.onOpenSceneEvents}
        disabled={!props.sceneEventsEnabled}
      />
      <TextButton
        id="scene-toolbar-open-script-button-mobile"
        label={<Trans>Script</Trans>}
        icon={<FileWithLinesIcon />}
        onClick={props.onOpenSceneScript}
        disabled={!props.sceneScriptEnabled}
      />
      <IconButton
        size="small"
        color="default"
        onClick={props.toggleCinematicTimeline}
        selected={props.isCinematicTimelineShown}
        disabled={props.gameEditorMode !== 'embedded-game'}
        tooltip={
          props.gameEditorMode !== 'embedded-game'
            ? t`Switch to 3D editor to use Cinematic Timeline`
            : props.isCinematicTimelineShown
            ? t`Close Cinematic Timeline`
            : t`Open Cinematic Timeline`
        }
      >
        <VideoIcon />
      </IconButton>
      <IconButton
        size="small"
        color="default"
        onClick={props.toggleSelectedPhysicsHitboxes}
        disabled={!props.canToggleSelectedPhysicsHitboxes}
        selected={props.areSelectedPhysicsHitboxesShown}
        tooltip={
          props.areSelectedPhysicsHitboxesShown
            ? t`Hide 3D physics hitboxes`
            : t`Show 3D physics hitboxes`
        }
      >
        <RectangleIcon />
      </IconButton>
      <IconButton
        size="small"
        color="default"
        id="scene-toolbar-toggle-performance-counters-mobile"
        onClick={() =>
          setShowBasicProfilingCounters(!values.showBasicProfilingCounters)
        }
        selected={values.showBasicProfilingCounters}
        tooltip={
          values.showBasicProfilingCounters
            ? t`Hide performance and FPS counters`
            : t`Show performance and FPS counters`
        }
      >
        <ProfilerIcon />
      </IconButton>
      <IconButton
        size="small"
        color="default"
        onClick={props.undo}
        disabled={!props.canUndo}
        tooltip={t`Undo the last changes`}
      >
        <UndoIcon />
      </IconButton>
      <IconButton
        size="small"
        color="default"
        onClick={props.redo}
        disabled={!props.canRedo}
        tooltip={t`Redo the last changes`}
      >
        <RedoIcon />
      </IconButton>
      <ElementWithMenu
        element={
          <IconButton
            size="small"
            color="default"
            tooltip={t`Change editor zoom`}
          >
            <ZoomInIcon />
          </IconButton>
        }
        buildMenuTemplate={(i18n: I18nType) => [
          ...zoomMenuTemplate(i18n),
        ]}
      />
      <IconButton
        size="small"
        color="default"
        onClick={props.deleteSelection}
        disabled={!props.selectedInstancesCount}
        tooltip={t`Delete the selected instances from the scene`}
      >
        <TrashIcon />
      </IconButton>
      <ToolbarSeparator />
      <ToolbarGroup lastChild>
        <ElementWithMenu
          element={
            <IconButton
              size="small"
              color="default"
              tooltip={t`Toggle/edit grid`}
            >
              <GridIcon />
            </IconButton>
          }
          buildMenuTemplate={gridMenuTemplate}
        />
        <ToolbarSeparator />
        <IconButton
          size="small"
          color="default"
          onClick={props.onOpenSettings}
          tooltip={t`Open settings`}
        >
          {props.settingsIcon || <EditSceneIcon />}
        </IconButton>
      </ToolbarGroup>
    </>
  );
});

export default Toolbar;
