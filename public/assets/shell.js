/* global BareMux, __uv$config, EmberStore */
(function () {
  "use strict";

  const PAGES = {
    home: { path: "/pages/home.html", title: "Home" },
    games: { path: "/pages/games.html", title: "Games" },
    settings: { path: "/pages/settings.html", title: "Settings" },
  };
  const SESSION_KEY = "ember.session";
  const proxyBase = location.origin + __uv$config.prefix;

  const $ = (id) => document.getElementById(id);
  const tabsEl = $("tabs");
  const framesEl = $("frames");
  const address = $("address");
  const omniIcon = $("omni-icon").querySelector("use");
  const progress = $("progress");
  const tabTemplate = $("tab-template");

  let settings = EmberStore.loadSettings();
  const tabs = [];
  let active = null;

  /* ---------------- proxy setup ---------------- */

  const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
  let proxyReady = null;

  function wispUrl() {
    if (settings.wisp) return settings.wisp;
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
  }

  function waitForActive(reg) {
    if (reg.active) return Promise.resolve();
    const worker = reg.installing || reg.waiting;
    return new Promise((resolve) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
      });
    });
  }

  function ensureProxy() {
    if (!proxyReady) {
      proxyReady = (async () => {
        if (!("serviceWorker" in navigator)) {
          const secure = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
          throw new Error(
            secure
              ? "This browser doesn't support service workers, which Ember needs."
              : "Ember only works over HTTPS. Open this site with https:// instead."
          );
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: __uv$config.prefix });
        await waitForActive(reg);
        await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl() }]);
      })().catch((err) => {
        proxyReady = null;
        throw err;
      });
    }
    return proxyReady;
  }

  // The service worker links up with the proxy on its first request. If several tabs
  // start loading at that same moment they can all stall, so the first proxied page
  // loads on its own and the others wait for it.
  let warmedUp = null;
  function waitForWarmup(tab) {
    if (warmedUp) return warmedUp;
    warmedUp = new Promise((resolve) => {
      tab.frame.addEventListener("load", resolve, { once: true });
      setTimeout(resolve, 10000);
    });
    return Promise.resolve();
  }

  /* ---------------- input → destination ---------------- */

  function toUrl(input) {
    try {
      const url = new URL(input);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch {
      /* not a full URL */
    }
    const looksLikeHost =
      !/\s/.test(input) &&
      (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(input) ||
        /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#].*)?$/.test(input));
    if (looksLikeHost) return "https://" + input;
    const engine = EmberStore.ENGINES[settings.engine] || EmberStore.ENGINES.duckduckgo;
    return engine.url.replace("%s", encodeURIComponent(input));
  }

  function resolveInput(raw) {
    const input = String(raw || "").trim();
    if (!input) return null;
    const page = input.match(/^ember:\/\/([a-z]+)\/?$/i);
    if (page && PAGES[page[1].toLowerCase()]) {
      const name = page[1].toLowerCase();
      return { page: PAGES[name].path, display: `ember://${name}`, title: PAGES[name].title };
    }
    const url = toUrl(input);
    return { url, display: url, title: EmberStore.hostOf(url) || url };
  }

  function unproxy(href, base) {
    let abs;
    try {
      abs = new URL(href, base).href;
    } catch {
      return href;
    }
    if (abs.startsWith(proxyBase)) {
      try {
        return __uv$config.decodeUrl(abs.slice(proxyBase.length));
      } catch {
        return abs;
      }
    }
    return abs;
  }

  /* ---------------- tabs ---------------- */

  function createTab(input = "ember://home", { activate = true, restore = false } = {}) {
    const el = tabTemplate.content.firstElementChild.cloneNode(true);
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.setAttribute(
      "allow",
      "fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; gamepad; microphone; camera"
    );
    frame.setAttribute("referrerpolicy", "no-referrer");

    const tab = { el, frame, url: "", title: "New tab", icon: "/assets/logo.svg", loading: false, navId: 0, pending: null };

    el.addEventListener("click", (e) => {
      if (!e.target.closest(".close")) activateTab(tab);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") activateTab(tab);
    });
    el.addEventListener("auxclick", (e) => {
      if (e.button === 1) closeTab(tab);
    });
    el.querySelector(".close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab);
    });
    el.querySelector(".favicon").addEventListener("error", (e) => {
      if (!e.target.src.endsWith("/assets/logo.svg")) e.target.src = "/assets/logo.svg";
    });
    frame.addEventListener("load", () => onFrameLoad(tab));

    tabsEl.append(el);
    framesEl.append(frame);
    tabs.push(tab);
    if (restore && !activate) {
      // Restored background tabs load the first time they're opened.
      const dest = resolveInput(input);
      tab.pending = input;
      tab.url = dest ? dest.display : "ember://home";
      tab.title = dest ? dest.title : "Home";
      tab.icon = dest && dest.url ? EmberStore.iconFor(dest.url) : "/assets/logo.svg";
      renderTab(tab);
      return tab;
    }
    if (activate) activateTab(tab);
    navigate(tab, input);
    if (!restore) saveSession();
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return tab;
  }

  function activateTab(tab) {
    if (active === tab) return;
    for (const t of tabs) {
      const on = t === tab;
      t.el.classList.toggle("active", on);
      t.el.setAttribute("aria-selected", String(on));
      t.frame.hidden = !on;
    }
    active = tab;
    if (tab.pending) navigate(tab, tab.pending);
    renderToolbar();
    saveSession();
  }

  function closeTab(tab) {
    const i = tabs.indexOf(tab);
    if (i === -1) return;
    tabs.splice(i, 1);
    tab.el.remove();
    tab.frame.remove();
    if (!tabs.length) {
      active = null;
      createTab();
      return;
    }
    if (active === tab) {
      active = null;
      activateTab(tabs[Math.min(i, tabs.length - 1)]);
    }
    saveSession();
  }

  async function navigate(tab, input) {
    const dest = resolveInput(input);
    if (!dest) return;
    const navId = ++tab.navId;
    tab.pending = null;
    tab.url = dest.display;
    tab.title = dest.title;
    tab.icon = dest.page ? "/assets/logo.svg" : EmberStore.iconFor(dest.url);
    setLoading(tab, true);
    renderTab(tab);
    if (tab === active) renderToolbar();

    if (dest.page) {
      tab.frame.src = dest.page;
      return;
    }
    try {
      await ensureProxy();
      await waitForWarmup(tab);
    } catch (err) {
      setLoading(tab, false);
      toast(err.message || String(err));
      return;
    }
    if (navId !== tab.navId) return; // a newer navigation took over
    tab.frame.src = __uv$config.prefix + __uv$config.encodeUrl(dest.url);
  }

  function setLoading(tab, on) {
    tab.loading = on;
    tab.el.classList.toggle("loading", on);
    if (tab === active) progress.classList.toggle("on", on);
  }

  /* Read the current URL / title out of a tab's frame (same-origin, so this works). */
  function syncFromFrame(tab) {
    let win, href;
    try {
      win = tab.frame.contentWindow;
      href = win.location.href;
    } catch {
      return false;
    }
    if (!href || href === "about:blank") return false;

    let url, title, icon;
    if (href.startsWith(proxyBase)) {
      url = unproxy(href);
      title = (win.document.title || "").trim() || EmberStore.hostOf(url) || url;
      icon = EmberStore.iconFor(url);
    } else {
      const path = new URL(href).pathname;
      const name = Object.keys(PAGES).find((k) => PAGES[k].path === path);
      if (!name) return false;
      url = `ember://${name}`;
      title = PAGES[name].title;
      icon = "/assets/logo.svg";
    }
    if (url === tab.url && title === tab.title && icon === tab.icon) return false;
    tab.url = url;
    tab.title = title;
    tab.icon = icon;
    return true;
  }

  function onFrameLoad(tab) {
    let href = "";
    try {
      href = tab.frame.contentWindow.location.href;
    } catch {
      /* ignore */
    }
    if (href === "about:blank" && !tab.frame.getAttribute("src")) return;
    setLoading(tab, false);
    syncFromFrame(tab);
    hookFrame(tab);
    renderTab(tab);
    if (tab === active) renderToolbar();
    saveSession();
  }

  /* Make shortcuts, new-window links and pop-ups inside a page work with Ember's tabs. */
  function hookFrame(tab) {
    let win;
    try {
      win = tab.frame.contentWindow;
      if (!win || win.__emberHooked) return;
      win.__emberHooked = true;
    } catch {
      return;
    }

    win.addEventListener("keydown", onKeydown, true);

    if (!win.location.href.startsWith(proxyBase)) return;

    win.addEventListener(
      "click",
      (e) => {
        if (!settings.popupsInTabs || e.button !== 0) return;
        const a = e.target && e.target.closest && e.target.closest("a[target]");
        if (!a || !/^_?(blank|new)$/i.test(a.getAttribute("target") || "")) return;
        const href = a.href;
        if (!href || /^(javascript|mailto|tel):/i.test(href)) return;
        e.preventDefault();
        createTab(unproxy(href, tab.url));
      },
      true
    );

    try {
      const originalOpen = win.open;
      win.open = function (url, ...rest) {
        if (!settings.popupsInTabs || !url) return originalOpen.call(this, url, ...rest);
        const next = createTab(unproxy(String(url), tab.url));
        return next.frame.contentWindow;
      };
    } catch {
      /* some pages lock window.open; leave it alone */
    }
  }

  /* ---------------- rendering ---------------- */

  function renderTab(tab) {
    tab.el.querySelector(".title").textContent = tab.title;
    tab.el.title = tab.title;
    const img = tab.el.querySelector(".favicon");
    if (img.getAttribute("src") !== tab.icon) img.src = tab.icon;
  }

  function renderToolbar() {
    if (!active) return;
    progress.classList.toggle("on", active.loading);
    if (document.activeElement !== address) {
      address.value = active.url === "ember://home" ? "" : active.url;
    }
    let icon = "#i-search";
    if (active.url.startsWith("ember://")) icon = active.url === "ember://home" ? "#i-search" : "#i-flame";
    else if (active.url.startsWith("https://")) icon = "#i-lock";
    else if (active.url) icon = "#i-globe";
    omniIcon.setAttribute("href", icon);
    document.title = active.url === "ember://home" ? "Ember" : `${active.title} · Ember`;
  }

  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 5000);
  }

  /* ---------------- session restore ---------------- */

  function saveSession() {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ tabs: tabs.map((t) => t.pending || t.url || "ember://home"), active: tabs.indexOf(active) })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      saved = null;
    }
    if (!saved || !Array.isArray(saved.tabs) || !saved.tabs.length) return false;
    saved.tabs.forEach((url) => createTab(String(url), { activate: false, restore: true }));
    activateTab(tabs[Math.max(0, Math.min(Number(saved.active) || 0, tabs.length - 1))]);
    return true;
  }

  /* ---------------- controls ---------------- */

  function withActiveWindow(fn) {
    if (!active) return;
    try {
      fn(active.frame.contentWindow);
    } catch {
      /* frame not ready */
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => toast("Fullscreen isn't allowed here."));
  }

  document.addEventListener("fullscreenchange", () => {
    const on = !!document.fullscreenElement;
    document.body.classList.toggle("fullscreen", on);
    $("fullscreen").querySelector("use").setAttribute("href", on ? "#i-shrink" : "#i-expand");
  });

  function focusAddress() {
    address.focus();
    address.select();
  }

  function onKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && (key === "k" || key === "l")) {
      e.preventDefault();
      focusAddress();
    } else if ((mod && key === "r") || e.key === "F5") {
      e.preventDefault();
      withActiveWindow((w) => w.location.reload());
    } else if (e.altKey && key === "t") {
      e.preventDefault();
      createTab();
      focusAddress();
    } else if (e.altKey && key === "w") {
      e.preventDefault();
      if (active) closeTab(active);
    } else if (e.altKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const t = tabs[Number(e.key) - 1];
      if (t) activateTab(t);
    }
  }

  $("omnibox").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!active) createTab();
    navigate(active, address.value);
    address.blur();
    active.frame.focus();
  });
  address.addEventListener("focus", () => address.select());
  address.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      address.blur();
      renderToolbar();
    }
  });
  address.addEventListener("blur", () => setTimeout(renderToolbar, 0));

  $("back").addEventListener("click", () => withActiveWindow((w) => w.history.back()));
  $("forward").addEventListener("click", () => withActiveWindow((w) => w.history.forward()));
  $("reload").addEventListener("click", () => withActiveWindow((w) => w.location.reload()));
  $("home").addEventListener("click", () => active && navigate(active, "ember://home"));
  $("brand").addEventListener("click", () => active && navigate(active, "ember://home"));
  $("games").addEventListener("click", () => Ember.openPage("games"));
  $("settings").addEventListener("click", () => Ember.openPage("settings"));
  $("fullscreen").addEventListener("click", toggleFullscreen);
  $("newtab").addEventListener("click", () => {
    createTab();
    focusAddress();
  });
  window.addEventListener("keydown", onKeydown, true);

  // Pages change their URL/title without reloading (YouTube, Discord...), so keep checking.
  setInterval(() => {
    if (active && syncFromFrame(active)) {
      renderTab(active);
      renderToolbar();
      saveSession();
    }
  }, 700);

  /* ---------------- API for Ember's own pages ---------------- */

  window.Ember = {
    go(input) {
      if (!active) createTab(input);
      else navigate(active, input);
    },
    open(input) {
      createTab(input);
    },
    openPage(name) {
      const existing = tabs.find((t) => t.url === `ember://${name}`);
      if (existing) activateTab(existing);
      else if (active && active.url === "ember://home") navigate(active, `ember://${name}`);
      else createTab(`ember://${name}`);
    },
    get settings() {
      return settings;
    },
    applySettings(next) {
      const wispChanged = next.wisp !== settings.wisp;
      settings = next;
      if (wispChanged && proxyReady) {
        proxyReady = null;
        ensureProxy().catch((err) => toast(err.message));
      }
    },
    async reset() {
      EmberStore.reset();
      try {
        sessionStorage.removeItem(SESSION_KEY);
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {
        /* ignore */
      }
      location.reload();
    },
    toast,
  };

  // The single-file version of Ember (ember.html) hands sites over as #go=<site> or #page=<name>.
  function handleHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const go = params.get("go");
    const page = params.get("page");
    if (!go && !page) return;
    history.replaceState(null, "", location.pathname + location.search);
    if (go) window.Ember.go(go);
    else if (PAGES[page]) window.Ember.openPage(page);
  }
  window.addEventListener("hashchange", handleHash);

  if (!restoreSession()) createTab();
  handleHash();
  ensureProxy().catch((err) => toast(err.message || String(err)));
})();
