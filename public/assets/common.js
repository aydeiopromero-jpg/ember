// Settings and shortcuts shared by the shell and the built-in pages.
(function () {
  const SETTINGS_KEY = "ember.settings";
  const SHORTCUTS_KEY = "ember.shortcuts";

  const ENGINES = {
    duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
    google: { name: "Google", url: "https://www.google.com/search?q=%s" },
    bing: { name: "Bing", url: "https://www.bing.com/search?q=%s" },
    brave: { name: "Brave", url: "https://search.brave.com/search?q=%s" },
  };

  const DEFAULTS = {
    engine: "duckduckgo",
    wisp: "",
    background: true,
    popupsInTabs: true,
  };

  const DEFAULT_SHORTCUTS = [
    { name: "Google", url: "https://www.google.com" },
    { name: "YouTube", url: "https://www.youtube.com" },
    { name: "GitHub", url: "https://github.com" },
    { name: "Discord", url: "https://discord.com/app" },
    { name: "now.gg", url: "https://now.gg" },
    { name: "Reddit", url: "https://www.reddit.com" },
  ];

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked: settings just won't persist */
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  window.EmberStore = {
    ENGINES,
    DEFAULTS,
    hostOf,
    iconFor(url) {
      const host = hostOf(url);
      return host ? `/api/icon?domain=${encodeURIComponent(host)}` : "/assets/logo.svg";
    },
    loadSettings() {
      const saved = read(SETTINGS_KEY, {});
      const settings = { ...DEFAULTS, ...saved };
      if (!ENGINES[settings.engine]) settings.engine = DEFAULTS.engine;
      return settings;
    },
    saveSettings(patch) {
      const next = { ...this.loadSettings(), ...patch };
      write(SETTINGS_KEY, next);
      return next;
    },
    loadShortcuts() {
      const saved = read(SHORTCUTS_KEY, null);
      return Array.isArray(saved) ? saved : DEFAULT_SHORTCUTS.slice();
    },
    saveShortcuts(list) {
      write(SHORTCUTS_KEY, list);
    },
    // A rounded site icon, falling back to a coloured letter if the icon can't load.
    iconElement(url, name) {
      const box = document.createElement("span");
      box.className = "tile-icon";
      const letter = () => {
        box.replaceChildren(document.createTextNode((name || "?").trim().charAt(0).toUpperCase()));
        box.style.background = this.colorFor(name).solid;
        box.style.color = "#fff";
      };
      const host = hostOf(url);
      if (!host) {
        letter();
        return box;
      }
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = this.iconFor(url);
      img.addEventListener("error", letter, { once: true });
      box.append(img);
      return box;
    },
    colorFor(name) {
      let hash = 0;
      for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      const hue = hash % 360;
      return {
        solid: `hsl(${hue} 62% 46%)`,
        art: `linear-gradient(140deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 72% 26%))`,
      };
    },
    reset() {
      try {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(SHORTCUTS_KEY);
      } catch {
        /* ignore */
      }
    },
  };
})();
