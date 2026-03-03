vim.pack.add({ "https://github.com/stevearc/oil.nvim" }, { confirm = false })

require("oil").setup({
    default_file_explorer = true,
    columns = {
        "icons"
    }
})



vim.keymap.set({ "n", "v" }, "<leader>b", "<cmd>Oil<CR>", { desc = "Open file tree" })


