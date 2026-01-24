document.getElementById('notion-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiKey = document.getElementById('api-key').value.trim();
  const databaseId = document.getElementById('database-id').value.trim().replace(/-/g, '');
  const statusEl = document.getElementById('status');

  // Validate inputs
  if (!apiKey) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Error: Please enter your API key';
    return;
  }

  if (!databaseId) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Error: Please enter your database ID';
    return;
  }

  try {
    statusEl.className = 'status loading';
    statusEl.textContent = 'Verifying credentials...';
    console.log('Starting verification...');

    // Verify and set credentials
    const isValid = await notionService.verifyApiKey(apiKey);
    console.log('Verification result:', isValid);
    
    if (!isValid) {
      throw new Error('Invalid API key. Please check your credentials.');
    }

    console.log('Setting credentials...');
    // Set credentials
    await notionService.setCredentials(apiKey, databaseId);

    statusEl.className = 'status success';
    statusEl.textContent = '✓ Setup successful! Your extension is now connected to Notion.';
    console.log('Setup complete, closing window in 2 seconds');

    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = `❌ Error: ${error.message}`;
    console.error('Setup error:', error);
    // Clear the input fields on error so user can try again
    document.getElementById('api-key').value = '';
    document.getElementById('database-id').value = '';
  }
});
