/*
 * GDevelop JS Platform
 * Copyright 2008-2016 Florian Rival (Florian.Rival@gmail.com). All rights
 * reserved. This project is released under the MIT License.
 */
#include "GDJS/IDE/ExporterHelper.h"

#if defined(EMSCRIPTEN)
#include <emscripten.h>
#endif
#include <algorithm>
#include <array>
#include <fstream>
#include <functional>
#include <set>
#include <sstream>
#include <streambuf>
#include <string>

#include "GDCore/CommonTools.h"
#include "GDCore/Events/CodeGeneration/DiagnosticReport.h"
#include "GDCore/Events/CodeGeneration/EffectsCodeGenerator.h"
#include "GDCore/Extensions/Metadata/DependencyMetadata.h"
#include "GDCore/Extensions/Metadata/MetadataProvider.h"
#include "GDCore/Extensions/Metadata/InGameEditorResourceMetadata.h"
#include "GDCore/Extensions/Platform.h"
#include "GDCore/Extensions/PlatformExtension.h"
#include "GDCore/IDE/AbstractFileSystem.h"
#include "GDCore/IDE/CaptureOptions.h"
#include "GDCore/IDE/Events/UsedExtensionsFinder.h"
#include "GDCore/IDE/ExportedDependencyResolver.h"
#include "GDCore/IDE/Project/ProjectResourcesCopier.h"
#include "GDCore/IDE/Project/ResourcesMergingHelper.h"
#include "GDCore/IDE/Project/SceneResourcesFinder.h"
#include "GDCore/IDE/ProjectStripper.h"
#include "GDCore/IDE/ResourceExposer.h"
#include "GDCore/IDE/SceneNameMangler.h"
#include "GDCore/Project/EventsBasedObject.h"
#include "GDCore/Project/EventsBasedObjectVariant.h"
#include "GDCore/Project/EventsFunctionsExtension.h"
#include "GDCore/Project/ExternalEvents.h"
#include "GDCore/Project/ExternalLayout.h"
#include "GDCore/Project/Layout.h"
#include "GDCore/Project/Project.h"
#include "GDCore/Project/PropertyDescriptor.h"
#include "GDCore/Serialization/Serializer.h"
#include "GDCore/Tools/Localization.h"
#include "GDCore/Tools/Log.h"
#include "GDJS/Events/CodeGeneration/LayoutCodeGenerator.h"
#include "GDJS/Extensions/JsPlatform.h"
#undef CopyFile  // Disable an annoying macro

namespace {
double GetTimeNow() {
#if defined(EMSCRIPTEN)
  double currentTime = emscripten_get_now();
  return currentTime;
#else
  return 0;
#endif
}
double GetTimeSpent(double previousTime) { return GetTimeNow() - previousTime; }
double LogTimeSpent(const gd::String &name, double previousTime) {
  gd::LogStatus(name + " took " + gd::String::From(GetTimeSpent(previousTime)) +
                "ms");
  return GetTimeNow();
}
}  // namespace

