require("plugins/mini")
require("mini.pick").setup()

vim.keymap.set("n", "<Leader>ft", MiniPick.builtin.grep_live, { desc = "Find Text" })
vim.keymap.set("n", "<Leader>fh", MiniPick.builtin.help, { desc = "Find Help" })
vim.keymap.set("n", "<Leader>fb", MiniPick.builtin.buffers, { desc = "Find Buffers" })
vim.keymap.set("n", "<Leader>fr", MiniPick.builtin.resume, { desc = "Resume last search" })
vim.keymap.set("n", "<Leader>fg", function() MiniPick.builtin.files({ tool = "git" }) end, { desc = "Find Git Files" })
