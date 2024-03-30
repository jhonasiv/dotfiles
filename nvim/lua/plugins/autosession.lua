return {
	{
		"rmagatti/auto-session",
		enabled = false,
		config = function()
			require("auto-session").setup({
				log_level = "error",
				session_lens = {
					load_on_setup = true,
					theme_conf = { border = true },
					previewer = false,
				},
			})

			vim.keymap.set("n", "<leader>fs", require("auto-session.session-lens").search_session, { noremap = true })
			vim.keymap.set("n", "<leader>sa", function() end, { noremap = true })
		end,
	},
}
