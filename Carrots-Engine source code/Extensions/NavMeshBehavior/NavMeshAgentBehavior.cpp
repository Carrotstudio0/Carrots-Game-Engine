#include "NavMeshAgentBehavior.h"

#include <algorithm>

#include "GDCore/Project/PropertyDescriptor.h"
#include "GDCore/Serialization/SerializerElement.h"
#include "GDCore/Tools/Localization.h"

void NavMeshAgentBehavior::InitializeContent(
    gd::SerializerElement& behaviorContent) {
  behaviorContent.SetAttribute("enabled", true);
  behaviorContent.SetAttribute("speed", 220);
  behaviorContent.SetAttribute("acceleration", 900);
  behaviorContent.SetAttribute("stoppingDistance", 12);
  behaviorContent.SetAttribute("autoRepath", true);
  behaviorContent.SetAttribute("repathIntervalSeconds", 0.35);
  behaviorContent.SetAttribute("rotateToVelocity", true);
  behaviorContent.SetAttribute("projectOnNavMesh", true);
  behaviorContent.SetAttribute("avoidanceEnabled", true);
  behaviorContent.SetAttribute("avoidanceRadius", 48);
  behaviorContent.SetAttribute("avoidanceStrength", 0.45);
  behaviorContent.SetAttribute("debugPathEnabled", false);
  behaviorContent.SetAttribute("debugPathColor", 58879);
}

#if defined(GD_IDE_ONLY)
std::map<gd::String, gd::PropertyDescriptor> NavMeshAgentBehavior::GetProperties(
    const gd::SerializerElement& behaviorContent) const {
  std::map<gd::String, gd::PropertyDescriptor> properties;

  properties["Enabled"]
      .SetLabel(_("Enabled"))
      .SetValue(behaviorContent.GetBoolAttribute("enabled") ? "true" : "false")
      .SetType("Boolean");
  properties["Speed"]
      .SetLabel(_("Speed"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixelSpeed())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("speed")));
  properties["Acceleration"]
      .SetLabel(_("Acceleration"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixelAcceleration())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("acceleration")));
  properties["StoppingDistance"]
      .SetLabel(_("Stopping distance"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("stoppingDistance")));
  properties["AutoRepath"]
      .SetLabel(_("Auto repath"))
      .SetValue(behaviorContent.GetBoolAttribute("autoRepath") ? "true" : "false")
      .SetType("Boolean");
  properties["RepathIntervalSeconds"]
      .SetLabel(_("Repath interval (seconds)"))
      .SetType("Number")
      .SetValue(gd::String::From(
          behaviorContent.GetDoubleAttribute("repathIntervalSeconds")));
  properties["RotateToVelocity"]
      .SetLabel(_("Rotate to velocity"))
      .SetGroup(_("Advanced"))
      .SetAdvanced()
      .SetValue(behaviorContent.GetBoolAttribute("rotateToVelocity") ? "true"
                                                                       : "false")
      .SetType("Boolean");
  properties["ProjectOnNavMesh"]
      .SetLabel(_("Project on navmesh"))
      .SetGroup(_("Advanced"))
      .SetAdvanced()
      .SetValue(behaviorContent.GetBoolAttribute("projectOnNavMesh") ? "true"
                                                                       : "false")
      .SetType("Boolean");
  properties["AvoidanceEnabled"]
      .SetLabel(_("Avoidance enabled"))
      .SetGroup(_("Avoidance"))
      .SetAdvanced()
      .SetValue(behaviorContent.GetBoolAttribute("avoidanceEnabled") ? "true"
                                                                       : "false")
      .SetType("Boolean");
  properties["AvoidanceRadius"]
      .SetLabel(_("Avoidance radius"))
      .SetGroup(_("Avoidance"))
      .SetAdvanced()
      .SetType("Number")
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("avoidanceRadius")));
  properties["AvoidanceStrength"]
      .SetLabel(_("Avoidance strength"))
      .SetGroup(_("Avoidance"))
      .SetAdvanced()
      .SetType("Number")
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("avoidanceStrength")));
  properties["DebugPathEnabled"]
      .SetLabel(_("Debug path painter"))
      .SetGroup(_("Debug"))
      .SetAdvanced()
      .SetValue(behaviorContent.GetBoolAttribute("debugPathEnabled") ? "true"
                                                                      : "false")
      .SetType("Boolean");
  properties["DebugPathColor"]
      .SetLabel(_("Debug path color"))
      .SetGroup(_("Debug"))
      .SetAdvanced()
      .SetType("Number")
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("debugPathColor")));

  return properties;
}

bool NavMeshAgentBehavior::UpdateProperty(gd::SerializerElement& behaviorContent,
                                          const gd::String& name,
                                          const gd::String& value) {
  if (name == "Enabled") {
    behaviorContent.SetAttribute("enabled", (value != "0"));
    return true;
  }
  if (name == "AutoRepath") {
    behaviorContent.SetAttribute("autoRepath", (value != "0"));
    return true;
  }
  if (name == "RotateToVelocity") {
    behaviorContent.SetAttribute("rotateToVelocity", (value != "0"));
    return true;
  }
  if (name == "ProjectOnNavMesh") {
    behaviorContent.SetAttribute("projectOnNavMesh", (value != "0"));
    return true;
  }
  if (name == "AvoidanceEnabled") {
    behaviorContent.SetAttribute("avoidanceEnabled", (value != "0"));
    return true;
  }
  if (name == "DebugPathEnabled") {
    behaviorContent.SetAttribute("debugPathEnabled", (value != "0"));
    return true;
  }

  const float numericValue = value.To<float>();
  if (name == "Speed") {
    behaviorContent.SetAttribute("speed", std::max(1.f, numericValue));
    return true;
  }
  if (name == "Acceleration") {
    behaviorContent.SetAttribute("acceleration", std::max(1.f, numericValue));
    return true;
  }
  if (name == "StoppingDistance") {
    behaviorContent.SetAttribute("stoppingDistance", std::max(0.f, numericValue));
    return true;
  }
  if (name == "RepathIntervalSeconds") {
    behaviorContent.SetAttribute("repathIntervalSeconds", std::max(0.05f, numericValue));
    return true;
  }
  if (name == "AvoidanceRadius") {
    behaviorContent.SetAttribute("avoidanceRadius", std::max(0.f, numericValue));
    return true;
  }
  if (name == "AvoidanceStrength") {
    behaviorContent.SetAttribute(
        "avoidanceStrength",
        std::max(0.f, std::min(2.f, numericValue)));
    return true;
  }
  if (name == "DebugPathColor") {
    behaviorContent.SetAttribute(
        "debugPathColor",
        static_cast<int>(std::max(0.f, std::min(16777215.f, numericValue))));
    return true;
  }

  return false;
}
#endif