namespace gdjs {

static void InsertUnique(std::vector<gd::String> &container, gd::String str) {
  if (std::find(container.begin(), container.end(), str) == container.end())
    container.push_back(str);
}

static void InsertUniqueFirst(std::vector<gd::String> &container, gd::String str) {
  if (std::find(container.begin(), container.end(), str) == container.end())
    container.insert(container.begin(), str);
}

static gd::String CleanProjectName(gd::String projectName) {
  gd::String partiallyCleanedProjectName = projectName;

  static const gd::String forbiddenFileNameCharacters =
      "\\/:*?\"<>|";  // See
                      // https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file

  for (size_t i = 0; i < partiallyCleanedProjectName.size();) {
    // Delete all characters that are not allowed in a filename
    if (forbiddenFileNameCharacters.find(partiallyCleanedProjectName[i]) !=
        gd::String::npos) {
      partiallyCleanedProjectName.erase(i, 1);
    } else {
      i++;
    }
  }

  if (partiallyCleanedProjectName.empty())
    partiallyCleanedProjectName = "Project";

  return partiallyCleanedProjectName;
}

constexpr const char kTypeScriptProjectScriptsExtensionName[] = "GDevelopEditor";
constexpr const char kTypeScriptProjectScriptsPropertyName[] =
    "typeScriptProjectScripts";

static gd::String MakeSafeFileNamePart(const gd::String &value,
                                       const gd::String &fallback) {
  gd::String sanitized;
  sanitized.reserve(value.Raw().size());

  for (char character : value.Raw()) {
    const bool isLowercaseLetter = character >= 'a' && character <= 'z';
    const bool isUppercaseLetter = character >= 'A' && character <= 'Z';
    const bool isDigit = character >= '0' && character <= '9';
    if (isLowercaseLetter || isUppercaseLetter || isDigit ||
        character == '-' || character == '_') {
      sanitized += character;
    } else {
      sanitized += '-';
    }
  }

  sanitized = sanitized.Trim("-");
  if (sanitized.empty()) return fallback;
  return sanitized;
}

static bool EndsWith(const std::string &value, const std::string &suffix) {
  return value.size() >= suffix.size() &&
         value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

static gd::String NormalizeTypeScriptModuleId(gd::String moduleId,
                                              const gd::String &fallback) {
  gd::String normalizedModuleId = moduleId.FindAndReplace("\\", "/").Trim();
  while (normalizedModuleId.size() >= 2 &&
         normalizedModuleId[0] == '.' &&
         normalizedModuleId[1] == '/') {
    normalizedModuleId = normalizedModuleId.substr(2);
  }
  if (normalizedModuleId.size() >= 1 && normalizedModuleId[0] == '/') {
    normalizedModuleId = normalizedModuleId.substr(1);
  }

  if (normalizedModuleId.empty()) {
    normalizedModuleId = fallback;
  }

  const std::string rawModuleId = normalizedModuleId.Raw();
  if (!EndsWith(rawModuleId, ".ts") &&
      !EndsWith(rawModuleId, ".tsx") &&
      !EndsWith(rawModuleId, ".js") &&
      !EndsWith(rawModuleId, ".jsx") &&
      !EndsWith(rawModuleId, ".mjs") &&
      !EndsWith(rawModuleId, ".cjs")) {
    normalizedModuleId += ".ts";
  }

  return normalizedModuleId;
}

static gd::String AsJsonStringLiteral(const gd::String &value) {
  return gd::Serializer::ToJSON(gd::SerializerElement(value));
}

ExporterHelper::ExporterHelper(gd::AbstractFileSystem &fileSystem,
                               gd::String gdjsRoot_,
                               gd::String codeOutputDir_)
    : fs(fileSystem), gdjsRoot(gdjsRoot_), codeOutputDir(codeOutputDir_) {};

bool ExporterHelper::ExportProjectForPixiPreview(
    const PreviewExportOptions &options,
    std::vector<gd::String> &includesFiles) {

  if (options.isInGameEdition && !options.shouldReloadProjectData &&
      !options.shouldReloadLibraries && !options.shouldGenerateScenesEventsCode &&
      !options.shouldClearExportFolder) {
    gd::LogStatus("Skip project export entirely");
    return "";
  }

  double previousTime = GetTimeNow();
  fs.MkDir(options.exportPath);
  if (options.shouldClearExportFolder) {
    fs.ClearDir(options.exportPath);
  }
  includesFiles.clear();
  std::vector<gd::String> resourcesFiles;

  std::vector<gd::InGameEditorResourceMetadata> inGameEditorResources;

  // TODO Try to remove side effects to avoid the copy
  // that destroys the AST in cache.
  gd::Project exportedProject = options.project;
  const gd::Project &immutableProject = options.project;
  previousTime = LogTimeSpent("Project cloning", previousTime);

  if (options.isInGameEdition) {
    if (options.shouldReloadProjectData ||
        options.shouldGenerateScenesEventsCode ||
        options.shouldClearExportFolder) {
      auto projectDirectory = fs.DirNameFrom(exportedProject.GetProjectFile());
      gd::ResourcesMergingHelper resourcesMergingHelper(
          exportedProject.GetResourcesManager(), fs);
      resourcesMergingHelper.SetBaseDirectory(projectDirectory);
      resourcesMergingHelper.SetShouldUseOriginalAbsoluteFilenames();
      gd::ResourceExposer::ExposeWholeProjectResources(exportedProject,
                                                        resourcesMergingHelper);

      previousTime = LogTimeSpent("Resource path resolving", previousTime);
    }
    gd::LogStatus("Resource export is skipped");
  } else {
    // Export resources (*before* generating events as some resources filenames
    // may be updated)
    ExportResources(fs, exportedProject, options.exportPath);

    previousTime = LogTimeSpent("Resource export", previousTime);
  }

  if (options.shouldReloadProjectData ||
      options.shouldGenerateScenesEventsCode ||
      options.shouldClearExportFolder) {
    // Compatibility with GD <= 5.0-beta56
    // Stay compatible with text objects declaring their font as just a filename
    // without a font resource - by manually adding these resources.
    AddDeprecatedFontFilesToFontResources(
        fs, exportedProject.GetResourcesManager(), options.exportPath);
    // end of compatibility code
  }

  std::vector<gd::SourceFileMetadata> noUsedSourceFiles;
  std::vector<gd::SourceFileMetadata> &usedSourceFiles = noUsedSourceFiles;
  if (options.shouldReloadLibraries || options.shouldClearExportFolder) {
    auto usedExtensionsResult =
        gd::UsedExtensionsFinder::ScanProject(exportedProject);
    usedSourceFiles = usedExtensionsResult.GetUsedSourceFiles();

    // Export engine libraries
    AddLibsInclude(/*pixiRenderers=*/true,
                  /*pixiInThreeRenderers=*/
                  usedExtensionsResult.Has3DObjects() ||
                      immutableProject.GetUpscalingMode() == "fsr1",
                  /*isInGameEdition=*/
                  options.isInGameEdition,
                  /*includeWebsocketDebuggerClient=*/
                  !options.websocketDebuggerServerAddress.empty(),
                  /*includeWindowMessageDebuggerClient=*/
                  options.useWindowMessageDebuggerClient,
                  /*includeMinimalDebuggerClient=*/
                  options.useMinimalDebuggerClient,
                  /*includeCaptureManager=*/
                  !options.captureOptions.IsEmpty(),
                  /*includeInAppTutorialMessage*/
                  !options.inAppTutorialMessageInPreview.empty(),
                  immutableProject.GetLoadingScreen().GetGDevelopLogoStyle(),
                  includesFiles);

    // Export files for free function, object and behaviors
    for (const auto &includeFile : usedExtensionsResult.GetUsedIncludeFiles()) {
      InsertUnique(includesFiles, includeFile);
    }
    for (const auto &requiredFile : usedExtensionsResult.GetUsedRequiredFiles()) {
      InsertUnique(resourcesFiles, requiredFile);
    }

    if (options.isInGameEdition) {
      // List the in-game editor resources used by the project, so they can
      // be later included in the exported project resources.
      for (const auto &inGameEditorResource : usedExtensionsResult.GetUsedInGameEditorResources()) {
        inGameEditorResources.push_back(inGameEditorResource);

        // Always use absolute paths for in-game editor resources.
        // There are not copied and instead directly refer to the file in the Runtime folder.
        gd::String resourceFile = inGameEditorResource.GetFilePath();
        if (!fs.IsAbsolute(resourceFile)) {
          fs.MakeAbsolute(resourceFile, gdjsRoot + "/Runtime");
        }
        inGameEditorResources.back().SetFilePath(resourceFile);
      }

      // TODO Scan the objects and events of event-based objects
      // (it could be an alternative method ScanProjectAndEventsBasedObjects in
      // UsedExtensionsFinder).
      // This is already done by UsedExtensionsFinder, but maybe it shouldn't.

      // Export all event-based objects because they can be edited even if they
      // are not used yet.
      for (std::size_t e = 0;
           e < exportedProject.GetEventsFunctionsExtensionsCount(); e++) {
        auto &eventsFunctionsExtension =
            exportedProject.GetEventsFunctionsExtension(e);

        for (auto &&eventsBasedObjectUniquePtr :
             eventsFunctionsExtension.GetEventsBasedObjects()
                 .GetInternalVector()) {
          auto eventsBasedObject = eventsBasedObjectUniquePtr.get();

          auto metadata = gd::MetadataProvider::GetExtensionAndObjectMetadata(
              exportedProject.GetCurrentPlatform(),
              gd::PlatformExtension::GetObjectFullType(
                  eventsFunctionsExtension.GetName(),
                  eventsBasedObject->GetName()));
          for (auto &&includeFile : metadata.GetMetadata().includeFiles) {
            InsertUnique(includesFiles, includeFile);
          }
          for (auto &behaviorType :
               metadata.GetMetadata().GetDefaultBehaviors()) {
            auto behaviorMetadata =
                gd::MetadataProvider::GetExtensionAndBehaviorMetadata(
                    exportedProject.GetCurrentPlatform(), behaviorType);
            for (auto &&includeFile :
                 behaviorMetadata.GetMetadata().includeFiles) {
              InsertUnique(includesFiles, includeFile);
            }
          }
        }
      }
    }

    // Export effects (after engine libraries as they auto-register themselves to
    // the engine)
    ExportEffectIncludes(exportedProject, includesFiles);

    previousTime = LogTimeSpent("Include files export", previousTime);
  }
  else {
    gd::LogStatus("Include files export is skipped");
  }

  if (options.shouldGenerateScenesEventsCode) {
    gd::WholeProjectDiagnosticReport &wholeProjectDiagnosticReport =
        options.project.GetWholeProjectDiagnosticReport();
    wholeProjectDiagnosticReport.Clear();

    // Generate events code
    if (!ExportScenesEventsCode(immutableProject,
                          codeOutputDir,
                          includesFiles,
                          wholeProjectDiagnosticReport,
                          true)) {
      return false;
    }
    previousTime = LogTimeSpent("Events code export", previousTime);
  }
  else {
    gd::LogStatus("Events code export is skipped");
  }

  if (options.shouldReloadLibraries || options.shouldClearExportFolder) {
    if (!ExportTypeScriptProjectScripts(immutableProject,
                                        codeOutputDir,
                                        includesFiles)) {
      return false;
    }
  }

  if (options.shouldReloadProjectData || options.shouldClearExportFolder) {

    if (options.fullLoadingScreen) {
      // Use project properties fallback to set empty properties
      if (exportedProject.GetAuthorIds().empty() &&
          !options.fallbackAuthorId.empty()) {
        exportedProject.GetAuthorIds().push_back(options.fallbackAuthorId);
      }
      if (exportedProject.GetAuthorUsernames().empty() &&
          !options.fallbackAuthorUsername.empty()) {
        exportedProject.GetAuthorUsernames().push_back(
            options.fallbackAuthorUsername);
      }
    } else {
      // Most of the time, we skip the logo and minimum duration so that
      // the preview start as soon as possible.
      exportedProject.GetLoadingScreen()
          .ShowGDevelopLogoDuringLoadingScreen(false)
          .SetMinDuration(0);
      exportedProject.GetWatermark().ShowGDevelopWatermark(false);
    }

    gd::SerializerElement runtimeGameOptions;
    ExporterHelper::SerializeRuntimeGameOptions(fs, gdjsRoot, options,
                                                    includesFiles, runtimeGameOptions);
    ExportProjectData(fs, exportedProject, codeOutputDir + "/data.js",
                      runtimeGameOptions, options.isInGameEdition,
                      inGameEditorResources);

    previousTime = LogTimeSpent("Project data export", previousTime);
  }
  else {
    gd::LogStatus("Project data export is skipped");
  }

  if (options.shouldReloadLibraries || options.shouldClearExportFolder) {
    includesFiles.push_back(codeOutputDir + "/data.js");
    // Copy all the dependencies and their source maps
    ExportIncludesAndLibs(includesFiles, options.exportPath, true);
    ExportIncludesAndLibs(resourcesFiles, options.exportPath, true);

    // TODO Build a full includesFiles list without actually doing export or
    // generation.
    if (options.shouldGenerateScenesEventsCode || options.shouldClearExportFolder) {
      // Create the index file
      if (!ExportIndexFile(exportedProject, gdjsRoot + "/Runtime/index.html",
                           options.exportPath, includesFiles, usedSourceFiles,
                           options.nonRuntimeScriptsCacheBurst,
                           "gdjs.runtimeGameOptions")) {
        return false;
      }
    }
    previousTime = LogTimeSpent("Include and libs export", previousTime);
  } else {
    gd::LogStatus("Include and libs export is skipped");
  }

  return true;
}

gd::String ExporterHelper::ExportProjectData(
    gd::AbstractFileSystem &fs, gd::Project &project, gd::String filename,
    const gd::SerializerElement &runtimeGameOptions, bool isInGameEdition,
    const std::vector<gd::InGameEditorResourceMetadata> &inGameEditorResources) {
  fs.MkDir(fs.DirNameFrom(filename));

  gd::SerializerElement projectDataElement;
  ExporterHelper::StripAndSerializeProjectData(project, projectDataElement,
                                                isInGameEdition,
                                                inGameEditorResources);

  // Save the project to JSON
  gd::String output =
      "gdjs.projectData = " + gd::Serializer::ToJSON(projectDataElement) +
      ";\ngdjs.runtimeGameOptions = " + gd::Serializer::ToJSON(runtimeGameOptions) +
      ";\n";

  if (!fs.WriteToFile(filename, output))
    return "Unable to write " + filename;

  return "";
}

void ExporterHelper::SerializeRuntimeGameOptions(
    gd::AbstractFileSystem &fs, const gd::String &gdjsRoot,
    const PreviewExportOptions &options, std::vector<gd::String> &includesFiles,
    gd::SerializerElement &runtimeGameOptions) {
  // Create the setup options passed to the gdjs.RuntimeGame
  runtimeGameOptions.AddChild("isPreview").SetBoolValue(true);

  auto &initialRuntimeGameStatus =
      runtimeGameOptions.AddChild("initialRuntimeGameStatus");
  initialRuntimeGameStatus.AddChild("sceneName")
      .SetStringValue(options.layoutName);
  if (options.isInGameEdition) {
    initialRuntimeGameStatus.AddChild("isInGameEdition").SetBoolValue(true);
    initialRuntimeGameStatus.AddChild("editorId").SetValue(options.editorId);
    if (!options.editorCamera3DCameraMode.empty()) {
      auto &editorCamera3D =
          initialRuntimeGameStatus.AddChild("editorCamera3D");
      editorCamera3D.AddChild("cameraMode").SetStringValue(
          options.editorCamera3DCameraMode);
      editorCamera3D.AddChild("positionX")
          .SetDoubleValue(options.editorCamera3DPositionX);
      editorCamera3D.AddChild("positionY")
          .SetDoubleValue(options.editorCamera3DPositionY);
      editorCamera3D.AddChild("positionZ")
          .SetDoubleValue(options.editorCamera3DPositionZ);
      editorCamera3D.AddChild("rotationAngle")
          .SetDoubleValue(options.editorCamera3DRotationAngle);
      editorCamera3D.AddChild("elevationAngle")
          .SetDoubleValue(options.editorCamera3DElevationAngle);
      editorCamera3D.AddChild("distance")
          .SetDoubleValue(options.editorCamera3DDistance);
    }
  }
  if (!options.externalLayoutName.empty()) {
    initialRuntimeGameStatus.AddChild("injectedExternalLayoutName")
        .SetValue(options.externalLayoutName);

    if (options.isInGameEdition) {
      initialRuntimeGameStatus.AddChild("skipCreatingInstancesFromScene")
          .SetBoolValue(true);
    }
  }
  if (!options.eventsBasedObjectType.empty()) {
    initialRuntimeGameStatus.AddChild("eventsBasedObjectType")
        .SetValue(options.eventsBasedObjectType);
    initialRuntimeGameStatus.AddChild("eventsBasedObjectVariantName")
        .SetValue(options.eventsBasedObjectVariantName);
  }

  if (!options.inGameEditorSettingsJson.empty()) {
    runtimeGameOptions.AddChild("inGameEditorSettings") =
        gd::Serializer::FromJSON(options.inGameEditorSettingsJson);
  }

  runtimeGameOptions.AddChild("shouldReloadLibraries")
      .SetBoolValue(options.shouldReloadLibraries);
  runtimeGameOptions.AddChild("shouldGenerateScenesEventsCode")
      .SetBoolValue(options.shouldGenerateScenesEventsCode);

  runtimeGameOptions.AddChild("nativeMobileApp")
      .SetBoolValue(options.nativeMobileApp);
  runtimeGameOptions.AddChild("websocketDebuggerServerAddress")
      .SetStringValue(options.websocketDebuggerServerAddress);
  runtimeGameOptions.AddChild("websocketDebuggerServerPort")
      .SetStringValue(options.websocketDebuggerServerPort);
  runtimeGameOptions.AddChild("electronRemoteRequirePath")
      .SetStringValue(options.electronRemoteRequirePath);
  if (options.isDevelopmentEnvironment) {
    runtimeGameOptions.AddChild("environment").SetStringValue("dev");
  }
  if (!options.gdevelopResourceToken.empty()) {
    runtimeGameOptions.AddChild("gdevelopResourceToken")
        .SetStringValue(options.gdevelopResourceToken);
  }
  runtimeGameOptions.AddChild("allowAuthenticationUsingIframeForPreview")
      .SetBoolValue(options.allowAuthenticationUsingIframeForPreview);
  if (!options.playerId.empty() && !options.playerToken.empty()) {
    runtimeGameOptions.AddChild("playerUsername")
        .SetStringValue(options.playerUsername);
    runtimeGameOptions.AddChild("playerId").SetStringValue(options.playerId);
    runtimeGameOptions.AddChild("playerToken")
        .SetStringValue(options.playerToken);
  }
  if (!options.inAppTutorialMessageInPreview.empty()) {
    runtimeGameOptions.AddChild("inAppTutorialMessageInPreview")
        .SetStringValue(options.inAppTutorialMessageInPreview);
    runtimeGameOptions.AddChild("inAppTutorialMessagePositionInPreview")
        .SetStringValue(options.inAppTutorialMessagePositionInPreview);
  }
  if (!options.crashReportUploadLevel.empty()) {
    runtimeGameOptions.AddChild("crashReportUploadLevel")
        .SetStringValue(options.crashReportUploadLevel);
  }
  if (!options.previewContext.empty()) {
    runtimeGameOptions.AddChild("previewContext")
        .SetStringValue(options.previewContext);
  }
  runtimeGameOptions.AddChild("gdevelopVersionWithHash")
      .SetStringValue(options.gdevelopVersionWithHash);
  if (!options.projectTemplateSlug.empty()) {
    runtimeGameOptions.AddChild("projectTemplateSlug")
        .SetStringValue(options.projectTemplateSlug);
  }
  if (!options.sourceGameId.empty()) {
    runtimeGameOptions.AddChild("sourceGameId")
        .SetStringValue(options.sourceGameId);
  }

  if (!options.captureOptions.IsEmpty()) {
    auto &captureOptionsElement = runtimeGameOptions.AddChild("captureOptions");
    const auto &screenshots = options.captureOptions.GetScreenshots();
    if (!screenshots.empty()) {
      auto &screenshotsElement = captureOptionsElement.AddChild("screenshots");
      screenshotsElement.ConsiderAsArrayOf("screenshot");
      for (const auto &screenshot : screenshots) {
        screenshotsElement.AddChild("screenshot")
            .SetIntAttribute("delayTimeInSeconds",
                             screenshot.GetDelayTimeInSeconds())
            .SetStringAttribute("signedUrl", screenshot.GetSignedUrl())
            .SetStringAttribute("publicUrl", screenshot.GetPublicUrl());
      }
    }
  }

  // Pass in the options the list of scripts files - useful for hot-reloading.
  // If includeFiles is empty, it means that the include files have not been
  // generated, so do not even add them to the runtime game options, so the
  // hot-reloader will not try to reload them.
  if (!includesFiles.empty()) {
    auto &scriptFilesElement = runtimeGameOptions.AddChild("scriptFiles");
    scriptFilesElement.ConsiderAsArrayOf("scriptFile");

    for (const auto &includeFile : includesFiles) {
      auto hashIt = options.includeFileHashes.find(includeFile);
      gd::String scriptSrc = GetExportedIncludeFilename(fs, gdjsRoot, includeFile);
      scriptFilesElement.AddChild("scriptFile")
          .SetStringAttribute("path", scriptSrc)
          .SetIntAttribute(
              "hash",
              hashIt != options.includeFileHashes.end() ? hashIt->second : 0);
    }
  }
}

void ExporterHelper::AddInGameEditorResources(
    gd::Project &project,
    std::set<gd::String> &projectUsedResources,
    const std::vector<gd::InGameEditorResourceMetadata> &inGameEditorResources) {
  for (const auto &inGameEditorResource : inGameEditorResources) {
    project.GetResourcesManager().AddResource(
        inGameEditorResource.GetResourceName(),
        inGameEditorResource.GetFilePath(),
        inGameEditorResource.GetKind());
    projectUsedResources.insert(inGameEditorResource.GetResourceName());
  }
}

void ExporterHelper::SerializeProjectData(gd::AbstractFileSystem &fs,
                                          const gd::Project &project,
                                          const PreviewExportOptions &options,
                                          gd::SerializerElement &rootElement,
                                          const std::vector<gd::InGameEditorResourceMetadata> &inGameEditorResources) {
  gd::Project clonedProject = project;

  // Replace all resource file paths with the one used in exported projects.
  auto projectDirectory = fs.DirNameFrom(project.GetProjectFile());
  gd::ResourcesMergingHelper resourcesMergingHelper(
      clonedProject.GetResourcesManager(), fs);
  resourcesMergingHelper.SetBaseDirectory(projectDirectory);
  if (options.isInGameEdition) {
    resourcesMergingHelper.SetShouldUseOriginalAbsoluteFilenames();
  } else {
    resourcesMergingHelper.PreserveDirectoriesStructure(false);
    resourcesMergingHelper.PreserveAbsoluteFilenames(false);
  }

  if (!options.fullLoadingScreen) {
    // Most of the time, we skip the logo and minimum duration so that
    // the preview start as soon as possible.
    clonedProject.GetLoadingScreen()
        .ShowGDevelopLogoDuringLoadingScreen(false)
        .SetMinDuration(0);
    clonedProject.GetWatermark().ShowGDevelopWatermark(false);
  }

  gd::ResourceExposer::ExposeWholeProjectResources(clonedProject,
                                                   resourcesMergingHelper);

  ExporterHelper::StripAndSerializeProjectData(clonedProject, rootElement,
                                                options.isInGameEdition,
                                                inGameEditorResources);
}

void ExporterHelper::StripAndSerializeProjectData(
    gd::Project &project, gd::SerializerElement &rootElement,
    bool isInGameEdition,
    const std::vector<gd::InGameEditorResourceMetadata> &inGameEditorResources) {
  auto projectUsedResources =
      gd::SceneResourcesFinder::FindProjectResources(project);

  if (isInGameEdition) {
    // All used in-game editor resources must be always loaded and available.
    ExporterHelper::AddInGameEditorResources(
        project, projectUsedResources, inGameEditorResources);
  }

  std::unordered_map<gd::String, std::set<gd::String>> scenesUsedResources;
  for (std::size_t layoutIndex = 0;
       layoutIndex < project.GetLayoutsCount(); layoutIndex++) {
    auto &layout = project.GetLayout(layoutIndex);
    scenesUsedResources[layout.GetName()] =
        gd::SceneResourcesFinder::FindSceneResources(project, layout);
  }

  std::unordered_map<gd::String, std::set<gd::String>>
      eventsBasedObjectVariantsUsedResources;
  for (std::size_t extensionIndex = 0;
       extensionIndex < project.GetEventsFunctionsExtensionsCount();
       extensionIndex++) {
    auto &eventsFunctionsExtension =
        project.GetEventsFunctionsExtension(extensionIndex);
    for (auto &&eventsBasedObject :
         eventsFunctionsExtension.GetEventsBasedObjects().GetInternalVector()) {

      auto eventsBasedObjectType = gd::PlatformExtension::GetObjectFullType(
          eventsFunctionsExtension.GetName(), eventsBasedObject->GetName());
      eventsBasedObjectVariantsUsedResources[eventsBasedObjectType] =
          gd::SceneResourcesFinder::FindEventsBasedObjectVariantResources(
              project, eventsBasedObject->GetDefaultVariant());

      for (auto &&eventsBasedObjectVariant :
           eventsBasedObject->GetVariants().GetInternalVector()) {

        auto variantType = gd::PlatformExtension::GetVariantFullType(
            eventsFunctionsExtension.GetName(), eventsBasedObject->GetName(),
            eventsBasedObjectVariant->GetName());
        eventsBasedObjectVariantsUsedResources[variantType] =
            gd::SceneResourcesFinder::FindEventsBasedObjectVariantResources(
                project, *eventsBasedObjectVariant);
      }
    }
  }

  // Strip the project (*after* generating events as the events may use stripped
  // things (objects groups...))
  gd::ProjectStripper::StripProjectForExport(project);

  project.SerializeTo(rootElement);
  SerializeUsedResources(rootElement, projectUsedResources, scenesUsedResources,
                         eventsBasedObjectVariantsUsedResources);
  if (isInGameEdition) {
    auto &behaviorsElement = rootElement.AddChild("activatedByDefaultInEditorBehaviors");
    behaviorsElement.ConsiderAsArrayOf("resourceReference");
    auto &platform = project.GetCurrentPlatform();
    for (auto &extension : platform.GetAllPlatformExtensions()) {
      for (auto &behaviorType : extension->GetBehaviorsTypes()) {
        auto &behaviorMetadata = extension->GetBehaviorMetadata(behaviorType);
        if (behaviorMetadata.IsActivatedByDefaultInEditor()) {
          behaviorsElement.AddChild("resourceReference")
              .SetStringValue(behaviorType);
        }
      }
    }
  }
}

void ExporterHelper::SerializeUsedResources(
    gd::SerializerElement &rootElement,
    std::set<gd::String> &projectUsedResources,
    std::unordered_map<gd::String, std::set<gd::String>> &scenesUsedResources,
    std::unordered_map<gd::String, std::set<gd::String>>
        &eventsBasedObjectVariantsUsedResources) {
  auto serializeUsedResources =
      [](gd::SerializerElement &element,
         std::set<gd::String> &usedResources) -> void {
    auto &resourcesElement = element.AddChild("usedResources");
    resourcesElement.ConsiderAsArrayOf("resourceReference");
    for (auto &resourceName : usedResources) {
      auto &resourceElement = resourcesElement.AddChild("resourceReference");
      resourceElement.SetAttribute("name", resourceName);
    }
  };

  serializeUsedResources(rootElement, projectUsedResources);

  auto &layoutsElement = rootElement.GetChild("layouts");
  for (std::size_t layoutIndex = 0;
       layoutIndex < layoutsElement.GetChildrenCount();
       layoutIndex++) {
    auto &layoutElement = layoutsElement.GetChild(layoutIndex);
    const auto layoutName = layoutElement.GetStringAttribute("name");

    auto &layoutUsedResources = scenesUsedResources[layoutName];
    serializeUsedResources(layoutElement, layoutUsedResources);
  }

  auto &extensionsElement = rootElement.GetChild("eventsFunctionsExtensions");
  for (std::size_t extensionIndex = 0;
       extensionIndex < extensionsElement.GetChildrenCount();
       extensionIndex++) {
    auto &extensionElement = extensionsElement.GetChild(extensionIndex);
    const auto extensionName = extensionElement.GetStringAttribute("name");

    auto &objectsElement = extensionElement.GetChild("eventsBasedObjects");

    for (std::size_t objectIndex = 0;
         objectIndex < objectsElement.GetChildrenCount(); objectIndex++) {
      auto &objectElement = objectsElement.GetChild(objectIndex);
      const auto objectName = objectElement.GetStringAttribute("name");

      auto eventsBasedObjectType =
          gd::PlatformExtension::GetObjectFullType(extensionName, objectName);
      auto &objectUsedResources =
          eventsBasedObjectVariantsUsedResources[eventsBasedObjectType];
      serializeUsedResources(objectElement, objectUsedResources);

      auto &variantsElement = objectElement.GetChild("variants");
      for (std::size_t variantIndex = 0;
           variantIndex < variantsElement.GetChildrenCount(); variantIndex++) {
        auto &variantElement = variantsElement.GetChild(variantIndex);
        const auto variantName = variantElement.GetStringAttribute("name");

        auto variantType = gd::PlatformExtension::GetVariantFullType(
            extensionName, objectName, variantName);
        auto &variantUsedResources =
            eventsBasedObjectVariantsUsedResources[variantType];
        serializeUsedResources(variantElement, variantUsedResources);
      }
    }
  }
}

bool ExporterHelper::ExportIndexFile(
    const gd::Project &project,
    gd::String source,
    gd::String exportDir,
    const std::vector<gd::String> &includesFiles,
    const std::vector<gd::SourceFileMetadata> &sourceFiles,
    unsigned int nonRuntimeScriptsCacheBurst,
    gd::String additionalSpec) {
  gd::String str = fs.ReadFile(source);

  // Add a reference to all files to include, as weel as the source files
  // required by the project.
  std::vector<gd::String> finalIncludesFiles = includesFiles;
  auto addSourceFileToIncludeFiles = [&](const gd::SourceFileMetadata& sourceFile) {
    const auto& resourcesManager = project.GetResourcesManager();
    if (!resourcesManager.HasResource(sourceFile.GetResourceName()))
      return;

    const gd::String& sourceFileFilename = resourcesManager.GetResource(sourceFile.GetResourceName()).GetFile();

    if (sourceFile.GetIncludePosition() == "first") {
      InsertUniqueFirst(finalIncludesFiles, sourceFileFilename);
    } else if (sourceFile.GetIncludePosition() == "last") {
      InsertUnique(finalIncludesFiles, sourceFileFilename);
    }
  };
  for (const auto& sourceFile : sourceFiles) {
    addSourceFileToIncludeFiles(sourceFile);
  }

  // Generate the file
  if (!CompleteIndexFile(str,
                         exportDir,
                         finalIncludesFiles,
                         nonRuntimeScriptsCacheBurst,
                         additionalSpec))
    return false;

  // Write the index.html file
  if (!fs.WriteToFile(exportDir + "/index.html", str)) {
    lastError = "Unable to write index file.";
    return false;
  }

  return true;
}

bool ExporterHelper::ExportCordovaFiles(const gd::Project &project,
                                        gd::String exportDir,
                                        std::set<gd::String> usedExtensions) {
  auto &platformSpecificAssets = project.GetPlatformSpecificAssets();
  auto &resourceManager = project.GetResourcesManager();
  auto getIconFilename = [&resourceManager, &platformSpecificAssets](
                             const gd::String &platform,
                             const gd::String &name) {
    const gd::String &file =
        resourceManager.GetResource(platformSpecificAssets.Get(platform, name))
            .GetFile();
    return file.empty() ? "" : "www/" + file;
  };

  auto makeIconsAndroid = [&getIconFilename]() {
    std::vector<std::pair<gd::String, gd::String>> sizes = {{"36", "ldpi"},
                                                            {"48", "mdpi"},
                                                            {"72", "hdpi"},
                                                            {"96", "xhdpi"},
                                                            {"144", "xxhdpi"},
                                                            {"192", "xxxhdpi"}};

    gd::String output;
    for (auto &size : sizes) {
      gd::String filename = getIconFilename("android", "icon-" + size.first);
      output += !filename.empty() ? ("<icon src=\"" + filename +
                                     "\" density=\"" + size.second + "\" />\n")
                                  : "";
    }

    // Splashscreen icon for Android 12+.
    gd::String splashScreenIconFilename =
        getIconFilename("android", "windowSplashScreenAnimatedIcon");
    if (!splashScreenIconFilename.empty())
      output +=
          "<preference name=\"AndroidWindowSplashScreenAnimatedIcon\" "
          "value=\"" +
          splashScreenIconFilename + "\" />\n";

    // Splashscreen "branding" image for Android 12+.
    gd::String splashScreenBrandingImageFilename =
        getIconFilename("android", "windowSplashScreenBrandingImage");
    if (!splashScreenBrandingImageFilename.empty())
      output +=
          "<preference name=\"AndroidWindowSplashScreenBrandingImage\" "
          "value=\"" +
          splashScreenBrandingImageFilename + "\" />\n";

    return output;
  };

  auto makeIconsIos = [&getIconFilename]() {
    std::vector<gd::String> sizes = {
        "180", "60",  "120", "76", "152", "40", "80", "57",  "114", "72",
        "144", "167", "29",  "58", "87",  "50", "20", "100", "167", "1024"};

    gd::String output;
    for (auto &size : sizes) {
      gd::String filename = getIconFilename("ios", "icon-" + size);
      output += !filename.empty() ? ("<icon src=\"" + filename + "\" width=\"" +
                                     size + "\" height=\"" + size + "\" />\n")
                                  : "";
    }

    return output;
  };

  auto makeProjectNameXcodeSafe = [](const gd::String &projectName) {
    // Avoid App Store Connect STATE_ERROR.VALIDATION_ERROR.90121 error, when
    // "CFBundleExecutable Info.plist key contains [...] any of the following
    // unsupported characters: \ [ ] { } ( ) + *".

    // Remove \ [ ] { } ( ) + * from the project name.
    return projectName.FindAndReplace("\\", "")
        .FindAndReplace("[", "")
        .FindAndReplace("]", "")
        .FindAndReplace("{", "")
        .FindAndReplace("}", "")
        .FindAndReplace("(", "")
        .FindAndReplace(")", "")
        .FindAndReplace("+", "")
        .FindAndReplace("*", "");
  };

  gd::String str =
      fs.ReadFile(gdjsRoot + "/Runtime/Cordova/config.xml")
          .FindAndReplace("GDJS_PROJECTNAME",
                          gd::Serializer::ToEscapedXMLString(
                              makeProjectNameXcodeSafe(project.GetName())))
          .FindAndReplace(
              "GDJS_PACKAGENAME",
              gd::Serializer::ToEscapedXMLString(project.GetPackageName()))
          .FindAndReplace("GDJS_PROJECTVERSION", project.GetVersion())
          .FindAndReplace("<!-- GDJS_ICONS_ANDROID -->", makeIconsAndroid())
          .FindAndReplace("<!-- GDJS_ICONS_IOS -->", makeIconsIos());

  gd::String plugins = "";
  auto dependenciesAndExtensions =
      gd::ExportedDependencyResolver::GetDependenciesFor(
          project, usedExtensions, "cordova");
  for (auto &dependencyAndExtension : dependenciesAndExtensions) {
    const auto &dependency = dependencyAndExtension.GetDependency();

    gd::String plugin;
    plugin += "<plugin name=\"" +
              gd::Serializer::ToEscapedXMLString(dependency.GetExportName());
    if (dependency.GetVersion() != "") {
      plugin += "\" spec=\"" +
                gd::Serializer::ToEscapedXMLString(dependency.GetVersion());
    }
    plugin += "\">\n";

    auto extraSettingValues = gd::ExportedDependencyResolver::
        GetExtensionDependencyExtraSettingValues(project,
                                                 dependencyAndExtension);

    // For Cordova, all settings are considered a plugin variable.
    for (auto &extraSetting : extraSettingValues) {
      plugin += "    <variable name=\"" +
                gd::Serializer::ToEscapedXMLString(extraSetting.first) +
                "\" value=\"" +
                gd::Serializer::ToEscapedXMLString(extraSetting.second) +
                "\" />\n";
    }

    plugin += "</plugin>";

    plugins += plugin;
  }

  // TODO: migrate the plugins to the package.json
  str =
      str.FindAndReplace("<!-- GDJS_EXTENSION_CORDOVA_DEPENDENCY -->", plugins);

  if (!fs.WriteToFile(exportDir + "/config.xml", str)) {
    lastError = "Unable to write Cordova config.xml file.";
    return false;
  }

  gd::String jsonName =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetName()));
  gd::String jsonAuthor =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetAuthor()));
  gd::String jsonVersion =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetVersion()));
  gd::String jsonMangledName = gd::Serializer::ToJSON(
      gd::SerializerElement(gd::SceneNameMangler::Get()
                                ->GetMangledSceneName(project.GetName())
                                .LowerCase()
                                .FindAndReplace(" ", "-")));

  {
    gd::String str =
        fs.ReadFile(gdjsRoot + "/Runtime/Cordova/package.json")
            .FindAndReplace("\"GDJS_GAME_NAME\"", jsonName)
            .FindAndReplace("\"GDJS_GAME_AUTHOR\"", jsonAuthor)
            .FindAndReplace("\"GDJS_GAME_VERSION\"", jsonVersion)
            .FindAndReplace("\"GDJS_GAME_MANGLED_NAME\"", jsonMangledName);

    if (!fs.WriteToFile(exportDir + "/package.json", str)) {
      lastError = "Unable to write Cordova package.json file.";
      return false;
    }
  }

  {
    gd::String str =
        fs.ReadFile(gdjsRoot + "/Runtime/Cordova/www/LICENSE.GDevelop.txt");

    if (!fs.WriteToFile(exportDir + "/www/LICENSE.GDevelop.txt", str)) {
      lastError = "Unable to write Cordova LICENSE.GDevelop.txt file.";
      return false;
    }
  }

  return true;
}

