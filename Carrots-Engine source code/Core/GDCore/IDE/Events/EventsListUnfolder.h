#include "GDCore/Events/Event.h"
#include "GDCore/Events/EventsList.h"

class GD_CORE_API EventsListUnfolder {
 public:
  /**
   * \brief Recursively unfold all the event lists containing the specified
   * event.
   */
  static void UnfoldWhenContaining(gd::EventsList& list,
                                   const gd::BaseEvent& eventToContain) {
    UnfoldWhenContainingRecursively(list, eventToContain);
  }

  static void FoldAll(gd::EventsList& list) {
    for (size_t i = 0; i < list.size(); ++i) {
      gd::BaseEvent& event = list[i];
      event.SetFolded(true);
      if (event.CanHaveSubEvents()) {
        gd::EventsList& subEvents = event.GetSubEvents();
        if (subEvents.size() > 0) {
          FoldAll(subEvents);
        }
      }
    }
  }

  /**
   * \brief Recursively unfold all the events until a certain level of depth.
   * 0 is the top level. If you want to unfold all events regardless of its depth,
   * use `maxLevel = -1`. `currentLevel` is used for the recursion.
   */
  static void UnfoldToLevel(gd::EventsList& list,
                            const int8_t maxLevel,
                            const std::size_t currentLevel = 0) {
    if (maxLevel >= 0 && currentLevel > maxLevel) return;
    const bool canUnfoldChildren =
        maxLevel < 0 || currentLevel < static_cast<std::size_t>(maxLevel);

    for (size_t i = 0; i < list.size(); ++i) {
      gd::BaseEvent& event = list[i];
      event.SetFolded(false);
      if (canUnfoldChildren && event.CanHaveSubEvents()) {
        gd::EventsList& subEvents = event.GetSubEvents();
        if (subEvents.size() > 0) {
          UnfoldToLevel(subEvents, maxLevel, currentLevel + 1);
        }
      }
    }
  }

 private:
  static bool UnfoldWhenContainingRecursively(
      gd::EventsList& list, const gd::BaseEvent& eventToContain) {
    bool listContainsTargetEvent = false;

    for (size_t i = 0; i < list.size(); ++i) {
      gd::BaseEvent& event = list[i];
      bool eventOrSubEventsContainTarget = (&event == &eventToContain);

      if (event.CanHaveSubEvents()) {
        gd::EventsList& subEvents = event.GetSubEvents();
        if (subEvents.size() > 0 &&
            UnfoldWhenContainingRecursively(subEvents, eventToContain)) {
          event.SetFolded(false);
          eventOrSubEventsContainTarget = true;
        }
      }

      if (eventOrSubEventsContainTarget) {
        listContainsTargetEvent = true;
      }
    }

    return listContainsTargetEvent;
  }
};
