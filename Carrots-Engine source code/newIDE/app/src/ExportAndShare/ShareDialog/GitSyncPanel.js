// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import AlertMessage from '../../UI/AlertMessage';
import { ColumnStackLayout, ResponsiveLineStackLayout } from '../../UI/Layout';
import Text from '../../UI/Text';
import RaisedButton from '../../UI/RaisedButton';
import FlatButton from '../../UI/FlatButton';
import TextField from '../../UI/TextField';
import PlaceholderLoader from '../../UI/PlaceholderLoader';
import {
  canUseGitSync,
  getGitSyncState,
  initGitRepository,
  setGitRemoteOrigin,
  fetchGitOrigin,
  pullGitOrigin,
  pushGitOrigin,
  commitAllGitChanges,
  openGitRemoteOrigin,
  type GitSyncState,
} from '../../Utils/GitSync';

type Props = {|
  localProjectFilePath: ?string,
|};

const GitSyncPanel = ({ localProjectFilePath }: Props): React.Node => {
  const [gitState, setGitState] = React.useState<?GitSyncState>(null);
  const [isLoadingState, setIsLoadingState] = React.useState(false);
  const [activeAction, setActiveAction] = React.useState<?string>(null);
  const [errorMessage, setErrorMessage] = React.useState<?string>(null);
  const [infoMessage, setInfoMessage] = React.useState<?string>(null);
  const [remoteOriginUrlInput, setRemoteOriginUrlInput] = React.useState('');
  const [remoteUrlManuallyEdited, setRemoteUrlManuallyEdited] = React.useState(
    false
  );
  const [commitMessage, setCommitMessage] = React.useState('Update project');

  const syncRemoteInputWithState = React.useCallback(
    (nextState: ?GitSyncState) => {
      if (!nextState || remoteUrlManuallyEdited) return;
      setRemoteOriginUrlInput(nextState.remoteOriginUrl || '');
    },
    [remoteUrlManuallyEdited]
  );

  const refreshState = React.useCallback(
    async () => {
      if (!localProjectFilePath || !canUseGitSync()) return;

      setIsLoadingState(true);
      setErrorMessage(null);

      try {
        const nextState = await getGitSyncState(localProjectFilePath);
        setGitState(nextState);
        syncRemoteInputWithState(nextState);
      } catch (error) {
        const message =
          error && error.message
            ? error.message
            : 'Unable to retrieve Git status.';
        setErrorMessage(message);
      } finally {
        setIsLoadingState(false);
      }
    },
    [localProjectFilePath, syncRemoteInputWithState]
  );

  React.useEffect(
    () => {
      setGitState(null);
      setErrorMessage(null);
      setInfoMessage(null);
      setRemoteOriginUrlInput('');
      setRemoteUrlManuallyEdited(false);

      if (!localProjectFilePath || !canUseGitSync()) return;
      refreshState();
    },
    [localProjectFilePath, refreshState]
  );

  React.useEffect(
    () => {
      if (!localProjectFilePath || !canUseGitSync()) return;

      const intervalId = setInterval(() => {
        if (activeAction || isLoadingState) return;
        refreshState();
      }, 5000);

      return () => clearInterval(intervalId);
    },
    [localProjectFilePath, activeAction, isLoadingState, refreshState]
  );

  const runAction = React.useCallback(
    async (
      actionKey: string,
      action: () => Promise<GitSyncState | {| noChangesCommitted: boolean, state: GitSyncState |}>
    ) => {
      setActiveAction(actionKey);
      setErrorMessage(null);
      setInfoMessage(null);

      try {
        const result = await action();

        if (result && typeof result === 'object' && result.state) {
          setGitState(result.state);
          syncRemoteInputWithState(result.state);
          if (result.noChangesCommitted) {
            setInfoMessage('No local changes to commit.');
          }
        } else {
          // $FlowFixMe[prop-missing]
          setGitState(result);
          // $FlowFixMe[prop-missing]
          syncRemoteInputWithState(result);
        }
      } catch (error) {
        const message =
          error && error.message ? error.message : 'Git action failed.';
        setErrorMessage(message);
      } finally {
        setActiveAction(null);
      }
    },
    [syncRemoteInputWithState]
  );

  const isBusy = isLoadingState || !!activeAction;

  if (!canUseGitSync()) {
    return (
      <AlertMessage kind="warning">
        <Trans>
          Git collaboration is available in the desktop app (Electron build)
          only.
        </Trans>
      </AlertMessage>
    );
  }

  if (!localProjectFilePath) {
    return (
      <AlertMessage kind="info">
        <Trans>
          Save this project on your computer to enable Git/GitHub collaboration
          and real-time synchronization tools.
        </Trans>
      </AlertMessage>
    );
  }

  if (!gitState && isLoadingState) {
    return <PlaceholderLoader />;
  }

  const hasRemote = !!(gitState && gitState.remoteOriginUrl);
  const commitMessageIsValid = !!commitMessage.trim();

  return (
    <ColumnStackLayout noMargin expand>
      <Text size="block-title">
        <Trans>Git/GitHub collaboration</Trans>
      </Text>
      <Text>
        <Trans>
          Configure repository sync, then fetch/pull/push updates to collaborate
          with your team on the same project.
        </Trans>
      </Text>

      {errorMessage ? <AlertMessage kind="error">{errorMessage}</AlertMessage> : null}
      {infoMessage ? <AlertMessage kind="info">{infoMessage}</AlertMessage> : null}

      <ResponsiveLineStackLayout noMargin noResponsiveLandscape>
        <FlatButton
          primary={false}
          label={<Trans>Refresh status</Trans>}
          onClick={refreshState}
          disabled={isBusy}
        />
        {!gitState || !gitState.isRepository ? (
          <RaisedButton
            primary
            label={<Trans>Initialize repository</Trans>}
            onClick={() =>
              runAction('init', () => initGitRepository(localProjectFilePath))
            }
            disabled={isBusy}
          />
        ) : null}
      </ResponsiveLineStackLayout>

      {gitState && !gitState.supported ? (
        <AlertMessage kind="warning">
          <Trans>
            Git is not available on this system. Install Git and restart Carrots
            Engine.
          </Trans>
        </AlertMessage>
      ) : null}

      {gitState && gitState.isRepository ? (
        <>
          <AlertMessage kind="info">
            <Trans>
              Branch: {gitState.branchName || 'unknown'} | Ahead:{' '}
              {gitState.aheadCount} | Behind: {gitState.behindCount} | Staged:{' '}
              {gitState.stagedCount} | Modified: {gitState.changedCount} |
              Untracked: {gitState.untrackedCount}
            </Trans>
          </AlertMessage>

          <Text>
            <Trans>Repository root: {gitState.repositoryRoot || '-'}</Trans>
          </Text>

          <ResponsiveLineStackLayout noMargin>
            <TextField
              fullWidth
              floatingLabelText={<Trans>Git remote origin (GitHub URL)</Trans>}
              value={remoteOriginUrlInput}
              onChange={(event, value) => {
                setRemoteUrlManuallyEdited(true);
                setRemoteOriginUrlInput(value);
              }}
              disabled={isBusy}
            />
            <RaisedButton
              primary
              label={<Trans>Save remote</Trans>}
              onClick={() =>
                runAction('set-remote', async () => {
                  const nextState = await setGitRemoteOrigin(
                    localProjectFilePath,
                    remoteOriginUrlInput
                  );
                  setRemoteUrlManuallyEdited(false);
                  return nextState;
                })
              }
              disabled={isBusy || !remoteOriginUrlInput.trim()}
            />
          </ResponsiveLineStackLayout>

          <ResponsiveLineStackLayout noMargin noResponsiveLandscape>
            <FlatButton
              primary={false}
              label={<Trans>Open repository</Trans>}
              onClick={() =>
                runAction('open-remote', async () => {
                  await openGitRemoteOrigin(localProjectFilePath);
                  return getGitSyncState(localProjectFilePath);
                })
              }
              disabled={isBusy || !hasRemote}
            />
            <FlatButton
              primary={false}
              label={<Trans>Fetch</Trans>}
              onClick={() =>
                runAction('fetch', () => fetchGitOrigin(localProjectFilePath))
              }
              disabled={isBusy || !hasRemote}
            />
            <FlatButton
              primary={false}
              label={<Trans>Pull</Trans>}
              onClick={() =>
                runAction('pull', () => pullGitOrigin(localProjectFilePath))
              }
              disabled={isBusy || !hasRemote}
            />
            <RaisedButton
              primary
              label={<Trans>Push</Trans>}
              onClick={() =>
                runAction('push', () => pushGitOrigin(localProjectFilePath))
              }
              disabled={isBusy || !hasRemote}
            />
            <RaisedButton
              primary
              label={<Trans>Sync now</Trans>}
              onClick={() =>
                runAction('sync', async () => {
                  await fetchGitOrigin(localProjectFilePath);
                  await pullGitOrigin(localProjectFilePath);
                  return pushGitOrigin(localProjectFilePath);
                })
              }
              disabled={isBusy || !hasRemote}
            />
          </ResponsiveLineStackLayout>

          <ResponsiveLineStackLayout noMargin>
            <TextField
              fullWidth
              floatingLabelText={<Trans>Commit message</Trans>}
              value={commitMessage}
              onChange={(event, value) => setCommitMessage(value)}
              disabled={isBusy}
            />
            <RaisedButton
              primary
              label={<Trans>Stage all and commit</Trans>}
              onClick={() =>
                runAction('commit', () =>
                  commitAllGitChanges(localProjectFilePath, commitMessage)
                )
              }
              disabled={isBusy || !commitMessageIsValid}
            />
          </ResponsiveLineStackLayout>
        </>
      ) : null}
    </ColumnStackLayout>
  );
};

export default GitSyncPanel;