bool ExporterHelper::ExportFacebookInstantGamesFiles(const gd::Project &project,
                                                     gd::String exportDir) {
  {
    gd::String str =
        fs.ReadFile(gdjsRoot +
                    "/Runtime/FacebookInstantGames/fbapp-config.json")
            .FindAndReplace("\"GDJS_ORIENTATION\"",
                            project.GetOrientation() == "portrait"
                                ? "\"PORTRAIT\""
                                : "\"LANDSCAPE\"");

    if (!fs.WriteToFile(exportDir + "/fbapp-config.json", str)) {
      lastError =
          "Unable to write Facebook Instant Games fbapp-config.json file.";
      return false;
    }
  }

  return true;
}

bool ExporterHelper::ExportHtml5Files(const gd::Project &project,
                                      gd::String exportDir) {
  if (!fs.WriteToFile(exportDir + "/manifest.webmanifest",
                      GenerateWebManifest(project))) {
    lastError = "Unable to export WebManifest.";
    return false;
  }

  {
    gd::String str =
        fs.ReadFile(gdjsRoot + "/Runtime/Electron/LICENSE.GDevelop.txt");

    if (!fs.WriteToFile(exportDir + "/LICENSE.GDevelop.txt", str)) {
      lastError = "Unable to write LICENSE.GDevelop.txt file.";
      return false;
    }
  }

  return true;
}

