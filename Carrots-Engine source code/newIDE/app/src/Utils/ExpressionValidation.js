// @flow

export const getRequiredExpressionErrorText = (
  expressionType: 'number' | 'string'
): string =>
  expressionType === 'string'
    ? 'You must enter a text (between quotes) or a valid expression call.'
    : 'You must enter a number or a valid expression call.';

export const isExpressionParameterType = (parameterType: string): boolean =>
  parameterType === 'expression' ||
  parameterType === 'number' ||
  parameterType === 'string';

export const isMissingRequiredExpressionValue = ({
  parameterType,
  parameterMetadata,
  value,
}: {|
  parameterType: string,
  parameterMetadata: ?gdParameterMetadata,
  value: string,
|}): boolean => {
  if (!isExpressionParameterType(parameterType)) {
    return false;
  }

  if (parameterMetadata) {
    if (parameterMetadata.isOptional()) {
      return false;
    }

    if (parameterMetadata.getDefaultValue() !== '') {
      return false;
    }
  }

  return value.trim() === '';
};
