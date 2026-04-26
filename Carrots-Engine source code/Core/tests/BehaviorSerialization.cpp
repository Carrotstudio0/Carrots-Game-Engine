/*
 * GDevelop Core
 * Copyright 2008-2016 Florian Rival (Florian.Rival@gmail.com). All rights
 * reserved. This project is released under the MIT License.
 */
/**
 * @file Tests covering serialization to JSON.
 */
#include "DummyPlatform.h"
#include "GDCore/CommonTools.h"
#include "GDCore/Events/Builtin/StandardEvent.h"
#include "GDCore/Events/Event.h"
#include "GDCore/Events/EventsList.h"
#include "GDCore/Events/Serialization.h"
#include "GDCore/Extensions/Platform.h"
#include "GDCore/Project/EventsFunctionsExtension.h"
#include "GDCore/Project/Layout.h"
#include "GDCore/Project/Object.h"
#include "GDCore/Project/ObjectsContainer.h"
#include "GDCore/Project/Project.h"
#include "GDCore/Project/Variable.h"
#include "GDCore/Serialization/Serializer.h"
#include "GDCore/Tools/SystemStats.h"
#include "GDCore/Tools/VersionWrapper.h"
#include "catch.hpp"

using namespace gd;

namespace {

void AddEventsBasedExtension(gd::Project &project) {
  auto &eventsExtension =
      project.InsertNewEventsFunctionsExtension("MyEventsExtension", 0);

  auto &eventsBasedBehavior =
      eventsExtension.GetEventsBasedBehaviors().InsertNew(
          "MyEventsBasedBehavior", 0);
  eventsBasedBehavior.SetFullName("My events based behavior");
  eventsBasedBehavior.SetDescription("An events based behavior for test");
  eventsBasedBehavior.SetObjectType("");
  eventsBasedBehavior.GetPropertyDescriptors()
      .InsertNew("MyProperty", 0)
      .SetType("Number");
};

void AddEventsFunctionWithVariableCondition(gd::Project &project) {
  auto &eventsExtension =
      project.GetEventsFunctionsExtension("MyEventsExtension");
  auto &eventsFunction =
      eventsExtension.GetEventsFunctions().InsertNewEventsFunction(
          "MyFunction", 0);
  eventsFunction.SetFunctionType(gd::EventsFunction::Condition);

  auto &event = dynamic_cast<gd::StandardEvent &>(
      eventsFunction.GetEvents().InsertNewEvent(
          project, "BuiltinCommonInstructions::Standard"));
  gd::Instruction condition;
  condition.SetType("NumberVariable");
  condition.SetParametersCount(3);
  condition.SetParameter(0, "MyVariable");
  condition.SetParameter(1, "=");
  condition.SetParameter(2, "42");
  event.GetConditions().Insert(condition);
}

void AddAnotherEventsBasedExtensionWithDependency(gd::Project &project) {
  auto &eventsExtension =
      project.InsertNewEventsFunctionsExtension("MyOtherEventsExtension", 0);

  auto &eventsBasedObject = eventsExtension.GetEventsBasedObjects().InsertNew(
      "MyEventsBasedObject", 0);
  eventsBasedObject.SetFullName("My events based object");
  eventsBasedObject.SetDescription("An events based object for test");

  gd::Object &object = eventsBasedObject.GetObjects().InsertNewObject(
      project, "MyExtension::Sprite", "MyObject", 0);
  gd::Behavior *behavior =
      object.AddNewBehavior(project, "MyEventsExtension::MyEventsBasedBehavior",
                            "MyEventsBasedBehavior");
  behavior->UpdateProperty("MyProperty", "481516");
};

void SetupProject(gd::Project &project, gd::Platform &platform) {
  SetupProjectWithDummyPlatform(project, platform);
  AddEventsBasedExtension(project);

  gd::Layout &layout = project.InsertNewLayout("Scene", 0);
  gd::Object &object = layout.GetObjects().InsertNewObject(
      project, "MyExtension::Sprite", "MyObject", 0);
  gd::Behavior *behavior =
      object.AddNewBehavior(project, "MyEventsExtension::MyEventsBasedBehavior",
                            "MyEventsBasedBehavior");
  behavior->UpdateProperty("MyProperty", "481516");
};

void CheckBehaviorPropertyInObjectContainerElement(
    SerializerElement &objectContainerElement) {
  REQUIRE(objectContainerElement.HasChild("objects"));

  auto &objectsElement = objectContainerElement.GetChild("objects");
  objectsElement.ConsiderAsArrayOf("object");
  REQUIRE(objectsElement.GetChildrenCount() == 1);
  auto &objectElement = objectsElement.GetChild(0);

  REQUIRE(objectElement.GetStringAttribute("name") == "MyObject");
  REQUIRE(objectElement.GetStringAttribute("type") == "MyExtension::Sprite");
  REQUIRE(objectElement.HasChild("behaviors"));

  auto &behaviorsElement = objectElement.GetChild("behaviors");
  behaviorsElement.ConsiderAsArrayOf("behavior");
  REQUIRE(behaviorsElement.GetChildrenCount() == 1);
  auto &behaviorElement = behaviorsElement.GetChild(0);

  REQUIRE(behaviorElement.GetStringAttribute("name") ==
          "MyEventsBasedBehavior");
  REQUIRE(behaviorElement.GetStringAttribute("type") ==
          "MyEventsExtension::MyEventsBasedBehavior");
  REQUIRE(behaviorElement.GetStringAttribute("MyProperty") == "481516");
};

void CheckBehaviorPropertyInElement(SerializerElement &projectElement) {
  auto &layoutsElement = projectElement.GetChild("layouts");
  layoutsElement.ConsiderAsArrayOf("layout");
  REQUIRE(layoutsElement.GetChildrenCount() == 1);
  auto &layoutElement = layoutsElement.GetChild(0);

  REQUIRE(layoutElement.GetStringAttribute("name") == "Scene");
  CheckBehaviorPropertyInObjectContainerElement(layoutElement);
};

void CheckBehaviorProperty(ObjectsContainer &container) {
  auto &object = container.GetObject("MyObject");
  REQUIRE(object.GetType() == "MyExtension::Sprite");
  REQUIRE(object.HasBehaviorNamed("MyEventsBasedBehavior"));

  auto &behavior = object.GetBehavior("MyEventsBasedBehavior");
  REQUIRE(behavior.GetTypeName() == "MyEventsExtension::MyEventsBasedBehavior");
  REQUIRE(behavior.GetProperties().size() == 1);
  REQUIRE(behavior.GetProperties().at("MyProperty").GetValue() == "481516");
};
} // namespace

