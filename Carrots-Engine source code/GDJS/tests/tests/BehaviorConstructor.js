// @ts-check

describe('gdjs.getBehaviorConstructor', () => {
  it('should resolve behavior type fallbacks for common legacy naming formats', () => {
    const behaviorType =
      'TestBehaviorFallbackExtension::FallbackOnlyForTestsUniqueBehavior';

    class FallbackOnlyForTestsRuntimeBehavior extends gdjs.RuntimeBehavior {}

    gdjs.registerBehavior(behaviorType, FallbackOnlyForTestsRuntimeBehavior);

    // Dot-notation can happen in older generated code.
    expect(
      gdjs.getBehaviorConstructor(
        'TestBehaviorFallbackExtension.FallbackOnlyForTestsUniqueBehavior'
      )
    ).to.be(FallbackOnlyForTestsRuntimeBehavior);

    // Namespace drift can happen if an extension was renamed.
    expect(
      gdjs.getBehaviorConstructor(
        'LegacyBehaviorExtension::FallbackOnlyForTestsUniqueBehavior'
      )
    ).to.be(FallbackOnlyForTestsRuntimeBehavior);
  });
});
