// @flow
import { Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';

import * as React from 'react';
import PropertiesEditor from '../../PropertiesEditor';
import propertiesMapToSchema from '../../PropertiesEditor/PropertiesMapToSchema';
import EmptyMessage from '../../UI/EmptyMessage';
import { type EditorProps } from './EditorProps.flow';
import { Line } from '../../UI/Grid';
import { getExtraObjectsInformation } from '../../Hints';
import { getObjectTutorialIds } from '../../Utils/GDevelopServices/Tutorial';
import AlertMessage from '../../UI/AlertMessage';
import { ColumnStackLayout, LineStackLayout } from '../../UI/Layout';
import RaisedButton from '../../UI/RaisedButton';
import Text from '../../UI/Text';
import ResourcesLoader from '../../ResourcesLoader';
import DismissableTutorialMessage from '../../Hints/DismissableTutorialMessage';

const gd: libGDevelop = global.gd;
const SOUND_EMITTER_3D_OBJECT_TYPE = 'Scene3D::SoundEmitterObject';

const clampNumber = (
  value: any,
  fallback: number,
  min: number,
  max: number
): number => {
  const numberValue =
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, numberValue));
};

type Props = EditorProps;

const ObjectPropertiesEditor = (props: Props): React.Node => {
  const {
    objectConfiguration,
    project,
    resourceManagementProps,
    projectScopedContainersAccessor,
    unsavedChanges,
    renderObjectNameField,
  } = props;

  // TODO: Workaround a bad design of ObjectJsImplementation. When getProperties
  // and associated methods are redefined in JS, they have different arguments (
  // see ObjectJsImplementation C++ implementation). If called directly here from JS,
  // the arguments will be mismatched. To workaround this, always cast the object to
  // a base gdObject to ensure C++ methods are called.
  const objectConfigurationAsGd = gd.castObject(
    // $FlowFixMe[incompatible-exact]
    objectConfiguration,
    gd.ObjectConfiguration
  );
  const properties = objectConfigurationAsGd.getProperties();

  const propertiesSchema = propertiesMapToSchema({
    properties,
    defaultValueProperties: null,
    getPropertyValue: (object, name) =>
      object
        .getProperties()
        .get(name)
        .getValue(),
    onUpdateProperty: (object, name, value) =>
      object.updateProperty(name, value),
  });

  const extraInformation = getExtraObjectsInformation()[
    objectConfigurationAsGd.getType()
  ];

  const tutorialIds = getObjectTutorialIds(objectConfigurationAsGd.getType());
  const is3DSoundEmitterObject =
    objectConfigurationAsGd.getType() === SOUND_EMITTER_3D_OBJECT_TYPE;

  const soundEmitterContent =
    is3DSoundEmitterObject && gd.ObjectJsImplementation
      ? gd.castObject(objectConfiguration, gd.ObjectJsImplementation).content ||
        {}
      : null;

  const soundResourceName =
    soundEmitterContent &&
    typeof soundEmitterContent.soundResourceName === 'string'
      ? soundEmitterContent.soundResourceName
      : '';
  const soundResourceUrl =
    soundResourceName && project.getResourcesManager().hasResource(soundResourceName)
      ? ResourcesLoader.getResourceFullUrl(project, soundResourceName, {})
      : null;
  const soundVolume = clampNumber(
    soundEmitterContent ? soundEmitterContent.volume : undefined,
    100,
    0,
    100
  );
  const soundPitch = clampNumber(
    soundEmitterContent ? soundEmitterContent.pitch : undefined,
    1,
    0.01,
    8
  );
  const soundLoop =
    soundEmitterContent && soundEmitterContent.loop !== undefined
      ? !!soundEmitterContent.loop
      : true;

  const [isAuditionPlaying, setIsAuditionPlaying] = React.useState(false);
  const [hasAuditionError, setHasAuditionError] = React.useState(false);
  const auditionAudioRef = React.useRef<?HTMLAudioElement>(null);
  const auditionAbortControllerRef = React.useRef<?AbortController>(null);
  const auditionUrlRef = React.useRef<?string>(null);

  const cleanupAuditionAudio = React.useCallback(() => {
    if (auditionAbortControllerRef.current) {
      auditionAbortControllerRef.current.abort();
      auditionAbortControllerRef.current = null;
    }

    const audio = auditionAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      auditionAudioRef.current = null;
    }

    auditionUrlRef.current = null;
    setIsAuditionPlaying(false);
  }, []);

  const startAudition = React.useCallback(() => {
    if (!soundResourceUrl) return;

    cleanupAuditionAudio();
    setHasAuditionError(false);

    const audio = new Audio(soundResourceUrl);
    audio.loop = soundLoop;
    audio.volume = soundVolume / 100;
    audio.playbackRate = soundPitch;

    const abortController = new AbortController();
    auditionAbortControllerRef.current = abortController;
    audio.addEventListener(
      'ended',
      () => {
        setIsAuditionPlaying(false);
      },
      { signal: abortController.signal }
    );
    audio.addEventListener(
      'error',
      () => {
        setIsAuditionPlaying(false);
        setHasAuditionError(true);
      },
      { signal: abortController.signal }
    );

    auditionAudioRef.current = audio;
    auditionUrlRef.current = soundResourceUrl;

    audio
      .play()
      .then(() => {
        setIsAuditionPlaying(true);
      })
      .catch(() => {
        setIsAuditionPlaying(false);
        setHasAuditionError(true);
      });
  }, [cleanupAuditionAudio, soundLoop, soundPitch, soundResourceUrl, soundVolume]);

  const toggleAudition = React.useCallback(() => {
    if (isAuditionPlaying) {
      cleanupAuditionAudio();
      return;
    }

    startAudition();
  }, [cleanupAuditionAudio, isAuditionPlaying, startAudition]);

  React.useEffect(
    () => () => {
      cleanupAuditionAudio();
    },
    [cleanupAuditionAudio]
  );

  React.useEffect(
    () => {
      if (!is3DSoundEmitterObject || !soundResourceUrl) {
        if (auditionAudioRef.current || isAuditionPlaying) {
          cleanupAuditionAudio();
        }
        if (hasAuditionError) {
          setHasAuditionError(false);
        }
        return;
      }

      const audio = auditionAudioRef.current;
      if (!audio) return;

      audio.loop = soundLoop;
      audio.volume = soundVolume / 100;
      audio.playbackRate = soundPitch;

      const auditionUrlChanged = auditionUrlRef.current !== soundResourceUrl;
      if (auditionUrlChanged) {
        if (isAuditionPlaying) {
          startAudition();
        } else {
          cleanupAuditionAudio();
        }
      }
    },
    [
      cleanupAuditionAudio,
      hasAuditionError,
      is3DSoundEmitterObject,
      isAuditionPlaying,
      soundLoop,
      soundPitch,
      soundResourceUrl,
      soundVolume,
      startAudition,
    ]
  );

  return (
    <I18n>
      {({ i18n }) => (
        <ColumnStackLayout noMargin>
          {renderObjectNameField && renderObjectNameField()}
          {tutorialIds.map(tutorialId => (
            <DismissableTutorialMessage
              key={tutorialId}
              tutorialId={tutorialId}
            />
          ))}
          {is3DSoundEmitterObject ? (
            <Line>
              <ColumnStackLayout noMargin>
                <LineStackLayout alignItems="center" noMargin>
                  <RaisedButton
                    primary
                    label={
                      isAuditionPlaying ? (
                        <Trans>Stop audition</Trans>
                      ) : (
                        <Trans>Audition in editor</Trans>
                      )
                    }
                    onClick={toggleAudition}
                    disabled={!soundResourceUrl}
                  />
                  <Text size="body-small" color="secondary" noMargin>
                    {soundResourceName ? (
                      soundResourceName
                    ) : (
                      <Trans>Select a sound file to audition.</Trans>
                    )}
                  </Text>
                </LineStackLayout>
                <Text size="body-small" color="secondary" noMargin>
                  <Trans>
                    Uses current volume, pitch and loop values without starting
                    scene preview.
                  </Trans>
                </Text>
                {hasAuditionError ? (
                  <AlertMessage kind="error">
                    <Trans>Unable to play this sound file.</Trans>
                  </AlertMessage>
                ) : null}
              </ColumnStackLayout>
            </Line>
          ) : null}
          {propertiesSchema.length ? (
            <React.Fragment>
              {extraInformation ? (
                <Line>
                  <ColumnStackLayout noMargin>
                    {extraInformation.map(({ kind, message }, index) => (
                      <AlertMessage kind={kind} key={index}>
                        {i18n._(message)}
                      </AlertMessage>
                    ))}
                  </ColumnStackLayout>
                </Line>
              ) : null}
              <PropertiesEditor
                unsavedChanges={unsavedChanges}
                schema={propertiesSchema}
                instances={[objectConfigurationAsGd]}
                project={project}
                resourceManagementProps={resourceManagementProps}
                projectScopedContainersAccessor={
                  projectScopedContainersAccessor
                }
              />
            </React.Fragment>
          ) : (
            <EmptyMessage>
              <Trans>
                There is nothing to configure for this object. You can still use
                events to interact with the object.
              </Trans>
            </EmptyMessage>
          )}
        </ColumnStackLayout>
      )}
    </I18n>
  );
};

export default ObjectPropertiesEditor;