bool ExporterHelper::ExportElectronFiles(const gd::Project &project,
                                         gd::String exportDir,
                                         std::set<gd::String> usedExtensions) {
  gd::String jsonName =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetName()));
  gd::String jsonPackageName =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetPackageName()));
  gd::String jsonAuthor =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetAuthor()));
  gd::String jsonVersion =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetVersion()));
  gd::String jsonMangledName = gd::Serializer::ToJSON(
      gd::SerializerElement(gd::SceneNameMangler::Get()
                                ->GetMangledSceneName(project.GetName())
                                .LowerCase()
                                .FindAndReplace(" ", "-")));
  // It's important to clean the project name from special characters,
  // otherwise Windows executable may be corrupted when electron builds it.
  gd::String jsonCleanedName = gd::Serializer::ToJSON(
      gd::SerializerElement(CleanProjectName(project.GetName())));

  {
    gd::String str =
        fs.ReadFile(gdjsRoot + "/Runtime/Electron/package.json")
            .FindAndReplace("\"GDJS_GAME_NAME\"", jsonCleanedName)
            .FindAndReplace("\"GDJS_GAME_PACKAGE_NAME\"", jsonPackageName)
            .FindAndReplace("\"GDJS_GAME_AUTHOR\"", jsonAuthor)
            .FindAndReplace("\"GDJS_GAME_VERSION\"", jsonVersion)
            .FindAndReplace("\"GDJS_GAME_MANGLED_NAME\"", jsonMangledName);

    gd::String packages = "";

    auto dependenciesAndExtensions =
        gd::ExportedDependencyResolver::GetDependenciesFor(
            project, usedExtensions, "npm");
    for (auto &dependencyAndExtension : dependenciesAndExtensions) {
      const auto &dependency = dependencyAndExtension.GetDependency();
      if (dependency.GetVersion() == "") {
        gd::LogError(
            "Latest Version not available for NPM dependencies, "
            "dependency " +
            dependency.GetName() +
            " is not exported. Please specify a version when calling "
            "addDependency.");
        continue;
      }

      // For Electron, extra settings of dependencies are ignored.
      packages += "\n\t\"" + dependency.GetExportName() + "\": \"" +
                  dependency.GetVersion() + "\",";
    }

    str = str.FindAndReplace("\"GDJS_EXTENSION_NPM_DEPENDENCY\": \"0\",",
                             packages);

    if (!fs.WriteToFile(exportDir + "/package.json", str)) {
      lastError = "Unable to write Electron package.json file.";
      return false;
    }
  }

  {
    gd::String str =
        fs.ReadFile(gdjsRoot + "/Runtime/Electron/main.js")
            .FindAndReplace(
                "800 /*GDJS_WINDOW_WIDTH*/",
                gd::String::From<int>(project.GetGameResolutionWidth()))
            .FindAndReplace(
                "600 /*GDJS_WINDOW_HEIGHT*/",
                gd::String::From<int>(project.GetGameResolutionHeight()))
            .FindAndReplace("'GDJS_GAME_NAME'", jsonName);

    if (!fs.WriteToFile(exportDir + "/main.js", str)) {
      lastError = "Unable to write Electron main.js file.";
      return false;
    }
  }

  {
    gd::String str =
        fs.ReadFile(gdjsRoot + "/Runtime/Electron/LICENSE.GDevelop.txt");

    if (!fs.WriteToFile(exportDir + "/LICENSE.GDevelop.txt", str)) {
      lastError = "Unable to write Electron LICENSE.GDevelop.txt file.";
      return false;
    }
  }

  return true;
}

bool ExporterHelper::ExportBuildResourcesElectronFiles(
    const gd::Project &project, gd::String exportDir) {
  auto &platformSpecificAssets = project.GetPlatformSpecificAssets();
  auto &resourceManager = project.GetResourcesManager();

  gd::String iconFilename =
      resourceManager
          .GetResource(platformSpecificAssets.Get("desktop", "icon-512"))
          .GetFile();

  fs.MakeAbsolute(iconFilename, exportDir + "/app");
  fs.MkDir(exportDir + "/buildResources");
  if (fs.FileExists(iconFilename)) {
    fs.CopyFile(iconFilename, exportDir + "/buildResources/icon.png");
  }

  return true;
}

bool ExporterHelper::CompleteIndexFile(
    gd::String &str,
    gd::String exportDir,
    const std::vector<gd::String> &includesFiles,
    unsigned int nonRuntimeScriptsCacheBurst,
    gd::String additionalSpec) {
  if (additionalSpec.empty()) additionalSpec = "{}";

  auto hasJavaScriptExtension = [](const gd::String &filename) {
    const gd::String lowerCaseFilename = filename.LowerCase();
    return (lowerCaseFilename.size() >= 3 &&
            lowerCaseFilename.substr(lowerCaseFilename.size() - 3) == ".js") ||
           (lowerCaseFilename.size() >= 4 &&
            lowerCaseFilename.substr(lowerCaseFilename.size() - 4) == ".mjs");
  };

  gd::String codeFilesIncludes;
  for (auto &include : includesFiles) {
    if (!hasJavaScriptExtension(include)) {
      continue;
    }

    gd::String scriptSrc =
        GetExportedIncludeFilename(fs, gdjsRoot, include, nonRuntimeScriptsCacheBurst);

    // Sanity check if the file exists - if not skip it to avoid
    // including it in the list of scripts.
    gd::String absoluteFilename = scriptSrc;
    fs.MakeAbsolute(absoluteFilename, exportDir);
    if (!fs.FileExists(absoluteFilename)) {
      std::cout << "Warning: Unable to find " << absoluteFilename << "."
                << std::endl;
      continue;
    }

    codeFilesIncludes += "\t<script src=\"" + scriptSrc +
                         "\" crossorigin=\"anonymous\"></script>\n";
  }

  str = str.FindAndReplace("/* GDJS_CUSTOM_STYLE */", "")
            .FindAndReplace("<!-- GDJS_CUSTOM_HTML -->", "")
            .FindAndReplace("<!-- GDJS_CODE_FILES -->", codeFilesIncludes)
            .FindAndReplace("{}/*GDJS_ADDITIONAL_SPEC*/", additionalSpec);

  return true;
}

void ExporterHelper::AddLibsInclude(bool pixiRenderers,
                                    bool pixiInThreeRenderers,
                                    bool isInGameEdition,
                                    bool includeWebsocketDebuggerClient,
                                    bool includeWindowMessageDebuggerClient,
                                    bool includeMinimalDebuggerClient,
                                    bool includeCaptureManager,
                                    bool includeInAppTutorialMessage,
                                    gd::String gdevelopLogoStyle,
                                    std::vector<gd::String> &includesFiles) {
  // First, do not forget common includes (they must be included before events
  // generated code files).
  InsertUnique(includesFiles, "libs/jshashtable.js");
  InsertUnique(includesFiles, "logger.js");
  InsertUnique(includesFiles, "gd.js");
  InsertUnique(includesFiles, "libs/rbush.js");
  InsertUnique(includesFiles, "AsyncTasksManager.js");
  InsertUnique(includesFiles, "inputmanager.js");
  InsertUnique(includesFiles, "jsonmanager.js");
  InsertUnique(includesFiles, "Model3DManager.js");
  InsertUnique(includesFiles, "ResourceLoader.js");
  InsertUnique(includesFiles, "ResourceCache.js");
  InsertUnique(includesFiles, "timemanager.js");
  InsertUnique(includesFiles, "polygon.js");
  InsertUnique(includesFiles, "runtimeobject.js");
  InsertUnique(includesFiles, "profiler.js");
  InsertUnique(includesFiles, "RuntimeInstanceContainer.js");
  InsertUnique(includesFiles, "runtimescene.js");
  InsertUnique(includesFiles, "scenestack.js");
  InsertUnique(includesFiles, "force.js");
  InsertUnique(includesFiles, "RuntimeLayer.js");
  InsertUnique(includesFiles, "layer.js");
  InsertUnique(includesFiles, "RuntimeCustomObjectLayer.js");
  InsertUnique(includesFiles, "timer.js");
  InsertUnique(includesFiles, "runtimewatermark.js");
  InsertUnique(includesFiles, "multithreadingmanager.js");
  InsertUnique(includesFiles, "runtimegame.js");
  InsertUnique(includesFiles, "variable.js");
  InsertUnique(includesFiles, "variablescontainer.js");
  InsertUnique(includesFiles, "oncetriggers.js");
  InsertUnique(includesFiles, "runtimebehavior.js");
  InsertUnique(includesFiles, "SpriteAnimator.js");
  InsertUnique(includesFiles, "spriteruntimeobject.js");
  InsertUnique(includesFiles, "affinetransformation.js");
  InsertUnique(includesFiles, "CustomRuntimeObjectInstanceContainer.js");
  InsertUnique(includesFiles, "CustomRuntimeObject.js");
  InsertUnique(includesFiles, "CustomRuntimeObject2D.js");
  InsertUnique(includesFiles, "indexeddb.js");

  // Common includes for events only.
  InsertUnique(includesFiles, "events-tools/commontools.js");
  InsertUnique(includesFiles, "events-tools/variabletools.js");
  InsertUnique(includesFiles, "events-tools/runtimescenetools.js");
  InsertUnique(includesFiles, "events-tools/inputtools.js");
  InsertUnique(includesFiles, "events-tools/objecttools.js");
  InsertUnique(includesFiles, "events-tools/cameratools.js");
  InsertUnique(includesFiles, "events-tools/soundtools.js");
  InsertUnique(includesFiles, "events-tools/storagetools.js");
  InsertUnique(includesFiles, "events-tools/stringtools.js");
  InsertUnique(includesFiles, "events-tools/windowtools.js");
  InsertUnique(includesFiles, "events-tools/networktools.js");

  if (gdevelopLogoStyle == "dark") {
    InsertUnique(includesFiles, "splash/gd-logo-dark.js");
  } else if (gdevelopLogoStyle == "dark-colored") {
    InsertUnique(includesFiles, "splash/gd-logo-dark-colored.js");
  } else if (gdevelopLogoStyle == "light-colored") {
    InsertUnique(includesFiles, "splash/gd-logo-light-colored.js");
  } else {
    InsertUnique(includesFiles, "splash/gd-logo-light.js");
  }

  if (includeInAppTutorialMessage) {
    InsertUnique(includesFiles, "InAppTutorialMessage.js");
    InsertUnique(includesFiles, "libs/nanomarkdown.js");
  }

  if (includeWebsocketDebuggerClient || includeWindowMessageDebuggerClient) {
    InsertUnique(includesFiles, "debugger-client/hot-reloader.js");
    InsertUnique(includesFiles, "debugger-client/abstract-debugger-client.js");
    InsertUnique(includesFiles, "debugger-client/InGameDebugger.js");
  }
  if (includeWebsocketDebuggerClient) {
    InsertUnique(includesFiles, "debugger-client/websocket-debugger-client.js");
  }
  if (includeWindowMessageDebuggerClient) {
    InsertUnique(includesFiles,
                 "debugger-client/window-message-debugger-client.js");
  }
  if (includeMinimalDebuggerClient) {
    InsertUnique(includesFiles, "debugger-client/minimal-debugger-client.js");
  }

  if (pixiInThreeRenderers || isInGameEdition) {
    InsertUnique(includesFiles, "pixi-renderers/three.js");
    InsertUnique(includesFiles, "pixi-renderers/three.webgpu.js");
    InsertUnique(includesFiles, "pixi-renderers/three.tsl.js");
    InsertUnique(includesFiles, "pixi-renderers/ThreeAddons.js");
    InsertUnique(includesFiles,
                 "pixi-renderers/draco/gltf/draco_wasm_wrapper.js");
    // Extensions in JS may use it.
    InsertUnique(includesFiles, "Extensions/3D/Scene3DTools.js");
    InsertUnique(includesFiles, "Extensions/3D/A_RuntimeObject3D.js");
    InsertUnique(includesFiles, "Extensions/3D/A_RuntimeObject3DRenderer.js");
    InsertUnique(includesFiles, "Extensions/3D/CustomRuntimeObject3D.js");
    InsertUnique(includesFiles,
                 "Extensions/3D/CustomRuntimeObject3DRenderer.js");
  }
  if (pixiRenderers || isInGameEdition) {
    InsertUnique(includesFiles, "pixi-renderers/pixi.js");
    InsertUnique(includesFiles, "pixi-renderers/pixi-filters-tools.js");
    InsertUnique(includesFiles, "pixi-renderers/runtimegame-pixi-renderer.js");
    InsertUnique(includesFiles, "pixi-renderers/fsr1-pass.js");
    InsertUnique(includesFiles, "pixi-renderers/runtimescene-pixi-renderer.js");
    InsertUnique(includesFiles, "pixi-renderers/layer-pixi-renderer.js");
    InsertUnique(includesFiles, "pixi-renderers/pixi-image-manager.js");
    InsertUnique(includesFiles, "pixi-renderers/pixi-bitmapfont-manager.js");
    InsertUnique(includesFiles,
                 "pixi-renderers/spriteruntimeobject-pixi-renderer.js");
    InsertUnique(includesFiles,
                 "pixi-renderers/CustomRuntimeObject2DPixiRenderer.js");
    InsertUnique(includesFiles, "pixi-renderers/DebuggerPixiRenderer.js");
    InsertUnique(includesFiles,
                 "pixi-renderers/loadingscreen-pixi-renderer.js");
    InsertUnique(includesFiles, "pixi-renderers/pixi-effects-manager.js");
    InsertUnique(includesFiles, "howler-sound-manager/howler.min.js");
    InsertUnique(includesFiles, "howler-sound-manager/howler-sound-manager.js");
    InsertUnique(includesFiles,
                 "fontfaceobserver-font-manager/fontfaceobserver.js");
    InsertUnique(
        includesFiles,
        "fontfaceobserver-font-manager/fontfaceobserver-font-manager.js");
  }
  if (isInGameEdition) {
    // `InGameEditor` uses the `is3D` function.
    InsertUnique(includesFiles, "Extensions/3D/Base3DBehavior.js");
    InsertUnique(includesFiles, "Extensions/3D/HemisphereLight.js");
    InsertUnique(includesFiles, "InGameEditor/InGameEditor.js");
  }
  if (includeCaptureManager) {
    InsertUnique(includesFiles, "capturemanager.js");
  }
}

