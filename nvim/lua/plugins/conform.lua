return {
	{
		"stevearc/conform.nvim",
		enable = true,
		event = { "BufWritePre" },
		cmd = { "ConformInfo" },
		opts = {
			notify_on_error = false,
			format_on_save = {
				timeout_ms = 500,
				lsp_fallback = true,
			},
			formatters_by_ft = {
				lua = { "stylua" },
				rust = { "rustfmt" },
			},
		},
		keys = {
			{
				"<leader>lf",
				function()
					require("conform").format({ async = false, lsp_fallback = true, timeout_ms = 500 })
				end,
				mode = "",
				desc = "LSP: [F]ormat file",
			},
		},
	},
}
