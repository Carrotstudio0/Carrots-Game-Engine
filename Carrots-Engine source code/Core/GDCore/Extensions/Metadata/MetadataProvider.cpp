/*
 * GDevelop Core
 * Copyright 2008-2016 Florian Rival (Florian.Rival@gmail.com). All rights
 * reserved. This project is released under the MIT License.
 */
#include "GDCore/Extensions/Metadata/MetadataProvider.h"

#include <algorithm>

#include "GDCore/Extensions/Metadata/BehaviorMetadata.h"
#include "GDCore/Extensions/Metadata/EffectMetadata.h"
#include "GDCore/Extensions/Metadata/InstructionMetadata.h"
#include "GDCore/Extensions/Metadata/ObjectMetadata.h"
#include "GDCore/Extensions/Platform.h"
#include "GDCore/Extensions/PlatformExtension.h"
#include "GDCore/Project/Layout.h"  // For GetTypeOfObject and GetTypeOfBehavior
#include "GDCore/Project/ObjectsContainersList.h"
#include "GDCore/String.h"
#include "GDCore/Events/Parsers/ExpressionParser2.h"

using namespace std;

namespace gd {

gd::BehaviorMetadata MetadataProvider::badBehaviorMetadata;
gd::ObjectMetadata MetadataProvider::badObjectInfo;
gd::EffectMetadata MetadataProvider::badEffectMetadata;
gd::InstructionMetadata MetadataProvider::badInstructionMetadata;
gd::ExpressionMetadata MetadataProvider::badExpressionMetadata;
gd::PlatformExtension MetadataProvider::badExtension;

ExtensionAndMetadata<BehaviorMetadata>
MetadataProvider::GetExtensionAndBehaviorMetadata(const gd::Platform& platform,
                                                  gd::String behaviorType) {
  for (auto& extension : platform.GetAllPlatformExtensions()) {
    if (extension->HasBehavior(behaviorType))
      return ExtensionAndMetadata<BehaviorMetadata>(
          *extension, extension->GetBehaviorMetadata(behaviorType));
  }

  return ExtensionAndMetadata<BehaviorMetadata>(badExtension, badBehaviorMetadata);
}

const BehaviorMetadata& MetadataProvider::GetBehaviorMetadata(
    const gd::Platform& platform, gd::String behaviorType) {
  return GetExtensionAndBehaviorMetadata(platform, behaviorType).GetMetadata();
}

ExtensionAndMetadata<ObjectMetadata>
MetadataProvider::GetExtensionAndObjectMetadata(const gd::Platform& platform,
                                                gd::String objectType) {
  for (auto& extension : platform.GetAllPlatformExtensions()) {
    if (extension->HasObject(objectType))
      return ExtensionAndMetadata<ObjectMetadata>(
          *extension, extension->GetObjectMetadata(objectType));
  }

  return ExtensionAndMetadata<ObjectMetadata>(badExtension, badObjectInfo);
}

const ObjectMetadata& MetadataProvider::GetObjectMetadata(
    const gd::Platform& platform, gd::String objectType) {
  return GetExtensionAndObjectMetadata(platform, objectType).GetMetadata();
}

ExtensionAndMetadata<EffectMetadata>
MetadataProvider::GetExtensionAndEffectMetadata(const gd::Platform& platform,
                                                gd::String type) {
  for (auto& extension : platform.GetAllPlatformExtensions()) {
    if (extension->HasEffect(type))
      return ExtensionAndMetadata<EffectMetadata>(
          *extension, extension->GetEffectMetadata(type));
  }

  return ExtensionAndMetadata<EffectMetadata>(badExtension, badEffectMetadata);
}

const EffectMetadata& MetadataProvider::GetEffectMetadata(
    const gd::Platform& platform, gd::String objectType) {
  return GetExtensionAndEffectMetadata(platform, objectType).GetMetadata();
}

ExtensionAndMetadata<InstructionMetadata>
MetadataProvider::GetExtensionAndActionMetadata(const gd::Platform& platform,
                                                gd::String actionType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    const auto& allActions = extension->GetAllActions();
    auto action = allActions.find(actionType);
    if (action != allActions.end())
      return ExtensionAndMetadata<InstructionMetadata>(*extension,
                                                       action->second);

    const auto& objects = extension->GetExtensionObjectsTypes();
    for (const gd::String& extObjectType : objects) {
      const auto& allObjectsActions =
          extension->GetAllActionsForObject(extObjectType);
      auto objectAction = allObjectsActions.find(actionType);
      if (objectAction != allObjectsActions.end())
        return ExtensionAndMetadata<InstructionMetadata>(
            *extension, objectAction->second);
    }

    const auto& autos = extension->GetBehaviorsTypes();
    for (std::size_t j = 0; j < autos.size(); ++j) {
      const auto& allAutosActions =
          extension->GetAllActionsForBehavior(autos[j]);
      auto behaviorAction = allAutosActions.find(actionType);
      if (behaviorAction != allAutosActions.end())
        return ExtensionAndMetadata<InstructionMetadata>(
            *extension, behaviorAction->second);
    }
  }