void ExporterHelper::RemoveIncludes(bool pixiRenderers,
                                    std::vector<gd::String> &includesFiles) {
  if (pixiRenderers) {
    for (size_t i = 0; i < includesFiles.size();) {
      const gd::String &includeFile = includesFiles[i];
      if (includeFile.find("pixi-renderer") != gd::String::npos ||
          includeFile.find("pixi-filter") != gd::String::npos)
        includesFiles.erase(includesFiles.begin() + i);
      else
        ++i;
    }
  }
}

bool ExporterHelper::ExportEffectIncludes(
    gd::Project &project, std::vector<gd::String> &includesFiles) {
  std::set<gd::String> effectIncludes;

  gd::EffectsCodeGenerator::GenerateEffectsIncludeFiles(
      project.GetCurrentPlatform(), project, effectIncludes);

  for (auto &include : effectIncludes) InsertUnique(includesFiles, include);

  return true;
}

bool ExporterHelper::ExportScenesEventsCode(
    const gd::Project &project,
    gd::String outputDir,
    std::vector<gd::String> &includesFiles,
    gd::WholeProjectDiagnosticReport &wholeProjectDiagnosticReport,
    bool exportForPreview) {
  fs.MkDir(outputDir);

  for (std::size_t i = 0; i < project.GetLayoutsCount(); ++i) {
    std::set<gd::String> eventsIncludes;
    const gd::Layout &layout = project.GetLayout(i);

    auto &diagnosticReport =
        wholeProjectDiagnosticReport.AddNewDiagnosticReportForScene(
            layout.GetName());
    LayoutCodeGenerator layoutCodeGenerator(project);
    gd::String eventsOutput = layoutCodeGenerator.GenerateLayoutCompleteCode(
        layout, eventsIncludes, diagnosticReport, !exportForPreview);
    gd::String filename =
        outputDir + "/" + "code" + gd::String::From(i) + ".js";

    // Export the code
    if (fs.WriteToFile(filename, eventsOutput)) {
      for (auto &include : eventsIncludes) InsertUnique(includesFiles, include);

      InsertUnique(includesFiles, filename);
    } else {
      lastError = _("Unable to write ") + filename;
      return false;
    }
  }

  return true;
}

