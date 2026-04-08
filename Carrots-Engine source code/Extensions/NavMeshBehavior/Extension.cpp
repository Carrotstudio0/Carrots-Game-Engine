
#include "GDCore/Extensions/Metadata/MultipleInstructionMetadata.h"
#include "GDCore/Extensions/PlatformExtension.h"
#include "GDCore/Project/BehaviorsSharedData.h"
#include "GDCore/Tools/Localization.h"
#include "NavMeshAgentBehavior.h"
#include "NavMeshLinkBehavior.h"
#include "NavMeshObstacleBehavior.h"
#include "NavMeshSurfaceBehavior.h"

void DeclareNavMeshBehaviorExtension(gd::PlatformExtension& extension) {
  extension
      .SetExtensionInformation(
          "NavMeshBehavior",
          _("3D Navmesh"),
          _(
              "3D runtime navmesh with surfaces, obstacles, links and agents."),
          "Carrots Engine Team",
          "Open source (MIT License)")
      .SetShortDescription(
          "3D NavMesh: surfaces, obstacles, links, agents, repath and "
          "avoidance.")
      .SetDimension("3D")
      .SetCategory("Movement")
      .SetTags("navmesh, pathfinding, 3d, ai")
      .SetExtensionHelpPath("/behaviors/navmesh");

  extension.AddInstructionOrExpressionGroupMetadata(_("3D Navmesh"))
      .SetIcon("CppPlatform/Extensions/AStaricon16.png");

  {
    gd::BehaviorMetadata& surface = extension.AddBehavior(
        "NavMeshSurfaceBehavior",
        _("3D Navmesh surface"),
        "NavMeshSurface",
        _("Contribute this 3D object mesh to navmesh generation."),
        "",
        "CppPlatform/Extensions/AStaricon.png",
        "NavMeshSurfaceBehavior",
        std::make_shared<NavMeshSurfaceBehavior>(),
        std::make_shared<gd::BehaviorsSharedData>());

    surface
        .AddScopedAction("SetEnabled",
                         _("Enable/disable"),
                         _("Enable or disable this surface."),
                         _("Set _PARAM0_ navmesh surface: _PARAM2_"),
                         _("NavMesh surface"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .AddParameter("yesorno", _("Enabled"))
        .SetFunctionName("setEnabled");

    surface
        .AddScopedCondition("IsEnabled",
                            _("Enabled"),
                            _("Check if surface is enabled."),
                            _("_PARAM0_ surface is enabled"),
                            _("NavMesh surface"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .SetFunctionName("isEnabled");

    surface
        .AddExpressionAndConditionAndAction(
            "number",
            "MaxSlope",
            _("Max slope"),
            _("the maximum walkable slope in degrees"),
            _("the max slope"),
            _("NavMesh surface"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Maximum walkable slope in degrees (0 to 89.9).")))
        .SetFunctionName("setMaxSlope")
        .SetGetter("getMaxSlope");

    surface
        .AddExpressionAndConditionAndAction(
            "number",
            "AreaCost",
            _("Area cost"),
            _("the path cost multiplier of this surface"),
            _("the area cost"),
            _("NavMesh surface"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Cost multiplier used by A* when crossing this surface.")))
        .SetFunctionName("setAreaCost")
        .SetGetter("getAreaCost");

    surface
        .AddScopedAction("SetDynamic",
                         _("Set dynamic updates"),
                         _("Enable or disable runtime rebuild checks for this "
                           "surface."),
                         _("Set dynamic updates of _PARAM0_ to _PARAM2_"),
                         _("NavMesh surface"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .AddParameter("yesorno", _("Dynamic updates"))
        .SetFunctionName("setDynamic");

    surface
        .AddScopedCondition("IsDynamic",
                            _("Dynamic updates enabled"),
                            _("Check if runtime rebuild checks are enabled."),
                            _("_PARAM0_ surface dynamic updates are enabled"),
                            _("NavMesh surface"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .SetFunctionName("isDynamic");

    surface
        .AddExpressionAndConditionAndAction(
            "number",
            "RefreshIntervalFrames",
            _("Refresh interval (frames)"),
            _("the frame interval for dynamic navmesh refresh checks"),
            _("the refresh interval"),
            _("NavMesh surface"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Frames between dynamic transform checks (minimum 1).")))
        .SetFunctionName("setRefreshIntervalFrames")
        .SetGetter("getRefreshIntervalFrames");

    surface
        .AddScopedAction("SetDebugMeshEnabled",
                         _("Set debug mesh"),
                         _("Enable or disable navmesh debug mesh rendering for "
                           "this layer."),
                         _("Set debug mesh of _PARAM0_ to _PARAM2_"),
                         _("NavMesh surface"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .AddParameter("yesorno", _("Debug mesh"))
        .SetFunctionName("setDebugMeshEnabled");

    surface
        .AddScopedCondition("IsDebugMeshEnabled",
                            _("Debug mesh enabled"),
                            _("Check if navmesh debug mesh rendering is "
                              "enabled."),
                            _("_PARAM0_ debug mesh is enabled"),
                            _("NavMesh surface"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .SetFunctionName("isDebugMeshEnabled");

    surface
        .AddExpressionAndConditionAndAction(
            "number",
            "DebugMeshColor",
            _("Debug mesh color"),
            _("the debug mesh color as RGB integer"),
            _("the debug mesh color"),
            _("NavMesh surface"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshSurfaceBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("RGB integer color (for example 3394815 for light blue).")))
        .SetFunctionName("setDebugMeshColor")
        .SetGetter("getDebugMeshColor");
  }

  {
    gd::BehaviorMetadata& obstacle = extension.AddBehavior(
        "NavMeshObstacleBehavior",
        _("3D Navmesh obstacle"),
        "NavMeshObstacle",
        _("Block navmesh triangles using this object 3D bounds."),
        "",
        "CppPlatform/Extensions/AStaricon.png",
        "NavMeshObstacleBehavior",
        std::make_shared<NavMeshObstacleBehavior>(),
        std::make_shared<gd::BehaviorsSharedData>());

    obstacle
        .AddScopedAction("SetEnabled",
                         _("Enable/disable"),
                         _("Enable or disable this obstacle."),
                         _("Set _PARAM0_ navmesh obstacle: _PARAM2_"),
                         _("NavMesh obstacle"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshObstacleBehavior")
        .AddParameter("yesorno", _("Enabled"))
        .SetFunctionName("setEnabled");

    obstacle
        .AddScopedCondition("IsEnabled",
                            _("Enabled"),
                            _("Check if obstacle is enabled."),
                            _("_PARAM0_ obstacle is enabled"),
                            _("NavMesh obstacle"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshObstacleBehavior")
        .SetFunctionName("isEnabled");
    obstacle
        .AddExpressionAndConditionAndAction(
            "number",
            "Margin",
            _("Obstacle margin"),
            _("the navmesh obstacle margin"),
            _("the obstacle margin"),
            _("NavMesh obstacle"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshObstacleBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Additional margin used around obstacle bounds.")))
        .SetFunctionName("setMargin")
        .SetGetter("getMargin");

    obstacle
        .AddScopedAction("SetDynamic",
                         _("Set dynamic updates"),
                         _("Enable or disable runtime rebuild checks for this "
                           "obstacle."),
                         _("Set dynamic updates of _PARAM0_ to _PARAM2_"),
                         _("NavMesh obstacle"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshObstacleBehavior")
        .AddParameter("yesorno", _("Dynamic updates"))
        .SetFunctionName("setDynamic");

    obstacle
        .AddScopedCondition("IsDynamic",
                            _("Dynamic updates enabled"),
                            _("Check if runtime rebuild checks are enabled."),
                            _("_PARAM0_ obstacle dynamic updates are enabled"),
                            _("NavMesh obstacle"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshObstacleBehavior")
        .SetFunctionName("isDynamic");

    obstacle
        .AddExpressionAndConditionAndAction(
            "number",
            "RefreshIntervalFrames",
            _("Refresh interval (frames)"),
            _("the frame interval for dynamic obstacle refresh checks"),
            _("the refresh interval"),
            _("NavMesh obstacle"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshObstacleBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Frames between dynamic transform checks (minimum 1).")))
        .SetFunctionName("setRefreshIntervalFrames")
        .SetGetter("getRefreshIntervalFrames");
  }

  {
    gd::BehaviorMetadata& link = extension.AddBehavior(
        "NavMeshLinkBehavior",
        _("3D Navmesh link"),
        "NavMeshLink",
        _("Create an off-mesh link connecting two 3D positions for agents."),
        "",
        "CppPlatform/Extensions/AStaricon.png",
        "NavMeshLinkBehavior",
        std::make_shared<NavMeshLinkBehavior>(),
        std::make_shared<gd::BehaviorsSharedData>());

    link.AddScopedAction("SetEnabled",
                         _("Enable/disable"),
                         _("Enable or disable this link."),
                         _("Set _PARAM0_ navmesh link: _PARAM2_"),
                         _("NavMesh link"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .AddParameter("yesorno", _("Enabled"))
        .SetFunctionName("setEnabled");

    link.AddScopedCondition("IsEnabled",
                            _("Enabled"),
                            _("Check if link is enabled."),
                            _("_PARAM0_ link is enabled"),
                            _("NavMesh link"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .SetFunctionName("isEnabled");

    link.AddScopedAction("SetTargetPosition",
                         _("Set target position"),
                         _("Set link target world position."),
                         _("Set _PARAM0_ link target to _PARAM2_; _PARAM3_; "
                           "_PARAM4_"),
                         _("NavMesh link"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .AddParameter("expression", _("Target X"))
        .AddParameter("expression", _("Target Y"))
        .AddParameter("expression", _("Target Z"))
        .SetFunctionName("setTargetPosition");

    link.AddExpressionAndConditionAndAction("number",
                                            "TargetX",
                                            _("Target X"),
                                            _("the navmesh link target X"),
                                            _("the target X"),
                                            _("NavMesh link"),
                                            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setTargetX")
        .SetGetter("getTargetX");

    link.AddExpressionAndConditionAndAction("number",
                                            "TargetY",
                                            _("Target Y"),
                                            _("the navmesh link target Y"),
                                            _("the target Y"),
                                            _("NavMesh link"),
                                            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setTargetY")
        .SetGetter("getTargetY");

    link.AddExpressionAndConditionAndAction("number",
                                            "TargetZ",
                                            _("Target Z"),
                                            _("the navmesh link target Z"),
                                            _("the target Z"),
                                            _("NavMesh link"),
                                            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setTargetZ")
        .SetGetter("getTargetZ");
    link.AddScopedAction("SetBidirectional",
                         _("Set bidirectional"),
                         _("Enable or disable movement in both directions on "
                           "this link."),
                         _("Set bidirectional of _PARAM0_ to _PARAM2_"),
                         _("NavMesh link"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .AddParameter("yesorno", _("Bidirectional"))
        .SetFunctionName("setBidirectional");

    link.AddScopedCondition("IsBidirectional",
                            _("Bidirectional enabled"),
                            _("Check if this navmesh link is bidirectional."),
                            _("_PARAM0_ link is bidirectional"),
                            _("NavMesh link"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .SetFunctionName("isBidirectional");

    link.AddExpressionAndConditionAndAction(
            "number",
            "CostMultiplier",
            _("Cost multiplier"),
            _("the link traversal cost multiplier"),
            _("the cost multiplier"),
            _("NavMesh link"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setCostMultiplier")
        .SetGetter("getCostMultiplier");

    link.AddScopedAction("SetDynamic",
                         _("Set dynamic updates"),
                         _("Enable or disable runtime rebuild checks for this "
                           "link."),
                         _("Set dynamic updates of _PARAM0_ to _PARAM2_"),
                         _("NavMesh link"),
                         "CppPlatform/Extensions/AStaricon24.png",
                         "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .AddParameter("yesorno", _("Dynamic updates"))
        .SetFunctionName("setDynamic");

    link.AddScopedCondition("IsDynamic",
                            _("Dynamic updates enabled"),
                            _("Check if runtime rebuild checks are enabled."),
                            _("_PARAM0_ link dynamic updates are enabled"),
                            _("NavMesh link"),
                            "CppPlatform/Extensions/AStaricon24.png",
                            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .SetFunctionName("isDynamic");

    link.AddExpressionAndConditionAndAction(
            "number",
            "RefreshIntervalFrames",
            _("Refresh interval (frames)"),
            _("the frame interval for dynamic link refresh checks"),
            _("the refresh interval"),
            _("NavMesh link"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshLinkBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Frames between dynamic transform checks (minimum 1).")))
        .SetFunctionName("setRefreshIntervalFrames")
        .SetGetter("getRefreshIntervalFrames");
  }

  {
    gd::BehaviorMetadata& agent = extension.AddBehavior(
        "NavMeshAgentBehavior",
        _("3D Navmesh agent"),
        "NavMeshAgent",
        _("Move this object across 3D navmesh surfaces at runtime."),
        "",
        "CppPlatform/Extensions/AStaricon.png",
        "NavMeshAgentBehavior",
        std::make_shared<NavMeshAgentBehavior>(),
        std::make_shared<gd::BehaviorsSharedData>());

    agent.AddScopedAction("SetDestination",
                          _("Set destination"),
                          _("Set destination and start pathfinding."),
                          _("Move _PARAM0_ to _PARAM2_; _PARAM3_; _PARAM4_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("expression", _("Destination X"))
        .AddParameter("expression", _("Destination Y"))
        .AddParameter("expression", _("Destination Z"))
        .SetFunctionName("setDestination");

    agent.AddScopedAction("ClearDestination",
                          _("Clear destination"),
                          _("Stop movement and clear the current destination."),
                          _("Clear destination of _PARAM0_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("clearDestination");

    agent.AddScopedAction("ForceRepath",
                          _("Force repath"),
                          _("Recompute the current path immediately."),
                          _("Force path rebuild for _PARAM0_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("forceRepath");

    agent.AddScopedCondition("PathFound",
                             _("Path found"),
                             _("Check if the current destination has a valid "
                               "path."),
                             _("_PARAM0_ has a navmesh path"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isPathFound");

    agent.AddScopedCondition("DestinationReached",
                             _("Destination reached"),
                             _("Check if destination is reached."),
                             _("_PARAM0_ reached destination"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("destinationReached");

    agent.AddScopedCondition("IsMoving",
                             _("Is moving"),
                             _("Check if the agent is currently moving."),
                             _("_PARAM0_ is moving"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isMoving");

    agent.AddScopedCondition("HasDestination",
                             _("Has destination"),
                             _("Check if the agent has an active destination."),
                             _("_PARAM0_ has a destination"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("hasDestination");

    agent.AddScopedCondition("IsStuck",
                             _("Is stuck"),
                             _("Check if the agent is currently stuck and trying "
                               "to repath."),
                             _("_PARAM0_ is stuck"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isStuck");

    agent.AddScopedCondition(
            "MovementAngleIsAround",
            _("Movement angle"),
            _("Compare the horizontal movement angle of the agent."),
            _("Movement angle of _PARAM0_ is _PARAM2_ ± _PARAM3_°"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png",
            "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("expression", _("Angle, in degrees"))
        .AddParameter("expression", _("Tolerance, in degrees"))
        .SetFunctionName("movementAngleIsAround");

    agent.AddCondition("RemainingDistance",
                       _("Remaining distance"),
                       _("Compare remaining distance to destination."),
                       _("the remaining path distance"),
                       _("NavMesh agent"),
                       "CppPlatform/Extensions/AStaricon24.png",
                       "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardRelationalOperatorParameters(
            "number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("getRemainingDistance");
    agent.AddExpression("RemainingDistance",
                        _("Remaining distance"),
                        _("the remaining path distance to destination"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getRemainingDistance");

    agent.AddCondition("NodeCount",
                       _("Waypoint count"),
                       _("Compare the number of waypoints in the current path."),
                       _("the waypoint count"),
                       _("NavMesh agent"),
                       "CppPlatform/Extensions/AStaricon24.png",
                       "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardRelationalOperatorParameters(
            "number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("getNodeCount");

    agent.AddExpression("NodeCount",
                        _("Waypoint count"),
                        _("the number of waypoints in the current path"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getNodeCount");

    agent.AddExpression("NextNodeIndex",
                        _("Index of next waypoint"),
                        _("the index of the next waypoint to reach"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getNextNodeIndex");

    agent.AddExpression("GetNodeX",
                        _("Waypoint X"),
                        _("the X position of a waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("expression", _("Node index (start at 0)"))
        .SetFunctionName("getNodeX");

    agent.AddExpression("GetNodeY",
                        _("Waypoint Y"),
                        _("the Y position of a waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("expression", _("Node index (start at 0)"))
        .SetFunctionName("getNodeY");

    agent.AddExpression("GetNodeZ",
                        _("Waypoint Z"),
                        _("the Z position of a waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("expression", _("Node index (start at 0)"))
        .SetFunctionName("getNodeZ");

    agent.AddExpression("NextNodeX",
                        _("Next waypoint X"),
                        _("the X position of the next waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getNextNodeX");

    agent.AddExpression("NextNodeY",
                        _("Next waypoint Y"),
                        _("the Y position of the next waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getNextNodeY");

    agent.AddExpression("NextNodeZ",
                        _("Next waypoint Z"),
                        _("the Z position of the next waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getNextNodeZ");

    agent.AddExpression("LastNodeX",
                        _("Last waypoint X"),
                        _("the X position of the last waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getLastNodeX");

    agent.AddExpression("LastNodeY",
                        _("Last waypoint Y"),
                        _("the Y position of the last waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getLastNodeY");

    agent.AddExpression("LastNodeZ",
                        _("Last waypoint Z"),
                        _("the Z position of the last waypoint"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getLastNodeZ");

    agent.AddExpression("DestinationX",
                        _("Destination X"),
                        _("the current destination X position"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getDestinationX");

    agent.AddExpression("DestinationY",
                        _("Destination Y"),
                        _("the current destination Y position"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getDestinationY");

    agent.AddExpression("DestinationZ",
                        _("Destination Z"),
                        _("the current destination Z position"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getDestinationZ");

    agent.AddExpression("MovementAngle",
                        _("Movement angle"),
                        _("the horizontal movement angle of the agent"),
                        _("NavMesh agent"),
                        "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("getMovementAngle");

    agent.AddScopedAction("SetEnabled",
                          _("Enable/disable"),
                          _("Enable or disable this agent."),
                          _("Set _PARAM0_ navmesh agent: _PARAM2_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("yesorno", _("Enabled"))
        .SetFunctionName("setEnabled");

    agent.AddScopedCondition("IsEnabled",
                             _("Enabled"),
                             _("Check if agent is enabled."),
                             _("_PARAM0_ agent is enabled"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isEnabled");

    agent.AddExpressionAndConditionAndAction("number",
                                             "Speed",
                                             _("Speed"),
                                             _("the movement speed"),
                                             _("the speed"),
                                             _("NavMesh agent"),
                                             "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setSpeed")
        .SetGetter("getSpeed");

    agent.AddExpressionAndConditionAndAction(
            "number",
            "Acceleration",
            _("Acceleration"),
            _("the movement acceleration"),
            _("the acceleration"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setAcceleration")
        .SetGetter("getAcceleration");

    agent.AddExpressionAndConditionAndAction(
            "number",
            "StoppingDistance",
            _("Stopping distance"),
            _("the stopping distance near destination"),
            _("the stopping distance"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setStoppingDistance")
        .SetGetter("getStoppingDistance");

    agent.AddScopedAction("SetAutoRepath",
                          _("Set auto repath"),
                          _("Enable or disable automatic path recomputation."),
                          _("Set auto repath of _PARAM0_ to _PARAM2_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("yesorno", _("Auto repath"))
        .SetFunctionName("setAutoRepath");

    agent.AddScopedCondition("IsAutoRepath",
                             _("Auto repath enabled"),
                             _("Check if auto repath is enabled."),
                             _("_PARAM0_ auto repath is enabled"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isAutoRepath");

    agent.AddExpressionAndConditionAndAction(
            "number",
            "RepathIntervalSeconds",
            _("Repath interval (seconds)"),
            _("the interval between automatic path rebuilds"),
            _("the repath interval"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("Seconds between automatic repath checks (minimum 0.05).")))
        .SetFunctionName("setRepathIntervalSeconds")
        .SetGetter("getRepathIntervalSeconds");

    agent.AddScopedAction("SetRotateToVelocity",
                          _("Set rotate to velocity"),
                          _("Enable or disable rotation toward movement "
                            "direction."),
                          _("Set rotate to velocity of _PARAM0_ to _PARAM2_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("yesorno", _("Rotate to velocity"))
        .SetFunctionName("setRotateToVelocity");

    agent.AddScopedCondition("IsRotateToVelocity",
                             _("Rotate to velocity enabled"),
                             _("Check if rotation to velocity is enabled."),
                             _("_PARAM0_ rotates to velocity"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isRotateToVelocity");

    agent.AddScopedAction("SetProjectOnNavMesh",
                          _("Set project on navmesh"),
                          _("Enable or disable snapping to navmesh points on "
                            "repath."),
                          _("Set project on navmesh of _PARAM0_ to _PARAM2_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("yesorno", _("Project on navmesh"))
        .SetFunctionName("setProjectOnNavMesh");

    agent.AddScopedCondition("IsProjectOnNavMesh",
                             _("Project on navmesh enabled"),
                             _("Check if project on navmesh is enabled."),
                             _("_PARAM0_ projects on navmesh"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isProjectOnNavMesh");

    agent.AddScopedAction("SetAvoidanceEnabled",
                          _("Set avoidance enabled"),
                          _("Enable or disable local crowd avoidance."),
                          _("Set avoidance of _PARAM0_ to _PARAM2_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("yesorno", _("Avoidance enabled"))
        .SetFunctionName("setAvoidanceEnabled");

    agent.AddScopedCondition("IsAvoidanceEnabled",
                             _("Avoidance enabled"),
                             _("Check if local crowd avoidance is enabled."),
                             _("_PARAM0_ has avoidance enabled"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isAvoidanceEnabled");

    agent.AddExpressionAndConditionAndAction(
            "number",
            "AvoidanceRadius",
            _("Avoidance radius"),
            _("the local avoidance radius"),
            _("the avoidance radius"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setAvoidanceRadius")
        .SetGetter("getAvoidanceRadius");

    agent.AddExpressionAndConditionAndAction(
            "number",
            "AvoidanceStrength",
            _("Avoidance strength"),
            _("the local avoidance strength"),
            _("the avoidance strength"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters("number", gd::ParameterOptions::MakeNewOptions())
        .SetFunctionName("setAvoidanceStrength")
        .SetGetter("getAvoidanceStrength");

    agent.AddScopedAction("SetDebugPathEnabled",
                          _("Set debug path painter"),
                          _("Enable or disable navmesh debug path painter."),
                          _("Set debug path painter of _PARAM0_ to _PARAM2_"),
                          _("NavMesh agent"),
                          "CppPlatform/Extensions/AStaricon24.png",
                          "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .AddParameter("yesorno", _("Debug path painter"))
        .SetFunctionName("setDebugPathEnabled");

    agent.AddScopedCondition("IsDebugPathEnabled",
                             _("Debug path painter enabled"),
                             _("Check if navmesh debug path painter is enabled."),
                             _("_PARAM0_ debug path painter is enabled"),
                             _("NavMesh agent"),
                             "CppPlatform/Extensions/AStaricon24.png",
                             "CppPlatform/Extensions/AStaricon16.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .SetFunctionName("isDebugPathEnabled");

    agent.AddExpressionAndConditionAndAction(
            "number",
            "DebugPathColor",
            _("Debug path color"),
            _("the debug painter line color as RGB integer"),
            _("the debug path color"),
            _("NavMesh agent"),
            "CppPlatform/Extensions/AStaricon24.png")
        .AddParameter("object", _("Object"))
        .AddParameter("behavior", _("Behavior"), "NavMeshAgentBehavior")
        .UseStandardParameters(
            "number",
            gd::ParameterOptions::MakeNewOptions().SetDescription(
                _("RGB integer color (for example 65535 for cyan).")))
        .SetFunctionName("setDebugPathColor")
        .SetGetter("getDebugPathColor");
  }
}
