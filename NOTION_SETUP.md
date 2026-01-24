# URL Context Notes - Notion Integration Setup

This extension uses **Notion API** to store your notes. This allows you to access your notes from anywhere, on any device!

## Quick Setup (3 Steps)

### Step 1: Create a Notion Integration

1. Go to [Notion My Integrations](https://www.notion.so/my-integrations)
2. Click "Create new integration"
3. Name it "URL Context Notes" (or whatever you prefer)
4. Click "Submit"
5. Copy your **Internal Integration Token** (starts with `secret_`)
   - **Keep this safe!** This is your API key

### Step 2: Create a Notion Database

You can use an existing database or create a new one. The extension will automatically detect your database properties and work with whatever you have.

**Minimum required:**
- At least one property for the URL (name doesn't matter - can be "URL", "url", "Link", etc.)

**Recommended properties:**
- `Name` or `Title` - The page title (auto-detected as title type)
- `URL` or similar - The webpage URL
- Additional properties like `Tags`, `Category`, `Date` are all supported

The extension automatically detects all properties in your database and uses the ones it needs.

### Step 3: Connect Your Integration to the Database

1. Open your Notion database
2. Click the "..." menu in the top-right corner
3. Scroll down and select "Connections"
4. Click "Add connections" or "Add a connection"
5. Search for and select your integration
6. Click to connect

### Step 4: Get Your Database ID

1. Open your Notion database in your browser
2. Look at the URL in your address bar:
   ```
   https://www.notion.so/[WORKSPACE]/[DATABASE_ID]?v=[VIEW_ID]
   ```
3. The **DATABASE_ID** is the long alphanumeric string between the workspace and `?`
4. Copy just the ID part (it's typically 32 characters, may include hyphens)
   - Example: `1234567890abcdef1234567890abcdef`

### Step 5: Configure the Extension

1. Click the extension icon in your Chrome toolbar
2. Click the **"Setup Notion Integration"** button
3. Enter your credentials:
   - **Notion API Key:** Paste your integration token (the `secret_...` string)
   - **Database ID:** Paste your database ID
4. Click **"Verify & Setup"**
5. ✅ You're done! The extension will verify your credentials and you're ready to go

## How It Works

### When You Visit a Website
- The extension checks if you have an existing note for that URL in your Notion database
- If you do, it loads the content automatically

### Taking Notes
1. Click the extension icon to open the side panel
2. Start typing - your note is automatically saved (with a 500ms debounce)
3. Use the formatting buttons for bold, italic, underline, lists, etc.
4. The save status indicator shows:
   - ⏳ Loading - Content is being fetched from Notion
   - 💾 Saving - Your changes are being saved
   - ✅ Saved - Everything is up to date
   - ⭕ Unsaved - You have changes that haven't been saved yet
   - ❌ Error - Something went wrong (check the error message)

### Opening Notes in Notion
- **From Side Panel:** Click the "🔗 Notion" button to open the note directly in Notion
- **From Dashboard:** Click "📊" icon then "View in Notion" on any note card

### Adding to Notes from Web Pages
1. Select text on any webpage
2. Right-click and choose "Add selection to note"
3. The text is automatically appended to your note and saved

### Viewing All Notes
1. Click the "📊" chart icon in the side panel toolbar
2. You'll see all your notes organized in a nice card layout
3. Search notes by title, URL, or content
4. Click "Open Website" to visit the webpage
5. Click "View in Notion" to open the note in Notion
6. Click "Delete" to remove a note

## FAQ

### Q: What properties should I use?
**A:** The extension automatically detects all properties in your database. You can use any property names you want - just make sure you have:
- At least one property for the URL (the extension looks for lowercase property names by default)
- Optionally a title/name property for the page title

### Q: Can I use an existing database?
**A:** Yes! The extension is flexible and works with any Notion database. It will auto-detect your properties and use the appropriate ones.

### Q: Are my notes private?
**A:** Completely! Your notes are stored in your personal Notion workspace. The extension only communicates with Notion using your credentials - nothing goes to any other server.

### Q: Can I access notes from my phone?
**A:** Yes! Open Notion on your phone and access your database directly. You can also view and edit notes through Notion's web interface on any device.

### Q: What if I delete the extension?
**A:** Your notes stay in Notion! When you reinstall the extension and set it up again, all your notes are still there.

### Q: Can I share notes with others?
**A:** Yes! Share your Notion database using Notion's built-in sharing features. Anyone with access to the database can see and edit the notes.

## Troubleshooting

### "API Key verification failed"
- ✓ Check that your token starts with `secret_`
- ✓ Make sure you copied the entire token
- ✓ Verify you're using the correct integration (check in My Integrations)
- ✓ Make sure the integration is connected to your database

### "Database not found" or "Failed to query database"
- ✓ Verify your Database ID is correct (32 characters)
- ✓ Check that your integration is connected to the database
- ✓ Go to your database and click "..." → "Connections" to verify

### "Notes not appearing in dashboard"
- ✓ Check your browser's Developer Console (F12) for error messages
- ✓ Make sure your integration has access to the database
- ✓ Refresh the page and try again
- ✓ Verify you have at least one note saved

### "Property not found" or property errors
- ✓ The extension auto-detects properties - it should work with any database structure
- ✓ If you see property errors, check your Notion database properties are set correctly
- ✓ Try creating a simple database with just Name and URL properties

### "Cannot save note"
- ✓ Check your internet connection
- ✓ Verify your Notion integration token is still valid
- ✓ Check the browser console (F12) for detailed error messages
- ✓ Verify your integration still has permission to edit the database

### Notes saved but not appearing in Notion
- ✓ Refresh your Notion database view
- ✓ Check that your integration is connected to the database
- ✓ Verify you're looking at the correct database

## Advanced Features

### Dynamic Property Detection
The extension automatically:
- Detects all properties in your Notion database
- Finds the title property (by type)
- Finds the URL property (by name matching)
- Adapts to any database structure

### Auto-Save
- Notes automatically save after 500ms of no typing
- Real-time status indicator shows save progress
- All changes are synced to Notion

### Domain-Smart Panel
- The side panel automatically closes when you switch to a different domain
- Keeps your browsing experience clean and focused
- Opens again when you return to a domain where you take notes

## Privacy & Security

- All communication with Notion uses HTTPS
- Your API key is stored only in your browser's local storage
- Nothing is logged or sent to any third party
- Your notes are completely private to your Notion account

## Support

If you need help:
1. Check the troubleshooting section above
2. Check the browser console (F12) for error messages - copy the full error
3. Verify your Notion integration setup matches the steps above
4. Try creating a simple test database with just Name and URL properties