bool ExporterHelper::ExportTypeScriptProjectScripts(
    const gd::Project &project,
    gd::String outputDir,
    std::vector<gd::String> &includesFiles) {
  const gd::String &serializedScripts =
      project.GetExtensionProperties().GetValue(
          kTypeScriptProjectScriptsExtensionName,
          kTypeScriptProjectScriptsPropertyName);
  if (serializedScripts.empty()) return true;

  auto scriptsMetadataElement = gd::Serializer::FromJSON(serializedScripts);
  if (!scriptsMetadataElement.HasChild("scripts")) return true;

  auto &scriptsElement = scriptsMetadataElement.GetChild("scripts");
  scriptsElement.ConsiderAsArray();

  struct ProjectTypeScriptModule {
    gd::String moduleId;
    gd::String transpiledCode;
    bool includeFirst = false;
    gd::String contextKind;
    gd::String sceneName;
    gd::String objectName;
    gd::String behaviorName;
  };

  std::vector<ProjectTypeScriptModule> modules;
  std::vector<gd::String> firstModuleIds;
  std::vector<gd::String> lastModuleIds;
  std::set<gd::String> usedModuleIds;

  const std::size_t scriptsCount = scriptsElement.GetChildrenCount();
  for (std::size_t i = 0; i < scriptsCount; ++i) {
    auto &scriptElement = scriptsElement.GetChild(i);
    const gd::String transpiledCode =
        scriptElement.HasChild("transpiledCode")
            ? scriptElement.GetChild("transpiledCode").GetStringValue()
            : "";
    if (transpiledCode.empty()) continue;

    const gd::String scriptId =
        scriptElement.HasChild("id")
            ? scriptElement.GetChild("id").GetStringValue()
            : "";
    const gd::String scriptName =
        scriptElement.HasChild("name")
            ? scriptElement.GetChild("name").GetStringValue()
            : "";

    const gd::String fallbackModuleId =
        "script-" + MakeSafeFileNamePart(scriptId, gd::String::From(i));
    const gd::String preferredModuleId =
        scriptName.empty() ? fallbackModuleId : scriptName;
    const gd::String normalizedModuleId =
        NormalizeTypeScriptModuleId(preferredModuleId, fallbackModuleId);

    gd::String uniqueModuleId = normalizedModuleId;
    const std::size_t extensionPosition =
        uniqueModuleId.Raw().find_last_of('.');
    for (std::size_t duplicateIndex = 1;
         usedModuleIds.count(uniqueModuleId) > 0;
         duplicateIndex++) {
      if (extensionPosition != std::string::npos) {
        uniqueModuleId = normalizedModuleId.substr(0, extensionPosition) + "-" +
                         gd::String::From(duplicateIndex) +
                         normalizedModuleId.substr(extensionPosition);
      } else {
        uniqueModuleId =
            normalizedModuleId + "-" + gd::String::From(duplicateIndex);
      }
    }
    usedModuleIds.insert(uniqueModuleId);

    const gd::String includePosition =
        scriptElement.HasChild("includePosition")
            ? scriptElement.GetChild("includePosition").GetStringValue()
            : "last";
    const bool includeFirst = includePosition == "first";

    gd::String contextKind =
        scriptElement.HasChild("contextKind")
            ? scriptElement.GetChild("contextKind").GetStringValue()
            : "project";
    if (contextKind != "scene" && contextKind != "object" &&
        contextKind != "behavior" && contextKind != "project") {
      contextKind = "project";
    }
    const gd::String sceneName =
        scriptElement.HasChild("sceneName")
            ? scriptElement.GetChild("sceneName").GetStringValue()
            : "";
    const gd::String objectName =
        scriptElement.HasChild("objectName")
            ? scriptElement.GetChild("objectName").GetStringValue()
            : "";
    const gd::String behaviorName =
        scriptElement.HasChild("behaviorName")
            ? scriptElement.GetChild("behaviorName").GetStringValue()
            : "";

    modules.push_back({uniqueModuleId,
                       transpiledCode,
                       includeFirst,
                       contextKind,
                       sceneName,
                       objectName,
                       behaviorName});
    if (includeFirst) {
      firstModuleIds.push_back(uniqueModuleId);
    } else {
      lastModuleIds.push_back(uniqueModuleId);
    }
  }

  if (modules.empty()) return true;

  fs.MkDir(outputDir);
  const gd::String runtimeFilePath = outputDir + "/project-ts-modules-runtime.js";
  const gd::String definitionsFilePath =
      outputDir + "/project-ts-modules-definitions.js";
  const gd::String firstBootstrapFilePath =
      outputDir + "/project-ts-modules-bootstrap-first.js";
  const gd::String lastBootstrapFilePath =
      outputDir + "/project-ts-modules-bootstrap-last.js";
  const gd::String lifecycleFilePath =
      outputDir + "/project-ts-modules-lifecycle.js";

  const gd::String runtimeOutput = R"TSMODULES((function(globalObject) {
  if (globalObject.__gdevelopTsModules) return;

  var moduleSources = Object.create(null);
  var cache = Object.create(null);
  var externals = Object.create(null);
  var externalAliases = Object.create(null);

  var normalizePath = function(path) {
    var parts = path.split('/');
    var normalizedParts = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part || part === '.') continue;
      if (part === '..') {
        if (normalizedParts.length) normalizedParts.pop();
        continue;
      }
      normalizedParts.push(part);
    }
    return normalizedParts.join('/');
  };

  var removeExtension = function(path) {
    return path.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, '');
  };

  var hasSource = function(moduleId) {
    return Object.prototype.hasOwnProperty.call(moduleSources, moduleId);
  };

  var getGlobalValueByPath = function(path) {
    if (!path || typeof path !== 'string') return undefined;
    if (
      path === 'globalThis' ||
      path === 'window' ||
      path === 'self' ||
      path === 'global'
    ) {
      return globalObject;
    }
    var normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    var parts = normalizedPath.split('.');
    var currentValue = globalObject;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (currentValue === null || typeof currentValue === 'undefined') {
        return undefined;
      }
      currentValue = currentValue[part];
      if (typeof currentValue === 'undefined') {
        return undefined;
      }
    }
    return currentValue;
  };

  var tryResolveExternalFromGlobal = function(moduleName) {
    if (!moduleName) return undefined;
    var directGlobalValue = getGlobalValueByPath(moduleName);
    if (typeof directGlobalValue !== 'undefined') {
      return directGlobalValue;
    }
    if (Object.prototype.hasOwnProperty.call(externalAliases, moduleName)) {
      var aliasedGlobalPath = externalAliases[moduleName];
      return getGlobalValueByPath(aliasedGlobalPath);
    }
    return undefined;
  };

  var tryResolveExternalFromNodeRequire = function(moduleName) {
    var nodeRequire = null;
    if (typeof require === 'function') {
      nodeRequire = require;
    } else if (globalObject && typeof globalObject.require === 'function') {
      nodeRequire = globalObject.require;
    }
    if (!nodeRequire) return undefined;
    try {
      return nodeRequire(moduleName);
    } catch (error) {
      return undefined;
    }
  };

  var resolveExternalModule = function(moduleName) {
    if (Object.prototype.hasOwnProperty.call(externals, moduleName)) {
      return externals[moduleName];
    }
    var globalExternalValue = tryResolveExternalFromGlobal(moduleName);
    if (typeof globalExternalValue !== 'undefined') {
      externals[moduleName] = globalExternalValue;
      return globalExternalValue;
    }
    var nodeExternalValue = tryResolveExternalFromNodeRequire(moduleName);
    if (typeof nodeExternalValue !== 'undefined') {
      externals[moduleName] = nodeExternalValue;
      return nodeExternalValue;
    }
    return undefined;
  };

  var resolveModuleId = function(request, fromModuleId) {
    var normalizedRequest = request.replace(/\\/g, '/');
    var candidateIds = [];
    var pushCandidate = function(candidateId) {
      if (candidateId && candidateIds.indexOf(candidateId) === -1) {
        candidateIds.push(candidateId);
      }
    };

    if (normalizedRequest.charAt(0) === '.') {
      var fromDirectory = '';
      if (fromModuleId) {
        var separatorIndex = fromModuleId.lastIndexOf('/');
        fromDirectory = separatorIndex >= 0 ? fromModuleId.slice(0, separatorIndex + 1) : '';
      }
      var normalizedRelativeId = normalizePath(fromDirectory + normalizedRequest);
      var normalizedWithoutExtension = removeExtension(normalizedRelativeId);
      pushCandidate(normalizedRelativeId);
      pushCandidate(normalizedWithoutExtension);
      pushCandidate(normalizedWithoutExtension + '.ts');
      pushCandidate(normalizedWithoutExtension + '.tsx');
      pushCandidate(normalizedWithoutExtension + '.js');
      pushCandidate(normalizedWithoutExtension + '/index.ts');
      pushCandidate(normalizedWithoutExtension + '/index.tsx');
      pushCandidate(normalizedWithoutExtension + '/index.js');
    } else {
      var normalizedAbsoluteId = normalizePath(normalizedRequest);
      var normalizedAbsoluteWithoutExtension = removeExtension(normalizedAbsoluteId);
      pushCandidate(normalizedAbsoluteId);
      pushCandidate(normalizedAbsoluteWithoutExtension);
      pushCandidate(normalizedAbsoluteWithoutExtension + '.ts');
      pushCandidate(normalizedAbsoluteWithoutExtension + '.tsx');
      pushCandidate(normalizedAbsoluteWithoutExtension + '.js');
    }

    for (var i = 0; i < candidateIds.length; i++) {
      if (hasSource(candidateIds[i])) return candidateIds[i];
    }

    throw new Error(
      '[TypeScript Modules] Cannot find module "' +
        request +
        '" from "' +
        (fromModuleId || '<entry>') +
        '".'
    );
  };

  var requireModule = function(request, fromModuleId) {
    var externalModule = resolveExternalModule(request);
    if (typeof externalModule !== 'undefined') {
      return externalModule;
    }

    var resolvedModuleId = resolveModuleId(request, fromModuleId);
    if (Object.prototype.hasOwnProperty.call(cache, resolvedModuleId)) {
      return cache[resolvedModuleId].exports;
    }

    var module = { exports: {} };
    cache[resolvedModuleId] = module;
    var localRequire = function(nextRequest) {
      return requireModule(nextRequest, resolvedModuleId);
    };
    var moduleFactory = new Function(
      'require',
      'module',
      'exports',
      moduleSources[resolvedModuleId]
    );
    moduleFactory(localRequire, module, module.exports);
    return module.exports;
  };

  var projectTests = [];
  var sharedState = Object.create(null);
  var scriptEventListeners = Object.create(null);

  var getListenersForEvent = function(eventName, createIfMissing) {
    if (!eventName || typeof eventName !== 'string') return [];
    if (!Object.prototype.hasOwnProperty.call(scriptEventListeners, eventName)) {
      if (!createIfMissing) return [];
      scriptEventListeners[eventName] = [];
    }
    return scriptEventListeners[eventName];
  };

  var cloneArray = function(values) {
    if (!values || !values.length) return [];
    return values.slice();
  };

  var modulesApi = {
    defineSource: function(moduleId, moduleSource) {
      moduleSources[moduleId] = moduleSource;
    },
    setExternal: function(moduleName, moduleValue) {
      if (!moduleName || typeof moduleName !== 'string') return;
      if (typeof moduleValue === 'undefined') {
        delete externals[moduleName];
        return;
      }
      externals[moduleName] = moduleValue;
    },
    setExternalAlias: function(moduleName, globalPath) {
      if (!moduleName || typeof moduleName !== 'string') return;
      if (!globalPath || typeof globalPath !== 'string') return;
      externalAliases[moduleName] = globalPath;
      var resolvedValue = tryResolveExternalFromGlobal(moduleName);
      if (typeof resolvedValue !== 'undefined') {
        externals[moduleName] = resolvedValue;
      }
    },
    hasExternal: function(moduleName) {
      if (!moduleName || typeof moduleName !== 'string') return false;
      if (Object.prototype.hasOwnProperty.call(externals, moduleName)) return true;
      return typeof resolveExternalModule(moduleName) !== 'undefined';
    },
    getExternal: function(moduleName) {
      if (!moduleName || typeof moduleName !== 'string') return undefined;
      return resolveExternalModule(moduleName);
    },
    requireExternal: function(moduleName) {
      if (!moduleName || typeof moduleName !== 'string') return undefined;
      return resolveExternalModule(moduleName);
    },
    importExternal: function(moduleName) {
      if (!moduleName || typeof moduleName !== 'string') {
        return Promise.reject(
          new Error(
            '[TypeScript Modules] External module name must be a non-empty string.'
          )
        );
      }
      var resolvedExternal = resolveExternalModule(moduleName);
      if (typeof resolvedExternal !== 'undefined') {
        return Promise.resolve(resolvedExternal);
      }
      try {
        var dynamicImportFactory = new Function(
          'moduleName',
          'return import(moduleName);'
        );
        return dynamicImportFactory(moduleName).then(function(importedModule) {
          var moduleValue =
            importedModule &&
            typeof importedModule === 'object' &&
            Object.prototype.hasOwnProperty.call(importedModule, 'default')
              ? importedModule.default
              : importedModule;
          externals[moduleName] = moduleValue;
          return moduleValue;
        });
      } catch (error) {
        return Promise.reject(
          new Error(
            '[TypeScript Modules] Unable to import external module "' +
              moduleName +
              '".'
          )
        );
      }
    },
    resolveGlobal: function(globalPath) {
      return getGlobalValueByPath(globalPath);
    },
    bindDefaultExternals: function() {
      modulesApi.setExternal('globalThis', globalObject);
      modulesApi.setExternal('tsModules', modulesApi);
      if (typeof globalObject.gdjs !== 'undefined') {
        modulesApi.setExternal('gdjs', globalObject.gdjs);
      }

      modulesApi.setExternalAlias('three', 'THREE');
      modulesApi.setExternalAlias('THREE', 'THREE');
      modulesApi.setExternalAlias('pixi.js', 'PIXI');
      modulesApi.setExternalAlias('pixi', 'PIXI');
      modulesApi.setExternalAlias('PIXI', 'PIXI');
      modulesApi.setExternalAlias('howler', 'Howler');
      modulesApi.setExternalAlias('Howler', 'Howler');
      modulesApi.setExternalAlias('Howl', 'Howl');
      modulesApi.setExternalAlias('tone', 'Tone');
      modulesApi.setExternalAlias('Tone', 'Tone');
      modulesApi.setExternalAlias('babylonjs', 'BABYLON');
      modulesApi.setExternalAlias('BABYLON', 'BABYLON');
    },
    listModuleIds: function() {
      return Object.keys(moduleSources).sort();
    },
    callExport: function(moduleId, exportName) {
      if (!moduleId || typeof moduleId !== 'string') {
        throw new Error('[TypeScript Modules] moduleId must be a non-empty string.');
      }
      var moduleExports = modulesApi.require(moduleId);
      var extraArgs = Array.prototype.slice.call(arguments, 2);
      if (typeof exportName === 'undefined' || exportName === null || exportName === '') {
        if (typeof moduleExports !== 'function') {
          throw new Error(
            '[TypeScript Modules] Module "' +
              moduleId +
              '" does not export a default callable function.'
          );
        }
        return moduleExports.apply(moduleExports, extraArgs);
      }
      if (!moduleExports || typeof moduleExports[exportName] !== 'function') {
        throw new Error(
          '[TypeScript Modules] Module "' +
            moduleId +
            '" has no callable export "' +
            exportName +
            '".'
        );
      }
      return moduleExports[exportName].apply(moduleExports, extraArgs);
    },
    hasSharedState: function(key) {
      return (
        !!key &&
        typeof key === 'string' &&
        Object.prototype.hasOwnProperty.call(sharedState, key)
      );
    },
    setSharedState: function(key, value) {
      if (!key || typeof key !== 'string') return;
      sharedState[key] = value;
    },
    getSharedState: function(key, defaultValue) {
      if (!key || typeof key !== 'string') return defaultValue;
      if (!Object.prototype.hasOwnProperty.call(sharedState, key)) {
        return defaultValue;
      }
      return sharedState[key];
    },
    deleteSharedState: function(key) {
      if (!key || typeof key !== 'string') return false;
      if (!Object.prototype.hasOwnProperty.call(sharedState, key)) return false;
      delete sharedState[key];
      return true;
    },
    patchSharedState: function(key, patchValue) {
      if (!key || typeof key !== 'string') return undefined;
      var currentValue = modulesApi.getSharedState(key, {});
      if (
        !currentValue ||
        typeof currentValue !== 'object' ||
        Array.isArray(currentValue)
      ) {
        currentValue = {};
      }
      var nextValue = Object.assign({}, currentValue, patchValue || {});
      modulesApi.setSharedState(key, nextValue);
      return nextValue;
    },
    clearSharedState: function() {
      var keys = Object.keys(sharedState);
      for (var i = 0; i < keys.length; i++) {
        delete sharedState[keys[i]];
      }
    },
    listSharedStateKeys: function() {
      return Object.keys(sharedState).sort();
    },
    on: function(eventName, listener) {
      if (!eventName || typeof eventName !== 'string') return function() {};
      if (typeof listener !== 'function') return function() {};
      var listeners = getListenersForEvent(eventName, true);
      listeners.push(listener);
      return function unsubscribe() {
        modulesApi.off(eventName, listener);
      };
    },
    once: function(eventName, listener) {
      if (!eventName || typeof eventName !== 'string') return function() {};
      if (typeof listener !== 'function') return function() {};
      var onceWrapper = function(payload, metadata) {
        modulesApi.off(eventName, onceWrapper);
        return listener(payload, metadata);
      };
      onceWrapper.__originalListener = listener;
      return modulesApi.on(eventName, onceWrapper);
    },
    off: function(eventName, listener) {
      if (!eventName || typeof eventName !== 'string') return 0;
      var listeners = getListenersForEvent(eventName, false);
      if (!listeners.length) return 0;
      if (typeof listener !== 'function') {
        var removedCount = listeners.length;
        listeners.length = 0;
        return removedCount;
      }
      var removed = 0;
      for (var i = listeners.length - 1; i >= 0; i--) {
        var currentListener = listeners[i];
        if (
          currentListener === listener ||
          currentListener.__originalListener === listener
        ) {
          listeners.splice(i, 1);
          removed++;
        }
      }
      return removed;
    },
    emit: function(eventName, payload) {
      if (!eventName || typeof eventName !== 'string') return 0;
      var listeners = cloneArray(getListenersForEvent(eventName, false));
      if (!listeners.length) return 0;
      var metadata = {
        eventName: eventName,
        timestamp: Date.now(),
        listenersCount: listeners.length,
      };
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](payload, metadata);
        } catch (error) {
          console.error(
            '[TypeScript Modules] Listener error for event "' + eventName + '".',
            error
          );
        }
      }
      return listeners.length;
    },
    clearEventListeners: function(eventName) {
      if (!eventName || typeof eventName !== 'string') {
        var allEvents = Object.keys(scriptEventListeners);
        for (var i = 0; i < allEvents.length; i++) {
          scriptEventListeners[allEvents[i]].length = 0;
        }
        return allEvents.length;
      }
      if (!Object.prototype.hasOwnProperty.call(scriptEventListeners, eventName)) {
        return 0;
      }
      var listeners = scriptEventListeners[eventName];
      var removedCount = listeners.length;
      listeners.length = 0;
      return removedCount;
    },
    listEventNames: function() {
      return Object.keys(scriptEventListeners).sort();
    },
    evalJavaScript: function(code) {
      return new Function(code)();
    },
    registerTest: function(testName, testFunction) {
      projectTests.push({
        name: testName || 'Unnamed test',
        fn: testFunction,
      });
    },
    clearTests: function() {
      projectTests.length = 0;
    },
    runTests: function() {
      var failures = [];
      for (var i = 0; i < projectTests.length; i++) {
        var testCase = projectTests[i];
        try {
          testCase.fn();
        } catch (error) {
          failures.push({
            name: testCase.name,
            message: error && error.message ? error.message : String(error),
          });
        }
      }
      return {
        total: projectTests.length,
        passed: projectTests.length - failures.length,
        failed: failures.length,
        failures: failures,
      };
    },
    installGdjsBindings: function() {
      if (!globalObject.gdjs) return;

      if (!globalObject.gdjs.ts) globalObject.gdjs.ts = {};
      globalObject.gdjs.ts.setExternalModule = function(moduleName, moduleValue) {
        modulesApi.setExternal(moduleName, moduleValue);
      };
      globalObject.gdjs.ts.bridge = modulesApi;
      globalObject.gdjs.ts.setExternalModuleAlias = function(
        moduleName,
        globalPath
      ) {
        modulesApi.setExternalAlias(moduleName, globalPath);
      };
      globalObject.gdjs.ts.requireExternalModule = function(moduleName) {
        return modulesApi.requireExternal(moduleName);
      };
      globalObject.gdjs.ts.importExternalModule = function(moduleName) {
        return modulesApi.importExternal(moduleName);
      };
      globalObject.gdjs.ts.resolveGlobal = function(globalPath) {
        return modulesApi.resolveGlobal(globalPath);
      };
      globalObject.gdjs.ts.bindDefaultExternalModules = function() {
        modulesApi.bindDefaultExternals();
      };
      globalObject.gdjs.ts.requireModule = function(moduleName) {
        return modulesApi.require(moduleName);
      };
      globalObject.gdjs.ts.callScriptExport = function(moduleId, exportName) {
        var extraArgs = Array.prototype.slice.call(arguments, 2);
        return modulesApi.callExport.apply(
          modulesApi,
          [moduleId, exportName].concat(extraArgs)
        );
      };
      globalObject.gdjs.ts.setSharedState = function(key, value) {
        return modulesApi.setSharedState(key, value);
      };
      globalObject.gdjs.ts.getSharedState = function(key, defaultValue) {
        return modulesApi.getSharedState(key, defaultValue);
      };
      globalObject.gdjs.ts.emit = function(eventName, payload) {
        return modulesApi.emit(eventName, payload);
      };
      globalObject.gdjs.ts.on = function(eventName, listener) {
        return modulesApi.on(eventName, listener);
      };
      globalObject.gdjs.ts.off = function(eventName, listener) {
        return modulesApi.off(eventName, listener);
      };
      globalObject.gdjs.ts.registerProjectBehavior = function(
        behaviorType,
        behaviorConstructor
      ) {
        globalObject.gdjs.registerBehavior(behaviorType, behaviorConstructor);
      };
      globalObject.gdjs.ts.evalJavaScript = function(code) {
        return modulesApi.evalJavaScript(code);
      };
      globalObject.gdjs.ts.test = function(testName, testFunction) {
        modulesApi.registerTest(testName, testFunction);
      };
      globalObject.gdjs.ts.runTests = function() {
        return modulesApi.runTests();
      };
      globalObject.gdjs.ts.clearTests = function() {
        modulesApi.clearTests();
      };
      globalObject.registerProjectBehavior = function(behaviorType, behaviorConstructor) {
        globalObject.gdjs.registerBehavior(behaviorType, behaviorConstructor);
      };
      globalObject.requireModule = function(moduleName) {
        return modulesApi.require(moduleName);
      };
      globalObject.callScriptExport = function(moduleId, exportName) {
        var extraArgs = Array.prototype.slice.call(arguments, 2);
        return modulesApi.callExport.apply(
          modulesApi,
          [moduleId, exportName].concat(extraArgs)
        );
      };
      globalObject.setScriptSharedState = function(key, value) {
        return modulesApi.setSharedState(key, value);
      };
      globalObject.getScriptSharedState = function(key, defaultValue) {
        return modulesApi.getSharedState(key, defaultValue);
      };
      globalObject.emitScriptEvent = function(eventName, payload) {
        return modulesApi.emit(eventName, payload);
      };
      globalObject.onScriptEvent = function(eventName, listener) {
        return modulesApi.on(eventName, listener);
      };
      globalObject.offScriptEvent = function(eventName, listener) {
        return modulesApi.off(eventName, listener);
      };
      globalObject.requireExternalModule = function(moduleName) {
        return modulesApi.requireExternal(moduleName);
      };
      globalObject.importExternalModule = function(moduleName) {
        return modulesApi.importExternal(moduleName);
      };
      globalObject.liveRepl = function(code) {
        return modulesApi.evalJavaScript(code);
      };
    },
    require: function(moduleId) {
      return requireModule(moduleId, '');
    },
  };
  modulesApi.bindDefaultExternals();
  globalObject.__gdevelopTsModules = modulesApi;
  globalObject.tsModules = modulesApi;
})(typeof globalThis !== 'undefined' ? globalThis : window);
)TSMODULES";

  gd::String definitionsOutput = R"TSMODULEDEFS((function(globalObject) {
  var modules = globalObject.__gdevelopTsModules;
  if (!modules) return;
)TSMODULEDEFS";
  for (const auto &module : modules) {
    const gd::String sourceWithSourceUrl =
        module.transpiledCode + "\n//# sourceURL=gdevelop-ts:///" +
        module.moduleId;
    definitionsOutput +=
        "  modules.defineSource(" + AsJsonStringLiteral(module.moduleId) +
        ", " + AsJsonStringLiteral(sourceWithSourceUrl) + ");\n";
  }
  definitionsOutput +=
      "})(typeof globalThis !== 'undefined' ? globalThis : window);\n";

  gd::String lifecycleOutput = R"TSMODULELIFE((function(globalObject) {
  var modules = globalObject.__gdevelopTsModules;
  var gdjs = globalObject.gdjs;
  if (!modules || !gdjs) return;
  modules.installGdjsBindings();

  if (
    globalObject.__gdevelopTsModulesLifecycleCallbacks &&
    typeof gdjs._unregisterCallback === 'function'
  ) {
    for (
      var callbackIndex = 0;
      callbackIndex < globalObject.__gdevelopTsModulesLifecycleCallbacks.length;
      callbackIndex++
    ) {
      gdjs._unregisterCallback(
        globalObject.__gdevelopTsModulesLifecycleCallbacks[callbackIndex]
      );
    }
  }

  var lifecycleCallbacks = [];
  globalObject.__gdevelopTsModulesLifecycleCallbacks = lifecycleCallbacks;

  var moduleContexts = [
)TSMODULELIFE";

  for (const auto &module : modules) {
    lifecycleOutput += "    {\n";
    lifecycleOutput +=
        "      moduleId: " + AsJsonStringLiteral(module.moduleId) + ",\n";
    lifecycleOutput +=
        "      contextKind: " + AsJsonStringLiteral(module.contextKind) + ",\n";
    lifecycleOutput +=
        "      sceneName: " + AsJsonStringLiteral(module.sceneName) + ",\n";
    lifecycleOutput +=
        "      objectName: " + AsJsonStringLiteral(module.objectName) + ",\n";
    lifecycleOutput +=
        "      behaviorName: " + AsJsonStringLiteral(module.behaviorName) + ",\n";
    lifecycleOutput += "    },\n";
  }

  lifecycleOutput += R"TSMODULELIFE(  ];

  var toIdentifier = function(value) {
    var sanitized = String(value || '').replace(/[^A-Za-z0-9_$]/g, '_');
    if (!sanitized) return 'ScriptTarget';
    if (/^[0-9]/.test(sanitized)) return '_' + sanitized;
    return sanitized;
  };

  var sceneMatches = function(expectedSceneName, runtimeSceneName) {
    return !expectedSceneName || expectedSceneName === runtimeSceneName;
  };

  var createWeakSet = function() {
    if (typeof WeakSet !== 'undefined') {
      return new WeakSet();
    }
    return {
      _items: [],
      has: function(item) {
        return this._items.indexOf(item) !== -1;
      },
      add: function(item) {
        if (this._items.indexOf(item) === -1) {
          this._items.push(item);
        }
      },
      delete: function(item) {
        var itemIndex = this._items.indexOf(item);
        if (itemIndex !== -1) this._items.splice(itemIndex, 1);
      },
    };
  };

  var createWeakMap = function() {
    if (typeof WeakMap !== 'undefined') {
      return new WeakMap();
    }
    return {
      _keys: [],
      _values: [],
      has: function(key) {
        return this._keys.indexOf(key) !== -1;
      },
      get: function(key) {
        var keyIndex = this._keys.indexOf(key);
        return keyIndex === -1 ? undefined : this._values[keyIndex];
      },
      set: function(key, value) {
        var keyIndex = this._keys.indexOf(key);
        if (keyIndex === -1) {
          this._keys.push(key);
          this._values.push(value);
        } else {
          this._values[keyIndex] = value;
        }
      },
      delete: function(key) {
        var keyIndex = this._keys.indexOf(key);
        if (keyIndex === -1) return;
        this._keys.splice(keyIndex, 1);
        this._values.splice(keyIndex, 1);
      },
    };
  };

  var safeCall = function(callback, args, details) {
    if (typeof callback !== 'function') return;
    try {
      callback.apply(null, args);
    } catch (error) {
      console.error('[TypeScript Scripts] ' + details, error);
    }
  };

  var getHook = function(moduleExports, names) {
    if (!moduleExports) return null;

    var holders = [moduleExports];
    if (
      moduleExports.default &&
      holders.indexOf(moduleExports.default) === -1
    ) {
      holders.push(moduleExports.default);
    }

    for (var holderIndex = 0; holderIndex < holders.length; holderIndex++) {
      var holder = holders[holderIndex];
      if (!holder) continue;
      for (var nameIndex = 0; nameIndex < names.length; nameIndex++) {
        var hookName = names[nameIndex];
        if (!hookName || typeof holder[hookName] !== 'function') continue;
        return holder[hookName];
      }
    }

    return null;
  };

  var getBehaviorSafely = function(runtimeObject, behaviorName) {
    if (
      !runtimeObject ||
      !behaviorName ||
      typeof runtimeObject.getBehavior !== 'function'
    ) {
      return null;
    }
    try {
      return runtimeObject.getBehavior(behaviorName);
    } catch (error) {
      return null;
    }
  };

  var getObjectsByName = function(runtimeScene, objectName) {
    if (
      !runtimeScene ||
      !objectName ||
      typeof runtimeScene.getObjects !== 'function'
    ) {
      return [];
    }
    return runtimeScene.getObjects(objectName) || [];
  };

  var ensureBehaviorState = function(
    behaviorScript,
    runtimeScene,
    owner,
    behavior
  ) {
    if (!behaviorScript || !behavior) return false;

    var isActive =
      typeof behavior.activated === 'function' ? !!behavior.activated() : true;
    var behaviorState = behaviorScript.behaviorStates.get(behavior);
    if (!behaviorState) {
      behaviorState = { active: isActive };
      behaviorScript.behaviorStates.set(behavior, behaviorState);
      safeCall(
        behaviorScript.hooks.onBehaviorCreated,
        [runtimeScene, owner, behavior],
        'onBehaviorCreated in ' + behaviorScript.moduleId
      );
      if (isActive) {
        safeCall(
          behaviorScript.hooks.onBehaviorActivate,
          [runtimeScene, owner, behavior],
          'onBehaviorActivate in ' + behaviorScript.moduleId
        );
      }
      return isActive;
    }

    if (behaviorState.active !== isActive) {
      safeCall(
        isActive
          ? behaviorScript.hooks.onBehaviorActivate
          : behaviorScript.hooks.onBehaviorDeActivate,
        [runtimeScene, owner, behavior],
        (isActive ? 'onBehaviorActivate' : 'onBehaviorDeActivate') +
          ' in ' +
          behaviorScript.moduleId
      );
      behaviorState.active = isActive;
    }

    return isActive;
  };

  var sceneScripts = [];
  var objectScripts = [];
  var behaviorScripts = [];

  for (
    var moduleContextIndex = 0;
    moduleContextIndex < moduleContexts.length;
    moduleContextIndex++
  ) {
    var moduleContext = moduleContexts[moduleContextIndex];
    var moduleExports = null;
    try {
      moduleExports = modules.require(moduleContext.moduleId);
    } catch (error) {
      console.error(
        '[TypeScript Scripts] Unable to load module ' + moduleContext.moduleId,
        error
      );
      continue;
    }

    var contextKind = moduleContext.contextKind || 'project';
    var moduleId = moduleContext.moduleId || '';
    var sceneName = moduleContext.sceneName || '';
    var objectName = moduleContext.objectName || '';
    var behaviorName = moduleContext.behaviorName || '';

    if (contextKind === 'scene' || contextKind === 'project') {
      var legacySceneStartHookName = 'on' + toIdentifier(sceneName) + 'SceneStart';
      sceneScripts.push({
        moduleId: moduleId,
        sceneName: sceneName,
        hooks: {
          onSceneLoaded: getHook(moduleExports, [
            'onSceneLoaded',
            'onSceneStart',
            'onReady',
            legacySceneStartHookName,
          ]),
          onScenePreEvents: getHook(moduleExports, [
            'onScenePreEvents',
            'onSceneUpdate',
            '_process',
          ]),
          onScenePostEvents: getHook(moduleExports, [
            'onScenePostEvents',
            'onSceneLateUpdate',
            '_lateProcess',
          ]),
          onSceneUnloading: getHook(moduleExports, [
            'onSceneUnloading',
            'onSceneDispose',
            'onDispose',
          ]),
          onSceneUnloaded: getHook(moduleExports, ['onSceneUnloaded']),
        },
      });
      continue;
    }

    if (contextKind === 'object') {
      var legacyObjectUpdateHookName =
        'update' + toIdentifier(objectName) + 'Object';
      objectScripts.push({
        moduleId: moduleId,
        sceneName: sceneName,
        objectName: objectName,
        objectStates: createWeakSet(),
        hooks: {
          onObjectCreated: getHook(moduleExports, [
            'onObjectCreated',
            'onCreated',
          ]),
          onObjectPreEvents: getHook(moduleExports, [
            'onObjectPreEvents',
            'onObjectUpdate',
            'updateObject',
            legacyObjectUpdateHookName,
          ]),
          onObjectPostEvents: getHook(moduleExports, [
            'onObjectPostEvents',
            'onObjectLateUpdate',
          ]),
          onObjectDestroyed: getHook(moduleExports, [
            'onObjectDestroyed',
            'onDestroy',
          ]),
        },
      });
      continue;
    }

    if (contextKind === 'behavior') {
      var legacyBehaviorUpdateHookName =
        'update' + toIdentifier(objectName) + toIdentifier(behaviorName) + 'Behavior';
      behaviorScripts.push({
        moduleId: moduleId,
        sceneName: sceneName,
        objectName: objectName,
        behaviorName: behaviorName,
        behaviorStates: createWeakMap(),
        hooks: {
          onBehaviorCreated: getHook(moduleExports, [
            'onBehaviorCreated',
            'onCreated',
          ]),
          onBehaviorActivate: getHook(moduleExports, [
            'onBehaviorActivate',
            'onActivate',
          ]),
          onBehaviorDeActivate: getHook(moduleExports, [
            'onBehaviorDeActivate',
            'onBehaviorDeactivate',
            'onDeActivate',
            'onDeactivate',
          ]),
          doStepPreEvents: getHook(moduleExports, [
            'doStepPreEvents',
            'onBehaviorPreEvents',
            'onBehaviorUpdate',
            legacyBehaviorUpdateHookName,
          ]),
          doStepPostEvents: getHook(moduleExports, [
            'doStepPostEvents',
            'onBehaviorPostEvents',
            'onBehaviorLateUpdate',
          ]),
          onBehaviorDestroy: getHook(moduleExports, [
            'onBehaviorDestroy',
            'onDestroy',
          ]),
        },
      });
    }
  }

  var runSceneCallbacks = function(runtimeScene, hookName) {
    var runtimeSceneName =
      runtimeScene && typeof runtimeScene.getName === 'function'
        ? runtimeScene.getName()
        : '';
    for (var i = 0; i < sceneScripts.length; i++) {
      var sceneScript = sceneScripts[i];
      if (!sceneMatches(sceneScript.sceneName, runtimeSceneName)) continue;
      safeCall(
        sceneScript.hooks[hookName],
        [runtimeScene],
        hookName + ' in ' + sceneScript.moduleId
      );
    }
  };

  var runObjectLifecycleCallbacks = function(runtimeScene, hookName) {
    var runtimeSceneName =
      runtimeScene && typeof runtimeScene.getName === 'function'
        ? runtimeScene.getName()
        : '';
    for (var i = 0; i < objectScripts.length; i++) {
      var objectScript = objectScripts[i];
      if (!sceneMatches(objectScript.sceneName, runtimeSceneName)) continue;
      var runtimeObjects = getObjectsByName(runtimeScene, objectScript.objectName);
      for (var objectIndex = 0; objectIndex < runtimeObjects.length; objectIndex++) {
        var runtimeObject = runtimeObjects[objectIndex];
        if (!runtimeObject) continue;
        if (!objectScript.objectStates.has(runtimeObject)) {
          objectScript.objectStates.add(runtimeObject);
          safeCall(
            objectScript.hooks.onObjectCreated,
            [runtimeScene, runtimeObject],
            'onObjectCreated in ' + objectScript.moduleId
          );
        }
      }
      safeCall(
        objectScript.hooks[hookName],
        [runtimeScene, runtimeObjects],
        hookName + ' in ' + objectScript.moduleId
      );
    }
  };

  var runBehaviorLifecycleCallbacks = function(runtimeScene, hookName) {
    var runtimeSceneName =
      runtimeScene && typeof runtimeScene.getName === 'function'
        ? runtimeScene.getName()
        : '';
    for (var i = 0; i < behaviorScripts.length; i++) {
      var behaviorScript = behaviorScripts[i];
      if (!sceneMatches(behaviorScript.sceneName, runtimeSceneName)) continue;

      var owners = getObjectsByName(runtimeScene, behaviorScript.objectName);
      for (var ownerIndex = 0; ownerIndex < owners.length; ownerIndex++) {
        var owner = owners[ownerIndex];
        if (!owner) continue;
        var behavior = getBehaviorSafely(owner, behaviorScript.behaviorName);
        if (!behavior) continue;

        var isActive = ensureBehaviorState(
          behaviorScript,
          runtimeScene,
          owner,
          behavior
        );
        if (!isActive) continue;
        safeCall(
          behaviorScript.hooks[hookName],
          [runtimeScene, owner, behavior],
          hookName + ' in ' + behaviorScript.moduleId
        );
      }
    }
  };

  var runBehaviorDestroyCallbacksFromScene = function(runtimeScene) {
    var runtimeSceneName =
      runtimeScene && typeof runtimeScene.getName === 'function'
        ? runtimeScene.getName()
        : '';
    for (var i = 0; i < behaviorScripts.length; i++) {
      var behaviorScript = behaviorScripts[i];
      if (!sceneMatches(behaviorScript.sceneName, runtimeSceneName)) continue;
      var owners = getObjectsByName(runtimeScene, behaviorScript.objectName);
      for (var ownerIndex = 0; ownerIndex < owners.length; ownerIndex++) {
        var owner = owners[ownerIndex];
        if (!owner) continue;
        var behavior = getBehaviorSafely(owner, behaviorScript.behaviorName);
        if (!behavior || !behaviorScript.behaviorStates.has(behavior)) continue;
        safeCall(
          behaviorScript.hooks.onBehaviorDestroy,
          [runtimeScene, owner, behavior],
          'onBehaviorDestroy in ' + behaviorScript.moduleId
        );
        behaviorScript.behaviorStates.delete(behavior);
      }
    }
  };

  var onRuntimeSceneLoaded = function(runtimeScene) {
    runSceneCallbacks(runtimeScene, 'onSceneLoaded');
  };
  gdjs.registerRuntimeSceneLoadedCallback(onRuntimeSceneLoaded);
  lifecycleCallbacks.push(onRuntimeSceneLoaded);

  var onRuntimeScenePreEvents = function(runtimeScene) {
    runSceneCallbacks(runtimeScene, 'onScenePreEvents');
    runObjectLifecycleCallbacks(runtimeScene, 'onObjectPreEvents');
    runBehaviorLifecycleCallbacks(runtimeScene, 'doStepPreEvents');
  };
  gdjs.registerRuntimeScenePreEventsCallback(onRuntimeScenePreEvents);
  lifecycleCallbacks.push(onRuntimeScenePreEvents);

  var onRuntimeScenePostEvents = function(runtimeScene) {
    runSceneCallbacks(runtimeScene, 'onScenePostEvents');
    runObjectLifecycleCallbacks(runtimeScene, 'onObjectPostEvents');
    runBehaviorLifecycleCallbacks(runtimeScene, 'doStepPostEvents');
  };
  gdjs.registerRuntimeScenePostEventsCallback(onRuntimeScenePostEvents);
  lifecycleCallbacks.push(onRuntimeScenePostEvents);

  var onRuntimeSceneUnloading = function(runtimeScene) {
    runSceneCallbacks(runtimeScene, 'onSceneUnloading');
    runBehaviorDestroyCallbacksFromScene(runtimeScene);
  };
  gdjs.registerRuntimeSceneUnloadingCallback(onRuntimeSceneUnloading);
  lifecycleCallbacks.push(onRuntimeSceneUnloading);

  var onRuntimeSceneUnloaded = function(runtimeScene) {
    runSceneCallbacks(runtimeScene, 'onSceneUnloaded');
  };
  gdjs.registerRuntimeSceneUnloadedCallback(onRuntimeSceneUnloaded);
  lifecycleCallbacks.push(onRuntimeSceneUnloaded);

  var onObjectDeletedFromScene = function(runtimeScene, runtimeObject) {
    if (!runtimeObject || typeof runtimeObject.getName !== 'function') return;
    var runtimeSceneName =
      runtimeScene && typeof runtimeScene.getName === 'function'
        ? runtimeScene.getName()
        : '';
    var objectName = runtimeObject.getName();

    for (var i = 0; i < objectScripts.length; i++) {
      var objectScript = objectScripts[i];
      if (!sceneMatches(objectScript.sceneName, runtimeSceneName)) continue;
      if (objectScript.objectName !== objectName) continue;
      objectScript.objectStates.delete(runtimeObject);
      safeCall(
        objectScript.hooks.onObjectDestroyed,
        [runtimeScene, runtimeObject],
        'onObjectDestroyed in ' + objectScript.moduleId
      );
    }

    for (var behaviorScriptIndex = 0; behaviorScriptIndex < behaviorScripts.length; behaviorScriptIndex++) {
      var behaviorScript = behaviorScripts[behaviorScriptIndex];
      if (!sceneMatches(behaviorScript.sceneName, runtimeSceneName)) continue;
      if (behaviorScript.objectName !== objectName) continue;
      var behavior = getBehaviorSafely(runtimeObject, behaviorScript.behaviorName);
      if (!behavior || !behaviorScript.behaviorStates.has(behavior)) continue;
      safeCall(
        behaviorScript.hooks.onBehaviorDestroy,
        [runtimeScene, runtimeObject, behavior],
        'onBehaviorDestroy in ' + behaviorScript.moduleId
      );
      behaviorScript.behaviorStates.delete(behavior);
    }
  };
  gdjs.registerObjectDeletedFromSceneCallback(onObjectDeletedFromScene);
  lifecycleCallbacks.push(onObjectDeletedFromScene);
})(typeof globalThis !== 'undefined' ? globalThis : window);
)TSMODULELIFE";

  auto buildBootstrapOutput = [](const std::vector<gd::String> &moduleIds) {
    gd::String output = R"TSMODULEBOOT((function(globalObject) {
  var modules = globalObject.__gdevelopTsModules;
  if (!modules) return;
  modules.installGdjsBindings();
)TSMODULEBOOT";
    for (const auto &moduleId : moduleIds) {
      output += "  modules.require(" + AsJsonStringLiteral(moduleId) + ");\n";
    }
    output += "})(typeof globalThis !== 'undefined' ? globalThis : window);\n";
    return output;
  };

  if (!fs.WriteToFile(runtimeFilePath, runtimeOutput)) {
    lastError = _("Unable to write ") + runtimeFilePath;
    return false;
  }
  if (!fs.WriteToFile(definitionsFilePath, definitionsOutput)) {
    lastError = _("Unable to write ") + definitionsFilePath;
    return false;
  }
  if (!fs.WriteToFile(lifecycleFilePath, lifecycleOutput)) {
    lastError = _("Unable to write ") + lifecycleFilePath;
    return false;
  }
  if (!firstModuleIds.empty() &&
      !fs.WriteToFile(firstBootstrapFilePath,
                      buildBootstrapOutput(firstModuleIds))) {
    lastError = _("Unable to write ") + firstBootstrapFilePath;
    return false;
  }
  if (!lastModuleIds.empty() &&
      !fs.WriteToFile(lastBootstrapFilePath,
                      buildBootstrapOutput(lastModuleIds))) {
    lastError = _("Unable to write ") + lastBootstrapFilePath;
    return false;
  }

  std::vector<gd::String> firstIncludesFiles;
  firstIncludesFiles.push_back(runtimeFilePath);
  firstIncludesFiles.push_back(definitionsFilePath);

  std::vector<gd::String> lastIncludesFiles;
  if (!firstModuleIds.empty()) {
    lastIncludesFiles.push_back(firstBootstrapFilePath);
  }
  if (!lastModuleIds.empty()) {
    lastIncludesFiles.push_back(lastBootstrapFilePath);
  }
  lastIncludesFiles.push_back(lifecycleFilePath);

  std::vector<gd::String> reorderedIncludesFiles;
  for (const auto &includeFile : firstIncludesFiles) {
    InsertUnique(reorderedIncludesFiles, includeFile);
  }
  for (const auto &includeFile : includesFiles) {
    InsertUnique(reorderedIncludesFiles, includeFile);
  }
  for (const auto &includeFile : lastIncludesFiles) {
    InsertUnique(reorderedIncludesFiles, includeFile);
  }
  includesFiles = reorderedIncludesFiles;

  return true;
}

