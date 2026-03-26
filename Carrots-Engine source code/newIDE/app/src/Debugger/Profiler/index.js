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
  summaryLine: {
    padding: '0 8px',
  },
  tableContainer: {
    flex: 1,
  },
};

type Props = {|
  onStart: () => void,
  onStop: () => void,
  profilerOutput: ?ProfilerOutput,
  profilingInProgress: boolean,
|};

const getSubsectionTime = (
  profilerOutput: ProfilerOutput,
  sectionName: string
): number => {
  const subsection = profilerOutput.framesAverageMeasures.subsections[sectionName];
  return subsection && subsection.time ? subsection.time : 0;
};

export default class Profiler extends React.Component<Props, void> {
  render(): any {
    const { onStart, onStop, profilerOutput, profilingInProgress } = this.props;
    const averageFrameTime =
      profilerOutput && profilerOutput.framesAverageMeasures.time
        ? profilerOutput.framesAverageMeasures.time
        : 0;
    const estimatedFps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;
    const eventsTime = profilerOutput
      ? getSubsectionTime(profilerOutput, 'events')
      : 0;
    const renderTime = profilerOutput
      ? getSubsectionTime(profilerOutput, 'render')
      : 0;
    const eventsPercent =
      averageFrameTime > 0 ? (eventsTime / averageFrameTime) * 100 : 0;
    const renderPercent =
      averageFrameTime > 0 ? (renderTime / averageFrameTime) * 100 : 0;

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
        {!profilingInProgress && profilerOutput && (
          <Line
            alignItems="center"
            justifyContent="center"
            style={styles.summaryLine}
          >
            <Text noMargin>
              <Trans>
                Average frame: {averageFrameTime.toFixed(2)}ms (
                {estimatedFps.toFixed(1)} FPS)
              </Trans>
            </Text>
            <Text noMargin>
              <Trans>
                Events: {eventsTime.toFixed(2)}ms ({eventsPercent.toFixed(1)}%)
              </Trans>
            </Text>
            <Text noMargin>
              <Trans>
                Render: {renderTime.toFixed(2)}ms ({renderPercent.toFixed(1)}%)
              </Trans>
            </Text>
          </Line>
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
