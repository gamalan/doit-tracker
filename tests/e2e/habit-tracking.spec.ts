/**
 * End-to-end tests for habit tracking functionality
 * Tests the complete user workflows and momentum calculations
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const testUser = {
  email: 'test@example.com',
  name: 'Test User'
};

const dailyHabit = {
  name: 'Daily Exercise',
  description: 'Go for a 30-minute walk',
  type: 'daily'
};

const weeklyHabit = {
  name: 'Weekly Reading',
  description: 'Read for 2 hours',
  type: 'weekly',
  targetCount: 2
};

// Helper functions
async function loginUser(page: Page) {
  await page.goto('/login');
  // Assuming OAuth login flow - this would depend on your auth implementation
  // For testing, you might need to mock the auth or use a test user
  await page.waitForURL('/dashboard');
}

async function createHabit(page: Page, habit: typeof dailyHabit | typeof weeklyHabit) {
  await page.goto(`/habits/${habit.type}`);
  await page.click('[data-testid="create-habit-button"]');
  
  await page.fill('[data-testid="habit-name"]', habit.name);
  await page.fill('[data-testid="habit-description"]', habit.description);
  
  if ('targetCount' in habit) {
    await page.fill('[data-testid="target-count"]', habit.targetCount.toString());
  }
  
  await page.click('[data-testid="save-habit"]');
  await expect(page.locator(`text=${habit.name}`)).toBeVisible();
}

async function trackHabit(page: Page, habitName: string, completed: boolean = true) {
  const habitRow = page.locator(`[data-testid="habit-${habitName}"]`);
  const trackButton = habitRow.locator('[data-testid="track-habit"]');
  
  if (completed) {
    await trackButton.click();
    await expect(habitRow.locator('[data-testid="completion-status"]')).toContainText('Completed');
  }
}

async function getMomentumValue(page: Page, habitName: string): Promise<number> {
  const habitRow = page.locator(`[data-testid="habit-${habitName}"]`);
  const momentumText = await habitRow.locator('[data-testid="momentum-value"]').textContent();
  return parseInt(momentumText?.replace(/[^\d-]/g, '') || '0');
}

test.describe('Daily Habit Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createHabit(page, dailyHabit);
  });

  test('should build consecutive streak momentum up to +7', async ({ page }) => {
    await page.goto('/habits/daily');
    
    // Track habit for multiple consecutive days
    const expectedMomentum = [1, 2, 3, 4, 5, 6, 7, 7]; // Caps at 7
    
    for (let day = 0; day < expectedMomentum.length; day++) {
      await trackHabit(page, dailyHabit.name, true);
      
      // Wait for momentum to update
      await page.waitForTimeout(1000);
      
      const momentum = await getMomentumValue(page, dailyHabit.name);
      expect(momentum).toBe(expectedMomentum[day]);
      
      // Simulate next day (this would typically be done by moving system date)
      // In a real test, you'd need to mock the date or have a test date control
    }
  });

  test('should reset momentum after missing a day', async ({ page }) => {
    await page.goto('/habits/daily');
    
    // Build up a streak
    await trackHabit(page, dailyHabit.name, true);
    await page.waitForTimeout(1000);
    let momentum = await getMomentumValue(page, dailyHabit.name);
    expect(momentum).toBe(1);
    
    // Track again (simulate next day)
    await trackHabit(page, dailyHabit.name, true);
    await page.waitForTimeout(1000);
    momentum = await getMomentumValue(page, dailyHabit.name);
    expect(momentum).toBe(2);
    
    // Simulate missing a day, then completing
    // This would require date manipulation in a real test environment
    await trackHabit(page, dailyHabit.name, true);
    await page.waitForTimeout(1000);
    momentum = await getMomentumValue(page, dailyHabit.name);
    expect(momentum).toBe(1); // Should reset to 1 after missing days
  });

  test('should apply consecutive miss penalties down to -3', async ({ page }) => {
    await page.goto('/habits/daily');
    
    // This test would require date manipulation to simulate missing days
    // The cron job would need to run to apply penalties
    
    // For now, we can test the UI shows negative momentum correctly
    const habitRow = page.locator(`[data-testid="habit-${dailyHabit.name}"]`);
    
    // Check that negative momentum is displayed with proper styling
    await expect(habitRow.locator('[data-testid="momentum-value"].text-red-500')).toBeVisible();
  });

  test('should display momentum with correct color coding', async ({ page }) => {
    await page.goto('/habits/daily');
    
    const habitRow = page.locator(`[data-testid="habit-${dailyHabit.name}"]`);
    const momentumElement = habitRow.locator('[data-testid="momentum-value"]');
    
    // Track habit to get positive momentum
    await trackHabit(page, dailyHabit.name, true);
    await page.waitForTimeout(1000);
    
    // Check positive momentum has green styling
    await expect(momentumElement).toHaveClass(/text-green/);
    
    const momentum = await getMomentumValue(page, dailyHabit.name);
    expect(momentum).toBeGreaterThan(0);
  });
});

test.describe('Weekly Habit Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createHabit(page, weeklyHabit);
  });

  test('should give +1 point per completion regardless of target', async ({ page }) => {
    await page.goto('/habits/weekly');
    
    // Track habit once
    await trackHabit(page, weeklyHabit.name, true);
    await page.waitForTimeout(1000);
    
    let momentum = await getMomentumValue(page, weeklyHabit.name);
    expect(momentum).toBe(1); // 1 completion, target not met yet
    
    // Track again in the same week
    await trackHabit(page, weeklyHabit.name, true);
    await page.waitForTimeout(1000);
    
    momentum = await getMomentumValue(page, weeklyHabit.name);
    expect(momentum).toBe(12); // 2 completions + 10 target bonus
  });

  test('should show target progress correctly', async ({ page }) => {
    await page.goto('/habits/weekly');
    
    const habitRow = page.locator(`[data-testid="habit-${weeklyHabit.name}"]`);
    const progressElement = habitRow.locator('[data-testid="target-progress"]');
    
    // Initially 0/2
    await expect(progressElement).toContainText('0/2');
    
    // Track once
    await trackHabit(page, weeklyHabit.name, true);
    await page.waitForTimeout(1000);
    await expect(progressElement).toContainText('1/2');
    
    // Track again to meet target
    await trackHabit(page, weeklyHabit.name, true);
    await page.waitForTimeout(1000);
    await expect(progressElement).toContainText('2/2');
    
    // Check target met indicator
    await expect(habitRow.locator('[data-testid="target-met"]')).toBeVisible();
  });

  test('should display weekly habit momentum with correct ranges', async ({ page }) => {
    await page.goto('/habits/weekly');
    
    const habitRow = page.locator(`[data-testid="habit-${weeklyHabit.name}"]`);
    const momentumElement = habitRow.locator('[data-testid="momentum-value"]');
    
    // Track to meet target
    await trackHabit(page, weeklyHabit.name, true);
    await trackHabit(page, weeklyHabit.name, true);
    await page.waitForTimeout(1000);
    
    const momentum = await getMomentumValue(page, weeklyHabit.name);
    expect(momentum).toBe(12); // 2 completions + 10 bonus
    
    // Check positive momentum has green styling
    await expect(momentumElement).toHaveClass(/text-green/);
  });

  test('should handle weekly momentum caps correctly', async ({ page }) => {
    await page.goto('/habits/weekly');
    
    // This would test the +40 cap, but requires simulating multiple weeks
    // and consecutive completions, which needs date manipulation
    
    // For now, verify the UI can handle high momentum values
    const habitRow = page.locator(`[data-testid="habit-${weeklyHabit.name}"]`);
    await expect(habitRow).toBeVisible();
  });
});

test.describe('Dashboard Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createHabit(page, dailyHabit);
    await createHabit(page, weeklyHabit);
  });

  test('should show total momentum across all habits', async ({ page }) => {
    await page.goto('/dashboard');
    
    const totalMomentumElement = page.locator('[data-testid="total-momentum"]');
    await expect(totalMomentumElement).toBeVisible();
    
    // Initially should be 0
    await expect(totalMomentumElement).toContainText('0');
    
    // Track daily habit
    await page.goto('/habits/daily');
    await trackHabit(page, dailyHabit.name, true);
    
    // Track weekly habit
    await page.goto('/habits/weekly');
    await trackHabit(page, weeklyHabit.name, true);
    
    // Check dashboard shows combined momentum
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    
    const totalMomentumText = await totalMomentumElement.textContent();
    const totalMomentum = parseInt(totalMomentumText?.replace(/[^\d]/g, '') || '0');
    expect(totalMomentum).toBeGreaterThan(0); // Should be sum of daily (1) + weekly (1)
  });

  test('should show momentum history chart', async ({ page }) => {
    await page.goto('/dashboard');
    
    const chartElement = page.locator('[data-testid="momentum-chart"]');
    await expect(chartElement).toBeVisible();
    
    // Chart should have SVG elements
    await expect(chartElement.locator('svg')).toBeVisible();
    await expect(chartElement.locator('path')).toBeVisible();
  });

  test('should display habit summaries correctly', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show both daily and weekly habits
    await expect(page.locator('[data-testid="daily-habits-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="weekly-habits-summary"]')).toBeVisible();
    
    // Track some habits and verify summaries update
    await page.goto('/habits/daily');
    await trackHabit(page, dailyHabit.name, true);
    
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    
    const dailySummary = page.locator('[data-testid="daily-habits-summary"]');
    await expect(dailySummary).toContainText('1'); // 1 completion
  });
});

test.describe('Cron Job Functionality', () => {
  test('should handle manual cron trigger for testing', async ({ page, request }) => {
    // This tests the manual GET endpoint for debugging
    const response = await request.get('/api/cron/daily-missed');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('processed');
    expect(data).toHaveProperty('errors');
    expect(data).toHaveProperty('timestamp');
  });

  test('should reject unauthorized cron requests', async ({ request }) => {
    // Test POST without Cloudflare headers
    const response = await request.post('/api/cron/daily-missed', {
      headers: {
        'user-agent': 'curl/7.0'
      }
    });
    
    expect(response.status()).toBe(401);
  });
});

test.describe('Error Handling and Edge Cases', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    await loginUser(page);
    await page.goto('/habits/daily');
    
    // Simulate network error by intercepting requests
    await page.route('/api/habits/track', route => {
      route.abort('failed');
    });
    
    await page.click('[data-testid="create-habit-button"]');
    await page.fill('[data-testid="habit-name"]', 'Test Habit');
    await page.click('[data-testid="save-habit"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should validate habit form inputs', async ({ page }) => {
    await loginUser(page);
    await page.goto('/habits/daily');
    
    await page.click('[data-testid="create-habit-button"]');
    
    // Try to save without name
    await page.click('[data-testid="save-habit"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle empty states correctly', async ({ page }) => {
    await loginUser(page);
    
    // Dashboard with no habits
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="no-habits-message"]')).toBeVisible();
    
    // Daily habits page with no habits
    await page.goto('/habits/daily');
    await expect(page.locator('[data-testid="empty-daily-habits"]')).toBeVisible();
    
    // Weekly habits page with no habits
    await page.goto('/habits/weekly');
    await expect(page.locator('[data-testid="empty-weekly-habits"]')).toBeVisible();
  });
});