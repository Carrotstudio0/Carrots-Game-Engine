// @flow

const copyKnownMetadata = (source: any, error: Error): Error => {
  if (!source || typeof source !== 'object') {
    return error;
  }

  if (source.code && typeof source.code === 'string') {
    // $FlowFixMe[prop-missing]
    error.code = source.code;
  }
  if (typeof source.status === 'number') {
    // $FlowFixMe[prop-missing]
    error.status = source.status;
  }

  return error;
};

const getEventTargetUrl = (event: any): string => {
  const target = event && (event.target || event.currentTarget);
  if (!target || typeof target !== 'object') {
    return '';
  }

  if (typeof target.src === 'string' && target.src) {
    return target.src;
  }
  if (typeof target.href === 'string' && target.href) {
    return target.href;
  }

  return '';
};

export const normalizePreviewError = (
  errorLike: any,
  fallbackMessage: string = 'An unknown error happened while launching the preview.'
): Error => {
  if (errorLike instanceof Error) {
    return errorLike;
  }

  if (
    typeof ErrorEvent !== 'undefined' &&
    errorLike instanceof ErrorEvent
  ) {
    const nestedError =
      errorLike.error instanceof Error ? errorLike.error : null;
    const resourceUrl = getEventTargetUrl(errorLike);
    const message =
      nestedError?.message ||
      errorLike.message ||
      [
        'A script or resource failed while starting the preview.',
        resourceUrl ? `Resource: ${resourceUrl}.` : '',
      ]
        .filter(Boolean)
        .join(' ');

    const error = new Error(message || fallbackMessage);
    if (nestedError?.stack) {
      error.stack = nestedError.stack;
    }
    return copyKnownMetadata(nestedError || errorLike, error);
  }

  if (
    typeof ProgressEvent !== 'undefined' &&
    errorLike instanceof ProgressEvent
  ) {
    const resourceUrl = getEventTargetUrl(errorLike);
    return copyKnownMetadata(
      errorLike,
      new Error(
        [
          'A browser network request failed while starting the preview.',
          resourceUrl ? `Resource: ${resourceUrl}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      )
    );
  }

  if (typeof errorLike === 'string') {
    return new Error(errorLike || fallbackMessage);
  }

  if (errorLike && typeof errorLike === 'object') {
    const message =
      (typeof errorLike.message === 'string' && errorLike.message) ||
      (typeof errorLike.reason === 'string' && errorLike.reason) ||
      (errorLike.error &&
      typeof errorLike.error === 'object' &&
      typeof errorLike.error.message === 'string'
        ? errorLike.error.message
        : '') ||
      '';

    if (message && !/^\[object .*Event\]$/i.test(message)) {
      const error = new Error(message);
      if (
        errorLike.stack &&
        typeof errorLike.stack === 'string' &&
        !error.stack
      ) {
        error.stack = errorLike.stack;
      }
      return copyKnownMetadata(errorLike, error);
    }
  }

  return new Error(fallbackMessage);
};
