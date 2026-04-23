// @flow

import * as React from 'react';
import { Trans } from '@lingui/macro';
import { Toolbar, ToolbarGroup } from '../../UI/Toolbar';
import ObjectIcon from '../../UI/CustomSvgIcons/Object';
import ObjectGroupIcon from '../../UI/CustomSvgIcons/ObjectGroup';
import EditIcon from '../../UI/CustomSvgIcons/Edit';
import InstancesListIcon from '../../UI/CustomSvgIcons/InstancesList';
import LayersIcon from '../../UI/CustomSvgIcons/Layers';
import ProjectResourcesIcon from '../../UI/CustomSvgIcons/ProjectResources';
import ConsoleIcon from '../../UI/CustomSvgIcons/Console';
import BuildIcon from '../../UI/CustomSvgIcons/Hammer';
import IconButton from '../../UI/IconButton';
import {
  OPEN_INSTANCES_PANEL_BUTTON_ID,
  OPEN_LAYERS_PANEL_BUTTON_ID,
  OPEN_OBJECT_GROUPS_PANEL_BUTTON_ID,
  OPEN_OBJECTS_PANEL_BUTTON_ID,
  OPEN_PROPERTIES_PANEL_BUTTON_ID,
  OPEN_PROJECT_PANEL_BUTTON_ID,
  OPEN_CONSOLE_PANEL_BUTTON_ID,
  OPEN_BUILD_PANEL_BUTTON_ID,
  type EditorId,
} from '../utils';
import Paper from '../../UI/Paper';

const iconSize = 19;
/**
 * Padding bottom is added to toolbar to leave space for the Android/iOS
 * bottom navigation bar.
 */
const toolbarPaddingBottom = 8;
const iconButtonPadding = 4;
const iconButtonLabelPadding = 1;
const toolbarHeight =
  iconSize + 12 + 2 * iconButtonLabelPadding + 2 * iconButtonPadding;

const styles = {
  iconButton: {
    padding: iconButtonPadding,
    fontSize: 'inherit',
    width: 56,
    height: 42,
    borderRadius: 11,
  },
  buttonLabel: {
    padding: iconButtonLabelPadding,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    lineHeight: 1.05,
  },
  buttonText: {
    fontSize: 9.5,
    fontWeight: 600,
    opacity: 0.9,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  container: { fontSize: iconSize },
};

type Props = {|
  selectedEditorIds: Array<EditorId>,
  onSelectEditor: EditorId => void,
|};

const editors = {
  'objects-list': {
    buttonId: OPEN_OBJECTS_PANEL_BUTTON_ID,
    icon: <ObjectIcon fontSize="inherit" />,
    label: <Trans>Objects</Trans>,
  },
  properties: {
    buttonId: OPEN_PROPERTIES_PANEL_BUTTON_ID,
    icon: <EditIcon fontSize="inherit" />,
    label: <Trans>Inspector</Trans>,
  },
  'project-resources': {
    buttonId: OPEN_PROJECT_PANEL_BUTTON_ID,
    icon: <ProjectResourcesIcon fontSize="inherit" />,
    label: <Trans>Project</Trans>,
  },
  console: {
    buttonId: OPEN_CONSOLE_PANEL_BUTTON_ID,
    icon: <ConsoleIcon fontSize="inherit" />,
    label: <Trans>Console</Trans>,
  },
  build: {
    buttonId: OPEN_BUILD_PANEL_BUTTON_ID,
    icon: <BuildIcon fontSize="inherit" />,
    label: <Trans>Build</Trans>,
  },
  'instances-list': {
    buttonId: OPEN_INSTANCES_PANEL_BUTTON_ID,
    icon: <InstancesListIcon fontSize="inherit" />,
    label: <Trans>Scene</Trans>,
  },
  'layers-list': {
    buttonId: OPEN_LAYERS_PANEL_BUTTON_ID,
    icon: <LayersIcon fontSize="inherit" />,
    label: <Trans>Layers</Trans>,
  },
  'object-groups-list': {
    buttonId: OPEN_OBJECT_GROUPS_PANEL_BUTTON_ID,
    icon: <ObjectGroupIcon fontSize="inherit" />,
    label: <Trans>Groups</Trans>,
  },
};

const BottomToolbar: React.ComponentType<Props> = React.memo<Props>(
  (props: Props) => {
    return (
      <Paper background="medium" square style={styles.container}>
        <Toolbar height={toolbarHeight} paddingBottom={toolbarPaddingBottom}>
          <ToolbarGroup spaceOut>
            {Object.keys(editors).map(editorId => {
              const { icon, buttonId, label } = editors[editorId];
              const isSelected = props.selectedEditorIds.includes(editorId);
              return (
                // $FlowFixMe[incompatible-type]
                <IconButton
                  color="default"
                  key={editorId}
                  disableRipple
                  disableFocusRipple
                  style={styles.iconButton}
                  id={buttonId}
                  onClick={() => {
                    props.onSelectEditor(editorId);
                  }}
                  selected={isSelected}
                >
                  <span style={styles.buttonLabel}>
                    {icon}
                    <span style={styles.buttonText}>{label}</span>
                  </span>
                </IconButton>
              );
            })}
          </ToolbarGroup>
        </Toolbar>
      </Paper>
    );
  }
);

export default BottomToolbar;
