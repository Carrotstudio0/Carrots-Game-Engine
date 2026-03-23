// @flow
import * as React from 'react';
import { t } from '@lingui/macro';

import {
  TitleBarLeftSafeMargins,
  TitleBarRightSafeMargins,
} from '../UI/TitleBarSafeMargins';
import { type EditorTab } from './EditorTabs/EditorTabsHandler';
import { getTabId } from './EditorTabs/DraggableEditorTabs';
import { useScreenType } from '../UI/Responsive/ScreenTypeMeasurer';
import TabsTitlebarTooltip from './TabsTitlebarTooltip';
import Window from '../Utils/Window';
import { isMacLike } from '../Utils/Platform';
import GDevelopThemeContext from '../UI/Theme/GDevelopThemeContext';
import ElementWithMenu from '../UI/Menu/ElementWithMenu';
import TextButton from '../UI/TextButton';
import CompactSearchBar from '../UI/CompactSearchBar';
import { type MenuItemTemplate } from '../UI/Menu/Menu.flow';
import {
  adaptFromDeclarativeTemplate,
  buildMainMenuDeclarativeTemplate,
  type MainMenuCallbacks,
  type BuildMainMenuProps,
} from './MainMenu';

const WINDOW_DRAGGABLE_PART_CLASS_NAME = 'title-bar-draggable-part';
const WINDOW_NON_DRAGGABLE_PART_CLASS_NAME = 'title-bar-non-draggable-part';

const styles = {
  container: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    position: 'relative', // to ensure it is displayed above any global iframe
    minHeight: 34,
    paddingRight: 4,
  },
  topRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    pointerEvents: 'none',
  },
  headerMenusContainer: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 4,
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  headerPrimaryMenus: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
  },
  headerQuickMenus: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
  },
  headerSearchContainer: {
    width: 220,
    minWidth: 150,
    maxWidth: 260,
    marginLeft: 4,
    marginRight: 4,
    flexShrink: 1,
  },
  headerProjectName: {
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 2,
    marginRight: 6,
    maxWidth: 150,
    padding: '2px 8px',
    borderRadius: 7,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerMenuButton: {
    minWidth: 40,
    marginLeft: 1,
    marginRight: 1,
  },
};

export type TabsTitlebarQuickAccessMenu = {|
  label: string,
  submenu: Array<MenuItemTemplate>,
|};

type TabsTitlebarProps = {|
  hidden: boolean,
  mainMenuCallbacks: MainMenuCallbacks,
  buildMainMenuProps: BuildMainMenuProps,
  quickAccessMenus: Array<TabsTitlebarQuickAccessMenu>,
  onSearchInProject: (query: string) => void,
  renderTabs: (
    onEditorTabHovered: (?EditorTab, {| isLabelTruncated: boolean |}) => void,
    onEditorTabClosing: () => void
  ) => React.Node,
  isLeftMostPane: boolean,
  isRightMostPane: boolean,
  displayMenuIcon: boolean,

  displayAskAi: boolean,
  onAskAiClicked: () => void,
|};

/**
 * The titlebar containing a menu, the tabs and giving space for window controls.
 */
