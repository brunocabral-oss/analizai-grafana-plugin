import { test, expect } from './fixtures';
import { ROUTES } from '../src/constants';

test.describe('navigating app', () => {
  test('page one should render AnalizAI copilot successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.One}`);
    await expect(page.getByText(/AnalizAI/i).first()).toBeVisible();
  });

  test('page two should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Two}`);
    await expect(page.getByText('This is page two.')).toBeVisible();
  });

  test('page three should support an id parameter', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Three}/123456`);
    await expect(page.getByText('ID: 123456')).toBeVisible();
  });

  test('page four should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Four}`);
    await expect(page.getByRole('link', { name: 'Back', exact: true })).toBeVisible();
  });
});
