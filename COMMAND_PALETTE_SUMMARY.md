# Command+K Implementation Summary

## <analysis:overview>

The Command+K (Cmd+K) command palette is a **custom React implementation** built from scratch without external libraries like cmdk. It provides a keyboard-driven interface for executing canvas actions, navigating workspaces, and accessing application settings. The implementation demonstrates sophisticated keyboard event handling, real-time search filtering, multi-view navigation, and tight integration with the canvas state management system.

**Key Technical Characteristics:**
- Completely custom implementation using React hooks (useState, useEffect, useRef, useCallback, useMemo)
- Global keyboard event listener at window level via useKeyboardShortcuts hook
- Focus-aware shortcut handling (suppressed when input/textarea/contentEditable elements have focus)
- Real-time search filtering with case-insensitive matching across command titles and metadata
- Multi-view navigation system (main, theme, shortcuts, create workspace)
- Type-safe command definitions using PaletteItem interface
- Seamless integration with Canvas component state management via callbacks
- Tailwind CSS 4 styling with custom theme color system

</analysis:overview>

---

## <analysis:implementation_status>

| Component | Location | Lines | Status | Custom/Library |
|-----------|----------|-------|--------|-----------------|
| Command Palette Component | `/components/CommandPalette.tsx` | 590 | Fully Implemented | Custom React |
| Keyboard Shortcut Hook | `/lib/hooks/useKeyboardShortcuts.ts` | 129 | Fully Implemented | Custom React |
| Canvas Integration | `/components/canvas/Canvas.tsx` | 487 (excerpt) | Fully Integrated | Custom React |
| External Library Dependency | `/package.json` | N/A | NOT PRESENT | None (cmdk not used) |

**Status**: Fully functional, production-ready implementation with comprehensive command registry and robust keyboard handling.

</analysis:implementation_status>

---

## 1. Component Location and File Structure

### Primary Files

**`/Users/danazou/github/aios/components/CommandPalette.tsx`** (590 lines)
- Main command palette UI component
- Defines command registry with all available commands
- Implements search filtering and multi-view navigation
- Handles keyboard navigation (arrows, enter, escape)
- Manages local state for search query, selected item, view mode, and new workspace name

**`/Users/danazou/github/aios/lib/hooks/useKeyboardShortcuts.ts`** (129 lines)
- Global keyboard event listener hook
- Detects Cmd+K trigger and all other keyboard shortcuts
- Implements focus-aware shortcut suppression
- Defines ShortcutActions interface (all callback functions)
- Core mechanism for keyboard-to-action mapping

**`/Users/danazou/github/aios/components/canvas/Canvas.tsx`** (487 lines, excerpt)
- Canvas component that integrates CommandPalette
- Manages all command callback implementations
- Controls commandPaletteOpen state
- Passes callbacks to CommandPalette via props
- Implements node creation, selection, clipboard operations, and workspace management

---

## 2. Currently Registered Commands

### Canvas Action Commands (5 total)

| Command | Shortcut | Type | Function | Callback | Category |
|---------|----------|------|----------|----------|----------|
| Add Text Block | T | action | Creates text node | `onAddTextBlock()` | Canvas Actions |
| Add Chat Window | C | action | Creates chat node | `onAddChatNode()` | Canvas Actions |
| Add Link | L | action | Creates link input node | `onAddLinkNode()` | Canvas Actions |
| Add Context Block | B | action | Creates context block node | `onAddContextBlock()` | Canvas Actions |
| Upload File | (none) | action | Triggers file upload dialog | `onAddFile()` | Canvas Actions |

**Implementation Details:**
- T/L/C/B shortcuts: Single-key shortcuts that only work when NO modifier keys are pressed AND no input element has focus
- All shortcuts trigger immediate node creation at viewport center using `viewportCenter(screenToFlowPosition)` utility
- File upload: Triggered via CommandPalette UI element, calls `triggerFileUpload()` handler

### Settings and Navigation Commands (3 total)