  return ExtensionAndMetadata<InstructionMetadata>(badExtension,
                                                   badInstructionMetadata);
}

const gd::InstructionMetadata& MetadataProvider::GetActionMetadata(
    const gd::Platform& platform, gd::String actionType) {
  return GetExtensionAndActionMetadata(platform, actionType).GetMetadata();
}

ExtensionAndMetadata<InstructionMetadata>
MetadataProvider::GetExtensionAndConditionMetadata(const gd::Platform& platform,
                                                   gd::String conditionType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    const auto& allConditions = extension->GetAllConditions();
    auto condition = allConditions.find(conditionType);
    if (condition != allConditions.end())
      return ExtensionAndMetadata<InstructionMetadata>(*extension,
                                                       condition->second);

    const auto& objects = extension->GetExtensionObjectsTypes();
    for (const gd::String& extObjectType : objects) {
      const auto& allObjectsConditions =
          extension->GetAllConditionsForObject(extObjectType);
      auto objectCondition = allObjectsConditions.find(conditionType);
      if (objectCondition != allObjectsConditions.end())
        return ExtensionAndMetadata<InstructionMetadata>(
            *extension, objectCondition->second);
    }

    const auto& autos = extension->GetBehaviorsTypes();
    for (std::size_t j = 0; j < autos.size(); ++j) {
      const auto& allAutosConditions =
          extension->GetAllConditionsForBehavior(autos[j]);
      auto behaviorCondition = allAutosConditions.find(conditionType);
      if (behaviorCondition != allAutosConditions.end())
        return ExtensionAndMetadata<InstructionMetadata>(
            *extension, behaviorCondition->second);
    }
  }

  return ExtensionAndMetadata<InstructionMetadata>(badExtension,
                                                   badInstructionMetadata);
}

const gd::InstructionMetadata& MetadataProvider::GetConditionMetadata(
    const gd::Platform& platform, gd::String conditionType) {
  return GetExtensionAndConditionMetadata(platform, conditionType)
      .GetMetadata();
}

ExtensionAndMetadata<ExpressionMetadata>
MetadataProvider::GetExtensionAndObjectExpressionMetadata(
    const gd::Platform& platform, gd::String objectType, gd::String exprType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    if (extension->HasObject(objectType)) {
      const auto& allObjectExpressions =
          extension->GetAllExpressionsForObject(objectType);
      auto objectExpression = allObjectExpressions.find(exprType);
      if (objectExpression != allObjectExpressions.end())
        return ExtensionAndMetadata<ExpressionMetadata>(
            *extension, objectExpression->second);
    }
  }

  // Then check base
  for (auto& extension : extensions) {
    const auto& allObjectExpressions =
        extension->GetAllExpressionsForObject("");
    auto objectExpression = allObjectExpressions.find(exprType);
    if (objectExpression != allObjectExpressions.end())
      return ExtensionAndMetadata<ExpressionMetadata>(
          *extension, objectExpression->second);
  }

  return ExtensionAndMetadata<ExpressionMetadata>(badExtension,
                                                  badExpressionMetadata);
}

