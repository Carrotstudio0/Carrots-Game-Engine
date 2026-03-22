describe('gdjs.RuntimeGame FSR', () => {
  const createRuntimeGame = (propertiesOverrides) =>
    gdjs.getPixiRuntimeGame({
      propertiesOverrides: {
        upscalingMode: 'fsr1',
        fsrQuality: 'quality',
        fsrSharpness: 0.2,
        windowWidth: 800,
        windowHeight: 600,
        ...propertiesOverrides,
      },
    });

  it('uses editor-aligned defaults when FSR properties are omitted', () => {
    const runtimeGame = gdjs.getPixiRuntimeGame();

    expect(runtimeGame.getUpscalingMode()).to.be('none');
    expect(runtimeGame.getEffectiveUpscalingMode()).to.be('none');
    expect(runtimeGame.getFsrQuality()).to.be('quality');
    expect(runtimeGame.getFsrSharpness()).to.be(0.2);
    expect(runtimeGame.getRenderingWidth()).to.be(800);
    expect(runtimeGame.getRenderingHeight()).to.be(600);
  });

  [
    { fsrQuality: 'ultra-quality', expectedWidth: 614, expectedHeight: 460 },
    { fsrQuality: 'quality', expectedWidth: 532, expectedHeight: 400 },
    { fsrQuality: 'balanced', expectedWidth: 470, expectedHeight: 352 },
    { fsrQuality: 'performance', expectedWidth: 400, expectedHeight: 300 },
  ].forEach(({ fsrQuality, expectedWidth, expectedHeight }) => {
    it(`computes even internal rendering size for ${fsrQuality}`, () => {
      const runtimeGame = createRuntimeGame({ fsrQuality });

      expect(runtimeGame.isFsrEnabled()).to.be(true);
      expect(runtimeGame.getEffectiveUpscalingMode()).to.be('fsr1');
      expect(runtimeGame.getRenderingWidth()).to.be(expectedWidth);
      expect(runtimeGame.getRenderingHeight()).to.be(expectedHeight);
      expect(runtimeGame.getRenderingWidth() % 2).to.be(0);
      expect(runtimeGame.getRenderingHeight() % 2).to.be(0);
    });
  });

  it('disables FSR for the session and falls back to native resolution', () => {
    const runtimeGame = createRuntimeGame({ fsrQuality: 'balanced' });

    runtimeGame.disableFsrForSession('Test fallback');

    expect(runtimeGame.isFsrEnabled()).to.be(false);
    expect(runtimeGame.getEffectiveUpscalingMode()).to.be('none');
    expect(runtimeGame.getFsrDisableReason()).to.be('Test fallback');
    expect(runtimeGame.getRenderingWidth()).to.be(800);
    expect(runtimeGame.getRenderingHeight()).to.be(600);
  });
});
