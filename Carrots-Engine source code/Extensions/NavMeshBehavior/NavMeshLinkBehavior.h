#pragma once

#include <map>

#include "GDCore/Project/Behavior.h"

namespace gd {
class SerializerElement;
class PropertyDescriptor;
}

class GD_EXTENSION_API NavMeshLinkBehavior : public gd::Behavior {
 public:
  NavMeshLinkBehavior(){};
  virtual ~NavMeshLinkBehavior(){};
  virtual std::unique_ptr<gd::Behavior> Clone() const override {
    return gd::make_unique<NavMeshLinkBehavior>(*this);
  }

  virtual std::map<gd::String, gd::PropertyDescriptor> GetProperties(
      const gd::SerializerElement& behaviorContent) const override;
  virtual bool UpdateProperty(gd::SerializerElement& behaviorContent,
                              const gd::String& name,
                              const gd::String& value) override;

  virtual void InitializeContent(
      gd::SerializerElement& behaviorContent) override;
};
