# URL Context Notes

A Chrome/Brave extension that allows you to save and manage sticky notes for specific URLs. Each webpage gets its own dedicated note that persists across sessions, making it perfect for research, documentation, and keeping track of important information.

![Version](https://img.shields.io/badge/version-1.8-blue.svg)
![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## Features

### 📝 URL-Specific Notes
- Each URL has its own dedicated note
- Notes are automatically saved as you type
- Domain-based organization - all tabs on the same domain share the panel state

### 🎨 Rich Text Editing
- **Bold**, *Italic*, and <u>Underline</u> formatting
- Bullet lists support
- Indent/Outdent functionality
- Full contenteditable editor with HTML support

### 🖱️ Context Menu Integration
- Select any text on a webpage
- Right-click and choose "Add selection to note" to instantly append text to that page's note

### 📊 Notes Dashboard
- View all your notes in one place
- Search and filter notes by content, title, or URL
- Delete old or unused notes

### 🔔 Smart Notifications
- Subtle "Note available" indicator when visiting pages with existing notes
- Click the notification to quickly open the side panel

### ⌨️ Keyboard Shortcuts
- **Cmd+Shift+8** (Mac) / **Ctrl+Shift+8** (Windows/Linux): Toggle list item for current line

### 🌓 Dark Mode Support
- Automatically adapts to your system's light/dark mode preference
- Smooth theme transitions
- Beautiful UI in both modes

### 💾 Data Persistence
- Notes stored in Chrome Sync storage (persists when extension is disabled)
- Automatic migration from local to sync storage
- Export/Import functionality for backup and restore
- Page titles are saved alongside URLs for better organization

### 📤 Export & Import
- Export all notes as JSON file
- Import notes from backup files
- Full backward compatibility with older export formats

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome/Brave and navigate to `chrome://extensions/` (or `brave://extensions/`)
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the extension directory (`chrome-extension-sticky-notes-to-page`)

### From Chrome Web Store

*Coming soon - extension will be published to Chrome Web Store*

## Usage

### Getting Started

1. **Enable Notes for a Domain**: Click the extension icon in your browser toolbar
2. **Open Side Panel**: The side panel will open automatically, showing the note editor for the current page
3. **Start Typing**: Your notes are automatically saved as you type (with 500ms debounce)

### Managing Notes

- **Format Text**: Use the toolbar buttons to format your text (Bold, Italic, Underline)
- **Create Lists**: Click the "• Liste" button or use `Cmd+Shift+8` / `Ctrl+Shift+8` to toggle list items
- **Indent/Outdent**: Use the arrow buttons to adjust indentation

### Using the Dashboard

- Click the "📊" chart icon in the side panel toolbar to open the Dashboard
- Here you can view, search, and manage all your saved notes across all domains

### Context Menu

- Highlight text on any webpage
- Right-click and select "Add selection to note" to append the text to the current note

### Export & Import

- **Export**: Click the "📥 Export" button to download all your notes as a JSON file
- **Import**: Click the "📤 Import" button to restore notes from a previously exported JSON file

### Domain-Based Behavior

- Notes are organized by domain (e.g., all `example.com` pages share the same panel state)
- When you enable notes for a domain, the panel becomes available for all tabs on that domain
- Each URL still maintains its own unique note content

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+8` (Mac)<br>`Ctrl+Shift+8` (Windows/Linux) | Toggle list item for current line |

## Data Storage

### Storage Method
- Notes are stored in **Chrome Sync Storage** by default
- This ensures notes persist when the extension is disabled (but not when removed)
- Falls back to local storage if sync quota is exceeded

### What Gets Saved
- Note content (HTML format)
- Page title (for better organization)
- Domain enable/disable states

### Backup Recommendations
- Use the Export feature regularly to create backups
- Export before removing the extension (data is cleared on removal)
- Import after reinstalling to restore your notes

## Technical Details

### Architecture
- **Manifest V3** compliant
- **Service Worker** for background tasks
- **Side Panel API** for the note editor interface
- **Contenteditable** for rich text editing

### Permissions
- `sidePanel`: Required for the side panel interface
- `storage`: Required for saving notes
- `tabs`: Required to detect current page and get page titles
- `<all_urls>`: Required to work on all websites

### Browser Compatibility
- ✅ Chrome 109+
- ✅ Brave (Chromium-based)
- ✅ Edge (Chromium-based)
- ❌ Firefox (not supported - uses different extension API)

## Development

### Project Structure

```
chrome-extension-sticky-notes-to-page/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (domain management)
├── sidepanel.html         # Side panel UI
├── sidepanel.js           # Note editor logic
├── dashboard.js           # Dashboard/Options page logic
├── content.js             # Content script for notifications
├── content.css            # Styles for notifications
├── style.css              # Styling (with dark mode support)
├── icon.png               # Extension icon
└── README.md              # This file
```

### Key Components

- **SidePanelManager** (`background.js`): Manages domain-based panel states
- **NoteEditor** (`sidepanel.js`): Handles note editing, saving, and formatting
- **Storage**: Uses Chrome Sync API with local storage fallback

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

1. Clone the repository
2. Make your changes
3. Test in Chrome/Brave with Developer mode enabled
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### Version 1.8
- Added Notes Dashboard for central management
- Added Context Menu integration ("Add selection to note")
- Added on-page notifications for existing notes
- Added search and filter functionality in Dashboard

### Version 1.7
- Added page title storage alongside URLs
- Enhanced export/import to include titles
- Improved display to show page titles

### Version 1.6
- Added dark mode support (automatic system detection)
- Switched to Chrome Sync storage for better persistence
- Added export/import functionality
- Added keyboard shortcut for list items (Cmd+Shift+8)

### Version 1.5
- Initial release
- Basic note editing functionality
- Domain-based panel management

## Support

If you encounter any issues or have feature requests, please open an issue on GitHub.

## Acknowledgments

- Built with Chrome Extension Manifest V3
- Uses Chrome Side Panel API
- Inspired by the need for URL-specific note-taking

---

**Made with ❤️ for better web note-taking**
