# URL Context Notes

A Chrome/Brave extension that allows you to save and manage sticky notes for specific URLs. Notes are stored in your **Notion workspace**, giving you access to them from anywhere!

![Version](https://img.shields.io/badge/version-2.0-blue.svg)
![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Notion](https://img.shields.io/badge/Powered%20by-Notion%20API-black.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## ✨ What's New in v2.0

🚀 **Notion Integration** - Your notes are now stored in your Notion workspace instead of browser storage
☁️ **Cloud Sync** - Access your notes from any device
🔐 **Better Privacy** - Your data stays in your Notion account
� **Smart Save Status** - Real-time indicators showing when notes are saving/saved/unsaved
🔗 **Notion Direct Links** - Open notes directly in Notion with one click
📊 **Domain-Smart Panel** - Side panel automatically closes when switching to different domains
�📱 **Multi-Device** - View and edit notes from desktop, tablet, or mobile via Notion

## Quick Setup

1. **Create a Notion Integration** at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. **Set up your database** with properties: Name, URL, Page Title
3. **Connect the integration** to your database
4. **Get your credentials**:
   - Internal Integration Token (starts with `secret_`)
   - Database ID (from your database URL)
5. **Open the extension** and click "Setup Notion Integration"
6. **Paste your credentials** and you're done!

📖 **[Detailed Setup Guide →](NOTION_SETUP.md)**

## Features

### 📝 URL-Specific Notes
- Each URL has its own dedicated note in your Notion database
- Notes are automatically saved as you type (with 500ms debounce)
- Domain-based organization - all tabs on the same domain can access the panel
- Editor is disabled while loading content from Notion (prevents editing empty notes)

### 💾 Smart Save Status Indicator
- **⏳ Loading** (gray) - Content is being loaded from Notion
- **💾 Saving** (orange, with pulse animation) - Note is being saved
- **✅ Saved** (green) - Note successfully saved
- **⭕ Unsaved** (red) - You have unsaved changes
- **❌ Error** (red) - Failed to save (with error message)

### 🎨 Rich Text Editing
- **Bold**, *Italic*, and <u>Underline</u> formatting
- Bullet lists support
- Indent/Outdent functionality
- Full contenteditable editor with HTML support
- Beautiful toolbar with intuitive icons

### 🖱️ Context Menu Integration
- Select any text on a webpage
- Right-click and choose "Add selection to note" to instantly append text to that page's note
- Text is formatted as a paragraph and automatically saved

### 📊 Notes Dashboard
- View all your notes in one place with card layout
- Search and filter notes by content, title, or URL
- Open Website - Jump to the original webpage
- View in Notion - Open the note entry directly in your Notion database
- Delete old or unused notes
- Beautiful, responsive grid layout

### 🔗 Notion Integration Features
- **Open in Notion** button (🔗 Notion) in the side panel toolbar
- **View in Notion** button (View in Notion) in the dashboard for each note
- Direct links to your Notion database entries
- Notes stored in your personal Notion workspace
- Access notes from anywhere (desktop, mobile, web)
- Automatic page creation and updates
- Full Notion database functionality

### 🌓 Dark Mode Support
- Automatically adapts to your system's light/dark mode preference
- Smooth theme transitions
- Beautiful UI in both modes
- Proper contrast and readability in all themes

### ⌨️ Keyboard Shortcuts
- **Cmd+Shift+8** (Mac) / **Ctrl+Shift+8** (Windows/Linux): Toggle list item for current line

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
- **Open Website** - Visit the original webpage where you took the note
- **View in Notion** - Open the note's entry directly in your Notion database
- **Delete** - Remove the note permanently (archives it in Notion)

### Context Menu

- Highlight text on any webpage
- Right-click and select "Add selection to note" to append the text to the current note
- Text is automatically formatted and saved

### Opening Notes in Notion

- **From Side Panel**: Click the "🔗 Notion" button to open the current note in Notion
- **From Dashboard**: Click "View in Notion" on any note card to open it directly in your Notion database
- Notes are stored with their full database entry, including all properties

### Domain-Based Panel Behavior

- The side panel automatically opens for notes on enabled domains
- When you switch to a different domain, the panel automatically closes
- When you return to a domain where you've taken notes, the panel is ready to use
- This keeps your browsing experience clean and focused

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+8` (Mac)<br>`Ctrl+Shift+8` (Windows/Linux) | Toggle list item for current line |

## Data Storage

### Storage Method
- Notes are stored in **your Notion workspace** via the Notion API
- Credentials (API key and database ID) are stored in Chrome local storage
- No data is stored on any external servers - all communication is direct with Notion

### What Gets Saved
- Note content (HTML format stored in Notion blocks)
- URL (the webpage URL for the note)
- Page title (the webpage title)
- Created date (Notion's creation timestamp in ISO 8601 format)
- Modified date (Notion's last edited timestamp in ISO 8601 format)
- All stored in your personal Notion database with automatic timestamping

### Why Notion?
- Access your notes from any device (web, mobile, desktop)
- Full Notion features available (sharing, collaboration, formatting, etc.)
- Your data stays in your account - total privacy
- Better than browser storage which is limited and device-specific

## Technical Details

### Architecture
- **Manifest V3** compliant modern extension
- **Service Worker** (background.js) for domain management and API calls
- **Side Panel API** for the note editor interface
- **Notion API** (notion-service.js) for all data operations
- **Contenteditable** for rich text editing
- **Message Passing** between content scripts, side panel, and background worker

### Key Files
- **background.js** - Domain-based panel state management, Notion API routing
- **sidepanel.js** - Note editor, formatting, auto-save, load state management
- **notion-service.js** - Complete Notion API wrapper with schema detection
- **dashboard.js** - Notes listing, search, delete functionality
- **content.js** - Note existence detection for current URL

### Permissions
- `sidePanel`: Required for the side panel interface
- `storage`: Required for saving Notion credentials
- `tabs`: Required to detect current page and get page titles
- `contextMenus`: Required for context menu "Add to note" feature
- `<all_urls>`: Required to work on all websites
- `https://api.notion.com/*`: Required to communicate with Notion API

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

### Version 2.0
- ✨ **Complete Refactor** - Migrated from Chrome storage to Notion API
- 🔗 Added "View in Notion" button in side panel and dashboard
- 💾 Added smart save status indicator with 5 states (loading/saving/saved/unsaved/error)
- 📊 Enhanced dashboard with direct Notion links for each note
- 🚫 Removed import/export buttons (data now in Notion)
- ⚙️ Added dynamic Notion database property detection
- 🔄 Fixed URL display issue in dashboard
- 🎯 Added domain-smart panel auto-close behavior
- 📝 Updated all documentation with Notion setup instructions

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