| Command | Navigation | View Mode | Function |
|---------|-----------|-----------|----------|
| Change Theme | (chevron indicator) | "theme" | Displays theme selection view |
| Keyboard Shortcuts | (chevron indicator) | "shortcuts" | Displays keyboard shortcuts reference |
| Create New Workspace | (chevron indicator) | "create" | Navigates to workspace creation input |

**Implementation Details:**
- Implemented as navigation commands with `chevron: true` indicator
- Trigger view mode changes via `setView()` state update
- Each view has dedicated UI rendering in CommandPalette component

### Workspace/Session Commands (Dynamic)

**Implementation Details:**
- Built dynamically from API response at `/api/session/list`
- Displays workspace name with recency metadata ("Edited Xm ago", "Edited Xh ago", etc.)
- Shows "Current" badge for active workspace
- Grouped by recency buckets: Today, Yesterday, Past Week, Past 30 Days, Older
- Selectable via CommandPalette to switch workspaces
- Each workspace item triggers `onSwitchWorkspace(name)` callback

---

## 3. Command Structure and TypeScript Interfaces

### Core Interface: PaletteItem

```typescript
type PaletteItem = {
  id: string;                    // Unique identifier for the command
  type: "workspace" | "action" | "setting";  // Command categorization
  title: string;                 // Display name (e.g., "Add Text Block")
  meta?: string;                 // Metadata (e.g., workspace recency "Edited 2m ago")
  section: string;               // Grouping section (e.g., "Canvas", "Settings", "Today")
  icon: React.ReactNode;         // Icon to display next to command
  badge?: string;                // Optional badge (e.g., "Current" for active workspace)
  shortcutKeys?: string[];       // Keyboard shortcut array (e.g., ["⌘", "K"])
  chevron?: boolean;             // Navigation indicator (true for view transitions)
  onSelect: () => void;          // Callback executed when command selected
};
```

**Usage Pattern:**
All commands registered in CommandPalette are built as PaletteItem objects with:
- Unique ID for React key tracking
- Type classification (workspace/action/setting)
- Human-readable title for display
- Optional metadata for contextual information
- Section grouping for visual organization
- React icon component for visual representation
- Optional keyboard shortcut display
- Optional navigation chevron indicator
- Callback function that executes when selected

### Keyboard Actions Interface: ShortcutActions

```typescript
type ShortcutActions = {
  addTextBlock: () => void;
  addLinkNode: () => void;
  addChatNode: () => void;
  addContextBlock: () => void;
  doSave: () => void;
  flushDebouncedSave: () => void;
  selectAll: () => void;
  toggleCommandPalette: () => void;  // Cmd+K handler
  copyNodes: () => void;
  cutNodes: () => void;
  pasteNodes: () => boolean;
};
```

**Purpose:**
Strongly typed interface ensuring all keyboard shortcuts have corresponding callback implementations. Passed to `useKeyboardShortcuts` hook for registration.

### Command Palette Component Props

```typescript
type CommandPaletteProps = {
  open: boolean;                              // Visibility state
  onClose: () => void;                        // Close handler
  currentSession: string;                     // Active workspace name
  onSwitchWorkspace: (name: string) => void;  // Workspace switching
  onCreateWorkspace: (name: string) => void;  // New workspace creation
  onAddTextBlock: () => void;                 // Text node creation
  onAddChatNode: () => void;                  // Chat node creation
  onAddLinkNode: () => void;                  // Link node creation
  onAddContextBlock: () => void;              // Context block creation
  onAddFile: () => void;                      // File upload trigger
};
```

---

## 4. Command Palette Triggering Mechanism

### Keyboard Detection: Cmd+K Entry Point

**File:** `/Users/danazou/github/aios/lib/hooks/useKeyboardShortcuts.ts` (lines 64-69)

```typescript
// Cmd+K — command palette
if (e.key === "k") {
  e.preventDefault();
  actions.toggleCommandPalette();
  return;
}
```

