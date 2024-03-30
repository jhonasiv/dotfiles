return {
	"gennaro-tedesco/nvim-possession",
	enabled = false,
	dependencies = {
		"ibhagwan/fzf-lua",
		config = function()
			require("nvim-possession").setup({
				autoswitch = {
					enable = true,
				},
				autosave = true,
				autoload = false,
			})
		end,
	},
}
