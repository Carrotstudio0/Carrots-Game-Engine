/**

GDevelop - Particle System Extension
Copyright (c) 2010-2016 Florian Rival (Florian.Rival@gmail.com)
This project is released under the MIT License.
*/

#include "Model3DObjectConfiguration.h"

#include "GDCore/CommonTools.h"
#include "GDCore/IDE/Project/ArbitraryResourceWorker.h"
#include "GDCore/Project/InitialInstance.h"
#include "GDCore/Project/MeasurementUnit.h"
#include "GDCore/Project/Object.h"
#include "GDCore/Project/Project.h"
#include "GDCore/Project/PropertyDescriptor.h"
#include "GDCore/Serialization/SerializerElement.h"
#include "GDCore/Tools/Localization.h"

using namespace std;

Model3DObjectConfiguration::Model3DObjectConfiguration()
    : width(100), height(100), depth(100), rotationX(90), rotationY(0),
      rotationZ(90), modelResourceName(""), materialType("Standard"),
      materialTextureResourceName(""), materialGraphDefinition(""),
      materialGraphFragmentShader(""), materialProjectionMode("UV"),
      materialGraphVersion("1"),
      originLocation("ModelOrigin"), centerLocation("ModelOrigin"),
      keepAspectRatio(true), crossfadeDuration(0.1f), isCastingShadow(true),
      isReceivingShadow(true), materialGraphEnabled(false),
      materialGraphBlend(1.0f) {}

bool Model3DObjectConfiguration::UpdateProperty(const gd::String &propertyName,
                                                const gd::String &newValue) {
  if (propertyName == "width") {
    width = newValue.To<double>();
    return true;
  }
  if (propertyName == "height") {
    height = newValue.To<double>();
    return true;
  }
  if (propertyName == "depth") {
    depth = newValue.To<double>();
    return true;
  }
  if (propertyName == "rotationX") {
    rotationX = newValue.To<double>();
    return true;
  }
  if (propertyName == "rotationY") {
    rotationY = newValue.To<double>();
    return true;
  }
  if (propertyName == "rotationZ") {
    rotationZ = newValue.To<double>();
    return true;
  }
  if (propertyName == "modelResourceName") {
    modelResourceName = newValue;
    return true;
  }
  if (propertyName == "materialType") {
    auto normalizedValue = newValue.LowerCase();
    if (normalizedValue == "basic")
      materialType = "Basic";
    else if (normalizedValue == "matte")
      materialType = "Matte";
    else if (normalizedValue == "standard")
      materialType = "Standard";
    else if (normalizedValue == "glossy")
      materialType = "Glossy";
    else if (normalizedValue == "metallic")
      materialType = "Metallic";
    else if (normalizedValue == "standardwithoutmetalness")
      materialType = "StandardWithoutMetalness";
    else if (normalizedValue == "keeporiginal")
      materialType = "KeepOriginal";
    else
      return false;
    return true;
  }
  if (propertyName == "materialTextureResourceName") {
    materialTextureResourceName = newValue;
    return true;
  }
  if (propertyName == "materialGraphEnabled") {
    materialGraphEnabled = newValue == "1" || newValue == "true";
    return true;
  }
  if (propertyName == "materialGraphBlend") {
    materialGraphBlend = newValue.To<double>();
    return true;
  }
  if (propertyName == "materialGraphDefinition") {
    materialGraphDefinition = newValue;
    return true;
  }
  if (propertyName == "materialGraphFragmentShader") {
    materialGraphFragmentShader = newValue;
    return true;
  }
  if (propertyName == "materialProjectionMode") {
    auto normalizedValue = newValue.LowerCase();
    if (normalizedValue == "triplanar")
      materialProjectionMode = "Triplanar";
    else
      materialProjectionMode = "UV";
    return true;
  }
  if (propertyName == "materialGraphVersion") {
    materialGraphVersion = newValue;
    return true;
  }
  if (propertyName == "originLocation") {
    auto normalizedValue = newValue.LowerCase();
    if (normalizedValue == "modelorigin")
      originLocation = "ModelOrigin";
    else if (normalizedValue == "topleft")
      originLocation = "TopLeft";
    else if (normalizedValue == "objectcenter")
      originLocation = "ObjectCenter";
    else if (normalizedValue == "bottomcenterz")
      originLocation = "BottomCenterZ";
    else if (normalizedValue == "bottomcentery")
      originLocation = "BottomCenterY";
    else
      return false;
    return true;
  }
  if (propertyName == "centerLocation") {
    auto normalizedValue = newValue.LowerCase();
    if (normalizedValue == "modelorigin")
      centerLocation = "ModelOrigin";
    else if (normalizedValue == "objectcenter")
      centerLocation = "ObjectCenter";
    else if (normalizedValue == "bottomcenterz")
      centerLocation = "BottomCenterZ";
    else if (normalizedValue == "bottomcentery")
      centerLocation = "BottomCenterY";
    else
      return false;
    return true;
  }
  if (propertyName == "keepAspectRatio") {
    keepAspectRatio = newValue == "1" || newValue == "true";
    return true;
  }
  if(propertyName == "crossfadeDuration") {
    crossfadeDuration = newValue.To<double>();
    return true;
  }
  if(propertyName == "isCastingShadow")
  {
    isCastingShadow = newValue == "1" || newValue == "true";
    return true;
  }
  if(propertyName == "isReceivingShadow")
  {
    isReceivingShadow = newValue == "1" || newValue == "true";
    return true;
  }

  return false;
}

