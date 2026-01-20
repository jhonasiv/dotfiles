return {
	"nvim-lualine/lualine.nvim",
	requires = { "nvim-tree/nvim-web-devicons", opt = true },
	enabled = true,
	config = function()
		require("lualine").setup({
			options = {
				icons_enabled = true,
				component_separators = "",
				section_separators = { left = "", right = "" },
			},
			sections = {
				lualine_a = { { "mode", separator = { left = "" }, right_padding = 2 } },
				lualine_b = { require("workwork.core").selected(), "branch" },
				lualine_c = { "diagnostics", "filename" },
				lualine_x = {},
				lualine_y = { "filetype", "progress" },
				lualine_z = { { "location", separator = { right = "" }, left_padding = 2 } },
			},
			extensions = { "quickfix" },
		})
	end,
}
