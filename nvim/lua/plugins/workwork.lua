return {
	dir = "/home/jhonas/dev/workwork",
	enabled = true,
	event = "VeryLazy",
	config = function()
		require("workwork").setup({
			autosave = {
				on_create = false,
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
		vim.keymap.set(
			"n",
			"<Leader>ws",
			require("workwork.core").save,
			{ desc = "[S]ave current workspaces configuration" }
		)
	end,
}
