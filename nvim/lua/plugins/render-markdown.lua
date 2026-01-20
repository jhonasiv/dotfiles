vim.pack.add({
    { src = "https://github.com/MeanderingProgrammer/render-markdown.nvim" }

})

require("render-markdown").setup({
    anti_conceal = { enabled = true },
    file_types = { 'markdown', 'opencode_output' },
    code = {
        enabled = true,
        highlight_language = true,
    },
})
