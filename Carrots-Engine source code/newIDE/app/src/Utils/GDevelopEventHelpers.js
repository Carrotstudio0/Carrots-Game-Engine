// @flow

const warnedInvalidEventAccesses = new Set<string>();

const getErrorMessage = (error: mixed): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && error.message) {
    return String(error.message);
  }

  try {
    return String(error);
  } catch (conversionError) {
    return 'Unknown error';
  }
};

const shouldTreatAsInvalidEventPointer = (errorMessage: string): boolean => {
  const normalizedErrorMessage = errorMessage.toLowerCase();

  return (
    normalizedErrorMessage.includes(
      'null function or function signature mismatch'
    ) ||
    normalizedErrorMessage.includes('cannot pass deleted object as a pointer') ||
    normalizedErrorMessage.includes('bindingerror') ||
    normalizedErrorMessage.includes('deleted object')
  );
};

const reportInvalidEventAccess = (
  methodName: string,
  error: mixed
): boolean => {
  const errorMessage = getErrorMessage(error);
  if (!shouldTreatAsInvalidEventPointer(errorMessage)) {
    throw error;
  }

  const warningKey = `${methodName}:${errorMessage}`;
  if (!warnedInvalidEventAccesses.has(warningKey)) {
    warnedInvalidEventAccesses.add(warningKey);
    console.warn(
      `[Events] Ignoring stale/invalid event reference while calling "${methodName}".`,
      error
    );
  }

  return true;
};

export const safeCanHaveSubEvents = (event: ?gdBaseEvent): boolean => {
  if (!event) return false;

  try {
    return event.canHaveSubEvents();
  } catch (error) {
    reportInvalidEventAccess('canHaveSubEvents', error);
    return false;
  }
};

export const safeCanHaveVariables = (event: ?gdBaseEvent): boolean => {
  if (!event) return false;

  try {
    return event.canHaveVariables();
  } catch (error) {
    reportInvalidEventAccess('canHaveVariables', error);
    return false;
  }
};

export const safeGetSubEvents = (event: ?gdBaseEvent): ?gdEventsList => {
  if (!safeCanHaveSubEvents(event)) return null;

  try {
    return event.getSubEvents();
  } catch (error) {
    reportInvalidEventAccess('getSubEvents', error);
    return null;
  }
};
