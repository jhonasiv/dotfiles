return {
	{
		"echasnovski/mini.nvim",
		enabled = true,
		version = "0.12.*",
		config = function()
			require("mini.ai").setup({
				custom_textobjects = {
					["q"] = { '%b""', "^.().*().$" },
				},
			})
			require("mini.surround").setup({
				mappings = {
					add = "<leader>sa",
					delete = "<leader>sd",
					find = "<leader>sf",
					find_left = "<leader>sF",
					highlight = "<leader>sh",
					replace = "<leader>sr",
					update_n_lines = "<leader>sn",
				},
			})
			require("mini.pairs").setup()
		end,
		dependencies = {
			"nvim-treesitter/nvim-treesitter-textobjects",
		},
	},
}
