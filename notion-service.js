/**
 * Notion API Service
 * Handles all interactions with Notion API for storing/retrieving notes
 */

class NotionService {
  constructor() {
    this.apiKey = null;
    this.databaseId = null;
    this.notionApiUrl = 'https://api.notion.com/v1';
    this.databaseSchema = null; // Cache database properties
    this.init();
  }

  async init() {
    // Load saved credentials from Chrome storage
    const data = await chrome.storage.local.get(['notionApiKey', 'notionDatabaseId']);
    this.apiKey = data.notionApiKey;
    this.databaseId = data.notionDatabaseId;
  }

  /**
   * Check if user is authenticated with Notion
   */
  isAuthenticated() {
    return !!this.apiKey && !!this.databaseId;
  }

  /**
   * Get a page by ID with all properties
   */
  async getPageById(pageId) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      const response = await fetch(`${this.notionApiUrl}/pages/${pageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get page: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting page by ID:', error);
      throw error;
    }
  }

  /**
   * Get database schema (property names and types)
   */
  async getDatabaseSchema() {
    if (this.databaseSchema) {
      return this.databaseSchema;
    }

    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      const response = await fetch(`${this.notionApiUrl}/databases/${this.databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get database schema: ${response.statusText}`);
      }

      const data = await response.json();
      this.databaseSchema = data.properties;
      
      console.log('Database schema properties:', Object.keys(this.databaseSchema));
      
      return this.databaseSchema;
    } catch (error) {
      console.error('Error getting database schema:', error);
      throw error;
    }
  }

  /**
   * Verify that the API key is valid
   */
  async verifyApiKey(apiKey) {
    try {
      const response = await fetch(`${this.notionApiUrl}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        throw new Error(`API Key verification failed: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error verifying API key:', error);
      return false;
    }
  }

  /**
   * Set API key and database ID
   */
  async setCredentials(apiKey, databaseId) {
    try {
      // Verify the API key first
      const isValid = await this.verifyApiKey(apiKey);
      if (!isValid) {
        throw new Error('Invalid API key');
      }

      // Save to Chrome storage
      await chrome.storage.local.set({
        notionApiKey: apiKey,
        notionDatabaseId: databaseId
      });

      this.apiKey = apiKey;
      this.databaseId = databaseId;

      return true;
    } catch (error) {
      console.error('Error setting credentials:', error);
      throw error;
    }
  }

  /**
   * Get note for a given URL
   * Fetches all notes and filters by URL (fallback approach)
   */
  async getNoteByUrl(url) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      // Fetch all notes and filter client-side
      const response = await fetch(`${this.notionApiUrl}/databases/${this.databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_size: 100
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Notion API Error Response:', response.status, errorData);
        throw new Error(`Failed to query database: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter results by URL
      const matchingPages = data.results.filter(page => {
        const pageUrl = this._getPageUrl(page);
        return pageUrl === url;
      });

      if (matchingPages.length === 0) {
        return null;
      }

      return this.parsePageToNote(matchingPages[0]);
    } catch (error) {
      console.error('Error getting note from Notion:', error);
      throw error;
    }
  }

  /**
   * Extract URL from page properties (handles different property types)
   */
  _getPageUrl(page) {
    const properties = page.properties;
    
    // Try different property names and types
    if (properties.URL) {
      // Try as URL type
      if (properties.URL.url) {
        return properties.URL.url;
      }
      // Try as rich_text type
      if (properties.URL.rich_text && properties.URL.rich_text.length > 0) {
        return properties.URL.rich_text.map(t => t.text.content).join('');
      }
    }
    
    return '';
  }

  /**
   * Create a new note in Notion
   */
  async createNote(url, content, pageTitle = '') {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      // Get database schema to know what properties exist
      const schema = await this.getDatabaseSchema();
      console.log('Available properties:', Object.keys(schema));

      // Build properties object with only existing properties
      const properties = {};

      // Always add Name (Title) - this is usually the default
      if (schema.Name || schema.Title) {
        const nameKey = Object.keys(schema).find(key => schema[key].type === 'title');
        if (nameKey) {
          properties[nameKey] = {
            title: [
              {
                text: {
                  content: pageTitle || url
                }
              }
            ]
          };
        }
      }

      // Add URL if it exists
      if (schema.URL) {
        properties['URL'] = {
          rich_text: [
            {
              text: {
                content: url
              }
            }
          ]
        };
      }

      // Add Page Title if it exists
      if (schema['Page Title']) {
        properties['Page Title'] = {
          rich_text: [
            {
              text: {
                content: pageTitle
              }
            }
          ]
        };
      }

      // Add Created date if it exists
      if (schema['Created']) {
        const now = new Date().toISOString();
        properties['Created'] = {
          date: {
            start: now
          }
        };
      }

      // Add Modified date if it exists
      if (schema['Modified']) {
        const now = new Date().toISOString();
        properties['Modified'] = {
          date: {
            start: now
          }
        };
      }

      const payload = {
        parent: {
          database_id: this.databaseId
        },
        properties: properties,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: content || ''
                  }
                }
              ]
            }
          }
        ]
      };

      console.log('Creating page with payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.notionApiUrl}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Notion API Error:', errorData);
        throw new Error(`Failed to create page: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('Page created with ID:', data.id);
      
      // Fetch the full page to ensure we have all fields including timestamps
      const fullPage = await this.getPageById(data.id);
      return this.parsePageToNote(fullPage);
    } catch (error) {
      console.error('Error creating note in Notion:', error);
      throw error;
    }
  }

  /**
   * Update note content in Notion
   */
  async updateNote(pageId, content) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      // Get existing blocks
      const blocksResponse = await fetch(`${this.notionApiUrl}/blocks/${pageId}/children`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!blocksResponse.ok) {
        const errorData = await blocksResponse.text();
        console.error('Failed to get blocks:', errorData);
        throw new Error(`Failed to get blocks: ${blocksResponse.statusText}`);
      }

      const blocksData = await blocksResponse.json();
      
      // Update or create the first block with the content
      if (blocksData.results.length > 0) {
        const firstBlockId = blocksData.results[0].id;
        
        const updateResponse = await fetch(`${this.notionApiUrl}/blocks/${firstBlockId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: content || ''
                  }
                }
              ]
            }
          })
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error('Failed to update block:', errorData);
          throw new Error(`Failed to update block: ${updateResponse.statusText}`);
        }
      } else {
        // No blocks exist, create one
        const createBlockResponse = await fetch(`${this.notionApiUrl}/blocks/${pageId}/children`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      text: {
                        content: content || ''
                      }
                    }
                  ]
                }
              }
            ]
          })
        });

        if (!createBlockResponse.ok) {
          throw new Error(`Failed to create block: ${createBlockResponse.statusText}`);
        }
      }

      // Update Modified date property if it exists in schema
      try {
        const schema = await this.getDatabaseSchema();
        if (schema['Modified']) {
          const now = new Date().toISOString();
          const updateResponse = await fetch(`${this.notionApiUrl}/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: {
                'Modified': {
                  date: {
                    start: now
                  }
                }
              }
            })
          });

          if (!updateResponse.ok) {
            console.warn('Failed to update Modified date:', updateResponse.statusText);
            // Don't throw - content was updated, just the date failed
          } else {
            console.log('Updated Modified date for page:', pageId);
          }
        }
      } catch (error) {
        console.warn('Error updating Modified date:', error);
        // Don't throw - content was updated successfully
      }

      // Fetch the full page to get updated timestamps
      const fullPage = await this.getPageById(pageId);
      return this.parsePageToNote(fullPage);
    } catch (error) {
      console.error('Error updating note in Notion:', error);
      throw error;
    }
  }

  /**
   * Save or update note (creates if doesn't exist, updates if exists)
   */
  async saveNote(url, content, pageTitle = '') {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      let note = await this.getNoteByUrl(url);
      
      if (note) {
        // Update existing note and return the updated note with fresh timestamps
        const updatedNote = await this.updateNote(note.id, content);
        return updatedNote;
      } else {
        // Create new note
        return await this.createNote(url, content, pageTitle);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }

  /**
   * Delete note from Notion
   */
  async deleteNote(pageId) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      const response = await fetch(`${this.notionApiUrl}/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          archived: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete page: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Get all notes from Notion database
   */
  async getAllNotes() {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      const response = await fetch(`${this.notionApiUrl}/databases/${this.databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_size: 100
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to query database: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results.map(page => this.parsePageToNote(page));
    } catch (error) {
      console.error('Error getting all notes from Notion:', error);
      throw error;
    }
  }

  /**
   * Parse a Notion page into a note object
   */
  parsePageToNote(page) {
    const properties = page.properties;
    
    // Dynamically find URL property (try common names)
    let url = '';
    const urlProperty = Object.entries(properties).find(([key, prop]) => {
      if (key.toLowerCase() === 'url') {
        return prop.url || (prop.rich_text && prop.rich_text.length > 0);
      }
      return false;
    });
    
    if (urlProperty) {
      const [, prop] = urlProperty;
      url = prop.url || (prop.rich_text?.[0]?.text?.content || '');
    }
    
    // Dynamically find title property (look for title type or common names)
    let pageTitle = '';
    const titleProperty = Object.entries(properties).find(([key, prop]) => {
      return prop.type === 'title';
    });
    
    if (titleProperty) {
      const [, prop] = titleProperty;
      pageTitle = prop.title?.[0]?.text?.content || '';
    }
    
    // Fallback: try to get from rich_text properties
    if (!pageTitle) {
      const richTextProperty = Object.entries(properties).find(([key, prop]) => {
        return key.toLowerCase() === 'title' || key.toLowerCase() === 'name' || key.toLowerCase() === 'page title';
      });
      if (richTextProperty) {
        const [, prop] = richTextProperty;
        pageTitle = prop.title?.[0]?.text?.content || prop.rich_text?.[0]?.text?.content || '';
      }
    }
    
    // If still no title, use URL as fallback
    if (!pageTitle) {
      pageTitle = url;
    }
    
    // Extract Notion date fields (ISO 8601 format)
    const created = page.created_time || null;
    const modified = page.last_edited_time || null;
    
    // Content will be fetched separately when needed
    return {
      id: page.id,
      url: url,
      title: pageTitle,
      content: '', // Will be populated when fetching full content
      created: created, // ISO 8601 timestamp
      modified: modified // ISO 8601 timestamp
    };
  }

  /**
   * Get content blocks for a page
   */
  async getPageContent(pageId) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Notion');
    }

    try {
      const response = await fetch(`${this.notionApiUrl}/blocks/${pageId}/children`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get page content: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract text content from blocks
      let content = '';
      for (const block of data.results) {
        if (block.type === 'paragraph' && block.paragraph) {
          const text = block.paragraph.rich_text.map(t => t.text.content).join('');
          if (text) {
            content += text;
          }
        }
      }

      return content;
    } catch (error) {
      console.error('Error getting page content:', error);
      throw error;
    }
  }

  /**
   * Cache helpers for local storage
   */

  /**
   * Get cached note for a URL
   */
  async getCachedNote(url) {
    try {
      const cacheKey = `note_cache:${url}`;
      const data = await chrome.storage.local.get(cacheKey);
      const cached = data[cacheKey];
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.debug('Error getting cached note:', error);
      return null;
    }
  }

  /**
   * Cache a note to local storage - won't overwrite if existing cache is newer
   */
  async cacheNote(url, noteData) {
    try {
      const cacheKey = `note_cache:${url}`;
      
      // Add timestamp if not provided
      if (!noteData.lastSaved) {
        noteData.lastSaved = Date.now();
      }
      
      // Check if we already have a cached version
      const data = await chrome.storage.local.get(cacheKey);
      const existing = data[cacheKey] ? JSON.parse(data[cacheKey]) : null;
      
      // Only overwrite if new data is newer or if there's no existing cache
      if (!existing || !existing.lastSaved || noteData.lastSaved >= existing.lastSaved) {
        await chrome.storage.local.set({
          [cacheKey]: JSON.stringify(noteData)
        });
        console.log('Cached note:', url, 'timestamp:', noteData.lastSaved);
      } else {
        console.log('Skipped overwriting newer cache for:', url, 
          'existing:', existing.lastSaved, 'new:', noteData.lastSaved);
      }
    } catch (error) {
      console.debug('Error caching note:', error);
    }
  }

  /**
   * Get all cached notes
   */
  async getAllCachedNotes() {
    try {
      const data = await chrome.storage.local.get(null);
      const cachedNotes = [];
      
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('note_cache:')) {
          try {
            cachedNotes.push(JSON.parse(value));
          } catch (e) {
            console.debug('Error parsing cached note:', e);
          }
        }
      }
      
      return cachedNotes;
    } catch (error) {
      console.debug('Error getting cached notes:', error);
      return [];
    }
  }

  /**
   * Clear cache for a specific URL
   */
  async clearNoteCache(url) {
    try {
      const cacheKey = `note_cache:${url}`;
      await chrome.storage.local.remove(cacheKey);
    } catch (error) {
      console.debug('Error clearing cache:', error);
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches() {
    try {
      const data = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(data).filter(key => key.startsWith('note_cache:'));
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (error) {
      console.debug('Error clearing all caches:', error);
    }
  }
}

// Create a global instance
const notionService = new NotionService();
