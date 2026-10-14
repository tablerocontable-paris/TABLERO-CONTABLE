async function selectProfile(page, selectLabel, fieldLabel, profileId) {
  const trigger = page.getByRole("button", { name: selectLabel, exact: true });
  const picker = trigger.locator('xpath=ancestor::div[contains(@class,"employee-picker")][1]');
  await trigger.click();
  const search = picker.getByRole("combobox", { name: `Buscar persona en ${fieldLabel}` });
  await search.fill("");
  await picker.locator(`[role="option"][data-profile-id="${profileId}"]`).click();
}

module.exports = { selectProfile };