gd::String ExporterHelper::GetExportedIncludeFilename(
    gd::AbstractFileSystem &fs, const gd::String &gdjsRoot,
    const gd::String &include, unsigned int nonRuntimeScriptsCacheBurst) {
  auto addSearchParameterToUrl = [](const gd::String &url,
                                    const gd::String &urlEncodedParameterName,
                                    const gd::String &urlEncodedValue) {
    gd::String separator = url.find("?") == gd::String::npos ? "?" : "&";
    return url + separator + urlEncodedParameterName + "=" + urlEncodedValue;
  };

  if (!fs.IsAbsolute(include)) {
    // By convention, an include file that is relative is relative to
    // the "<GDJS Root>/Runtime" folder, and will have the same relative
    // path when exported.

    // We still do this seemingly useless relative to absolute to relative
    // conversion, because some filesystems are using a URL for gdjsRoot, and
    // will convert the relative include to an absolute URL.
    gd::String relativeInclude = gdjsRoot + "/Runtime/" + include;
    fs.MakeRelative(relativeInclude, gdjsRoot + "/Runtime/");
    return relativeInclude;
  } else {
    // Note: all the code generated from events are generated in another
    // folder and fall in this case:
    gd::String resolvedInclude = fs.FileNameFrom(include);

    if (nonRuntimeScriptsCacheBurst == 0) {
      return resolvedInclude;
    }

    // Add the parameter to force the browser to reload the code - useful
    // for cases where the browser is caching files that are getting
    // overwritten.
    return addSearchParameterToUrl(
        resolvedInclude,
        "gdCacheBurst",
        gd::String::From(nonRuntimeScriptsCacheBurst));
  }
}

