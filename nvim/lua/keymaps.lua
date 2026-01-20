-- GENERAL NON PLUGIN SPECIFIC KEYMAPS

vim.keymap.set({ "n", "x"}, "<Leader>w", ":update<CR>", { desc = "Save buffer"})
vim.keymap.set({ "n", "x"}, "<Leader>o", ":update<CR> :so<CR>", { desc = "Source file"})
