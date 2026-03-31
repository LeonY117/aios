# UI Prototyping Workflow

## Where to put files

All UI prototypes go in `prototype/`. This folder is gitignored (except this file).

## Naming and versioning

- **Small/quick prototypes:** single file, e.g. `prototype/sidebar-layout.html`
- **Larger features with iterations:** create a subfolder with versioned files:
  ```
  prototype/chat-redesign/
    chat-redesign_v0.html
    chat-redesign_v1.html
    chat-redesign_v2.html
  ```

## Always open after generating

After creating or updating a prototype file, always run `open <file>` to open it in the browser. Do not wait for the user to ask.

## Archiving

When a design is confirmed or the feature is implemented, move the prototype files into `prototype/archive/`. For example:
```
mv prototype/sidebar-layout.html prototype/archive/
mv prototype/chat-redesign/ prototype/archive/
```
