// @flow
import * as React from 'react';
import GDevelopThemeContext from './Theme/GDevelopThemeContext';
import { useResponsiveWindowSize } from './Responsive/ResponsiveWindowMeasurer';

type ToolbarProps = {|
  children: React.Node,
  height?: number,
  borderBottomColor?: ?string,
  paddingBottom?: number,
  hidden?: boolean,
|};

const styles = {
  toolbar: {
    flexShrink: 0,
    display: 'flex',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingLeft: 6,
    paddingRight: 6,
    alignItems: 'center',
    position: 'relative', // to ensure it is displayed above any global iframe.
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'thin',
  },
};

export const Toolbar: React.ComponentType<ToolbarProps> = React.memo<ToolbarProps>(
  ({
    children,
    borderBottomColor,
    height = 34,
    paddingBottom,
    hidden,
  }: ToolbarProps) => {
    const gdevelopTheme = React.useContext(GDevelopThemeContext);
    const { isMobile, isMediumScreen, isLandscape } = useResponsiveWindowSize();
    const isCompactToolbar =
      (isMobile || isMediumScreen) && isLandscape && height === 34;
    const compactToolbarHeight = isCompactToolbar ? 28 : height;
    const toolbarBackground = `linear-gradient(180deg, ${
      gdevelopTheme.toolbar.backgroundColor
    } 0%, ${gdevelopTheme.paper.backgroundColor.dark} 120%)`;

    return (
      <div
        className={`almost-invisible-scrollbar carrots-main-toolbar${
          isCompactToolbar ? ' carrots-main-toolbar--compact' : ''
        }`}
        style={{
          ...styles.toolbar,
          background: toolbarBackground,
          height: compactToolbarHeight,
          paddingLeft: isCompactToolbar ? 3 : styles.toolbar.paddingLeft,
          paddingRight: isCompactToolbar ? 3 : styles.toolbar.paddingRight,
          borderBottom: borderBottomColor
            ? `2px solid ${borderBottomColor}`
            : '1px solid rgba(255, 177, 92, 0.24)',
          boxShadow: isCompactToolbar
            ? '0 3px 8px rgba(0, 0, 0, 0.14)'
            : '0 5px 12px rgba(0, 0, 0, 0.18)',
          ...(paddingBottom ? { paddingBottom } : undefined),

          // Hiding the titlebar should still keep its position in the layout to avoid layout shifts:
          visibility: hidden ? 'hidden' : 'visible',
          // Use content-visibility as we know the exact height of the toolbar, so the
          // content can be entirely skipped when hidden:
          contentVisibility: hidden ? 'hidden' : 'visible',
          pointerEvents: hidden ? undefined : 'all',
        }}
      >
        {children}
      </div>
    );
  }
);

// $FlowFixMe[missing-local-annot]
const toolbarGroupStyle = props => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: props.spaceOut
    ? 'space-around'
    : props.firstChild
    ? 'flex-start'
    : props.lastChild
    ? 'flex-end'
    : 'center',
});

type ToolbarGroupProps = {|
  children?: React.Node,
  firstChild?: boolean,
  lastChild?: boolean,
  spaceOut?: boolean,
|};

export const ToolbarGroup: React.ComponentType<ToolbarGroupProps> = React.memo<ToolbarGroupProps>(
  (props: ToolbarGroupProps) => (
    <span style={toolbarGroupStyle(props)}>{props.children}</span>
  )
);
