// @flow
import { Trans } from '@lingui/macro';

import * as React from 'react';
import RaisedButton from '../../UI/RaisedButton';
import MeasuresTable from './MeasuresTable';
import { type ProfilerOutput } from '..';
import EmptyMessage from '../../UI/EmptyMessage';
import { Line } from '../../UI/Grid';
import Background from '../../UI/Background';
import Text from '../../UI/Text';
import LinearProgress from '../../UI/LinearProgress';

const styles = {
  tableContainer: {
    flex: 1,
  },
  quickStatsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  quickStat: {
    padding: '6px 10px',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.06)',
    minWidth: 130,
    textAlign: 'center',
  },
  quickStatLabel: {
    opacity: 0.8,
    fontSize: 12,
  },
  quickStatValue: {
    fontWeight: 600,
    fontSize: 14,
  },
  hintsContainer: {
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
  },
  hintText: {
    fontSize: 12,
    opacity: 0.9,
  },
};

type Props = {|
  onStart: () => void,
  onStop: () => void,
  profilerOutput: ?ProfilerOutput,
  profilingInProgress: boolean,
|};

export default class Profiler extends React.Component<Props, void> {
  _formatNumber = (value: ?number, digits: number = 2): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'n/a';
    }
    return value.toFixed(digits);
  };

  render(): any {
    const { onStart, onStop, profilerOutput, profilingInProgress } = this.props;
    const profilerStats = profilerOutput ? profilerOutput.stats : null;
    const renderStats = profilerStats ? profilerStats.renderStats : null;
    const optimizationHints = profilerStats?.optimizationHints || [];

    return (
      <Background>
        <Line alignItems="center" justifyContent="center">
          {!profilingInProgress && profilerOutput && (
            <Text>
              <Trans>
                Last run collected on {profilerOutput.stats.framesCount} frames.
              </Trans>
            </Text>
          )}
          {!profilingInProgress && profilerOutput && (
            <RaisedButton label={<Trans>Restart</Trans>} onClick={onStart} />
          )}
          {!profilingInProgress && !profilerOutput && (
            <RaisedButton
              label={<Trans>Start profiling</Trans>}
              onClick={onStart}
            />
          )}
          {profilingInProgress && (
            <RaisedButton
              label={<Trans>Stop profiling</Trans>}
              onClick={onStop}
            />
          )}
        </Line>
        {!profilingInProgress && profilerStats && (
          <div style={styles.quickStatsContainer}>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>Avg frame</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(profilerStats.averageFrameTimeMs)} ms
              </Text>
            </div>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>P95 frame</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(profilerStats.percentile95FrameTimeMs)} ms
              </Text>
            </div>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>Avg FPS</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(profilerStats.averageFps, 1)}
              </Text>
            </div>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>Draw calls (avg / max)</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(renderStats?.averageDrawCalls, 0)} /{' '}
                {this._formatNumber(renderStats?.maxDrawCalls, 0)}
              </Text>
            </div>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>Triangles (avg / max)</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(renderStats?.averageTriangles, 0)} /{' '}
                {this._formatNumber(renderStats?.maxTriangles, 0)}
              </Text>
            </div>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>Shader programs</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(renderStats?.averageShaderPrograms, 0)}
              </Text>
            </div>
            <div style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>Textures / Geometries</Text>
              <Text style={styles.quickStatValue}>
                {this._formatNumber(renderStats?.averageTextures, 0)} /{' '}
                {this._formatNumber(renderStats?.averageGeometries, 0)}
              </Text>
            </div>
          </div>
        )}
        {!profilingInProgress && optimizationHints.length > 0 && (
          <div style={styles.hintsContainer}>
            {optimizationHints.map((hint, index) => (
              <Text key={index} style={styles.hintText}>
                {`- ${hint}`}
              </Text>
            ))}
          </div>
        )}
        {profilingInProgress && (
          <Line alignItems="center">
            <LinearProgress />
          </Line>
        )}
        <div style={styles.tableContainer}>
          {profilerOutput && (
            <MeasuresTable
              profilerMeasures={profilerOutput.framesAverageMeasures}
            />
          )}
          {!profilerOutput && (
            <EmptyMessage>
              <Trans>
                Start profiling and then stop it after a few seconds to see the
                results.
              </Trans>
            </EmptyMessage>
          )}
        </div>
      </Background>
    );
  }
}