const gd::ExpressionMetadata& MetadataProvider::GetObjectExpressionMetadata(
    const gd::Platform& platform, gd::String objectType, gd::String exprType) {
  return GetExtensionAndObjectExpressionMetadata(platform, objectType, exprType)
      .GetMetadata();
}

ExtensionAndMetadata<ExpressionMetadata>
MetadataProvider::GetExtensionAndBehaviorExpressionMetadata(
    const gd::Platform& platform, gd::String autoType, gd::String exprType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    if (extension->HasBehavior(autoType)) {
      const auto& allAutoExpressions =
          extension->GetAllExpressionsForBehavior(autoType);
      if (allAutoExpressions.find(exprType) != allAutoExpressions.end())
        return ExtensionAndMetadata<ExpressionMetadata>(
            *extension, allAutoExpressions.find(exprType)->second);
    }
  }

  // Then check base
  for (auto& extension : extensions) {
    const auto& allAutoExpressions =
        extension->GetAllExpressionsForBehavior("");
    if (allAutoExpressions.find(exprType) != allAutoExpressions.end())
      return ExtensionAndMetadata<ExpressionMetadata>(
          *extension, allAutoExpressions.find(exprType)->second);
  }

  return ExtensionAndMetadata<ExpressionMetadata>(badExtension,
                                                  badExpressionMetadata);
}

const gd::ExpressionMetadata& MetadataProvider::GetBehaviorExpressionMetadata(
    const gd::Platform& platform, gd::String autoType, gd::String exprType) {
  return GetExtensionAndBehaviorExpressionMetadata(platform, autoType, exprType)
      .GetMetadata();
}

ExtensionAndMetadata<ExpressionMetadata>
MetadataProvider::GetExtensionAndExpressionMetadata(
    const gd::Platform& platform, gd::String exprType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    const auto& allExpr = extension->GetAllExpressions();
    auto expression = allExpr.find(exprType);
    if (expression != allExpr.end())
      return ExtensionAndMetadata<ExpressionMetadata>(
          *extension, expression->second);
  }

  return ExtensionAndMetadata<ExpressionMetadata>(badExtension,
                                                  badExpressionMetadata);
}

const gd::ExpressionMetadata& MetadataProvider::GetExpressionMetadata(
    const gd::Platform& platform, gd::String exprType) {
  return GetExtensionAndExpressionMetadata(platform, exprType).GetMetadata();
}

ExtensionAndMetadata<ExpressionMetadata>
MetadataProvider::GetExtensionAndObjectStrExpressionMetadata(
    const gd::Platform& platform, gd::String objectType, gd::String exprType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    if (extension->HasObject(objectType)) {
      const auto& allObjectStrExpressions =
          extension->GetAllStrExpressionsForObject(objectType);
      auto objectStrExpression = allObjectStrExpressions.find(exprType);
      if (objectStrExpression != allObjectStrExpressions.end())
        return ExtensionAndMetadata<ExpressionMetadata>(
            *extension, objectStrExpression->second);
    }
  }

  // Then check in functions of "Base object".
  for (auto& extension : extensions) {
    const auto& allObjectStrExpressions =
        extension->GetAllStrExpressionsForObject("");
    auto objectStrExpression = allObjectStrExpressions.find(exprType);
    if (objectStrExpression != allObjectStrExpressions.end())
      return ExtensionAndMetadata<ExpressionMetadata>(
          *extension, objectStrExpression->second);
  }

  return ExtensionAndMetadata<ExpressionMetadata>(badExtension,
                                                  badExpressionMetadata);
}

