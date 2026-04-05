namespace gdjs {
  /**
   * @category Debugging > Profiler
   */
  export type ProfilerRenderStatsSample = {
    drawCalls?: number;
    triangles?: number;
    lines?: number;
    points?: number;
    textures?: number;
    geometries?: number;
    shaderPrograms?: number;
  };

  /**
   * @category Debugging > Profiler
   */
  export type ProfilerRenderStatsSummary = {
    averageDrawCalls: number;
    maxDrawCalls: number;
    averageTriangles: number;
    maxTriangles: number;
    averageLines: number;
    averagePoints: number;
    averageTextures: number;
    averageGeometries: number;
    averageShaderPrograms: number;
  };

  /**
   * @category Debugging > Profiler
   */
  export type ProfilerStats = {
    framesCount: integer;
    averageFrameTimeMs?: number;
    minFrameTimeMs?: number;
    maxFrameTimeMs?: number;
    percentile95FrameTimeMs?: number;
    averageFps?: number;
    frameTimeJitterMs?: number;
    renderStats?: ProfilerRenderStatsSummary;
    optimizationHints?: string[];
  };

  /**
   * @category Debugging > Profiler
   */
  export type FrameMeasure = {
    parent: FrameMeasure | null;
    time: float;
    lastStartTime: float;
    subsections: Record<string, FrameMeasure>;
  };

  /**
   * A basic profiling tool that can be used to measure time spent in sections of the engine.
   * @category Debugging > Profiler
   */
  export class Profiler {
    /** All the measures for the last frames */
    _framesMeasures: Array<FrameMeasure> = [];

    _currentFrameIndex: float = 0;

    /** The measures being done */
    _currentFrameMeasure: FrameMeasure = {
      parent: null,
      time: 0,
      lastStartTime: 0,
      subsections: {},
    };

    /** The section being measured */
    _currentSection: FrameMeasure | null = null;

    _maxFramesCount: number = 600;

    /** The number of frames that have been measured */
    _framesCount: number = 0;

    /** Duration in milliseconds of each captured frame. */
    _frameDurationsMs: Array<number> = [];

    /** Render/GPU related stats captured for each frame. */
    _renderStatsSamples: Array<ProfilerRenderStatsSample | null> = [];

    /** Render stats collected for the frame currently being profiled. */
    _pendingRenderStats: ProfilerRenderStatsSample | null = null;

    /** A function to get the current time. If available, corresponds to performance.now(). */
    _getTimeNow: () => float;

    constructor() {
      while (this._framesMeasures.length < this._maxFramesCount) {
        this._framesMeasures.push({
          parent: null,
          time: 0,
          lastStartTime: 0,
          subsections: {},
        });
        this._frameDurationsMs.push(0);
        this._renderStatsSamples.push(null);
      }
      this._getTimeNow =
        window.performance && typeof window.performance.now === 'function'
          ? window.performance.now.bind(window.performance)
          : Date.now;
    }

    beginFrame(): void {
      this._currentFrameMeasure = {
        parent: null,
        time: 0,
        lastStartTime: this._getTimeNow(),
        subsections: {},
      };
      this._currentSection = this._currentFrameMeasure;
      this._pendingRenderStats = null;
    }

    recordRenderStats(
      renderStats: ProfilerRenderStatsSample | null | undefined
    ): void {
      if (!renderStats) {
        this._pendingRenderStats = null;
        return;
      }
      this._pendingRenderStats = {
        drawCalls: renderStats.drawCalls,
        triangles: renderStats.triangles,
        lines: renderStats.lines,
        points: renderStats.points,
        textures: renderStats.textures,
        geometries: renderStats.geometries,
        shaderPrograms: renderStats.shaderPrograms,
      };
    }

    begin(sectionName: string): void {
      if (this._currentSection === null)
        throw new Error(
          'Impossible to call Profiler.begin() when not profiling a frame!'
        );

      // Push the new section
      const subsections = this._currentSection.subsections;
      const subsection = (subsections[sectionName] = subsections[
        sectionName
      ] || {
        parent: this._currentSection,
        time: 0,
        lastStartTime: 0,
        subsections: {},
      });
      this._currentSection = subsection;

      // Start the timer
      this._currentSection.lastStartTime = this._getTimeNow();
    }

    end(sectionName?: string): void {
      if (this._currentSection === null)
        throw new Error(
          'Impossible to call Profiler.end() when not profiling a frame!'
        );

      // Stop the timer
      const sectionTime =
        this._getTimeNow() - this._currentSection.lastStartTime;
      this._currentSection.time =
        (this._currentSection.time || 0) + sectionTime;

      // Pop the section
      if (this._currentSection.parent !== null)
        this._currentSection = this._currentSection.parent;
    }

    endFrame(): void {
      if (this._currentSection === null)
        throw new Error(
          'Impossible to end profiling a frame when profiling has not started a frame!'
        );
      if (this._currentSection.parent !== null) {
        throw new Error(
          'Mismatch in profiler, endFrame should be called on root section'
        );
      }
      this.end();
      this._framesCount++;
      if (this._framesCount > this._maxFramesCount) {
        this._framesCount = this._maxFramesCount;
      }
      const frameIndex = this._currentFrameIndex;
      this._framesMeasures[frameIndex] = this
        ._currentFrameMeasure as FrameMeasure;
      this._frameDurationsMs[frameIndex] = this._currentFrameMeasure.time;
      this._renderStatsSamples[frameIndex] = this._pendingRenderStats;
      this._currentFrameIndex++;
      if (this._currentFrameIndex >= this._maxFramesCount) {
        this._currentFrameIndex = 0;
      }
    }

    private static _isFiniteNonNegativeNumber(value: any): value is number {
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    }

    private static _getAverage(values: Array<number>): number {
      if (!values.length) {
        return 0;
      }
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        sum += values[i];
      }
      return sum / values.length;
    }

    private static _getPercentile(values: Array<number>, percentile: number): number {
      if (!values.length) {
        return 0;
      }
      const sortedValues = values.slice().sort((a, b) => a - b);
      const normalizedPercentile = Math.max(0, Math.min(1, percentile));
      const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.ceil(sortedValues.length * normalizedPercentile) - 1)
      );
      return sortedValues[index];
    }

    private _computeRenderStatsSummary():
      | ProfilerRenderStatsSummary
      | null {
      let drawCallsSum = 0;
      let drawCallsCount = 0;
      let drawCallsMax = 0;

      let trianglesSum = 0;
      let trianglesCount = 0;
      let trianglesMax = 0;

      let linesSum = 0;
      let linesCount = 0;

      let pointsSum = 0;
      let pointsCount = 0;

      let texturesSum = 0;
      let texturesCount = 0;

      let geometriesSum = 0;
      let geometriesCount = 0;

      let shaderProgramsSum = 0;
      let shaderProgramsCount = 0;

      for (let i = 0; i < this._framesCount; i++) {
        const sample = this._renderStatsSamples[i];
        if (!sample) {
          continue;
        }

        if (Profiler._isFiniteNonNegativeNumber(sample.drawCalls)) {
          drawCallsSum += sample.drawCalls;
          drawCallsMax = Math.max(drawCallsMax, sample.drawCalls);
          drawCallsCount++;
        }
        if (Profiler._isFiniteNonNegativeNumber(sample.triangles)) {
          trianglesSum += sample.triangles;
          trianglesMax = Math.max(trianglesMax, sample.triangles);
          trianglesCount++;
        }
        if (Profiler._isFiniteNonNegativeNumber(sample.lines)) {
          linesSum += sample.lines;
          linesCount++;
        }
        if (Profiler._isFiniteNonNegativeNumber(sample.points)) {
          pointsSum += sample.points;
          pointsCount++;
        }
        if (Profiler._isFiniteNonNegativeNumber(sample.textures)) {
          texturesSum += sample.textures;
          texturesCount++;
        }
        if (Profiler._isFiniteNonNegativeNumber(sample.geometries)) {
          geometriesSum += sample.geometries;
          geometriesCount++;
        }
        if (Profiler._isFiniteNonNegativeNumber(sample.shaderPrograms)) {
          shaderProgramsSum += sample.shaderPrograms;
          shaderProgramsCount++;
        }
      }

      if (
        drawCallsCount === 0 &&
        trianglesCount === 0 &&
        linesCount === 0 &&
        pointsCount === 0 &&
        texturesCount === 0 &&
        geometriesCount === 0 &&
        shaderProgramsCount === 0
      ) {
        return null;
      }

      return {
        averageDrawCalls: drawCallsCount > 0 ? drawCallsSum / drawCallsCount : 0,
        maxDrawCalls: drawCallsMax,
        averageTriangles: trianglesCount > 0 ? trianglesSum / trianglesCount : 0,
        maxTriangles: trianglesMax,
        averageLines: linesCount > 0 ? linesSum / linesCount : 0,
        averagePoints: pointsCount > 0 ? pointsSum / pointsCount : 0,
        averageTextures: texturesCount > 0 ? texturesSum / texturesCount : 0,
        averageGeometries: geometriesCount > 0 ? geometriesSum / geometriesCount : 0,
        averageShaderPrograms:
          shaderProgramsCount > 0 ? shaderProgramsSum / shaderProgramsCount : 0,
      };
    }

    private _buildOptimizationHints(stats: ProfilerStats): string[] {
      const hints: string[] = [];
      if (!stats.framesCount || stats.framesCount < 10) {
        return hints;
      }

      const averageFrameTimeMs = stats.averageFrameTimeMs || 0;
      const averageFps = stats.averageFps || 0;
      const percentile95FrameTimeMs = stats.percentile95FrameTimeMs || 0;
      const renderStats = stats.renderStats;

      if (averageFrameTimeMs > 18 || averageFps < 55) {
        if (renderStats && renderStats.averageDrawCalls > 1200) {
          hints.push(
            'High draw-call pressure detected. Prioritize instancing, draw-call merging, and stricter culling.'
          );
        }
        if (renderStats && renderStats.averageTriangles > 2500000) {
          hints.push(
            'High triangle throughput detected. Review LOD thresholds and distant geometry complexity.'
          );
        }
        if (renderStats && renderStats.averageShaderPrograms > 96) {
          hints.push(
            'Many shader programs are active. Shader variant caching/prewarming is likely needed.'
          );
        }
      }

      if (percentile95FrameTimeMs - averageFrameTimeMs > 6) {
        hints.push(
          'Frame-time spikes detected. Investigate shader compilation stutters and runtime resource uploads.'
        );
      }

      if (averageFrameTimeMs > 25 && hints.length === 0) {
        hints.push(
          'Frame time is high. Start with profiler hotspots in events/behaviors and expensive post-processing effects.'
        );
      }

      return hints;
    }

    static _addAverageSectionTimes(
      section: FrameMeasure,
      destinationSection: FrameMeasure,
      totalCount: integer,
      i: integer
    ): void {
      destinationSection.time =
        (destinationSection.time || 0) + section.time / totalCount;
      for (const sectionName in section.subsections) {
        if (section.subsections.hasOwnProperty(sectionName)) {
          const destinationSubsections = destinationSection.subsections;
          const destinationSubsection = (destinationSubsections[sectionName] =
            destinationSubsections[sectionName] || {
              parent: destinationSection,
              time: 0,
              subsections: {},
            });
          Profiler._addAverageSectionTimes(
            section.subsections[sectionName],
            destinationSubsection,
            totalCount,
            i
          );
        }
      }
    }

    /**
     * Return the measures for all the section of the game during the frames
     * captured.
     */
    getFramesAverageMeasures(): FrameMeasure {
      const framesAverageMeasures = {
        parent: null,
        time: 0,
        lastStartTime: 0,
        subsections: {},
      };
      for (let i = 0; i < this._framesCount; ++i) {
        Profiler._addAverageSectionTimes(
          this._framesMeasures[i],
          framesAverageMeasures,
          this._framesCount,
          i
        );
      }
      return framesAverageMeasures;
    }

    /**
     * Get stats measured during the frames captured.
     */
    getStats(): ProfilerStats {
      const stats: ProfilerStats = { framesCount: this._framesCount };
      if (!this._framesCount) {
        return stats;
      }

      const frameDurations: Array<number> = [];
      for (let i = 0; i < this._framesCount; i++) {
        const frameDuration = this._frameDurationsMs[i];
        if (Profiler._isFiniteNonNegativeNumber(frameDuration)) {
          frameDurations.push(frameDuration);
          continue;
        }
        const fallbackDuration = this._framesMeasures[i].time;
        if (Profiler._isFiniteNonNegativeNumber(fallbackDuration)) {
          frameDurations.push(fallbackDuration);
        }
      }

      if (frameDurations.length > 0) {
        const averageFrameTimeMs = Profiler._getAverage(frameDurations);
        const minFrameTimeMs = Math.min.apply(null, frameDurations);
        const maxFrameTimeMs = Math.max.apply(null, frameDurations);
        const percentile95FrameTimeMs = Profiler._getPercentile(frameDurations, 0.95);

        let squaredDeltaSum = 0;
        for (let i = 0; i < frameDurations.length; i++) {
          const delta = frameDurations[i] - averageFrameTimeMs;
          squaredDeltaSum += delta * delta;
        }
        const frameTimeJitterMs = Math.sqrt(squaredDeltaSum / frameDurations.length);

        stats.averageFrameTimeMs = averageFrameTimeMs;
        stats.minFrameTimeMs = minFrameTimeMs;
        stats.maxFrameTimeMs = maxFrameTimeMs;
        stats.percentile95FrameTimeMs = percentile95FrameTimeMs;
        stats.averageFps = averageFrameTimeMs > 0 ? 1000 / averageFrameTimeMs : 0;
        stats.frameTimeJitterMs = frameTimeJitterMs;
      }

      const renderStatsSummary = this._computeRenderStatsSummary();
      if (renderStatsSummary) {
        stats.renderStats = renderStatsSummary;
      }

      const optimizationHints = this._buildOptimizationHints(stats);
      if (optimizationHints.length) {
        stats.optimizationHints = optimizationHints;
      }

      return stats;
    }

    /**
     * Convert measures for a section into texts.
     * Useful for ingame profiling.
     *
     * @param sectionName The name of the section
     * @param profilerSection The section measures
     * @param outputs The array where to push the results
     */
    static getProfilerSectionTexts(
      sectionName: string,
      profilerSection: any,
      outputs: any
    ): void {
      const percent =
        profilerSection.parent && profilerSection.parent.time !== 0
          ? (
              (profilerSection.time / profilerSection.parent.time) *
              100
            ).toFixed(1)
          : '100%';
      const time = profilerSection.time.toFixed(2);
      outputs.push(sectionName + ': ' + time + 'ms (' + percent + ')');
      const subsectionsOutputs = [];
      for (const subsectionName in profilerSection.subsections) {
        if (profilerSection.subsections.hasOwnProperty(subsectionName)) {
          Profiler.getProfilerSectionTexts(
            subsectionName,
            profilerSection.subsections[subsectionName],
            subsectionsOutputs
          );
        }
      }
      outputs.push.apply(outputs, subsectionsOutputs);
    }
  }
}
