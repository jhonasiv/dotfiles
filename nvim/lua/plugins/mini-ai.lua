require("plugins/mini")
require("mini.ai").setup({
    custom_textobjects = {
        ["q"] = { '%b""', "^.().*().$" },
    },
})
