#include "NavMeshObstacleBehavior.h"

#include <algorithm>

#include "GDCore/Project/PropertyDescriptor.h"
#include "GDCore/Serialization/SerializerElement.h"
#include "GDCore/Tools/Localization.h"

void NavMeshObstacleBehavior::InitializeContent(
    gd::SerializerElement& behaviorContent) {
  behaviorContent.SetAttribute("enabled", true);
  behaviorContent.SetAttribute("margin", 8);
  behaviorContent.SetAttribute("dynamic", true);
  behaviorContent.SetAttribute("refreshIntervalFrames", 10);
}

#if defined(GD_IDE_ONLY)
std::map<gd::String, gd::PropertyDescriptor> NavMeshObstacleBehavior::GetProperties(
    const gd::SerializerElement& behaviorContent) const {
  std::map<gd::String, gd::PropertyDescriptor> properties;

  properties["Enabled"]
      .SetLabel(_("Enabled"))
      .SetValue(behaviorContent.GetBoolAttribute("enabled") ? "true" : "false")
      .SetType("Boolean");
  properties["Margin"]
      .SetLabel(_("Obstacle margin"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("margin")));
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

bool NavMeshObstacleBehavior::UpdateProperty(gd::SerializerElement& behaviorContent,
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
  if (name == "Margin") {
    behaviorContent.SetAttribute("margin", std::max(0.f, numericValue));
    return true;
  }
  if (name == "RefreshIntervalFrames") {
    behaviorContent.SetAttribute("refreshIntervalFrames", std::max(1.f, numericValue));
    return true;
  }

  return false;
}
#endif
