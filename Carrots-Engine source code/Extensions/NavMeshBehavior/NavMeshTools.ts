namespace gdjs {
  /**
   * Shared helpers for NavMeshBehavior runtime files.
   * Keep this file included so the extension mirrors the PathfindingBehavior layout.
   */
  export const navMeshTools = {
    clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    },
    toBoolean(value: unknown, defaultValue: boolean): boolean {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        if (value === '1' || value.toLowerCase() === 'true') return true;
        if (value === '0' || value.toLowerCase() === 'false') return false;
      }
      return defaultValue;
    },
  };
}
