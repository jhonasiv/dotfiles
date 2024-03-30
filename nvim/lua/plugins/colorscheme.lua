return {
	{
		-- main colorscheme, make sure to load this during startup and before all plugins
		"catppuccin/nvim",
		lazy = false,
		priority = 1000,
		name = "catppuccin",
		config = function()
			vim.cmd.colorscheme("catppuccin")
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
		end,
	},
	{ "tiagovla/tokyodark.nvim", enabled = false },
}
