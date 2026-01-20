vim.pack.add({
    { src = "https://github.com/catppuccin/nvim", name = "catppuccin" }
})


require("catppuccin").setup({
    flavor = "macchiato",
    integrations = {
        mason = true,
        native_lsp = {
            enable = true,
            underlines = {
                errors = { "undercurl" },
                hints = { "undercurl" },
                warnings = { "undercurl" },
                information = { "undercurl" },
            },
        },
        cmp = true,
        which_key = true,
        neotree = true,
        treesitter = true,
        telescope = true,
    },
})
vim.cmd.colorscheme("catppuccin")
