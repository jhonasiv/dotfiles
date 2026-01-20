vim.pack.add({ { src = "https://github.com/folke/which-key.nvim" } })

local wk = require("which-key")
wk.setup()

wk.add({
    { "<leader>f",   group = "[F]ind" },
    { "<leader>f_",  hidden = true },
    { "<leader>l",   group = "[L]sp" },
    { "<leader>l_",  hidden = true },
    { "<leader>b",   group = "Open file tree" },
    { "<leader>b_",  hidden = true },
    { "<leader>lw",  group = "[W]orkspace" },
    { "<leader>lw_", hidden = true },
    { "<leader>t",   group = "[T]oggle options" },
    { "<leader>t_",  hidden = true },
    { "<leader>s",   group = "[S]urround Actions" },
    { "<leader>s_",  hidden = true },
})

