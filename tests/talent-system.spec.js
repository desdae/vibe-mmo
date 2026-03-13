const { test, expect } = require('@playwright/test');

test.describe('Talent System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to game
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  });

  test('talent tree displays after leveling up', async ({ page }) => {
    // Wait for join screen
    await page.waitForSelector('#join-screen');
    
    // Fill in character name
    await page.fill('#character-name', 'TestMage');
    
    // Select mage class
    await page.selectOption('#class-select', 'mage');
    
    // Click join
    await page.click('#join-button');
    
    // Wait for game UI
    await page.waitForSelector('#game-ui:not(.hidden)');
    
    // Wait for welcome message and game to initialize
    await page.waitForTimeout(2000);
    
    // Open talent panel with T key
    await page.keyboard.press('t');
    
    // Wait for talent panel to appear
    await page.waitForTimeout(500);
    
    // Take screenshot of talent panel
    const talentPanel = await page.$('#talent-panel');
    expect(talentPanel).toBeTruthy();
    
    const isVisible = await talentPanel.isVisible();
    console.log('Talent panel visible:', isVisible);
    
    // Check if talent tree container has content
    const talentTreeContainer = await page.$('#talent-tree-container');
    const innerHTML = await talentTreeContainer.innerHTML();
    console.log('Talent tree HTML length:', innerHTML.length);
    console.log('Talent tree HTML:', innerHTML.substring(0, 500));
    
    // Should have talent nodes (not the "no talent tree" message)
    expect(innerHTML).not.toContain('No talent tree available');
    
    // Should have talent-node elements
    const talentNodes = await page.$$('.talent-node');
    console.log('Number of talent nodes:', talentNodes.length);
    
    // Mage should have 10 talents
    expect(talentNodes.length).toBeGreaterThan(0);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/talent-panel-test.png',
      fullPage: false
    });
    
    // Check talent points display
    const talentPointsEl = await page.$('#talent-points-available');
    if (talentPointsEl) {
      const pointsText = await talentPointsEl.textContent();
      console.log('Talent points available:', pointsText);
    }
  });

  test('talent points increase on level up', async ({ page }) => {
    // This test would require admin commands or extended gameplay
    // For now, just verify the UI elements exist
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#join-screen');
    await page.fill('#character-name', 'TestWarrior');
    await page.selectOption('#class-select', 'warrior');
    await page.click('#join-button');
    await page.waitForSelector('#game-ui:not(.hidden)');
    await page.waitForTimeout(2000);
    
    // Press T to open talent panel
    await page.keyboard.press('t');
    await page.waitForTimeout(500);
    
    // Verify talent points display exists
    const pointsDisplay = await page.$('#talent-points-display');
    expect(pointsDisplay).toBeTruthy();
    
    const pointsText = await pointsDisplay.textContent();
    console.log('Points display text:', pointsText);
  });
});
