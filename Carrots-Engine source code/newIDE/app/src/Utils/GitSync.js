// @flow
import optionalRequire from './OptionalRequire';

const electron = optionalRequire('electron');
const ipcRenderer = electron ? electron.ipcRenderer : null;

export type GitSyncState = {|
  supported: boolean,
  isRepository: boolean,
  workingDirectory: string,
  repositoryRoot: ?string,
  branchName: ?string,
  upstreamBranchName: ?string,
  aheadCount: number,
  behindCount: number,
  stagedCount: number,
  changedCount: number,
  untrackedCount: number,
  conflictedCount: number,
  remoteOriginUrl: ?string,
|};

export type GitSyncCommitResult = {|
  noChangesCommitted: boolean,
  state: GitSyncState,
|};

const ensureDesktopSupport = () => {
  if (!ipcRenderer) {
    throw new Error(
      'Git sync is available only in the desktop app (Electron build).'
    );
  }
};

const invokeGitSync = async <T: mixed>(
  channel: string,
  payload: Object
): Promise<T> => {
  ensureDesktopSupport();
  return ipcRenderer.invoke(channel, payload);
};

export const canUseGitSync = (): boolean => !!ipcRenderer;

export const getGitSyncState = (
  projectPath: string
): Promise<GitSyncState> =>
  invokeGitSync('git-sync-get-state', {
    projectPath,
  });

export const initGitRepository = (
  projectPath: string
): Promise<GitSyncState> =>
  invokeGitSync('git-sync-init-repository', {
    projectPath,
  });

export const setGitRemoteOrigin = (
  projectPath: string,
  remoteUrl: string
): Promise<GitSyncState> =>
  invokeGitSync('git-sync-set-remote-origin', {
    projectPath,
    remoteUrl,
  });

export const fetchGitOrigin = (projectPath: string): Promise<GitSyncState> =>
  invokeGitSync('git-sync-fetch-origin', {
    projectPath,
  });

export const pullGitOrigin = (projectPath: string): Promise<GitSyncState> =>
  invokeGitSync('git-sync-pull-origin', {
    projectPath,
  });

export const pushGitOrigin = (projectPath: string): Promise<GitSyncState> =>
  invokeGitSync('git-sync-push-origin', {
    projectPath,
  });

export const commitAllGitChanges = (
  projectPath: string,
  commitMessage: string
): Promise<GitSyncCommitResult> =>
  invokeGitSync('git-sync-commit-all', {
    projectPath,
    commitMessage,
  });

export const openGitRemoteOrigin = (
  projectPath: string
): Promise<{| opened: boolean, url: string |}> =>
  invokeGitSync('git-sync-open-remote-origin', {
    projectPath,
  });
