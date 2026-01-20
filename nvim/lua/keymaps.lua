-- GENERAL NON PLUGIN SPECIFIC KEYMAPS

local function toggle_quickfix()
  local windows = vim.fn.getwininfo()
  for _, win in pairs(windows) do
    if win["quickfix"] == 1 then
      vim.cmd.cclose()
      return
    end
  end
  -- Open at the bottom, or use 'botright copen'
  vim.cmd.copen()
end


vim.keymap.set({ "n", "x" }, "<Leader>q", toggle_quickfix, { desc = "Toggle quickfix list" })
vim.keymap.set({ "n", "x" }, "<Leader>w", ":update<CR>", { desc = "Save buffer" })
vim.keymap.set({ "n", "x" }, "<Leader>\\", ":update<CR> :so<CR>", { desc = "Source file" })
vim.keymap.set({ "n", "x" }, "<Leader>h", function() vim.lsp.inlay_hint.enable(vim.lsp.inlay_hint.is_enabled()) end,
    { desc = "Toggles inlay hints" })
