# 🔫 Salesforce: Can it run Doom?

> **"Rip and tear... your sales pipeline."**

## 🎮 Play It Now

Run Doom on the live public Salesforce Digital Experience site:

**https://doom-dev-ed.develop.my.site.com**

You can also run it inside the internal Salesforce `Doom` custom app, but the public site above is the fastest way to try it.

![Doom Logo](doom/main/default/staticresources/DoomLogo.png)

---

## 💀 Why?

Because "can it run Doom?" is the eternal question. We've seen Salesforce run DosBox games, but now we need to know, once and for all in native code: can Salesforce run Doom?

**Yes. Yes it can.**

This project implements Doom as a Lightning Web Component (LWC) exposed on a publicly accessible Salesforce Digital Experience (LWR) site — so anyone on the internet can play Doom, served by Salesforce.

Live site: **https://doom-dev-ed.develop.my.site.com**

---

## 🎮 What's in the box

| Component | Type | Description |
|---|---|---|
| 🕹️ `doom` LWC | Lightning Web Component | Loads and renders the Doom engine on a `<canvas>` |
| 📑 `Doom` Tab | Custom Tab | Wires the LWC into Lightning |
| ⚡ `Doom` App | Custom Application | Lightning app with the Doom logo |
| 🖼️ `DoomLogo` | Static Resource | The iconic Doom wordmark |
| 🔐 `DoomPlayers` | Permission Set | Grants access to the app, tab, and LWC |
| ⚙️ `DoomEngine` | Static Resource | 2.32MB asm.js — original Doom C source compiled to JavaScript |
| 💾 `DoomWAD` | Static Resource | `DOOM1.WAD` v1.9 shareware (freely redistributable by id Software) |
| 🌐 `Doom` Network | Digital Experience Site | LWR site, publicly accessible, Doom LWC on the home page |

---

## 🏗️ Architecture

```
🌐 Internet
    └── 🏢 Salesforce Digital Experience Site (LWR, public)
            └── ⚡ c:doom Lightning Web Component
                    ├── loadScript(DoomEngine) ← 2.32MB asm.js
                    ├── fetch(DoomWAD)         ← 4MB DOOM1.WAD
                    └── createDoom({ canvas, FS, callMain })
                                └── 👾 Original 1993 Doom engine running in your browser
                                        └── 💀 Demons (getting ripped and torn)
```

The key insight: Salesforce's Lightning Web Security (LWS) blocks WebAssembly (`wasm-unsafe-eval` CSP). So instead of compiling to WASM, we use **Emscripten's asm.js output** (`-s WASM=0`) — pure JavaScript, no CSP issues.

An additional Experience Cloud wrinkle: the public Digital Experience runtime has stricter Lightning Web Security behavior than the internal custom app. The shipped LWC includes the runtime-safe startup path needed for the public `my.site.com` experience to boot correctly.

---

## 🔧 How It Was Built

### Step 1 — Salesforce App Framework

Created the foundational Salesforce metadata:

- **Custom Lightning App** named `Doom` with the Doom wordmark logo
- **Lightning Web Component** `doom` exposed to `lightning__Tab` and `lightningCommunity__Page` targets
- **Custom Tab** wired to the LWC
- **Permission Set** `DoomPlayers` granting access to the app and tab, assigned to all org users

```bash
sf project deploy start --target-org doom --source-dir doom
```

### Step 2 — Compiling Doom from C to JavaScript

The original 1993 Doom source code (GPL-2.0, released by John Carmack) was compiled to JavaScript using Emscripten 5.0.4.

**Why asm.js, not WebAssembly?**

Salesforce's Content Security Policy blocks `wasm-unsafe-eval`. The `-s WASM=0` flag tells Emscripten to emit asm.js — a strict, highly-optimizable subset of pure JavaScript — instead of a `.wasm` binary. No CSP violations, runs fine inside LWC.

**Platform substitutions:**

| Original file | Replacement | Purpose |
|---|---|---|
| `i_video.c` | `i_video_sdl.c` | SDL2 → Emscripten canvas |
| `i_sound.c` | `i_sound_stub.c` | Silent (no audio) |
| `i_net.c` | `i_net_stub.c` | No multiplayer |

**Source patches:**
- `w_wad.c` — removed `strupr()` definition (Emscripten sysroot already provides it)
- `am_map.c` — added explicit `int` types to K&R-style implicit declarations

**Build command:**
```bash
cd build && bash build.sh
# Output: build/out/doom-engine.js (~2.32MB)
```

The full build script lives at `build/build.sh`. Key flags:

```bash
emcc [sources] \
  -s WASM=0 \               # asm.js output — no CSP issues
  -s MODULARIZE=1 \         # wrap in factory function createDoom({...})
  -s EXPORT_NAME='createDoom' \
  -s TOTAL_MEMORY=16777216 \ # 16MB heap (Doom ran in 4MB in 1993)
  -s USE_SDL=2 \             # Emscripten SDL2 shim → canvas
  -s ASYNCIFY=1 \            # support for emscripten_sleep
  -O2
```

### Step 3 — The DOOM1.WAD

`DOOM1.WAD` is the shareware data file for Doom episode 1 ("Knee-Deep in the Dead"), freely redistributable by id Software.

- **Version:** 1.9
- **Size:** 4,196,020 bytes
- **MD5:** `f0cefca49926d00903cf57551d901abe`
- **Contains:** All level geometry, textures, sprites, sounds for E1M1–E1M8

Uploaded as the `DoomWAD` Salesforce Static Resource.