// TODO EBO Add similar test cases for events-based objects.
TEST_CASE("BehaviorSerialization", "[common]") {

  SECTION("Save and load a project with a custom behavior property value") {
    gd::Platform platform;
    gd::Project writtenProject;
    SetupProject(writtenProject, platform);
    CheckBehaviorProperty(
        writtenProject.GetLayout("Scene").GetObjects());

    SerializerElement projectElement;
    writtenProject.SerializeTo(projectElement);
    CheckBehaviorPropertyInElement(projectElement);

    gd::Project readProject;
    readProject.AddPlatform(platform);
    readProject.UnserializeFrom(projectElement);
    CheckBehaviorProperty(readProject.GetLayout("Scene").GetObjects());
  }

  SECTION("Copy constructor of Behavior") {
    gd::Platform platform;
    gd::Project originalProject;
    SetupProject(originalProject, platform);
    CheckBehaviorProperty(originalProject.GetLayout("Scene").GetObjects());

    auto clonedProject = originalProject;

    CheckBehaviorProperty(clonedProject.GetLayout("Scene").GetObjects());
  }

  SECTION("Load a project with a property value on a custom behavior that no longer exists") {
    gd::Platform platform;
    gd::Project writtenProject;
    SetupProject(writtenProject, platform);

    // Remove the events-based behavior
    writtenProject.RemoveEventsFunctionsExtension("MyEventsExtension");

    SerializerElement projectElement;
    writtenProject.SerializeTo(projectElement);
    CheckBehaviorPropertyInElement(projectElement);

    gd::Project readProject;
    readProject.AddPlatform(platform);
    readProject.UnserializeFrom(projectElement);

    // Add the events-based behavior back
    AddEventsBasedExtension(readProject);

    CheckBehaviorProperty(readProject.GetLayout("Scene").GetObjects());
  }

  SECTION("Save and load a project with an event based extension dependency") {
    gd::Platform platform;
    gd::Project writtenProject;
    SetupProject(writtenProject, platform);
    AddAnotherEventsBasedExtensionWithDependency(writtenProject);

    // It's important that the extension with the dependency is the first one.
    REQUIRE(writtenProject.GetEventsFunctionsExtension(0).GetName() ==
            "MyOtherEventsExtension");
    REQUIRE(writtenProject.GetEventsFunctionsExtension(1).GetName() ==
            "MyEventsExtension");

    SerializerElement projectElement;
    writtenProject.SerializeTo(projectElement);

    auto &extensionsElement =
        projectElement.GetChild("eventsFunctionsExtensions");
    extensionsElement.ConsiderAsArrayOf("eventsFunctionsExtension");
    REQUIRE(extensionsElement.GetChildrenCount() == 2);

    auto &firstExtensionElement = extensionsElement.GetChild(0);
    REQUIRE(firstExtensionElement.GetStringAttribute("name") ==
            "MyOtherEventsExtension");
    auto &eventsBasedObjectsElement =
        firstExtensionElement.GetChild("eventsBasedObjects");
    eventsBasedObjectsElement.ConsiderAsArrayOf("eventsBasedObject");
    auto &eventsBasedObjectElement =
        eventsBasedObjectsElement.GetChild(0);
    CheckBehaviorPropertyInObjectContainerElement(eventsBasedObjectElement);

    auto &secondExtensionElement = extensionsElement.GetChild(1);
    REQUIRE(secondExtensionElement.GetStringAttribute("name") ==
            "MyEventsExtension");

    gd::Project readProject;
    readProject.AddPlatform(platform);
    readProject.UnserializeFrom(projectElement);

    // The custom behavior is unserialized even though it depends on the other
    // extension.
    REQUIRE(readProject.HasEventsBasedObject(
        "MyOtherEventsExtension::MyEventsBasedObject"));
    CheckBehaviorProperty(
        readProject
            .GetEventsBasedObject("MyOtherEventsExtension::MyEventsBasedObject")
            .GetObjects());
  }

  SECTION("Loading old project versions does not reorder extension event condition parameters") {
    gd::Platform platform;
    gd::Project writtenProject;
    SetupProject(writtenProject, platform);
    AddEventsFunctionWithVariableCondition(writtenProject);

    SerializerElement projectElement;
    writtenProject.SerializeTo(projectElement);

    // Simulate loading a very old project to trigger legacy compatibility code.
    auto &versionElement = projectElement.GetChild("gdVersion");
    versionElement.SetAttribute("major", 2);
    versionElement.SetAttribute("minor", 0);
    versionElement.SetAttribute("build", 0);

    gd::Project readProject;
    readProject.AddPlatform(platform);
    readProject.UnserializeFrom(projectElement);

    const auto &eventsExtension =
        readProject.GetEventsFunctionsExtension("MyEventsExtension");
    const auto &eventsFunction =
        eventsExtension.GetEventsFunctions().GetEventsFunction("MyFunction");
    REQUIRE(eventsFunction.GetEvents().GetEventsCount() == 1);
    const auto &standardEvent = dynamic_cast<const gd::StandardEvent &>(
        eventsFunction.GetEvents().GetEvent(0));
    REQUIRE(standardEvent.GetConditions().size() == 1);
    const auto &condition = standardEvent.GetConditions()[0];
    REQUIRE(condition.GetType() == "NumberVariable");
    REQUIRE(condition.GetParameter(0).GetPlainString() == "MyVariable");
    REQUIRE(condition.GetParameter(1).GetPlainString() == "=");
    REQUIRE(condition.GetParameter(2).GetPlainString() == "42");
  }
}