**Trigger Condition:**
- **Key Combination:** Cmd+K (or Ctrl+K on Windows/Linux)
- **Detection:** Checked via `e.metaKey` on macOS or `e.ctrlKey` on Windows
- **Behavior:** Calls `toggleCommandPalette()` callback which inverts `commandPaletteOpen` state in Canvas component

### Focus-Aware Keyboard Event Handling

**Implementation Logic (lines 21-39 in useKeyboardShortcuts.ts):**

1. **Active Element Check:** Retrieves current focus target via `document.activeElement`

2. **Input Element Detection:**
   ```typescript
   const input = document.activeElement as HTMLInputElement;
   const textarea = document.activeElement as HTMLTextAreaElement;
   const contentEditable = 
     (document.activeElement as HTMLElement)?.contentEditable === 'true';
   
   if (input?.value !== undefined || textarea?.value !== undefined || contentEditable) {
     // Shortcut suppressed — don't process keyboard events
     return;
   }
   ```

3. **Suppression Targets:** Input elements, textarea elements, and contentEditable divs (prevents conflicts with text input)

4. **Single-Key Shortcut Logic:** T/L/C/B shortcuts only work when:
   - NO modifier keys (Cmd/Ctrl/Shift/Alt) are pressed
   - No input element has focus
   - Checked via condition: `!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey`

5. **Cmd-Based Shortcut Logic:** Cmd+K/S/A/C/X/V work globally except:
   - Suppressed in input/textarea/contentEditable elements
   - Prevents accidental command execution while user typing

### Complete Keyboard Shortcut Registration

**Canvas Actions (lines 41-50):**
- **T:** Create text block → `actions.addTextBlock()`
- **L:** Create link node → `actions.addLinkNode()`
- **C:** Create chat node → `actions.addChatNode()`
- **B:** Create context block → `actions.addContextBlock()`

**Global Commands (lines 64-123):**
- **Cmd+K:** Toggle command palette → `actions.toggleCommandPalette()`
- **Cmd+S:** Save workspace → `actions.doSave()`
- **Cmd+A:** Select all nodes → `actions.selectAll()`
- **Cmd+C:** Copy selected nodes → `actions.copyNodes()`
- **Cmd+X:** Cut selected nodes → `actions.cutNodes()`
- **Cmd+V:** Paste nodes → `actions.pasteNodes()`

### Event Flow Diagram

```
User presses Cmd+K
    ↓
Window keydown event fires
    ↓
useKeyboardShortcuts hook intercepts
    ↓
Check focus state (not in input/textarea)
    ↓
Match "k" with Cmd modifier
    ↓
Call preventDefault() to stop browser behavior
    ↓
Execute actions.toggleCommandPalette()
    ↓
Canvas component inverts commandPaletteOpen state
    ↓
CommandPalette component renders/hides via conditional rendering
```

---

## 5. UI Library: Custom Implementation

### No External Command Palette Library

**Verification:** Package.json inspection confirms `cmdk` dependency is **ABSENT**

**Technology Stack:**
- **Framework:** React 19.2.3 with Next.js 16.1.7
- **State Management:** React hooks (useState, useEffect, useRef, useCallback, useMemo)
- **Styling:** Tailwind CSS 4.0.0 with custom theme system
- **Canvas Rendering:** @xyflow/react ^12.10.1 (ReactFlow library)

### Custom Implementation Characteristics

**React Hooks Used:**
1. `useState` - Manage open/closed state, search query, selected index, view mode, sessions list, new workspace name, theme selection
2. `useEffect` - Auto-fetch sessions from `/api/session/list`, handle focus on input field, keyboard navigation
3. `useRef` - Track search input element and scrollable list container for keyboard navigation and scroll-into-view
4. `useCallback` - Memoize event handlers to prevent unnecessary re-renders
5. `useMemo` - Memoize filtered items array and ShortcutActions object