### Step 4 — The LWC

`doom/main/default/lwc/doom/doom.js` handles the full lifecycle:

```javascript
// 1. Load the compiled engine via Salesforce's platformResourceLoader
loadScript(this, DOOM_ENGINE)

// 2. Fetch the WAD from the static resource URL
.then(() => fetch(DOOM_WAD))
.then(r => r.arrayBuffer())

// 3. Boot Doom
.then(wadBuffer => {
    createDoom({
        canvas: this.refs.gameCanvas,
        preRun: [() => {
            // Mount WAD into Emscripten's virtual filesystem
            module.FS.createDataFile('/', 'doom1.wad', new Uint8Array(wadBuffer), true, true);
        }],
        onRuntimeInitialized: () => {
            module.callMain(['-iwad', 'doom1.wad', '-window', '-nogui', '-nomusic', '-episode', '1']);
        }
    });
});
```

The `<canvas>` element lives in the LWC shadow DOM and is passed directly to the Emscripten module — SDL2 renders frames into it at 320×200, scaled to 640×400.

During the Digital Experience work, the component was also hardened for the public site runtime:
- safer startup sequencing so the Experience container can paint before heavy engine bootstrap
- LWS-safe diagnostics and error handling
- fixes for public-site startup behavior that differs from the internal Lightning app container

### Step 5 — Digital Experience Site

Created a **LWR (Lightning Web Runtime)** Digital Experience site named `Doom`.

The key metadata type for LWR sites is **`DigitalExperienceBundle`** (not the older `ExperienceBundle`). The correct source format structure:

```
doom/main/default/digitalExperiences/site/Doom1/
    Doom1.digitalExperience-meta.xml
    sfdc_cms__view/
        home/
            content.json    ← c:doom LWC injected here
            _meta.json
    sfdc_cms__route/
        Home/content.json
    sfdc_cms__site/
        Doom1/content.json
    sfdc_cms__appPage/...
    sfdc_cms__theme/...
    ... (other LWR boilerplate)
```

The `c:doom` component is placed in the home view's content region:

```json
{
    "definition": "c:doom",
    "id": "08a53557-04fa-4401-b50f-20ff6df047dc",
    "type": "component",
    "attributes": {}
}
```

---

## 🚀 Setup

### Prerequisites

- Salesforce CLI (`sf`) 🛠️
- Emscripten (`emcc`) for building the engine 🔨
- A Salesforce Developer Edition org 🏛️
- A burning desire to rip and tear 🔥

### Build the Engine

```bash
# Install Emscripten (macOS)
brew install emscripten

# Build Doom C source → asm.js
cd build && bash build.sh
# Output: build/out/doom-engine.js
```

### Deploy to Salesforce

```bash
# Authenticate
sf org login web --instance-url https://your-org.my.salesforce.com --alias doom

# Deploy everything
sf project deploy start --target-org doom --source-dir doom
```

### Open The Live Site

If you just want to see Doom running on Salesforce, open:

**https://doom-dev-ed.develop.my.site.com**

---

## 📦 Unlocked Package

This project is structured as an **unlocked package** for easy distribution.

```bash
sf package create --name "Doom" --type Unlocked --path doom --no-namespace
sf package version create --package Doom --installation-key-bypass --wait 10
sf package install --package <version-id> --target-org <org-alias>
```

---

## 🩸 Status

- [x] 🏗️ Salesforce app scaffolded (App, Tab, LWC, Permission Set)
- [x] ⚙️ Doom C source compiled to asm.js via Emscripten (`build/build.sh`)
- [x] 💾 DOOM1.WAD shareware uploaded as static resource
- [x] ⚡ LWC wired to load engine + WAD and boot the game
- [x] 🌐 Digital Experience (LWR) site live with `c:doom` on the home page
- [x] 🔓 Public guest access (no login required)
- [x] 🧪 Runtime testing + CSP/LWS debugging for the public site
- [x] 🎮 Keyboard input working for browser play
- [ ] 💅 Doom-themed site styling

---

## 🤓 Technical Notes

### Why asm.js and not WASM?

Salesforce Lightning Web Security (LWS) enforces a strict Content Security Policy. `WebAssembly.instantiate()` requires the `wasm-unsafe-eval` CSP directive, which Salesforce doesn't allow in LWC context. Emscripten's `-s WASM=0` flag generates asm.js — semantically equivalent JavaScript that JIT-compiles almost as fast as WASM in modern browsers, with zero CSP friction.

### Why Did The Public Site Need Extra Work?

The Doom LWC worked in the internal Salesforce custom app before it worked on the public Digital Experience site. The key difference was the Experience runtime's Lightning Web Security behavior:

- the public site applies stricter runtime restrictions than the internal app shell
- startup and diagnostics had to be adjusted to be safe in that environment
- the final working implementation supports both the internal app and the public `my.site.com` site

### Memory

Doom ran in 4MB on a 486 in 1993. We give it 16MB (`TOTAL_MEMORY=16777216`). Luxurious.

### The WAD Format

Doom's data is stored in a WAD file (Where's All the Data). The shareware `DOOM1.WAD` contains episode 1 only ("Knee-Deep in the Dead"). It's been freely redistributable since id Software released it — we fetch it from a public mirror and serve it from a Salesforce Static Resource.

---

## 🤘 Contributing

Found a bug? Open an issue. Want to add more demons? Open a PR. Want to question whether this was a good idea? Too late.

---

*"Thy flesh consumed, thy soul devoured... by Apex triggers."* 👹
