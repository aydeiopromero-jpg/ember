/* global EmberStore */
(function () {
  "use strict";
  const Ember = window.parent.Ember;
  if (!Ember) return;

  // Add your own games here: name, url, and a category.
  const GAMES = [
    { name: "2048", url: "https://play2048.co", cat: "Puzzle" },
    { name: "Slither.io", url: "https://slither.io", cat: ".io" },
    { name: "Krunker", url: "https://krunker.io", cat: "Shooter" },
    { name: "Shell Shockers", url: "https://shellshock.io", cat: "Shooter" },
    { name: "Smash Karts", url: "https://smashkarts.io", cat: "Racing" },
    { name: "Agar.io", url: "https://agar.io", cat: ".io" },
    { name: "Diep.io", url: "https://diep.io", cat: ".io" },
    { name: "Paper.io 2", url: "https://paper-io.com", cat: ".io" },
    { name: "Bloxd.io", url: "https://bloxd.io", cat: "Sandbox" },
    { name: "Minecraft Classic", url: "https://classic.minecraft.net", cat: "Sandbox" },
    { name: "Narrow One", url: "https://narrow.one", cat: "Shooter" },
    { name: "Venge.io", url: "https://venge.io", cat: "Shooter" },
    { name: "Ev.io", url: "https://ev.io", cat: "Shooter" },
    { name: "Moomoo.io", url: "https://moomoo.io", cat: ".io" },
    { name: "Zombs.io", url: "https://zombs.io", cat: ".io" },
    { name: "Bonk.io", url: "https://bonk.io", cat: ".io" },
    { name: "Hole.io", url: "https://hole-io.com", cat: ".io" },
    { name: "Taming.io", url: "https://taming.io", cat: ".io" },
    { name: "Chess.com", url: "https://www.chess.com/play/computer", cat: "Board" },
    { name: "Lichess", url: "https://lichess.org", cat: "Board" },
    { name: "Skribbl.io", url: "https://skribbl.io", cat: "Party" },
    { name: "Gartic Phone", url: "https://garticphone.com", cat: "Party" },
    { name: "Wordle", url: "https://www.nytimes.com/games/wordle/index.html", cat: "Puzzle" },
    { name: "Sudoku", url: "https://sudoku.com", cat: "Puzzle" },
    { name: "Little Alchemy 2", url: "https://littlealchemy2.com", cat: "Puzzle" },
    { name: "Tetris", url: "https://tetris.com/play-tetris", cat: "Puzzle" },
    { name: "Cookie Clicker", url: "https://orteil.dashnet.org/cookieclicker/", cat: "Idle" },
    { name: "Google Snake", url: "https://www.google.com/fbx?fbx=snake_arcade", cat: "Arcade" },
    { name: "Dino Run", url: "https://chromedino.com", cat: "Arcade" },
    { name: "Solitaire", url: "https://solitaired.com", cat: "Arcade" },
    { name: "Monkeytype", url: "https://monkeytype.com", cat: "Typing" },
    { name: "TypeRacer", url: "https://play.typeracer.com", cat: "Typing" },
    { name: "Roblox (now.gg)", url: "https://now.gg/apps/roblox-corporation/5349/roblox.html", cat: "Cloud" },
    { name: "GeForce NOW", url: "https://play.geforcenow.com", cat: "Cloud" },
    { name: "Poki", url: "https://poki.com", cat: "Game sites" },
    { name: "CrazyGames", url: "https://www.crazygames.com", cat: "Game sites" },
    { name: "Coolmath Games", url: "https://www.coolmathgames.com", cat: "Game sites" },
  ];

  const cats = ["All", ...new Set(GAMES.map((g) => g.cat))];
  let cat = "All";

  const grid = document.getElementById("grid");
  const q = document.getElementById("q");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");
  const catsEl = document.getElementById("cats");

  const tiles = GAMES.map((game) => {
    const tile = document.createElement("button");
    tile.className = "game";
    tile.title = game.url;
    const art = document.createElement("span");
    art.className = "art";
    art.style.background = EmberStore.colorFor(game.name).art;
    art.append(EmberStore.iconElement(game.url, game.name));
    const meta = document.createElement("span");
    meta.className = "meta";
    const name = document.createElement("strong");
    name.textContent = game.name;
    const sub = document.createElement("span");
    sub.textContent = game.cat;
    meta.append(name, sub);
    tile.append(art, meta);
    tile.addEventListener("click", () => Ember.go(game.url));
    tile.addEventListener("auxclick", (e) => {
      if (e.button === 1) Ember.open(game.url);
    });
    return { game, tile };
  });
  grid.append(...tiles.map((t) => t.tile));

  const chips = cats.map((c) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = c;
    chip.addEventListener("click", () => {
      cat = c;
      update();
    });
    return chip;
  });
  catsEl.append(...chips);

  function update() {
    const term = q.value.trim().toLowerCase();
    let shown = 0;
    for (const { game, tile } of tiles) {
      const match = (cat === "All" || game.cat === cat) && (!term || game.name.toLowerCase().includes(term));
      tile.hidden = !match;
      if (match) shown++;
    }
    chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.textContent === cat)));
    empty.hidden = shown > 0;
    count.textContent = `${shown} game${shown === 1 ? "" : "s"} · they open right here through Ember.`;
  }

  q.addEventListener("input", update);
  document.getElementById("search").addEventListener("submit", (e) => e.preventDefault());
  update();
})();
