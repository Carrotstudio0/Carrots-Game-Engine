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