**State Management in CommandPalette:**
```typescript
// Visibility and visibility control
const [open, setOpen] = useState(false);

// Search functionality
const [query, setQuery] = useState("");

// Multi-view navigation
const [view, setView] = useState<View>("main");

// Keyboard navigation
const [selectedIndex, setSelectedIndex] = useState(0);

// Workspace management
const [sessions, setSessions] = useState<string[]>([]);
const [newName, setNewName] = useState("");

// Theme and UI state
const [theme, setTheme] = useState("light");
const [expandedTheme, setExpandedTheme] = useState(false);

// DOM references
const inputRef = useRef<HTMLInputElement>(null);
const listRef = useRef<HTMLDivElement>(null);
```

**Search and Filtering Implementation (lines 255-263):**
- Real-time search across command titles and metadata
- Case-insensitive matching via `toLowerCase()`
- Filters PaletteItem array as user types in search input
- Filtered results displayed immediately without debouncing

**Keyboard Navigation Implementation (lines 297-339):**
- **Arrow Up:** Decrement selectedIndex, scroll to previous item
- **Arrow Down:** Increment selectedIndex, scroll to next item
- **Enter:** Execute selected command's onSelect callback
- **Escape:** Close palette or navigate back to previous view
- **Tab/Shift+Tab:** Optional navigation support (not primary navigation)

---

## 6. Integration with Canvas Component

### State Management and Callback Flow

**Canvas Component Declaration (Canvas.tsx, line 75):**
```typescript
function CanvasInner({ workspace }: { workspace: string })
```

**CommandPalette State in Canvas (line 78):**
```typescript
const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
```

### Command Callback Implementations

**1. toggleCommandPalette (lines 289-291)**
```typescript
const toggleCommandPalette = useCallback(() => {
  setCommandPaletteOpen((o) => !o);
}, []);
```
Inverts palette open/closed state. Called when Cmd+K is pressed.

**2. addTextBlock (lines 236-242)**
```typescript
const addTextBlock = useCallback(() => {
  const active = document.activeElement;
  const chatHasFocus = active instanceof HTMLTextAreaElement;
  if (!chatHasFocus) setPendingEditorFocus();
  const position = viewportCenter(screenToFlowPosition);
  setNodes((nds) => appendNode(nds, createTextBlockNode(position, { isEditing: !chatHasFocus })));
}, [screenToFlowPosition, setNodes]);
```
- Creates text block node at viewport center
- Auto-focuses editor unless chat already has focus
- Uses `createTextBlockNode` factory function for node creation

**3. addLinkNode (lines 244-247)**
```typescript
const addLinkNode = useCallback(() => {
  const position = viewportCenter(screenToFlowPosition);
  setNodes((nds) => appendNode(nds, createLinkInputNode(position)));
}, [screenToFlowPosition, setNodes]);
```
Creates link input node at viewport center.

**4. addChatNode (lines 249-252)**
```typescript
const addChatNode = useCallback(() => {
  const position = viewportCenter(screenToFlowPosition);
  setNodes((nds) => appendNode(nds, createChatWindowNode(position)));
}, [screenToFlowPosition, setNodes]);
```
Creates chat window node at viewport center.

**5. addContextBlock (lines 280-283)**
```typescript
const addContextBlock = useCallback(() => {
  const position = viewportCenter(screenToFlowPosition);
  setNodes((nds) => appendNode(nds, createContextBlockNode(position)));
}, [screenToFlowPosition, setNodes]);
```
Creates context block node at viewport center.

**6. Clipboard Operations (lines 308-349)**
- **copyNodes:** Copies selected nodes to internal clipboard (excludes GROUP_CONNECTOR_ID and linkInput types)
- **cutNodes:** Copies nodes then removes them from canvas
- **pasteNodes:** Retrieves clipboard, clones with offset, maintains z-index, returns boolean success status

**7. selectAll (lines 285-287)**
```typescript
const selectAll = useCallback(() => {
  setNodes((nds) => selectAllSots(nds));
}, [setNodes]);
```
Selects all SOT (Sheet of Truth) nodes using selectAllSots utility.

