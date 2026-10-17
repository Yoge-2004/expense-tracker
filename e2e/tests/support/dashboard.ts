import { expect, type Page } from '@playwright/test';

/** Opens the account menu the way a user does: by clicking the avatar. */
export async function openProfileMenu(page: Page): Promise<void> {
  await page.locator('#profileTrigger').click();
  await expect(page.locator('#profileTrigger')).toHaveAttribute('aria-expanded', 'true');
}

/** Opens the Record Expense dialog from the top bar. */
export async function openExpenseModal(page: Page): Promise<void> {
  await page.locator('#openModalBtn').click();
  await expect(page.locator('#expenseModal')).toHaveClass(/active/);
}