const gd::ExpressionMetadata& MetadataProvider::GetObjectStrExpressionMetadata(
    const gd::Platform& platform, gd::String objectType, gd::String exprType) {
  return GetExtensionAndObjectStrExpressionMetadata(
             platform, objectType, exprType)
      .GetMetadata();
}

ExtensionAndMetadata<ExpressionMetadata>
MetadataProvider::GetExtensionAndBehaviorStrExpressionMetadata(
    const gd::Platform& platform, gd::String autoType, gd::String exprType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    if (extension->HasBehavior(autoType)) {
      const auto& allBehaviorStrExpressions =
          extension->GetAllStrExpressionsForBehavior(autoType);
      auto behaviorStrExpression = allBehaviorStrExpressions.find(exprType);
      if (behaviorStrExpression != allBehaviorStrExpressions.end())
        return ExtensionAndMetadata<ExpressionMetadata>(
            *extension, behaviorStrExpression->second);
    }
  }

  // Then check in functions of "Base object".
  for (auto& extension : extensions) {
    const auto& allBehaviorStrExpressions =
        extension->GetAllStrExpressionsForBehavior("");
    auto behaviorStrExpression = allBehaviorStrExpressions.find(exprType);
    if (behaviorStrExpression != allBehaviorStrExpressions.end())
      return ExtensionAndMetadata<ExpressionMetadata>(
          *extension, behaviorStrExpression->second);
  }

  return ExtensionAndMetadata<ExpressionMetadata>(badExtension,
                                                  badExpressionMetadata);
}

const gd::ExpressionMetadata&
MetadataProvider::GetBehaviorStrExpressionMetadata(const gd::Platform& platform,
                                                   gd::String autoType,
                                                   gd::String exprType) {
  return GetExtensionAndBehaviorStrExpressionMetadata(
             platform, autoType, exprType)
      .GetMetadata();
}

ExtensionAndMetadata<ExpressionMetadata>
MetadataProvider::GetExtensionAndStrExpressionMetadata(
    const gd::Platform& platform, gd::String exprType) {
  auto& extensions = platform.GetAllPlatformExtensions();
  for (auto& extension : extensions) {
    const auto& allExpr = extension->GetAllStrExpressions();
    auto expression = allExpr.find(exprType);
    if (expression != allExpr.end())
      return ExtensionAndMetadata<ExpressionMetadata>(
          *extension, expression->second);
  }

  return ExtensionAndMetadata<ExpressionMetadata>(badExtension,
                                                  badExpressionMetadata);
}

const gd::ExpressionMetadata& MetadataProvider::GetStrExpressionMetadata(
    const gd::Platform& platform, gd::String exprType) {
  return GetExtensionAndStrExpressionMetadata(platform, exprType).GetMetadata();
}

const gd::ExpressionMetadata& MetadataProvider::GetAnyExpressionMetadata(
    const gd::Platform& platform, gd::String exprType) {
  const auto& numberExpressionMetadata =
      GetExpressionMetadata(platform, exprType);
  if (&numberExpressionMetadata != &badExpressionMetadata) {
    return numberExpressionMetadata;
  }
  const auto& stringExpressionMetadata =
      GetStrExpressionMetadata(platform, exprType);
  if (&stringExpressionMetadata != &badExpressionMetadata) {
    return stringExpressionMetadata;
  }
  return badExpressionMetadata;
}

const gd::ExpressionMetadata& MetadataProvider::GetObjectAnyExpressionMetadata(
    const gd::Platform& platform, gd::String objectType, gd::String exprType) {
  const auto& numberExpressionMetadata =
      GetObjectExpressionMetadata(platform, objectType, exprType);
  if (&numberExpressionMetadata != &badExpressionMetadata) {
    return numberExpressionMetadata;
  }
  const auto& stringExpressionMetadata =
      GetObjectStrExpressionMetadata(platform, objectType, exprType);
  if (&stringExpressionMetadata != &badExpressionMetadata) {
    return stringExpressionMetadata;
  }
  return badExpressionMetadata;
}

