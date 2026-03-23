// @flow
import * as React from 'react';
import ChangelogDialog from './ChangelogDialog';
import PreferencesContext from '../Preferences/PreferencesContext';

type InnerContainerProps = {|
  defaultOpen: boolean,
|};

const ChangelogDialogInnerContainer = ({
  defaultOpen,
}: InnerContainerProps) => {
  const [open, setOpen] = React.useState(defaultOpen);

  return <ChangelogDialog open={open} onClose={() => setOpen(false)} />;
};

/**
 * The container showing the ChangelogDialog only if a a new version
 * of GDevelop is detected.
 */
const ChangelogDialogContainer = (): React.Node => {
  const { values, verifyIfIsNewVersion } = React.useContext(PreferencesContext);
  const [defaultOpen, setDefaultOpen] = React.useState(false);
  const didCheckForNewVersion = React.useRef(false);

  React.useEffect(() => {
    if (didCheckForNewVersion.current) return;

    didCheckForNewVersion.current = true;
    const shouldOpen =
      verifyIfIsNewVersion() && !!values.autoDisplayChangelog;
    setDefaultOpen(shouldOpen);
  }, [values.autoDisplayChangelog, verifyIfIsNewVersion]);

  return <ChangelogDialogInnerContainer defaultOpen={defaultOpen} />;
};

export default ChangelogDialogContainer;
