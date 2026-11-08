# 🔥 Ember

A web proxy with a full browser built in: tabs, an address bar, back/forward/reload, a home page with drifting embers, shortcuts, a games page and settings.

Built on [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) with [bare-mux](https://github.com/MercuryWorkshop/bare-mux), [epoxy](https://github.com/MercuryWorkshop/epoxy-tls) and [wisp-js](https://github.com/MercuryWorkshop/wisp-js).

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm start
```

Then open http://localhost:8080.

## Put it online

Ember needs a host that runs Node.js and supports WebSockets. The site **must be served over HTTPS** (except on `localhost`), because browsers only allow service workers on secure pages. All the hosts below give you HTTPS automatically.

### Render (free)

1. Make a new repository on GitHub and upload all of Ember's files into it. `package.json` must be at the top of the repository, not inside a folder.
2. On [render.com](https://render.com), choose **New → Web Service** (not Static Site) and pick the repository.
3. Language: **Node**. Build command: `npm install`. Start command: `npm start`. Instance type: **Free**.
4. Click **Deploy** and wait until it says **Live**. Your link is shown at the top, like `https://your-app.onrender.com`.

Free Render apps go to sleep when nobody uses them, so the first visit after a while takes about a minute.

GitHub Pages, Netlify and Google Sites **can't** run Ember: they only host plain files, and Ember needs a server. If you open a link from one of those, you'll get "Not Found" or a blank page.

### Docker (Koyeb, Fly.io, a VPS…)

```bash
docker build -t ember .
```

```bash
docker run -p 8080:8080 ember
```

### GitHub Codespaces (quick test)

Open the repository in a codespace, run `npm install && npm start`, then open the forwarded port 8080.

## Windows program (ember.exe)

`ember.exe` is all of Ember, proxy server included, in one program file. Double-click it: a small black window opens and Ember opens in your browser at http://localhost:8080. Keep the black window open while you use Ember, and close it to stop.

Windows may say it "protected your PC" because the program isn't signed. Click **More info → Run anyway**.

It uses your computer's own internet connection, so it's for trying Ember out. Sites your network blocks stay blocked; for that, Ember has to run on a server (see above).

To build it yourself: `npm install`, then `npm run build:exe`. The program appears at `build/ember.exe`.

## Single-file Ember

`ember.html` is Ember in one file. Double-click it and it opens straight to Ember's home page, with no setup screen.

To open websites it needs your Ember server, so put your server's link between the quotes on line 7 of the file (open it in Notepad or any text editor). `how-to-add-your-link.png` shows exactly where:

```html
const EMBER_URL = "https://my-ember.onrender.com";
```

When you search, click a shortcut, or open Games or Settings, the file hands over to your Ember server and everything works as normal. Without a link, the home page still shows, and searching tells you the link is missing.

## Customise it

| What | Where |
| --- | --- |
| Games list | `public/assets/games.js` (the `GAMES` array) |
| Default home shortcuts | `public/assets/common.js` (`DEFAULT_SHORTCUTS`) |
| Search engines | `public/assets/common.js` (`ENGINES`) |
| Colours and font | `public/assets/theme.css` |
| Name, tagline, home page | `public/pages/home.html` |
| Background animation | `public/assets/bg.js` |

Settings people change in the app (search engine, background on/off, Wisp server) are saved in their own browser.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl K | Jump to the address bar |
| Ctrl R / F5 | Reload the current tab |
| Alt T | New tab |
| Alt W | Close tab |
| Alt 1–9 | Switch tabs |
| Middle click | Open a shortcut or game in a new tab |

## How it works

- `index.js` serves the site and runs a **Wisp** server at `/wisp/`, which opens connections to websites for the browser.
- The page registers a **service worker** (`public/sw.js`) that catches every request under `/uv/service/`, rewrites it with Ultraviolet, and sends it through bare-mux and epoxy over the Wisp connection.
- Each tab is an iframe pointing at `/uv/service/<encoded url>`. The shell (`public/assets/shell.js`) reads the real URL and title back out of the frame to fill the address bar and tab.

## Notes

- Some sites (Google sign-in, Discord login, heavy video sites) can be unreliable through any web proxy.
- Only use Ember on networks where you're allowed to. Schools and workplaces often have rules about proxies.

## License

AGPL-3.0, because epoxy-transport is AGPL. Outfit font: SIL Open Font License (`public/assets/fonts/OFL.txt`).
