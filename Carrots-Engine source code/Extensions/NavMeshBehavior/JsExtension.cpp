#if defined(GD_IDE_ONLY)
#include "GDCore/Extensions/PlatformExtension.h"

void DeclareNavMeshBehaviorExtension(gd::PlatformExtension& extension);

class NavMeshBehaviorJsExtension : public gd::PlatformExtension {
 public:
  NavMeshBehaviorJsExtension() {
    DeclareNavMeshBehaviorExtension(*this);

    const gd::String runtimeFile =
        "Extensions/NavMeshBehavior/navmeshruntimebehavior.js";
    const gd::String obstacleRuntimeFile =
        "Extensions/NavMeshBehavior/navmeshobstacleruntimebehavior.js";
    const gd::String toolsRuntimeFile =
        "Extensions/NavMeshBehavior/NavMeshTools.js";

    GetBehaviorMetadata("NavMeshBehavior::NavMeshSurfaceBehavior")
        .SetIncludeFile(runtimeFile)
        .AddIncludeFile(obstacleRuntimeFile)
        .AddIncludeFile(toolsRuntimeFile);
    GetBehaviorMetadata("NavMeshBehavior::NavMeshObstacleBehavior")
        .SetIncludeFile(runtimeFile)
        .AddIncludeFile(obstacleRuntimeFile)
        .AddIncludeFile(toolsRuntimeFile);
    GetBehaviorMetadata("NavMeshBehavior::NavMeshLinkBehavior")
        .SetIncludeFile(runtimeFile)
        .AddIncludeFile(obstacleRuntimeFile)
        .AddIncludeFile(toolsRuntimeFile);
    GetBehaviorMetadata("NavMeshBehavior::NavMeshAgentBehavior")
        .SetIncludeFile(runtimeFile)
        .AddIncludeFile(obstacleRuntimeFile)
        .AddIncludeFile(toolsRuntimeFile);

    {
      auto& actions =
          GetAllActionsForBehavior("NavMeshBehavior::NavMeshSurfaceBehavior");
      auto& conditions =
          GetAllConditionsForBehavior("NavMeshBehavior::NavMeshSurfaceBehavior");
      auto& expressions =
          GetAllExpressionsForBehavior("NavMeshBehavior::NavMeshSurfaceBehavior");

      actions["NavMeshBehavior::SetEnabled"].SetFunctionName("setEnabled");
      conditions["NavMeshBehavior::IsEnabled"].SetFunctionName("isEnabled");
      actions["NavMeshBehavior::MaxSlope"]
          .SetFunctionName("setMaxSlope")
          .SetGetter("getMaxSlope");
      conditions["NavMeshBehavior::MaxSlope"].SetFunctionName("getMaxSlope");
      expressions["MaxSlope"].SetFunctionName("getMaxSlope");
      actions["NavMeshBehavior::AreaCost"]
          .SetFunctionName("setAreaCost")
          .SetGetter("getAreaCost");
      conditions["NavMeshBehavior::AreaCost"].SetFunctionName("getAreaCost");
      expressions["AreaCost"].SetFunctionName("getAreaCost");
      actions["NavMeshBehavior::SetDynamic"].SetFunctionName("setDynamic");
      conditions["NavMeshBehavior::IsDynamic"].SetFunctionName("isDynamic");
      actions["NavMeshBehavior::RefreshIntervalFrames"]
          .SetFunctionName("setRefreshIntervalFrames")
          .SetGetter("getRefreshIntervalFrames");
      conditions["NavMeshBehavior::RefreshIntervalFrames"].SetFunctionName(
          "getRefreshIntervalFrames");
      expressions["RefreshIntervalFrames"].SetFunctionName(
          "getRefreshIntervalFrames");
    }

    {
      auto& actions = GetAllActionsForBehavior(
          "NavMeshBehavior::NavMeshObstacleBehavior");
      auto& conditions = GetAllConditionsForBehavior(
          "NavMeshBehavior::NavMeshObstacleBehavior");
      auto& expressions = GetAllExpressionsForBehavior(
          "NavMeshBehavior::NavMeshObstacleBehavior");

      actions["NavMeshBehavior::SetEnabled"].SetFunctionName("setEnabled");
      conditions["NavMeshBehavior::IsEnabled"].SetFunctionName("isEnabled");
      actions["NavMeshBehavior::Margin"]
          .SetFunctionName("setMargin")
          .SetGetter("getMargin");
      conditions["NavMeshBehavior::Margin"].SetFunctionName("getMargin");
      expressions["Margin"].SetFunctionName("getMargin");
      actions["NavMeshBehavior::SetDynamic"].SetFunctionName("setDynamic");
      conditions["NavMeshBehavior::IsDynamic"].SetFunctionName("isDynamic");
      actions["NavMeshBehavior::RefreshIntervalFrames"]
          .SetFunctionName("setRefreshIntervalFrames")
          .SetGetter("getRefreshIntervalFrames");
      conditions["NavMeshBehavior::RefreshIntervalFrames"].SetFunctionName(
          "getRefreshIntervalFrames");
      expressions["RefreshIntervalFrames"].SetFunctionName(
          "getRefreshIntervalFrames");
    }

    {
      auto& actions =
          GetAllActionsForBehavior("NavMeshBehavior::NavMeshLinkBehavior");
      auto& conditions =
          GetAllConditionsForBehavior("NavMeshBehavior::NavMeshLinkBehavior");
      auto& expressions =
          GetAllExpressionsForBehavior("NavMeshBehavior::NavMeshLinkBehavior");

      actions["NavMeshBehavior::SetEnabled"].SetFunctionName("setEnabled");
      conditions["NavMeshBehavior::IsEnabled"].SetFunctionName("isEnabled");
      actions["NavMeshBehavior::SetTargetPosition"].SetFunctionName(
          "setTargetPosition");
      actions["NavMeshBehavior::TargetX"]
          .SetFunctionName("setTargetX")
          .SetGetter("getTargetX");
      conditions["NavMeshBehavior::TargetX"].SetFunctionName("getTargetX");
      expressions["TargetX"].SetFunctionName("getTargetX");
      actions["NavMeshBehavior::TargetY"]
          .SetFunctionName("setTargetY")
          .SetGetter("getTargetY");
      conditions["NavMeshBehavior::TargetY"].SetFunctionName("getTargetY");
      expressions["TargetY"].SetFunctionName("getTargetY");
      actions["NavMeshBehavior::TargetZ"]
          .SetFunctionName("setTargetZ")
          .SetGetter("getTargetZ");
      conditions["NavMeshBehavior::TargetZ"].SetFunctionName("getTargetZ");
      expressions["TargetZ"].SetFunctionName("getTargetZ");
      actions["NavMeshBehavior::SetBidirectional"].SetFunctionName(
          "setBidirectional");
      conditions["NavMeshBehavior::IsBidirectional"].SetFunctionName(
          "isBidirectional");
      actions["NavMeshBehavior::CostMultiplier"]
          .SetFunctionName("setCostMultiplier")
          .SetGetter("getCostMultiplier");
      conditions["NavMeshBehavior::CostMultiplier"].SetFunctionName(
          "getCostMultiplier");
      expressions["CostMultiplier"].SetFunctionName("getCostMultiplier");
      actions["NavMeshBehavior::SetDynamic"].SetFunctionName("setDynamic");
      conditions["NavMeshBehavior::IsDynamic"].SetFunctionName("isDynamic");
      actions["NavMeshBehavior::RefreshIntervalFrames"]
          .SetFunctionName("setRefreshIntervalFrames")
          .SetGetter("getRefreshIntervalFrames");
      conditions["NavMeshBehavior::RefreshIntervalFrames"].SetFunctionName(
          "getRefreshIntervalFrames");
      expressions["RefreshIntervalFrames"].SetFunctionName(
          "getRefreshIntervalFrames");
    }

    {
      auto& actions =
          GetAllActionsForBehavior("NavMeshBehavior::NavMeshAgentBehavior");
      auto& conditions =
          GetAllConditionsForBehavior("NavMeshBehavior::NavMeshAgentBehavior");
      auto& expressions =
          GetAllExpressionsForBehavior("NavMeshBehavior::NavMeshAgentBehavior");

      actions["NavMeshBehavior::SetDestination"].SetFunctionName(
          "setDestination");
      actions["NavMeshBehavior::ClearDestination"].SetFunctionName(
          "clearDestination");
      actions["NavMeshBehavior::ForceRepath"].SetFunctionName("forceRepath");
      conditions["NavMeshBehavior::PathFound"].SetFunctionName("isPathFound");
      conditions["NavMeshBehavior::DestinationReached"].SetFunctionName(
          "destinationReached");
      conditions["NavMeshBehavior::IsMoving"].SetFunctionName("isMoving");
      conditions["NavMeshBehavior::HasDestination"].SetFunctionName(
          "hasDestination");
      conditions["NavMeshBehavior::IsStuck"].SetFunctionName("isStuck");
      conditions["NavMeshBehavior::MovementAngleIsAround"].SetFunctionName(
          "movementAngleIsAround");
      conditions["NavMeshBehavior::RemainingDistance"].SetFunctionName(
          "getRemainingDistance");
      expressions["RemainingDistance"].SetFunctionName("getRemainingDistance");
      conditions["NavMeshBehavior::NodeCount"].SetFunctionName("getNodeCount");
      expressions["NodeCount"].SetFunctionName("getNodeCount");
      expressions["NextNodeIndex"].SetFunctionName("getNextNodeIndex");
      expressions["GetNodeX"].SetFunctionName("getNodeX");
      expressions["GetNodeY"].SetFunctionName("getNodeY");
      expressions["GetNodeZ"].SetFunctionName("getNodeZ");
      expressions["NextNodeX"].SetFunctionName("getNextNodeX");
      expressions["NextNodeY"].SetFunctionName("getNextNodeY");
      expressions["NextNodeZ"].SetFunctionName("getNextNodeZ");
      expressions["LastNodeX"].SetFunctionName("getLastNodeX");
      expressions["LastNodeY"].SetFunctionName("getLastNodeY");
      expressions["LastNodeZ"].SetFunctionName("getLastNodeZ");
      expressions["DestinationX"].SetFunctionName("getDestinationX");
      expressions["DestinationY"].SetFunctionName("getDestinationY");
      expressions["DestinationZ"].SetFunctionName("getDestinationZ");
      expressions["MovementAngle"].SetFunctionName("getMovementAngle");

      actions["NavMeshBehavior::SetEnabled"].SetFunctionName("setEnabled");
      conditions["NavMeshBehavior::IsEnabled"].SetFunctionName("isEnabled");
      actions["NavMeshBehavior::Speed"]
          .SetFunctionName("setSpeed")
          .SetGetter("getSpeed");
      conditions["NavMeshBehavior::Speed"].SetFunctionName("getSpeed");
      expressions["Speed"].SetFunctionName("getSpeed");
      actions["NavMeshBehavior::Acceleration"]
          .SetFunctionName("setAcceleration")
          .SetGetter("getAcceleration");
      conditions["NavMeshBehavior::Acceleration"].SetFunctionName(
          "getAcceleration");
      expressions["Acceleration"].SetFunctionName("getAcceleration");
      actions["NavMeshBehavior::StoppingDistance"]
          .SetFunctionName("setStoppingDistance")
          .SetGetter("getStoppingDistance");
      conditions["NavMeshBehavior::StoppingDistance"].SetFunctionName(
          "getStoppingDistance");
      expressions["StoppingDistance"].SetFunctionName("getStoppingDistance");
      actions["NavMeshBehavior::SetAutoRepath"].SetFunctionName(
          "setAutoRepath");
      conditions["NavMeshBehavior::IsAutoRepath"].SetFunctionName(
          "isAutoRepath");
      actions["NavMeshBehavior::RepathIntervalSeconds"]
          .SetFunctionName("setRepathIntervalSeconds")
          .SetGetter("getRepathIntervalSeconds");
      conditions["NavMeshBehavior::RepathIntervalSeconds"].SetFunctionName(
          "getRepathIntervalSeconds");
      expressions["RepathIntervalSeconds"].SetFunctionName(
          "getRepathIntervalSeconds");

      actions["NavMeshBehavior::SetRotateToVelocity"].SetFunctionName(
          "setRotateToVelocity");
      conditions["NavMeshBehavior::IsRotateToVelocity"].SetFunctionName(
          "isRotateToVelocity");
      actions["NavMeshBehavior::SetProjectOnNavMesh"].SetFunctionName(
          "setProjectOnNavMesh");
      conditions["NavMeshBehavior::IsProjectOnNavMesh"].SetFunctionName(
          "isProjectOnNavMesh");

      actions["NavMeshBehavior::SetAvoidanceEnabled"].SetFunctionName(
          "setAvoidanceEnabled");
      conditions["NavMeshBehavior::IsAvoidanceEnabled"].SetFunctionName(
          "isAvoidanceEnabled");
      actions["NavMeshBehavior::AvoidanceRadius"]
          .SetFunctionName("setAvoidanceRadius")
          .SetGetter("getAvoidanceRadius");
      conditions["NavMeshBehavior::AvoidanceRadius"].SetFunctionName(
          "getAvoidanceRadius");
      expressions["AvoidanceRadius"].SetFunctionName("getAvoidanceRadius");
      actions["NavMeshBehavior::AvoidanceStrength"]
          .SetFunctionName("setAvoidanceStrength")
          .SetGetter("getAvoidanceStrength");
      conditions["NavMeshBehavior::AvoidanceStrength"].SetFunctionName(
          "getAvoidanceStrength");
      expressions["AvoidanceStrength"].SetFunctionName("getAvoidanceStrength");
      actions["NavMeshBehavior::SetDebugPathEnabled"].SetFunctionName(
          "setDebugPathEnabled");
      conditions["NavMeshBehavior::IsDebugPathEnabled"].SetFunctionName(
          "isDebugPathEnabled");
      actions["NavMeshBehavior::DebugPathColor"]
          .SetFunctionName("setDebugPathColor")
          .SetGetter("getDebugPathColor");
      conditions["NavMeshBehavior::DebugPathColor"].SetFunctionName(
          "getDebugPathColor");
      expressions["DebugPathColor"].SetFunctionName("getDebugPathColor");
    }

    StripUnimplementedInstructionsAndExpressions();
    GD_COMPLETE_EXTENSION_COMPILATION_INFORMATION();
  }
};

#if defined(EMSCRIPTEN)
extern "C" gd::PlatformExtension* CreateGDJSNavMeshBehaviorExtension() {
  return new NavMeshBehaviorJsExtension;
}
#else
extern "C" gd::PlatformExtension* GD_EXTENSION_API CreateGDJSExtension() {
  return new NavMeshBehaviorJsExtension;
}
#endif
#endif
