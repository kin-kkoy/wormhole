This folder contains a standalone reference prototype aimed much more closely at Obsidian's graph view.

What this reference now tries to match:
- Obsidian-like dark workspace structure with side panes and a central graph canvas
- automatic graph building from wiki-style internal links such as [[Page Name]]
- unresolved links appearing as nodes even when no file exists yet
- node sizing based on backlink count so highly referenced notes become larger
- hover and selection behavior that emphasizes connected nodes and fades unrelated ones
- a settings panel organized around Filters, Groups, Display, and Forces
- graph navigation through zooming, panning, and node dragging
- optional directional arrows for links

What is still approximate:
- this is still a custom reimplementation, not copied source code
- the search and group matching are simplified compared with full Obsidian query behavior
- the force simulation is tuned to resemble the feel of Obsidian's graph, not to reproduce its internal engine exactly

Why it exists:
- to serve as a visual and interaction reference for the graph view in the future app
- to give a concrete example of how note content can drive graph generation
- to document the features and behaviors that should be preserved when building the real production version

Open index.html in a browser to inspect the reference.

App-ready React + TypeScript component files are also available in the react-component subfolder for future integration into the actual Tauri app.

For a direct AI-readable explanation of what the React component is for, how it stays portable, what data it expects, and how to integrate it into a markdown-based app, see react-component/FOR_AI_READERS.md.