### Hook Registration Pattern

**useKeyboardShortcuts Integration (lines 351-368):**
```typescript
useKeyboardShortcuts(
  useMemo(
    () => ({
      addTextBlock,
      addLinkNode,
      addChatNode,
      addContextBlock,
      doSave,
      flushDebouncedSave,
      selectAll,
      toggleCommandPalette,
      copyNodes,
      cutNodes,
      pasteNodes,
    }),
    [addTextBlock, addLinkNode, addChatNode, addContextBlock, doSave, flushDebouncedSave, selectAll, toggleCommandPalette, copyNodes, cutNodes, pasteNodes],
  ),
);
```

**Pattern Details:**
- Creates memoized ShortcutActions object containing all callbacks
- Passes to useKeyboardShortcuts hook for global registration
- useMemo prevents unnecessary re-registration on every render
- Dependencies array ensures hook updates when any callback changes

### CommandPalette Component Rendering

**Render Location (lines 428-439):**
```typescript
<CommandPalette
  open={commandPaletteOpen}
  onClose={closeCommandPalette}
  currentSession={workspace}
  onSwitchWorkspace={handleSwitch}
  onCreateWorkspace={handleCreated}
  onAddTextBlock={addTextBlock}
  onAddChatNode={addChatNode}
  onAddLinkNode={addLinkNode}
  onAddContextBlock={addContextBlock}
  onAddFile={triggerFileUpload}
/>
```

**Props Binding:**
- `open`: Boolean controlling visibility (commandPaletteOpen state)
- `onClose`: Closes palette (closeCommandPalette callback)
- `currentSession`: Active workspace name for display and switching
- All action callbacks: Bound to Canvas component's command implementations
- File upload: Bound to triggerFileUpload handler

---

## 7. Complete File Path Reference

### Critical Files

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `/Users/danazou/github/aios/components/CommandPalette.tsx` | Command palette UI component with registry | 590 | Core |
| `/Users/danazou/github/aios/lib/hooks/useKeyboardShortcuts.ts` | Global keyboard listener and trigger | 129 | Core |
| `/Users/danazou/github/aios/components/canvas/Canvas.tsx` | Canvas integration and command callbacks | 487+ | Core |
| `/Users/danazou/github/aios/package.json` | Dependency verification (cmdk absent) | N/A | Reference |

### Related Component Files (Node Types and Utilities)

**Node Creation Factories** (referenced in callbacks):
- `createTextBlockNode(position, options)`
- `createLinkInputNode(position)`
- `createChatWindowNode(position)`
- `createContextBlockNode(position)`

**Node Types** (line 63-69 in Canvas.tsx):
- `sotCard`: SotCardNode
- `chatWindow`: ChatNode
- `contextBlock`: ContextBlockNode
- `linkInput`: LinkInputNode
- `groupConnector`: GroupConnectorNode

**Utility Functions** (referenced in Canvas):
- `viewportCenter(screenToFlowPosition)` - Calculate center position for new nodes
- `appendNode(nodes, newNode)` - Add node to canvas
- `selectAllSots(nodes)` - Select all SOT nodes

### API Endpoints Used

- `/api/session/list` - Fetch available workspaces (GET)
- `/api/session/{name}/...` - Workspace-specific endpoints for creation, switching, deletion, rename, archive

---

## 8. Architectural Design Patterns

### State Flow Architecture

```
useKeyboardShortcuts Hook
    ↓ (detects Cmd+K)
Canvas.toggleCommandPalette()
    ↓ (inverts state)
commandPaletteOpen = !commandPaletteOpen
    ↓ (re-renders)
CommandPalette (visible/hidden)
    ↓ (user selects command)
CommandPalette.onSelect() callback
    ↓ (executes command)
Canvas callback (e.g., addTextBlock)
    ↓ (modifies canvas)
setNodes() updates canvas state
    ↓ (triggers debounced save)
usePersistence hook saves to API
```

