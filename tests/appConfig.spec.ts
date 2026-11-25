import { test, expect } from './fixtures';

test('should be possible to save app configuration', async ({ appConfigPage, page }) => {
  const saveButton = page.getByRole('button', { name: /Salvar Configurações do AnalizAI/i });

  const apiUrlInput = page.locator('#config-api-url');
  await apiUrlInput.clear();
  await apiUrlInput.fill('http://localhost:11434');

  const modelInput = page.locator('#config-model-name');
  await modelInput.clear();
  await modelInput.fill('llama3:8b');

  // listen for the server response on the saved form
  const saveResponse = appConfigPage.waitForSettingsResponse();

  await saveButton.click();
  await expect(saveResponse).toBeOK();
});
