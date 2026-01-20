vim.pack.add({
    { src = "https://github.com/neovim/nvim-lspconfig" },
    { src = "https://github.com/mason-org/mason.nvim" },
    { src = "https://github.com/mason-org/mason-lspconfig.nvim" },
    { src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
    "https://github.com/j-hui/fidget.nvim",
    "https://github.com/folke/lazydev.nvim",
})

require("mason").setup()
require("mason-lspconfig").setup()

vim.lsp.config("lua_ls", {
    settings = {
        Lua = {
            runtime = {
                version = "LuaJIT",
            },
            diagnostics = {
                globals = {
                    "vim",
                    "require",
                },
            },
            workspace = {
                library = vim.api.nvim_get_runtime_file("", true),
            },
        },
    },
})


vim.keymap.set({ "n", "x" }, "<Leader>lf", vim.lsp.buf.format, { desc = "Format the buffer" })
vim.keymap.set({ "n", "x" }, "<Leader>ld", vim.diagnostic.open_float, { desc = "Open diagnostics popup for cursor" })
vim.keymap.set("n", "gh", function()
    vim.diagnostic.open_float({ scope = "buffer", })
end, { desc = "Show buffer diagnostics", })
