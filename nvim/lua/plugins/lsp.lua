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
    cmd = { "lua-language-server" },
    filetypes = { "lua" },
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

vim.lsp.config("stylua", {
    cmd = { "stylua", "-" }, -- read from stdin
    filetypes = { "lua" },
    root_dir = function(bufnr)
        return vim.fs.root(bufnr, {
            "stylua.toml",
            ".git",
        })
    end,
})

-- Python formatter and lsp
vim.lsp.config("ruff", {})
vim.lsp.config("pyright", {
    capabilities = {
        documentFormattingProvider = true,
        documentRangeFormattingProvider = true,
    },
})
vim.lsp.config("regex", {})
vim.lsp.config("dockerls", {})

vim.lsp.enable("lua_ls")
vim.lsp.enable("stylua")
vim.lsp.enable("regex")
vim.lsp.enable("dockerls")
vim.lsp.enable("pyright")
vim.lsp.enable("ruff")

vim.keymap.set({ "n", "x" }, "<Leader>lf", vim.lsp.buf.format, { desc = "Format the buffer" })
vim.keymap.set({ "n", "x" }, "<Leader>ld", function()
    vim.diagnostic.open_float({ scope = "buffer", })
end, { desc = "Open diagnostics popup for buffer" })
vim.keymap.set("n", "gh", function()
    vim.diagnostic.open_float(nil, { scope = "cursor", focusable = true })
end, { desc = "Show cursor diagnostics", })
