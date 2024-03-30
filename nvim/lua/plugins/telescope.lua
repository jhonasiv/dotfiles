return {
	"nvim-telescope/telescope.nvim",
	branch = "0.1.x",
	dependencies = {
		{
			"nvim-telescope/telescope-fzf-native.nvim",
			build = "make",
			conf = function()
				return vim.fn.executable("make") == 1
			end,
		},
		{ "nvim-telescope/telescope-ui-select.nvim" },
		{ "nvim-tree/nvim-web-devicons" },
		{ "nvim-telescope/telescope-file-browser.nvim" },
	},
	config = function()
		local telescope = require("telescope")
		local actions = require("telescope.actions")
		local fb_actions = require("telescope._extensions.file_browser.actions")
		telescope.setup({
			extensions = {
				["ui-select"] = {
					require("telescope.themes").get_dropdown(),
				},
				workwork = {
					relative_path_entries = true,
					support_nongit_folders = true,
				},
				file_browser = {
					hijack_netrw = true,
					mappings = {
						["i"] = {
							["<C-o>"] = fb_actions.create,
							["<S-CR>"] = fb_actions.create_from_prompt,
							["<A-r>"] = fb_actions.rename,
							["<A-x>"] = fb_actions.move,
							["<A-y>"] = fb_actions.copy,
							["<A-d>"] = fb_actions.remove,
							["<C-<CR>>"] = fb_actions.open,
							["<C-m>"] = fb_actions.goto_parent_dir,
							["<C-0>"] = fb_actions.goto_home_dir,
							["<C-w>"] = fb_actions.goto_cwd,
							["<C-t>"] = fb_actions.change_cwd,
							["<C-f>"] = fb_actions.toggle_browser,
							["<C-h>"] = fb_actions.toggle_hidden,
							["<C-s>"] = fb_actions.toggle_all,
							["<bs>"] = fb_actions.backspace,
						},
						["n"] = {
							["o"] = fb_actions.create,
							["r"] = fb_actions.rename,
							["x"] = fb_actions.move,
							["y"] = fb_actions.copy,
							["d"] = fb_actions.remove,
							["l"] = fb_actions.open,
							["K"] = fb_actions.goto_parent_dir,
							["0"] = fb_actions.goto_home_dir,
							["w"] = fb_actions.goto_cwd,
							["t"] = fb_actions.change_cwd,
							["f"] = fb_actions.toggle_browser,
							["h"] = fb_actions.toggle_hidden,
							["s"] = fb_actions.toggle_all,
						},
					},
				},
			},
			defaults = {
				mappings = {
					i = {
						["<C-j>"] = actions.move_selection_next,
						["<C-k>"] = actions.move_selection_previous,
						["|"] = actions.select_vertical,
						["_"] = actions.select_horizontal,
						["<C-l>"] = actions.select_default,
					},
				},
			},
		})

		pcall(telescope.load_extension, "fzf")
		pcall(telescope.load_extension, "ui-select")
		pcall(telescope.load_extension, "session-lens")

		local builtin = require("telescope.builtin")
		vim.keymap.set("n", "<leader>fh", builtin.help_tags, { desc = "[S]earch [H]elp" })
		vim.keymap.set("n", "<leader>fk", builtin.keymaps, { desc = "[S]earch [K]eymaps" })
		vim.keymap.set("n", "<leader>ff", builtin.find_files, { desc = "[F]ind [F]iles" })
		vim.keymap.set("n", "<leader>fw", builtin.grep_string, { desc = "[F]ind Current [W]ord" })
		vim.keymap.set("n", "<leader>fg", builtin.live_grep, { desc = "[F]ind Current [W]ord" })
		vim.keymap.set("n", "<leader>fr", builtin.resume, { desc = "Previous [F]ind [R]esume" })
		vim.keymap.set("n", "<leader>fl", builtin.oldfiles, { desc = "[F]ind [L]atest Files" })
		vim.keymap.set("n", "<leader>f<leader>", builtin.buffers, { desc = "[F]ind existing buffers" })
		vim.keymap.set("n", "<leader>/", function()
			builtin.current_buffer_fuzzy_find(require("telescope.themes").get_dropdown({
				winblend = 10,
				previewer = false,
			}))
		end, { desc = "[/] Fuzzily search in the current buffer" })

		vim.keymap.set("n", "<leader>f/", function()
			builtin.live_grep({
				grep_open_files = true,
				prompt_title = "Live Grep in Open Files",
			})
		end, { desc = "[F]ind [/] in Open Files" })

		-- Shortcut for searching your neovim configuration files
		vim.keymap.set("n", "<leader>fn", function()
			builtin.find_files({ cwd = vim.fn.stdpath("config") })
		end, { desc = "[F]ind [N]eovim files" })

		vim.keymap.set("n", "<leader>fb", "<cmd>Telescope file_browser<CR>", { desc = "[F]ile [B]rowser" })
	end,
}
