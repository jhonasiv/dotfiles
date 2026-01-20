vim.pack.add({
    { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
})

require("nvim-treesitter").setup({})

-- Install parsers explicitly
require("nvim-treesitter").install({ "markdown", "markdown_inline", "lua" })

-- Enable treesitter highlighting
vim.api.nvim_create_autocmd("FileType", {
    pattern = { "markdown", "opencode_output" },
    callback = function()
        vim.treesitter.start()
    end,
})

