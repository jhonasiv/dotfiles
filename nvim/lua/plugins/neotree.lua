return {
	{
		"nvim-neo-tree/neo-tree.nvim",
		branch = "v3.x",
		enabled = true,
		dependencies = {
			"nvim-tree/nvim-web-devicons",
			"MunifTanjim/nui.nvim",
			"3rd/image.nvim",
		},
		config = function()
			require("neo-tree").setup({
				close_if_last_window = true,
				enable_git_status = false,
				enable_diagnostics = true,
				source_selector = {
					winbar = true,
					sources = {
						{ source = "filesystem" },
						{ source = "buffers" },
						{ source = "document_symbols" },
					},
				},
				sources = { "buffers", "filesystem", "document_symbols" },
				filesystem = {
					follow_current_file = {
						enabled = true,
					},
					window = {
						mappings = {
							["<CR>"] = "open",
							["l"] = "open",
							["|"] = "open_vsplit",
							["_"] = "open_split",
							["t"] = "open_tabnew",
							["h"] = "close_node",
							["B"] = "close_all_nodes",
							["o"] = { "add", config = { show_path = "relative" } },
							["s"] = { "show_help", nowait = false, config = { title = "Sort by", prefix_key = "s" } },
							["sc"] = { "order_by_created", nowait = false },
							["sd"] = { "order_by_diagnostics", nowait = false },
							["sg"] = { "order_by_git_status", nowait = false },
							["sm"] = { "order_by_modified", nowait = false },
							["sn"] = { "order_by_name", nowait = false },
							["ss"] = { "order_by_size", nowait = false },
							["st"] = { "order_by_type", nowait = false },
						},
					},
				},
				buffers = {
					follow_current_file = {
						enabled = true,
					},
					group_empty_dirs = true,
					show_unloaded = true,
					window = {
						mappings = {
							["bd"] = "buffer_delete",
							["<bs>"] = "navigate_up",
							["l"] = "open",
							["|"] = "open_vsplit",
							["_"] = "open_split",
							["."] = "set_root",
							["s"] = { "show_help", nowait = false, config = { title = "Order by", prefix_key = "o" } },
							["sc"] = { "order_by_created", nowait = false },
							["sd"] = { "order_by_diagnostics", nowait = false },
							["sm"] = { "order_by_modified", nowait = false },
							["sn"] = { "order_by_name", nowait = false },
							["ss"] = { "order_by_size", nowait = false },
							["st"] = { "order_by_type", nowait = false },
						},
					},
				},
				document_symbols = {
					window = {
						mappings = {
							["l"] = "jump_to_symbol",
							["|"] = "open_vsplit",
							["_"] = "open_split",
						},
					},
				},
			})

			vim.keymap.set({ "n", "v" }, "<leader>b", "<cmd>Neotree toggle last<CR>", { desc = "Open file tree" })
		end,
	},
}
