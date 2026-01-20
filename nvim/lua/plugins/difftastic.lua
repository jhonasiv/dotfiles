vim.pack.add({ {
    src = "https://github.com/clabby/difftastic.nvim"
} })

require("difftastic-nvim").setup({
    download = true,
    snacks_picker = {
        enabled = true
    }
})