export default function TabsTitlebar({
  hidden,
  mainMenuCallbacks,
  buildMainMenuProps,
  quickAccessMenus,
  onSearchInProject,
  renderTabs,
  isLeftMostPane,
  isRightMostPane,
  displayMenuIcon,
  displayAskAi,
  onAskAiClicked,
}: TabsTitlebarProps): React.MixedElement {
  void displayAskAi;
  void onAskAiClicked;

  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const isTouchscreen = useScreenType() === 'touch';
  const [projectSearch, setProjectSearch] = React.useState('');
  const topHeaderMenus = React.useMemo(
    () => {
      const allMenus = adaptFromDeclarativeTemplate(
        buildMainMenuDeclarativeTemplate(buildMainMenuProps),
        mainMenuCallbacks
      );

      if (!allMenus.length) return [];
      const fileMenuIndex = isMacLike() && allMenus.length > 1 ? 1 : 0;
      const fileMenu = allMenus[fileMenuIndex];
      const helpMenu = allMenus[allMenus.length - 1];
      return helpMenu === fileMenu ? [fileMenu] : [fileMenu, helpMenu];
    },
    [buildMainMenuProps, mainMenuCallbacks]
  );
  const currentProjectName =
    buildMainMenuProps.project && buildMainMenuProps.project.getName
      ? buildMainMenuProps.project.getName()
      : '';
  const [tooltipData, setTooltipData] = React.useState<?{|
    element: HTMLElement,
    editorTab: EditorTab,
  |}>(null);
  const tooltipTimeoutId = React.useRef<?TimeoutID>(null);

  const onEditorTabHovered = React.useCallback(
    (
      editorTab: ?EditorTab,
      { isLabelTruncated }: {| isLabelTruncated: boolean |}
    ) => {
      if (isTouchscreen) {
        setTooltipData(null);
        return;
      }

      if (tooltipTimeoutId.current) {
        clearTimeout(tooltipTimeoutId.current);
        tooltipTimeoutId.current = null;
      }

      if (editorTab && isLabelTruncated) {
        const element = document.getElementById(getTabId(editorTab));
        if (element) {
          tooltipTimeoutId.current = setTimeout(
            () => {
              setTooltipData({ editorTab, element });
            },
            // If the tooltip is already displayed, quickly change to the new tab
            // but not too quick because the display might look flickering.
            tooltipData ? 100 : 500
          );
        }
      } else {
        tooltipTimeoutId.current = setTimeout(() => {
          setTooltipData(null);
        }, 50);
      }
    },
    [isTouchscreen, tooltipData]
  );

  const onEditorTabClosing = React.useCallback(() => {
    // Always clear the tooltip when a tab is closed,
    // as they are multiple actions that can be done to
    // close it, it's safer (close all, close others, close one).
    if (tooltipTimeoutId.current) {
      clearTimeout(tooltipTimeoutId.current);
      tooltipTimeoutId.current = null;
    }
    setTooltipData(null);
  }, []);

  React.useEffect(
    () => {
      return () => {
        if (tooltipTimeoutId.current) {
          clearTimeout(tooltipTimeoutId.current);
        }
      };
    },
    // Clear timeout if necessary when unmounting.
    []
  );

  const handleDoubleClick = React.useCallback(() => {
    // On macOS, double-clicking the title bar should maximize/restore the window
    if (isMacLike()) {
      Window.toggleMaximize();
    }
  }, []);

  const triggerSearchInProject = React.useCallback(
    () => {
      onSearchInProject(projectSearch);
    },
    [onSearchInProject, projectSearch]
  );

  return (
    <div
      style={{
        ...styles.container,
        background: `linear-gradient(180deg, ${
          gdevelopTheme.paper.backgroundColor.dark
        } 0%, ${gdevelopTheme.paper.backgroundColor.medium} 130%)`,
        borderBottom: `1px solid ${gdevelopTheme.toolbar.separatorColor}`,
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.16)',
        // Hiding the titlebar should still keep its position in the layout to avoid layout shifts:
        visibility: hidden ? 'hidden' : 'visible',
        pointerEvents: hidden ? undefined : 'all',
      }}
      className={`${WINDOW_DRAGGABLE_PART_CLASS_NAME} carrots-tabs-titlebar`}
      onDoubleClick={handleDoubleClick}
    >
      <span
        style={{
          ...styles.topRail,
          background:
            'linear-gradient(90deg, rgba(201, 106, 18, 0.35) 0%, rgba(46, 159, 91, 0.3) 100%)',
        }}
      />
      {isLeftMostPane && <TitleBarLeftSafeMargins />}
      {displayMenuIcon && (
        <span
          className={WINDOW_NON_DRAGGABLE_PART_CLASS_NAME}
          style={styles.headerMenusContainer}
        >
          {currentProjectName ? (
            <span
              style={{
                ...styles.headerProjectName,
                color: '#ffd29a',
                background: 'rgba(201, 106, 18, 0.18)',
                border: '1px solid rgba(255, 177, 92, 0.34)',
                boxShadow: '0 1px 8px rgba(0, 0, 0, 0.16)',
              }}
              title={currentProjectName}
            >
              {currentProjectName}
            </span>
          ) : null}
          <span style={styles.headerPrimaryMenus}>
            {topHeaderMenus.map((menuItem, index) => (
              <ElementWithMenu
                key={`main-menu-${index}`}
                element={
                  <TextButton
                    // $FlowFixMe[prop-missing]
                    label={menuItem.label || ''}
                    onClick={() => {}}
                    style={styles.headerMenuButton}
                  />
                }
                // $FlowFixMe[prop-missing]
                buildMenuTemplate={() => menuItem.submenu || []}
              />
            ))}
          </span>
          <span style={styles.headerSearchContainer}>
            <CompactSearchBar
              value={projectSearch}
              onChange={setProjectSearch}
              onRequestSearch={triggerSearchInProject}
              placeholder={t`Search in project`}
            />
          </span>
          <span style={styles.headerQuickMenus}>
            {quickAccessMenus.map((menu, index) => (
              <ElementWithMenu
                key={`quick-menu-${menu.label}-${index}`}
                element={
                  <TextButton
                    label={menu.label}
                    onClick={() => {}}
                    style={styles.headerMenuButton}
                  />
                }
                buildMenuTemplate={() => menu.submenu}
              />
            ))}
          </span>
        </span>
      )}
      {renderTabs(onEditorTabHovered, onEditorTabClosing)}
      {isRightMostPane && <TitleBarRightSafeMargins />}
      {tooltipData && (
        <TabsTitlebarTooltip
          anchorElement={tooltipData.element}
          editorTab={tooltipData.editorTab}
        />
      )}
    </div>
  );
}
