require("plugins/mini")
require("plugins/mini-pick")

require("mini.extra").setup()

vim.keymap.set("n", "<Leader>ff", MiniExtra.pickers.explorer, { desc = "Find Files" })
vim.keymap.set("n", "<Leader>fk", MiniExtra.pickers.keymaps, { desc = "Find keymaps" })