std::map<gd::String, gd::PropertyDescriptor>
Model3DObjectConfiguration::GetProperties() const {
  std::map<gd::String, gd::PropertyDescriptor> objectProperties;

  objectProperties["width"]
      .SetValue(gd::String::From(width))
      .SetType("number")
      .SetLabel(_("Width"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetGroup(_("Default size"));

  objectProperties["height"]
      .SetValue(gd::String::From(height))
      .SetType("number")
      .SetLabel(_("Height"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetGroup(_("Default size"));

  objectProperties["depth"]
      .SetValue(gd::String::From(depth))
      .SetType("number")
      .SetLabel(_("Depth"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetPixel())
      .SetGroup(_("Default size"));

  objectProperties["keepAspectRatio"]
      .SetValue(keepAspectRatio ? "true" : "false")
      .SetType("boolean")
      .SetLabel(_("Reduce initial dimensions to keep aspect ratio"))
      .SetGroup(_("Default size"));

  objectProperties["rotationX"]
      .SetValue(gd::String::From(rotationX))
      .SetType("number")
      .SetLabel(_("X"))
      .SetDescription(_("Rotation around X axis"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetDegreeAngle())
      .SetGroup(_("Default rotation"));

  objectProperties["rotationY"]
      .SetValue(gd::String::From(rotationY))
      .SetType("number")
      .SetLabel(_("Y"))
      .SetDescription(_("Rotation around Y axis"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetDegreeAngle())
      .SetGroup(_("Default rotation"));

  objectProperties["rotationZ"]
      .SetValue(gd::String::From(rotationZ))
      .SetType("number")
      .SetLabel(_("Z"))
      .SetDescription(_("Rotation around Z axis"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetDegreeAngle())
      .SetGroup(_("Default rotation"));

  objectProperties["modelResourceName"]
      .SetValue(modelResourceName)
      .SetType("resource")
      .AddExtraInfo("model3D")
      .SetLabel(_("3D model"));

  objectProperties["materialType"]
      .SetValue(materialType.empty() ? "Standard" : materialType)
      .SetType("choice")
      .AddChoice("Standard", _("Standard PBR (balanced)"))
      .AddChoice("Matte", _("Matte (soft highlights)"))
      .AddChoice("Glossy", _("Glossy (strong highlights)"))
      .AddChoice("Metallic", _("Metallic (reflective metal)"))
      .AddChoice("StandardWithoutMetalness", _("Standard (without metalness)"))
      .AddChoice("Basic", _("Basic (no lighting, no shadows)"))
      .AddChoice("KeepOriginal", _("Keep original"))
      .SetLabel(_("Material"))
      .SetGroup(_("Lighting"));

  objectProperties["materialTextureResourceName"]
      .SetValue(materialTextureResourceName)
      .SetType("resource")
      .AddExtraInfo("image")
      .SetLabel(_("Material texture asset"))
      .SetDescription(
          _("Drop/select an image resource to override the model base texture."))
      .SetGroup(_("Material blueprint"));

  objectProperties["materialGraphEnabled"]
      .SetValue(materialGraphEnabled ? "true" : "false")
      .SetType("boolean")
      .SetLabel(_("Use material blueprint"))
      .SetDescription(
          _("Enable a node-based material shader blueprint on this model."))
      .SetGroup(_("Material blueprint"));

  objectProperties["materialProjectionMode"]
      .SetValue(materialProjectionMode.empty() ? "UV" : materialProjectionMode)
      .SetType("choice")
      .AddChoice("UV", _("UV"))
      .AddChoice("Triplanar", _("Triplanar projection"))
      .SetLabel(_("Projection mode"))
      .SetGroup(_("Material blueprint"));

  objectProperties["materialGraphBlend"]
      .SetValue(gd::String::From(materialGraphBlend))
      .SetType("number")
      .SetLabel(_("Blend strength"))
      .SetDescription(_("0 keeps original material, 1 applies the blueprint fully."))
      .SetGroup(_("Material blueprint"));

  objectProperties["materialGraphDefinition"]
      .SetValue(materialGraphDefinition)
      .SetType("textarea")
      .SetLabel(_("Blueprint graph (serialized)"))
      .SetGroup(_("Material blueprint"))
      .SetAdvanced(true);

  objectProperties["materialGraphFragmentShader"]
      .SetValue(materialGraphFragmentShader)
      .SetType("textarea")
      .SetLabel(_("Generated fragment shader"))
      .SetGroup(_("Material blueprint"))
      .SetAdvanced(true);

  objectProperties["materialGraphVersion"]
      .SetValue(materialGraphVersion.empty() ? "1" : materialGraphVersion)
      .SetType("string")
      .SetLabel(_("Blueprint version"))
      .SetGroup(_("Material blueprint"))
      .SetAdvanced(true);

  objectProperties["originLocation"]
      .SetValue(originLocation.empty() ? "TopLeft" : originLocation)
      .SetType("choice")
      .AddChoice("ModelOrigin", _("Model origin"))
      .AddChoice("TopLeft", _("Top left"))
      .AddChoice("ObjectCenter", _("Object center"))
      .AddChoice("BottomCenterZ", _("Bottom center (Z)"))
      .AddChoice("BottomCenterY", _("Bottom center (Y)"))
      .SetLabel(_("Origin point"))
      .SetGroup(_("Points"))
      .SetAdvanced(true);

  objectProperties["centerLocation"]
      .SetValue(centerLocation.empty() ? "ObjectCenter" : centerLocation)
      .SetType("choice")
      .AddChoice("ModelOrigin", _("Model origin"))
      .AddChoice("ObjectCenter", _("Object center"))
      .AddChoice("BottomCenterZ", _("Bottom center (Z)"))
      .AddChoice("BottomCenterY", _("Bottom center (Y)"))
      .SetLabel(_("Center point"))
      .SetGroup(_("Points"))
      .SetAdvanced(true);

  objectProperties["crossfadeDuration"]
      .SetValue(gd::String::From(crossfadeDuration))
      .SetType("number")
      .SetLabel(_("Crossfade duration"))
      .SetGroup(_("Animations"))
      .SetMeasurementUnit(gd::MeasurementUnit::GetSecond());

  objectProperties["isCastingShadow"]
      .SetValue(isCastingShadow ? "true" : "false")
      .SetType("boolean")
      .SetLabel(_("Shadow casting"))
      .SetGroup(_("Lighting"));

  objectProperties["isReceivingShadow"]
      .SetValue(isReceivingShadow ? "true" : "false")
      .SetType("boolean")
      .SetLabel(_("Shadow receiving"))
      .SetGroup(_("Lighting"));



  return objectProperties;
}

bool Model3DObjectConfiguration::UpdateInitialInstanceProperty(
    gd::InitialInstance &instance, const gd::String &propertyName,
    const gd::String &newValue) {
  return false;
}

std::map<gd::String, gd::PropertyDescriptor>
Model3DObjectConfiguration::GetInitialInstanceProperties(
    const gd::InitialInstance &instance) {
  std::map<gd::String, gd::PropertyDescriptor> instanceProperties;
  return instanceProperties;
}

void Model3DObjectConfiguration::DoUnserializeFrom(
    gd::Project &project, const gd::SerializerElement &element) {
  auto &content = element.GetChild("content");

  width = content.GetDoubleAttribute("width");
  height = content.GetDoubleAttribute("height");
  depth = content.GetDoubleAttribute("depth");
  rotationX = content.GetDoubleAttribute("rotationX");
  rotationY = content.GetDoubleAttribute("rotationY");
  rotationZ = content.GetDoubleAttribute("rotationZ");
  modelResourceName = content.GetStringAttribute("modelResourceName");
  materialType = content.GetStringAttribute("materialType", "Standard");
  materialTextureResourceName =
      content.GetStringAttribute("materialTextureResourceName", "");
  materialGraphEnabled = content.GetBoolAttribute("materialGraphEnabled", false);
  materialGraphBlend = content.GetDoubleAttribute("materialGraphBlend", 1.0);
  materialGraphDefinition =
      content.GetStringAttribute("materialGraphDefinition", "");
  materialGraphFragmentShader =
      content.GetStringAttribute("materialGraphFragmentShader", "");
  materialProjectionMode =
      content.GetStringAttribute("materialProjectionMode", "UV");
  materialGraphVersion = content.GetStringAttribute("materialGraphVersion", "1");
  originLocation = content.GetStringAttribute("originLocation");
  centerLocation = content.GetStringAttribute("centerLocation");
  keepAspectRatio = content.GetBoolAttribute("keepAspectRatio");
  crossfadeDuration = content.GetDoubleAttribute("crossfadeDuration");
  isCastingShadow = content.GetBoolAttribute("isCastingShadow");
  isReceivingShadow = content.GetBoolAttribute("isReceivingShadow");

  RemoveAllAnimations();
  auto &animationsElement = content.GetChild("animations");
  animationsElement.ConsiderAsArrayOf("animation");
  for (std::size_t i = 0; i < animationsElement.GetChildrenCount(); ++i) {
    auto &animationElement = animationsElement.GetChild(i);
    Model3DAnimation animation;
    animation.SetName(animationElement.GetStringAttribute("name", ""));
    animation.SetSource(animationElement.GetStringAttribute("source", ""));
    animation.SetShouldLoop(animationElement.GetBoolAttribute("loop", false));
    AddAnimation(animation);
  }
}

void Model3DObjectConfiguration::DoSerializeTo(
    gd::SerializerElement &element) const {
  auto &content = element.AddChild("content");
  content.SetAttribute("width", width);
  content.SetAttribute("height", height);
  content.SetAttribute("depth", depth);
  content.SetAttribute("rotationX", rotationX);
  content.SetAttribute("rotationY", rotationY);
  content.SetAttribute("rotationZ", rotationZ);
  content.SetAttribute("modelResourceName", modelResourceName);
  content.SetAttribute("materialType", materialType);
  content.SetAttribute(
      "materialTextureResourceName", materialTextureResourceName);
  content.SetAttribute("materialGraphEnabled", materialGraphEnabled);
  content.SetAttribute("materialGraphBlend", materialGraphBlend);
  content.SetAttribute("materialGraphDefinition", materialGraphDefinition);
  content.SetAttribute(
      "materialGraphFragmentShader", materialGraphFragmentShader);
  content.SetAttribute("materialProjectionMode", materialProjectionMode);
  content.SetAttribute("materialGraphVersion", materialGraphVersion);
  content.SetAttribute("originLocation", originLocation);
  content.SetAttribute("centerLocation", centerLocation);
  content.SetAttribute("keepAspectRatio", keepAspectRatio);
  content.SetAttribute("crossfadeDuration", crossfadeDuration);
  content.SetAttribute("isCastingShadow", isCastingShadow);
  content.SetAttribute("isReceivingShadow", isReceivingShadow);

  auto &animationsElement = content.AddChild("animations");
  animationsElement.ConsiderAsArrayOf("animation");
  for (auto &animation : animations) {
    auto &animationElement = animationsElement.AddChild("animation");
    animationElement.SetAttribute("name", animation.GetName());
    animationElement.SetAttribute("source", animation.GetSource());
    animationElement.SetAttribute("loop", animation.ShouldLoop());
  }
}

void Model3DObjectConfiguration::ExposeResources(
    gd::ArbitraryResourceWorker &worker) {
  worker.ExposeModel3D(modelResourceName);
  worker.ExposeImage(materialTextureResourceName);
}

const gd::String &
Model3DObjectConfiguration::GetAnimationName(size_t index) const {
  return GetAnimation(index).GetName();
}

bool Model3DObjectConfiguration::HasAnimationNamed(
    const gd::String &name) const {
  return !name.empty() && (find_if(animations.begin(), animations.end(),
                                   [&name](const Model3DAnimation &animation) {
                                     return animation.GetName() == name;
                                   }) != animations.end());
}

Model3DAnimation Model3DObjectConfiguration::badAnimation;

const Model3DAnimation &
Model3DObjectConfiguration::GetAnimation(std::size_t nb) const {
  if (nb >= animations.size())
    return badAnimation;

  return animations[nb];
}

Model3DAnimation &Model3DObjectConfiguration::GetAnimation(std::size_t nb) {
  if (nb >= animations.size())
    return badAnimation;

  return animations[nb];
}

void Model3DObjectConfiguration::AddAnimation(
    const Model3DAnimation &animation) {
  animations.push_back(animation);
}

bool Model3DObjectConfiguration::RemoveAnimation(std::size_t nb) {
  if (nb >= GetAnimationsCount())
    return false;

  animations.erase(animations.begin() + nb);
  return true;
}

void Model3DObjectConfiguration::SwapAnimations(std::size_t firstIndex,
                                                std::size_t secondIndex) {
  if (firstIndex < animations.size() && secondIndex < animations.size() &&
      firstIndex != secondIndex)
    std::swap(animations[firstIndex], animations[secondIndex]);
}

void Model3DObjectConfiguration::MoveAnimation(std::size_t oldIndex,
                                               std::size_t newIndex) {
  if (oldIndex >= animations.size() || newIndex >= animations.size())
    return;

  auto animation = animations[oldIndex];
  animations.erase(animations.begin() + oldIndex);
  animations.insert(animations.begin() + newIndex, animation);
}
