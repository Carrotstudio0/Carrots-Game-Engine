# Carrots Engine Editor

This is the **Carrots Engine Editor**, the official editor of Carrots Engine, an Arabic game engine developed by the Carrots Team.

The editor is built using modern web technologies including:

- React
- Material UI
- Pixi.js
- Three.js
- Electron

Carrots Engine uses its own runtime and editor systems to create both 2D and 3D games while providing a modern visual workflow focused on productivity and ease of use.

---

# 1) Installation 💻

Make sure you have the following installed:

- Git
- Node.js
- Yarn (optional)

```bash
git clone https://github.com/CarrotStudio/Carrots-Engine.git
cd Carrots-Engine/newIDE/app
npm install
```

---

# 2) Development 🤓

```bash
npm start
```

The editor will automatically open in your browser.

During development, engine resources, editor assets, and runtime files will be generated automatically.

---

## Development of the Desktop Application

Before launching Electron, make sure the web editor is already running.

```bash
cd newIDE/app
npm start

# New terminal

cd newIDE/electron-app
npm install
npm run start
```

---

## UI Development

Carrots Engine includes Storybook for developing and testing UI components.

```bash
cd newIDE/app

npm run storybook
```

---

## Tests

```bash
npm run test
npm run format
```

---

## Themes

Carrots Engine supports fully customizable editor themes.

You can create your own theme or modify the default **Carrots Dark Theme** by editing the theme configuration.

---

## Runtime Development

The runtime and engine modules are located inside the Runtime directory.

Any changes made while the editor is running are rebuilt automatically.

Simply launch Preview to test your changes.

---

## Recommended Tools

We recommend using **Visual Studio Code** with:

- Prettier
- ESLint
- Flow

---

# Building the Desktop Editor 📦

```bash
cd newIDE/electron-app

npm run build
```

---

# Localization

To extract editor translations:

```bash
npm run extract-all-translations
```

After updating translations:

```bash
npm run compile-translations
```

---

# Contributing

Carrots Engine is a **closed-source commercial project** developed exclusively by the **Carrots Team**.

External pull requests are not accepted.

However, we always welcome:

- Bug reports
- Feature suggestions
- UI ideas
- Performance feedback
- Community contributions

You can contact us through our official Discord server.

---

# About Carrots Engine

Carrots Engine is an Arabic game engine designed to simplify game development while providing powerful tools for both beginners and experienced developers.

Current features include:

- 2D & 3D Game Development
- Visual Event System
- Blueprint System
- Modern Asset Browser
- Material Editor
- Particle System
- CSG Tools
- Room Generator
- Built-in Physics
- Animation Tools
- Integrated Editor

Our mission is to build a modern Arabic game engine that empowers creators and grows alongside its community.

---

**Code. Create. Carrot. 🥕**
## (Optional) Building and deploying the standalone app 📦

> 🖐 This section is only for maintainers that want to deploy the "official app" on the GDevelop website. If you're working on contributions for GDevelop, you won't need it. You can download ["Nightly Builds" of GDevelop here too](./docs/Nightly-Builds-and-continuous-deployment.md).

### Desktop version

First, update the version number in `newIDE/electron-app/app/package.json` and merge the change to master.

Then, wait for the CIs (CircleCI & AppVeyor) to build the artifacts needed for the release (MacOS+Linux and Windows respectively).

Once finished, you can download them (use `newIDE/app/scripts/download-all-build-artifacts.js` script) and upload them to the new Github release!

> Note: You can also build manually a desktop version locally by running `npm run build` in `newIDE/electron-app`.

### Webapp version

```bash
cd newIDE/web-app
yarn deploy # or npm run deploy
```

> Note: this will also upload the game engine (GDJS) and extension sources, needed by the IDE and purge the CloudFlare cache.

### (Optional) Updating translations

Extract translations from the editor, as well as GDevelop Core and extensions:

```bash
cd newIDE/app
yarn extract-all-translations # or npm run extract-all-translations
```

This will create `ide-messages.pot` (in `newIDE/app/src/locales/en`) and `gdcore-gdcpp-gdjs-extensions-messages.pot` (in `scripts`). Upload both of them to [the GDevelop Crowdin project](https://crowdin.com/project/gdevelop).

To update translations, build and download the translations from Crowdin. Extract everything in `newIDE/app/src/locales`. And run:

```bash
yarn compile-translations # or npm run compile-translations
```

## 3) How to contribute? 😎

The editor, the game engine and extensions are always in development. Your contribution is welcome!

-   Check [the **roadmap** for ideas and features planned](https://trello.com/b/qf0lM7k8/gdevelop-roadmap).

    You can contribute by picking anything here or anything that you think is missing or could be improved in GD5! If you don't know how to start, it's a good idea to play a bit with the editor and see if there is something that is unavailable and that you can add or fix.

-   Follow the [Development](https://github.com/4ian/GDevelop/tree/master/newIDE#development) section of the README to set up GDevelop and start modifying either **the editor** or **[the game engine/extensions](https://github.com/4ian/GDevelop/tree/master/newIDE#development-of-the-game-engine-or-extensions)**.

-   To submit your changes, you have to first create a Fork on GitHub (use the Fork button on the top right), then [create a Pull Request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/).

-   Finally, make sure that the tests pass (refer to this README and the [game engine README](https://github.com/4ian/GDevelop/tree/master/GDJS) for learning how to run tests).
