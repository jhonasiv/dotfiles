vim.pack.add({
    { src = "https://github.com/jhonasiv/opencode.nvim" },
    { src = "https://github.com/nvim-lua/plenary.nvim" }
})

require("plugins/render-markdown")

require("opencode").setup({
    preferred_picker = "snacks",
    preferred_completion = "blink",
    keymap_prefix = "<leader>o",
    opencode_executable = "opencode",
    -- server_url = "https://ai.jjlab.xyz.br",
    -- server_auth = {
    --     enabled = true,
    --     username = "opencode",
    --     password = vim.env.OPENCODE_SERVER_PASSWORD,
    -- },
    context = {
        diagnostics = {
            info = true
        },
        git_diff = {

        }
    }
})

-- Register opencode_output as markdown for treesitter parsing
vim.treesitter.language.register('markdown', 'opencode_output')