const gd::ExpressionMetadata&
MetadataProvider::GetBehaviorAnyExpressionMetadata(const gd::Platform& platform,
                                                   gd::String autoType,
                                                   gd::String exprType) {
  const auto& numberExpressionMetadata =
      GetBehaviorExpressionMetadata(platform, autoType, exprType);
  if (&numberExpressionMetadata != &badExpressionMetadata) {
    return numberExpressionMetadata;
  }
  const auto& stringExpressionMetadata =
      GetBehaviorStrExpressionMetadata(platform, autoType, exprType);
  if (&stringExpressionMetadata != &badExpressionMetadata) {
    return stringExpressionMetadata;
  }
  return badExpressionMetadata;
}

const gd::ExpressionMetadata& MetadataProvider::GetFunctionCallMetadata(
    const gd::Platform& platform,
    const gd::ObjectsContainersList &objectsContainersList,
    FunctionCallNode& node) {

  if (!node.behaviorName.empty()) {
    gd::String behaviorType =
        objectsContainersList.GetTypeOfBehavior(node.behaviorName);
    return MetadataProvider::GetBehaviorAnyExpressionMetadata(
            platform, behaviorType, node.functionName);
  }
  else if (!node.objectName.empty()) {
    gd::String objectType =
        objectsContainersList.GetTypeOfObject(node.objectName);
    return MetadataProvider::GetObjectAnyExpressionMetadata(
                  platform, objectType, node.functionName);
  }

  return MetadataProvider::GetAnyExpressionMetadata(platform, node.functionName);
}

const gd::ParameterMetadata* MetadataProvider::GetFunctionCallParameterMetadata(
    const gd::Platform& platform,
    const gd::ObjectsContainersList &objectsContainersList,
    FunctionCallNode& functionCall,
    ExpressionNode& parameter) {
      int parameterIndex = -1;
      for (int i = 0; i < functionCall.parameters.size(); i++) {
        if (functionCall.parameters.at(i).get() == &parameter) {
          parameterIndex = i;
          break;
        }
      }
      if (parameterIndex < 0) {
        return nullptr;
      }
      return MetadataProvider::GetFunctionCallParameterMetadata(
          platform,
          objectsContainersList,
          functionCall,
          parameterIndex);
}

const gd::ParameterMetadata* MetadataProvider::GetFunctionCallParameterMetadata(
    const gd::Platform& platform,
    const gd::ObjectsContainersList &objectsContainersList,
    FunctionCallNode& functionCall,
    int parameterIndex) {
      // Search the parameter metadata index skipping invisible ones.
      size_t visibleParameterIndex = 0;
      size_t metadataParameterIndex =
          ExpressionParser2::WrittenParametersFirstIndex(
              functionCall.objectName, functionCall.behaviorName);
      const gd::ExpressionMetadata &metadata = MetadataProvider::GetFunctionCallMetadata(
          platform, objectsContainersList, functionCall);

      if (IsBadExpressionMetadata(metadata)) {
        return nullptr;
      }

      // TODO use a badMetadata instead of a nullptr?
      const gd::ParameterMetadata* parameterMetadata = nullptr;
      while (metadataParameterIndex <
             metadata.GetParameters().GetParametersCount()) {
        if (!metadata.GetParameters().GetParameter(metadataParameterIndex)
                 .IsCodeOnly()) {
          if (visibleParameterIndex == parameterIndex) {
            parameterMetadata =
                &metadata.GetParameters().GetParameter(metadataParameterIndex);
          }
          visibleParameterIndex++;
        }
        metadataParameterIndex++;
      }
      const int visibleParameterCount = visibleParameterIndex;
      // It can be null if there are too many parameters in the expression, this text node is
      // not actually linked to a parameter expected by the function call.
      return parameterMetadata;
}

MetadataProvider::~MetadataProvider() {}
MetadataProvider::MetadataProvider() {}

}  // namespace gd