bool ExporterHelper::ExportIncludesAndLibs(
    const std::vector<gd::String> &includesFiles,
    gd::String exportDir,
    bool exportSourceMaps) {
  for (auto &include : includesFiles) {
    if (!fs.IsAbsolute(include)) {
      // By convention, an include file that is relative is relative to
      // the "<GDJS Root>/Runtime" folder, and will have the same relative
      // path when exported.
      gd::String source = gdjsRoot + "/Runtime/" + include;
      if (fs.FileExists(source)) {
        gd::String path = fs.DirNameFrom(exportDir + "/" + include);
        if (!fs.DirExists(path)) fs.MkDir(path);

        fs.CopyFile(source, exportDir + "/" + include);

        gd::String sourceMap = source + ".map";
        // Copy source map if present
        if (exportSourceMaps && fs.FileExists(sourceMap)) {
          fs.CopyFile(sourceMap, exportDir + "/" + include + ".map");
        }
      } else {
        std::cout << "Could not find GDJS include file " << include
                  << std::endl;
      }
    } else {
      // Note: all the code generated from events are generated in another
      // folder and fall in this case:
      if (fs.FileExists(include)) {
        fs.CopyFile(include, exportDir + "/" + fs.FileNameFrom(include));
      } else {
        std::cout << "Could not find include file " << include << std::endl;
      }
    }
  }

  return true;
}

void ExporterHelper::ExportResources(gd::AbstractFileSystem &fs,
                                     gd::Project &project,
                                     gd::String exportDir) {
  gd::ProjectResourcesCopier::CopyAllResourcesTo(
      project, fs, exportDir, true, false, false);
}

void ExporterHelper::AddDeprecatedFontFilesToFontResources(
    gd::AbstractFileSystem &fs,
    gd::ResourcesContainer &resourcesManager,
    const gd::String &exportDir,
    gd::String urlPrefix) {
  // Compatibility with GD <= 5.0-beta56
  //
  // Before, fonts were detected by scanning the export folder for .TTF files.
  // Text Object (or anything using a font) was just declaring the font filename
  // as a file (using ArbitraryResourceWorker::ExposeFile) for export.
  //
  // To still support this, the time everything is migrated to using font
  // resources, we manually declare font resources for each ".TTF" file, using
  // the name of the file as the resource name.
  std::vector<gd::String> ttfFiles = fs.ReadDir(exportDir, ".TTF");
  for (std::size_t i = 0; i < ttfFiles.size(); ++i) {
    gd::String relativeFile = ttfFiles[i];
    fs.MakeRelative(relativeFile, exportDir);

    // Create a resource named like the file (to emulate the old behavior).
    gd::FontResource fontResource;
    fontResource.SetName(relativeFile);
    fontResource.SetFile(urlPrefix + relativeFile);

    // Note that if a resource with this name already exists, it won't be
    // overwritten - which is expected.
    resourcesManager.AddResource(fontResource);
  }
  // end of compatibility code
}

const std::array<int, 20> IOS_ICONS_SIZES = {
    180, 60,  120, 76, 152, 40, 80, 57,  114, 72,
    144, 167, 29,  58, 87,  50, 20, 100, 167, 1024,
};
const std::array<int, 6> ANDROID_ICONS_SIZES = {36, 48, 72, 96, 144, 192};

const gd::String ExporterHelper::GenerateWebManifest(
    const gd::Project &project) {
  const gd::String &orientation = project.GetOrientation();
  gd::String icons = "[";

  {
    std::map<int, gd::String> resourcesForSizes;
    const auto getFileNameForIcon = [&project](const gd::String &platform,
                                               const int size) {
      const gd::String iconName = "icon-" + gd::String::From(size);
      return project.GetPlatformSpecificAssets().Has(platform, iconName)
                 ? project.GetResourcesManager()
                       .GetResource(project.GetPlatformSpecificAssets().Get(
                           platform, iconName))
                       .GetFile()
                 : "";
    };

    for (const int size : IOS_ICONS_SIZES) {
      const auto iconFile = getFileNameForIcon("ios", size);
      if (!iconFile.empty()) resourcesForSizes[size] = iconFile;
    };

    for (const int size : ANDROID_ICONS_SIZES) {
      const auto iconFile = getFileNameForIcon("android", size);
      if (!iconFile.empty()) resourcesForSizes[size] = iconFile;
    };

    const auto desktopIconFile = getFileNameForIcon("desktop", 512);
    if (!desktopIconFile.empty()) resourcesForSizes[512] = desktopIconFile;

    for (const auto &sizeAndFile : resourcesForSizes) {
      icons +=
          gd::String(R"({
        "src": "{FILE}",
        "sizes": "{SIZE}x{SIZE}"
      },)")
              .FindAndReplace("{SIZE}", gd::String::From(sizeAndFile.first))
              .FindAndReplace("{FILE}", sizeAndFile.second);
    }
  }

  icons = icons.RightTrim(",") + "]";

  gd::String jsonName =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetName()));
  gd::String jsonPackageName =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetPackageName()));
  gd::String jsonDescription =
      gd::Serializer::ToJSON(gd::SerializerElement(project.GetDescription()));

  return gd::String(R"webmanifest({
  "name": {NAME},
  "short_name": {NAME},
  "id": {PACKAGE_ID},
  "description": {DESCRIPTION},
  "orientation": "{ORIENTATION}",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "black",
  "categories": ["games", "entertainment"],
  "icons": {ICONS}
})webmanifest")
      .FindAndReplace("{NAME}", jsonName)
      .FindAndReplace("{PACKAGE_ID}", jsonPackageName)
      .FindAndReplace("{DESCRIPTION}", jsonDescription)
      .FindAndReplace("{ORIENTATION}",
                      orientation == "default" ? "any" : orientation)
      .FindAndReplace("{ICONS}", icons);
};

}  // namespace gdjs