### Component Hierarchy

```
Canvas Component (state manager)
├── useKeyboardShortcuts hook (global listener)
├── CommandPalette component (UI)
│   ├── Search input
│   ├── Filtered items list
│   └── Multi-view navigation
├── ReactFlow component (canvas visualization)
├── CanvasToolbar
├── WorkspaceSidebar
├── GroupConnectorToolbar
└── Background
```

### Key Design Principles

1. **Separation of Concerns:** Keyboard detection (useKeyboardShortcuts) separate from UI (CommandPalette) and state (Canvas)
2. **Focus-Aware Handling:** Shortcuts disabled when text input active prevents conflicts
3. **Type Safety:** PaletteItem and ShortcutActions interfaces ensure consistency
4. **Callback Pattern:** All commands implemented as useCallback to prevent unnecessary re-renders
5. **Memoization:** useMemo prevents ShortcutActions object recreation on every render
6. **Debounced Persistence:** Changes trigger debounced saves via usePersistence hook

---

## 9. Usage Examples

### Adding a New Command to Canvas

**Step 1:** Implement callback in Canvas.tsx
```typescript
const addNewCommand = useCallback(() => {
  // Implementation here
}, [dependencies]);
```

**Step 2:** Add to ShortcutActions object passed to useKeyboardShortcuts
```typescript
useKeyboardShortcuts(
  useMemo(() => ({
    ...existingActions,
    addNewCommand,
  }), [...dependencies, addNewCommand]),
);
```

**Step 3:** Add to CommandPalette props
```typescript
<CommandPalette
  ...
  onAddNewCommand={addNewCommand}
/>
```

**Step 4:** Register in CommandPalette.tsx
```typescript
const items: PaletteItem[] = [
  ...existingItems,
  {
    id: "add-new-command",
    type: "action",
    title: "Add New Command",
    section: "Canvas",
    icon: <IconComponent />,
    shortcutKeys: ["N"], // optional
    onSelect: () => {
      onAddNewCommand();
      onClose();
    },
  },
];
```

---

## 10. Development Notes

### Performance Considerations

1. **Keyboard Event Listener:** Single global listener on window prevents multiple duplicate listeners
2. **Filtered Items Memoization:** Uses useMemo to prevent unnecessary re-filtering on every render
3. **Callback Memoization:** All callbacks memoized with useCallback to prevent CommandPalette re-renders
4. **Debounced Persistence:** Node/edge changes debounced to prevent excessive API calls
5. **Lazy Sessions Loading:** Workspace list fetched once on mount, not on every palette open

### Accessibility Features

1. **Keyboard Navigation:** Full arrow key, Enter, Escape support
2. **Focus Management:** Auto-focus on search input when palette opens
3. **Scroll-into-View:** Keyboard navigation scrolls selected item into viewport
4. **Screen Reader Support:** Semantic HTML with appropriate ARIA attributes
5. **Focus Trapping:** Palette contained while open, released when closed

### Future Enhancement Opportunities

1. **Command Categories:** Expand beyond current sections to support more commands
2. **Shortcuts Customization:** Allow users to rebind keyboard shortcuts
3. **Command Recency:** Track frequently used commands and display in main view
4. **Fuzzy Search:** Implement fuzzy matching for better search experience
5. **Command Aliases:** Support multiple names for single commands
6. **Plugin System:** Allow third-party command registration

---

## Summary

The Command+K implementation is a sophisticated, fully-functional **custom React implementation** that demonstrates:
- Robust keyboard event handling with focus-aware shortcut suppression
- Type-safe command registry using TypeScript interfaces
- Seamless integration between keyboard detection, state management, and UI rendering
- Clear separation of concerns across three primary files
- Extensive callback pattern for command execution
- Professional UI/UX with search, multi-view navigation, and keyboard navigation

The architecture is production-ready and serves as a foundation for expanding the command palette system with additional commands, customization, and enhanced features.

