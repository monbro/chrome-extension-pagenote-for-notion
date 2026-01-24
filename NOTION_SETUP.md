# URL Context Notes - Notion Integration Setup

This extension now uses Notion API to store your notes instead of browser local storage. This allows you to access your notes from anywhere!

## Setup Instructions

### Step 1: Create a Notion Integration

1. Go to [Notion My Integrations](https://www.notion.so/my-integrations)
2. Click "Create new integration"
3. Name it something like "URL Context Notes"
4. Click "Submit"
5. Copy your **Internal Integration Token** (starts with `secret_`)

### Step 2: Create a Notion Database

1. In Notion, create a new database (or use an existing one)
2. Make sure it has the following properties:
   - **Name** (Title) - automatically created
   - **URL** (URL property) - the URL the note is for
   - **Page Title** (Text) - the page title

**Quick setup:**
Create a simple database with these fields:
- `Name` (default Title field)
- `URL` (URL field)
- `Page Title` (Text field)

### Step 3: Connect Your Integration to the Database

1. Open your Notion database
2. Click the "..." menu in the top-right corner
3. Select "+ Add Connections"
4. Find your integration and click it to connect

### Step 4: Get Your Database ID

1. Open your Notion database
2. Look at the URL: `https://www.notion.so/[WORKSPACE_ID]/[DATABASE_ID]?v=[VIEW_ID]`
3. The **DATABASE_ID** is the long string between `/` and `?` (or at the end if there's no `?`)
   - It looks like: `1234567890abcdef1234567890abcdef`

### Step 5: Configure the Extension

1. Click the extension icon in Chrome
2. You'll see a "Setup Notion Integration" button
3. Paste your credentials:
   - **Notion API Key:** Your integration token (starts with `secret_`)
   - **Database ID:** The ID from your database URL
4. Click "Verify & Setup"
5. Done! You're ready to use the extension

## How It Works

- **When you visit a website:** A notification appears if you have an existing note for that URL
- **Click the extension icon:** Opens the side panel where you can write/edit notes
- **Notes are saved automatically** as you type (debounced every 500ms)
- **Select text on any page:** Right-click and choose "Add selection to note" to append text to your note
- **Dashboard:** Access all your notes by clicking the dashboard button in the side panel

## Features

✨ **Modern UI** with beautiful gradient colors and smooth animations
📝 **Rich text editing** with formatting tools (bold, italic, underline, lists)
🌙 **Dark mode support** - automatically uses your system preferences
⚡ **Auto-save** - notes are saved in real-time
🔍 **Searchable** - find notes by title, URL, or content
☁️ **Cloud synced** - all notes stored in your Notion workspace

## Troubleshooting

### "API Key verification failed"
- Double-check your integration token starts with `secret_`
- Make sure you're using the correct token from the right integration

### "Invalid Database ID"
- The database ID should be 32 characters (excluding hyphens)
- It's the string between `/` and `?` in your database URL

### Notes not appearing
- Make sure your integration is connected to the database
- Check that your database has the required properties (Name, URL, Page Title)

### Content not syncing
- Check your browser console (F12) for any error messages
- Make sure your Notion integration has edit permissions

## Privacy

Your notes are stored in your personal Notion workspace. The extension only communicates with the Notion API using your credentials - no data is sent elsewhere.

## Support

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Verify your Notion integration is properly connected
3. Try refreshing the page and trying again
