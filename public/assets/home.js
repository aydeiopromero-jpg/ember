/* global EmberStore */
(function () {
  "use strict";
  const Ember = window.parent.Ember;
  if (!Ember) return;

  const q = document.getElementById("q");
  const grid = document.getElementById("shortcuts");
  const dialog = document.getElementById("add-dialog");
  const nameInput = document.getElementById("add-name");
  const urlInput = document.getElementById("add-url");

  document.getElementById("search").addEventListener("submit", (e) => {
    e.preventDefault();
    if (q.value.trim()) Ember.go(q.value);
  });

  function normalize(url) {
    const v = url.trim();
    return /^https?:\/\//i.test(v) ? v : "https://" + v;
  }

  function shortcutTile(item, index, list) {
    const wrap = document.createElement("div");
    wrap.className = "tile-wrap";

    const tile = document.createElement("button");
    tile.className = "shortcut";
    tile.title = item.url;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = item.name;
    tile.append(EmberStore.iconElement(item.url, item.name), name);
    tile.addEventListener("click", () => Ember.go(item.url));
    tile.addEventListener("auxclick", (e) => {
      if (e.button === 1) Ember.open(item.url);
    });

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.title = `Remove ${item.name}`;
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    remove.addEventListener("click", () => {
      list.splice(index, 1);
      EmberStore.saveShortcuts(list);
      render();
    });

    wrap.append(tile, remove);
    return wrap;
  }

  function addTile() {
    const tile = document.createElement("button");
    tile.className = "shortcut add";
    tile.innerHTML =
      '<span class="tile-icon"><svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span class="name">Add</span>';
    tile.addEventListener("click", () => {
      nameInput.value = "";
      urlInput.value = "";
      dialog.showModal();
    });
    return tile;
  }

  function render() {
    const list = EmberStore.loadShortcuts();
    const tiles = list.map((item, i) => shortcutTile(item, i, list));
    if (list.length < 12) tiles.push(addTile());
    grid.replaceChildren(...tiles);
  }

  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "ok") return;
    const name = nameInput.value.trim();
    const url = normalize(urlInput.value);
    if (!name || !EmberStore.hostOf(url)) return;
    const list = EmberStore.loadShortcuts();
    list.push({ name, url });
    EmberStore.saveShortcuts(list);
    render();
  });

  render();
  // Only grab focus when this tab is the one being shown.
  if (window.frameElement && !window.frameElement.hidden) q.focus();
})();
