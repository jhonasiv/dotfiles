vim.pack.add({{
    src = "https://github.com/julienvincent/hunk.nvim"
}}, { confirm = false })

require("plugins.nui")

require("hunk").setup()
