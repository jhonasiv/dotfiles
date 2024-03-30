return {
	{
		"folke/which-key.nvim",
		event = "VeryLazy",
		config = function()
			local wk = require("which-key")
			wk.setup()

			wk.register({
				["<leader>f"] = { name = "[F]ind", _ = "which_key_ignore" },
				["<leader>l"] = { name = "[L]sp", _ = "which_key_ignore" },
				["<leader>b"] = { name = "Open file tree", _ = "which_key_ignore" },
				["<leader>lw"] = { name = "[W]orkspace", _ = "which_key_ignore" },
				["<leader>t"] = { name = "[T]oggle options", _ = "which_key_ignore" },
				["<leader>s"] = { name = "[S]urround Actions", _ = "which_key_ignore" },
			})
		end,
	},
}
