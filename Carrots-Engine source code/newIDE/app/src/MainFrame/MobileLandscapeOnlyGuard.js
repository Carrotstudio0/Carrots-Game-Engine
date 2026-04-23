// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import { useResponsiveWindowSize } from '../UI/Responsive/ResponsiveWindowMeasurer';

const styles = {
  overlay: {
    position: 'fixed',
    zIndex: 5000,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background:
      'linear-gradient(180deg, rgba(14, 18, 16, 0.97) 0%, rgba(11, 14, 13, 0.99) 100%)',
    backdropFilter: 'blur(3px)',
  },
  card: {
    width: 'min(540px, 100%)',
    borderRadius: 14,
    border: '1px solid rgba(255, 177, 92, 0.35)',
    background:
      'radial-gradient(120% 120% at 0% 0%, rgba(242, 140, 40, 0.2), rgba(0, 0, 0, 0)) #182019',
    boxShadow: '0 14px 40px rgba(0, 0, 0, 0.38)',
    padding: '18px 16px',
  },
  title: {
    margin: 0,
    color: '#ffe2bc',
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(255, 242, 226, 0.9)',
    fontSize: 15,
    lineHeight: 1.45,
  },
};

const lockLandscapeIfPossible = () => {
  if (typeof window === 'undefined') return;
  const orientationApi: any = window.screen && window.screen.orientation;
  if (!orientationApi || typeof orientationApi.lock !== 'function') return;

  const lockRequest = orientationApi.lock('landscape');
  if (lockRequest && typeof lockRequest.catch === 'function') {
    lockRequest.catch(() => {});
  }
};

const MobileLandscapeOnlyGuard = (): React.Node => {
  const { isMobile, isMediumScreen, isLandscape } = useResponsiveWindowSize();
  const shouldForceLandscape = isMobile || isMediumScreen;

  React.useEffect(
    () => {
      if (!shouldForceLandscape) return;
      lockLandscapeIfPossible();
    },
    [shouldForceLandscape]
  );

  if (!shouldForceLandscape || isLandscape) return null;

  return (
    <div style={styles.overlay} className="safe-area-aware-container">
      <div style={styles.card}>
        <h2 style={styles.title}>
          <Trans>Landscape mode required</Trans>
        </h2>
        <div style={styles.subtitle}>
          <Trans>
            Rotate your phone or tablet to landscape to continue using Carrots
            Engine.
          </Trans>
        </div>
      </div>
    </div>
  );
};

export default MobileLandscapeOnlyGuard;
