vim.pack.add({ { src = "https://github.com/lewis6991/gitsigns.nvim" } }, { confirm = false })

require("gitsigns").setup {
    signs = {
        add = { text = '+' },
        change = { text = '~' },
        delete = { text = '_' },
        topdelete = { text = '‾' },
        changedelete = { text = '~' },
    },
}
