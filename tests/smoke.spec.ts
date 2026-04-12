import { test, expect } from '@playwright/test';

test('loads dashboard', async ({ page }) => {
  await page.goto('/ascend/');
  await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Strength Progress').first()).toBeVisible();
});

test('workouts flow: create workout + add exercise', async ({ page }) => {
  await page.goto('/ascend/');

  // Start clean so the test is deterministic.
  await page.evaluate(() => {
    try {
      localStorage.removeItem('ascend.v1');
    } catch {}
  });
  await page.reload();

  // Bottom nav -> Workouts
  await page.getByRole('button', { name: 'Workouts' }).click();
  await expect(page.getByText('Workout History').first()).toBeVisible();

  // Create
  await page.getByRole('button', { name: '+ New' }).waitFor();
  await page.getByRole('button', { name: '+ New' }).click();
  await expect(page.getByText('New Workout')).toBeVisible();
  await page.getByPlaceholder('Push / Pull / Legs / Core').fill('QA Test Workout');
  await page.getByRole('button', { name: 'Create' }).click();

  // Open created workout
  await expect(page.getByText('QA Test Workout')).toBeVisible();
  await page.getByText('QA Test Workout').click();

  // Add exercise
  await page.getByRole('button', { name: 'Add Exercise' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await page.getByPlaceholder('Incline Dumbbell Press').fill('Lat Pulldown');

  // Save
  await page.getByRole('button', { name: 'Save' }).click();

  // Assert entry
  await expect(page.getByText('Lat Pulldown')).toBeVisible();
});
