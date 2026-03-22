// @flow
import BrowserSWFileSystem from './BrowserSWFileSystem';
import { putFile } from './BrowserSWPreviewLauncher/BrowserSWPreviewIndexedDB';

jest.mock('./BrowserSWPreviewLauncher/BrowserSWPreviewIndexedDB', () => ({
  deleteFilesWithPrefix: jest.fn(() => Promise.resolve(0)),
  putFile: jest.fn(() => Promise.resolve()),
}));

describe('BrowserSWFileSystem', () => {
  const rootUrl = 'http://localhost:3000/browser_sw_preview/';
  const mockedPutFile = (putFile: any);

  beforeEach(() => {
    jest.clearAllMocks();
    // $FlowFixMe[cannot-write]
    global.fetch = jest.fn();
  });

  afterEach(() => {
    // $FlowFixMe[cannot-write]
    delete global.fetch;
  });

  it('stores copied external files in IndexedDB for preview usage', async () => {
    const runtimeBytes = new TextEncoder().encode('window.preview = true;')
      .buffer;
    const mockedFetch = (global.fetch: any);
    mockedFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(runtimeBytes),
      headers: {
        get: () => 'text/javascript; charset=utf-8',
      },
    });

    const browserSWFileSystem = new BrowserSWFileSystem({
      filesContent: [],
      rootUrl,
    });

    expect(
      browserSWFileSystem.copyFile(
        'http://localhost:5002/Runtime/libGD.js',
        `${rootUrl}15/preview/libGD.js`
      )
    ).toBe(true);

    await browserSWFileSystem.applyPendingOperations();

    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:5002/Runtime/libGD.js'
    );
    expect(mockedPutFile).toHaveBeenCalledWith(
      '/15/preview/libGD.js',
      expect.any(ArrayBuffer),
      'text/javascript; charset=utf-8'
    );
  });

  it('can copy generated text files before uploading them', async () => {
    const browserSWFileSystem = new BrowserSWFileSystem({
      filesContent: [],
      rootUrl,
    });
    const mockedFetch = (global.fetch: any);

    const sourceFile = `${rootUrl}15/preview/index.html`;
    const copiedFile = `${rootUrl}15/preview/copied/index.html`;

    browserSWFileSystem.writeToFile(sourceFile, '<html>preview</html>');

    expect(browserSWFileSystem.copyFile(sourceFile, copiedFile)).toBe(true);
    expect(browserSWFileSystem.readFile(copiedFile)).toBe(
      '<html>preview</html>'
    );

    await browserSWFileSystem.applyPendingOperations();

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedPutFile).toHaveBeenCalledWith(
      '/15/preview/index.html',
      expect.any(ArrayBuffer),
      'text/html; charset=utf-8'
    );
    expect(mockedPutFile).toHaveBeenCalledWith(
      '/15/preview/copied/index.html',
      expect.any(ArrayBuffer),
      'text/html; charset=utf-8'
    );
  });

  it('skips missing source maps instead of failing the preview export', async () => {
    const mockedFetch = (global.fetch: any);
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: () => null,
      },
    });

    const browserSWFileSystem = new BrowserSWFileSystem({
      filesContent: [],
      rootUrl,
    });

    expect(
      browserSWFileSystem.copyFile(
        'http://localhost:5002/Runtime/libs/rbush.js.map',
        `${rootUrl}15/in-game-editor-preview/libs/rbush.js.map`
      )
    ).toBe(true);

    await expect(browserSWFileSystem.applyPendingOperations()).resolves.toBe(
      undefined
    );
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedPutFile).not.toHaveBeenCalled();
  });
});
