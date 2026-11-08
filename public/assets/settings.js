/* global EmberStore */
(function () {
  "use strict";
  const Ember = window.parent.Ember;
  if (!Ember) return;

  let settings = EmberStore.loadSettings();

  function save(patch) {
    settings = EmberStore.saveSettings(patch);
    Ember.applySettings(settings);
    render();
  }

  const enginesEl = document.getElementById("engines");
  const engineChips = Object.entries(EmberStore.ENGINES).map(([id, engine]) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = engine.name;
    chip.dataset.id = id;
    chip.addEventListener("click", () => save({ engine: id }));
    return chip;
  });
  enginesEl.append(...engineChips);

  const background = document.getElementById("background");
  const popups = document.getElementById("popups");
  background.addEventListener("click", () => save({ background: !settings.background }));
  popups.addEventListener("click", () => save({ popupsInTabs: !settings.popupsInTabs }));

  const wisp = document.getElementById("wisp");
  wisp.value = settings.wisp;
  document.getElementById("wisp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = wisp.value.trim();
    if (value && !/^wss?:\/\/.+/i.test(value)) {
      Ember.toast("A Wisp server address starts with wss:// or ws://");
      return;
    }
    save({ wisp: value });
    Ember.toast(value ? "Wisp server saved." : "Using this site's own Wisp server.");
  });

  document.getElementById("reset").addEventListener("click", () => {
    if (confirm("Reset all Ember settings and shortcuts?")) Ember.reset();
  });

  function render() {
    engineChips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.id === settings.engine)));
    background.setAttribute("aria-checked", String(settings.background));
    popups.setAttribute("aria-checked", String(settings.popupsInTabs));
  }
  render();
})();
