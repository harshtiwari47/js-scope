# JS-Scope | Interactive JavaScript Code Visualizer

JS-Scope is an interactive JavaScript execution engine and visualizer built with modern **Neumorphism (Soft 3D UI)** design aesthetics, real-time AST line-by-line instrumentation, and multi-panel visualization arenas.

![JS-Scope Neumorphic Visualizer](https://img.shields.io/badge/UI-Neumorphic_3D-blue?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript)
![Vercel Ready](https://img.shields.io/badge/Vercel-Ready-black?style=for-the-badge&logo=vercel)

---

## ✨ Features

- 🧠 **AST-Based Instrumentation & Trace Engine**: Line-by-line step execution capture powered by Acorn AST parsing.
- 🎨 **Convex Dome Neumorphic Design**: Tactile 3D soft light UI (`#dde3ec` / `#3c4858`) with extruded cards, convex dome buttons, and inset cavities.
- 🎛️ **Draggable Resizable Sections**: Adjust sizes of workspace panels, CodeEditor vs Scope Inspector, Call Stack vs Heap, and Console Terminal.
- 📚 **Multi-Tab Visualization Arenas**:
  - **Stack & Heap Memory**: Real-time call stack frames and hex memory object references (`0x10A1`).
  - **Array & Sorting Visualizer**: 3D bar columns with pointer flags (`i`, `j`, `pivot`) and state highlights (`comparing`, `swapping`, `sorted`).
  - **Event Loop & Async**: Visualizes Call Stack, Web APIs background threads, Microtask Queue (Promises), and Task Queue (`setTimeout`).
  - **Object / Tree Graph**: Dynamic SVG node-link graph diagram for Binary Trees (BST), Linked Lists, and Object references.
- ⚡ **Interactive Code Editor**: Powered by CodeMirror with debounced tracing, formatting, and high-contrast character syntax highlighting.

---

## 🚀 Live Demo & Deployment

This repository is **Vercel-ready** out of the box!

### Local Setup
```bash
# Clone the repository
git clone git@github.com:harshtiwari47/js-scope.git

# Navigate to project directory
cd js-scope

# Run development server
npx serve . -p 3000
```

Open `http://localhost:3000` in your browser.

---

## 🛠️ Built With

- **HTML5 & Vanilla CSS3** (Neumorphism Design Tokens)
- **JavaScript (ES Modules)**
- **CodeMirror 5** (Code Editor)
- **Acorn JS Parser** (AST Boundary Analysis)
- **FontAwesome 6** & **Google Fonts (Outfit, Inter, Fira Code)**

---

## 📄 License

MIT © [Harsh Tiwari](https://github.com/harshtiwari47)
