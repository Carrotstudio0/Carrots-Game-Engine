// @flow
import * as React from 'react';
import SemiControlledTextField, {
  type SemiControlledTextFieldInterface,
} from '../../UI/SemiControlledTextField';
import {
  type ParameterFieldProps,
  type ParameterFieldInterface,
  type FieldFocusFunction,
} from './ParameterFieldCommons';
import { type ParameterInlineRendererProps } from './ParameterInlineRenderer.flow';
import { isMissingRequiredExpressionValue } from '../../Utils/ExpressionValidation';

export default (React.forwardRef<ParameterFieldProps, ParameterFieldInterface>(
  function DefaultField(props: ParameterFieldProps, ref) {
    const field = React.useRef<?SemiControlledTextFieldInterface>(null);
    const focus: FieldFocusFunction = options => {
      if (field.current) field.current.focus(options);
    };
    React.useImperativeHandle(ref, () => ({
      focus,
    }));

    const { parameterMetadata } = props;
    const description = parameterMetadata
      ? parameterMetadata.getDescription()
      : undefined;

    return (
      <SemiControlledTextField
        margin={props.isInline ? 'none' : 'dense'}
        commitOnBlur
        value={props.value}
        floatingLabelText={description}
        helperMarkdownText={
          parameterMetadata ? parameterMetadata.getLongDescription() : undefined
        }
        onChange={(text: string) => props.onChange(text)}
        ref={field}
        fullWidth
      />
    );
  }
): React.ComponentType<{
  ...ParameterFieldProps,
  +ref?: React.RefSetter<ParameterFieldInterface>,
}>);

export const renderInlineDefaultField = ({
  value,
  expressionIsValid,
  hasDeprecationWarning,
  parameterMetadata,
  InvalidParameterValue,
  DeprecatedParameterValue,
  MissingParameterValue,
}: ParameterInlineRendererProps): string | React.MixedElement => {
  const parameterType = parameterMetadata.getType();
  const hasDefaultValue = parameterMetadata.getDefaultValue() !== '';
  if (
    isMissingRequiredExpressionValue({
      parameterType,
      parameterMetadata,
      value,
    }) ||
    (value === '' &&
      !parameterMetadata.isOptional() &&
      !hasDefaultValue)
  ) {
    return <MissingParameterValue />;
  }
  if (!expressionIsValid) {
    return <InvalidParameterValue>{value}</InvalidParameterValue>;
  }
  if (hasDeprecationWarning) {
    return <DeprecatedParameterValue>{value}</DeprecatedParameterValue>;
  }
  return value;
};
