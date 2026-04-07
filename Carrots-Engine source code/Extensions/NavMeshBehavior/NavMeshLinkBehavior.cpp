#include "NavMeshLinkBehavior.h"

#include <algorithm>

#include "GDCore/Project/PropertyDescriptor.h"
#include "GDCore/Serialization/SerializerElement.h"
#include "GDCore/Tools/Localization.h"

void NavMeshLinkBehavior::InitializeContent(
    gd::SerializerElement& behaviorContent) {
  behaviorContent.SetAttribute("enabled", true);
  behaviorContent.SetAttribute("targetX", 128);
  behaviorContent.SetAttribute("targetY", 0);
  behaviorContent.SetAttribute("targetZ", 0);
  behaviorContent.SetAttribute("bidirectional", true);
  behaviorContent.SetAttribute("costMultiplier", 1);
  behaviorContent.SetAttribute("dynamic", true);
  behaviorContent.SetAttribute("refreshIntervalFrames", 10);
}

#if defined(GD_IDE_ONLY)
std::map<gd::String, gd::PropertyDescriptor> NavMeshLinkBehavior::GetProperties(
    const gd::SerializerElement& behaviorContent) const {
  std::map<gd::String, gd::PropertyDescriptor> properties;

  properties["Enabled"]
      .SetLabel(_("Enabled"))
      .SetValue(behaviorContent.GetBoolAttribute("enabled") ? "true" : "false")
      .SetType("Boolean");
  properties["TargetX"]
      .SetLabel(_("Target X"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("targetX")));
  properties["TargetY"]
      .SetLabel(_("Target Y"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("targetY")));
  properties["TargetZ"]
      .SetLabel(_("Target Z"))
      .SetType("Number")
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetValue(gd::String::From(behaviorContent.GetDoubleAttribute("targetZ")));
  properties["Bidirectional"]
      .SetLabel(_("Bidirectional"))
      .SetValue(behaviorContent.GetBoolAttribute("bidirectional") ? "true"
                                                                   : "false")
      .SetType("Boolean");
  properties["CostMultiplier"]
      .SetLabel(_("Cost multiplier"))
      .SetType("Number")
      .SetValue(gd::String::From(
          behaviorContent.GetDoubleAttribute("costMultiplier")));
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

bool NavMeshLinkBehavior::UpdateProperty(gd::SerializerElement& behaviorContent,
                                         const gd::String& name,
                                         const gd::String& value) {
  if (name == "Enabled") {
    behaviorContent.SetAttribute("enabled", (value != "0"));
    return true;
  }
  if (name == "Bidirectional") {
    behaviorContent.SetAttribute("bidirectional", (value != "0"));
    return true;
  }
  if (name == "Dynamic") {
    behaviorContent.SetAttribute("dynamic", (value != "0"));
    return true;
  }

  const float numericValue = value.To<float>();
  if (name == "TargetX") {
    behaviorContent.SetAttribute("targetX", numericValue);
    return true;
  }
  if (name == "TargetY") {
    behaviorContent.SetAttribute("targetY", numericValue);
    return true;
  }
  if (name == "TargetZ") {
    behaviorContent.SetAttribute("targetZ", numericValue);
    return true;
  }
  if (name == "CostMultiplier") {
    behaviorContent.SetAttribute(
        "costMultiplier",
        std::max(0.01f, std::min(100.f, numericValue)));
    return true;
  }
  if (name == "RefreshIntervalFrames") {
    behaviorContent.SetAttribute("refreshIntervalFrames", std::max(1.f, numericValue));
    return true;
  }

  return false;
}
#endif
