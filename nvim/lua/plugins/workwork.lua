return {
	dir = "/home/jhonas/dev/workwork",
	enabled = true,
	event = "VeryLazy",
	config = function()
		require("workwork").setup({
			autosave = {
				on_create = true,
				on_new_folder = true,
			},
			integrations = {
				fzf_lua = {
					enable = false,
				},
				telescope = {
					enable = true,
				},
			},
		})
	end,
}
