// @flow
import React from 'react';
import GDevelopThemeContext from '../UI/Theme/GDevelopThemeContext';

const ToolbarSeparator = (): React.MixedElement => {
  const theme = React.useContext(GDevelopThemeContext);
  return (
    <span
      style={{
        height: 24,
        marginLeft: 2,
        marginRight: 2,
        borderLeftStyle: 'solid',
        borderLeftWidth: 1,
        borderColor: theme.toolbar.separatorColor,
      }}
    />
  );
};

export default ToolbarSeparator;
