#include "NavMeshSurfaceBehavior.h"

#include <algorithm>

#include "GDCore/Project/PropertyDescriptor.h"
#include "GDCore/Serialization/SerializerElement.h"
#include "GDCore/Tools/Localization.h"

void NavMeshSurfaceBehavior::InitializeContent(
    gd::SerializerElement& behaviorContent) {
  behaviorContent.SetAttribute("enabled", true);
  behaviorContent.SetAttribute("maxSlope", 60);
  behaviorContent.SetAttribute("areaCost", 1);
  behaviorContent.SetAttribute("dynamic", true);
  behaviorContent.SetAttribute("refreshIntervalFrames", 20);
}

#if defined(GD_IDE_ONLY)
std::map<gd::String, gd::PropertyDescriptor> NavMeshSurfaceBehavior::GetProperties(
    const gd::SerializerElement& behaviorContent) const {
  std::map<gd::String, gd::PropertyDescriptor> properties;

  properties["Enabled"]
      .SetLabel(_("Enabled"))
      .SetValue(behaviorContent.GetBoolAttribute("enabled") ? "true" : "false")
      .SetType("Boolean");
  properties["MaxSlope"]
      .SetLabel(_("Max slope (degrees)"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetDegreeAngle())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("maxSlope")));
  properties["AreaCost"]
      .SetLabel(_("Area cost"))
      .SetType("Number")
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("areaCost")));
  properties["Dynamic"]
      .SetLabel(_("Dynamic updates"))
      .SetGroup(_("Runtime updates"))
      .SetAdvanced()
      .SetValue(behaviorContent.GetBoolAttribute("dynamic") ? "true" : "false")
      .SetType("Boolean");
  properties["RefreshIntervalFrames"]
      .SetLabel(_("Refresh interval (frames)"))
      .SetGroup(_("Runtime updates"))
      .SetAdvanced()
      .SetType("Number")
      .SetValue(gd::String::From(
          behaviorContent.GetDoubleAttribute("refreshIntervalFrames")));

  return properties;
}

bool NavMeshSurfaceBehavior::UpdateProperty(gd::SerializerElement& behaviorContent,
                                            const gd::String& name,
                                            const gd::String& value) {
  if (name == "Enabled") {
    behaviorContent.SetAttribute("enabled", (value != "0"));
    return true;
  }
  if (name == "Dynamic") {
    behaviorContent.SetAttribute("dynamic", (value != "0"));
    return true;
  }

  const float numericValue = value.To<float>();
  if (name == "MaxSlope") {
    behaviorContent.SetAttribute("maxSlope", std::max(0.f, std::min(89.9f, numericValue)));
    return true;
  }
  if (name == "AreaCost") {
    behaviorContent.SetAttribute("areaCost", std::max(0.001f, numericValue));
    return true;
  }
  if (name == "RefreshIntervalFrames") {
    behaviorContent.SetAttribute("refreshIntervalFrames", std::max(1.f, numericValue));
    return true;
  }

  return false;
}
#endif
