vim.pack.add({
    { src = "https://github.com/yannvanhalewyn/jujutsu.nvim" }
})

require("plugins.difftastic")
require("jujutsu-nvim").setup(
    {
        diff_preset = "difftastic",
    }
)

vim.keymap.set({ "n", "x" }, "<Leader>jj", ":JJ status<CR>", { desc = "Opens JJ Status" })
vim.keymap.set({ "n", "x" }, "<Leader>jl", ":JJ log<CR>", { desc = "Opens JJ Log" })
vim.keymap.set({ "n", "x" }, "<Leader>jd", ":JJ diff<CR>", { desc = "Opens JJ Diff" })
vim.keymap.set({ "n", "x" }, "<Leader>jd", ":JJ diff<CR>", { desc = "Opens JJ Diff" })
