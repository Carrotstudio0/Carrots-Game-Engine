// Compatibility shim for runtime code still referencing `pixi_spine`.
(() => {
  if (typeof globalThis === 'undefined') return;
  if (typeof globalThis.spine === 'undefined') return;

  globalThis.pixi_spine = globalThis.spine;
})();
