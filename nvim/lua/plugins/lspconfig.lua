return {
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			{ "williamboman/mason.nvim", config = true },
			"williamboman/mason-lspconfig.nvim",
			"WhoIsSethDaniel/mason-tool-installer.nvim",

			-- Status updates for LSP
			{ "j-hui/fidget.nvim", opts = {} },
			"folke/neodev.nvim",
		},
		config = function()
			vim.api.nvim_create_autocmd("LspAttach", {
				group = vim.api.nvim_create_augroup("lsp-attach", { clear = true }),
				callback = function(event)
					-- This function gets run when a LSP connects to a particular buffer
					-- Helper function that lets us more easily define mapping specific for LSP related items. It sets the mode, buffer and description for us each time
					local leader_nmap = function(keys, func, desc)
						if desc then
							desc = "LSP: " .. desc
						end

						-- All LSP related leader keys use <leader>l chord
						vim.keymap.set("n", "<leader>l" .. keys, func, { buffer = event.buf, desc = desc })
					end
					local nmap = function(keys, func, desc)
						if desc then
							desc = "LSP: " .. desc
						end

						-- All LSP related leader keys use <leader>l chord
						vim.keymap.set("n", keys, func, { buffer = event.buf, desc = desc })
					end
					leader_nmap("rn", vim.lsp.buf.rename, "[R]e[n]ame")
					leader_nmap("ca", function()
						vim.lsp.buf.code_action({ context = { only = { "quickfix", "refactor", "source" } } })
					end, "[C]ode [A]ction")
					nmap("gd", require("telescope.builtin").lsp_definitions, "[G]o to [D]efinition")
					nmap("gr", require("telescope.builtin").lsp_references, "[G]o to [R]eferences")
					nmap("gI", require("telescope.builtin").lsp_implementations, "[G]o to [I]mplementation")
					nmap("gD", vim.lsp.buf.declaration, "[G]o to [D]eclaration")

					leader_nmap("td", require("telescope.builtin").lsp_type_definitions, "[T]ype [D]efinitions")
					leader_nmap("ds", require("telescope.builtin").lsp_document_symbols, "[D]ocument [S]ymbols")
					leader_nmap(
						"ws",
						require("telescope.builtin").lsp_dynamic_workspace_symbols,
						"[W]orkspace [S]ymbols"
					)

					leader_nmap("wa", vim.lsp.buf.add_workspace_folder, "[W]orkspace [F]older")
					leader_nmap("wr", vim.lsp.buf.remove_workspace_folder, "[W]orkspace [R]emove Folder")
					leader_nmap("wl", function()
						print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
					end, "[W]orkspace [L]ist Folders")

					vim.api.nvim_buf_create_user_command(event.buf, "Format", function(_)
						vim.lsp.buf.format()
					end, { desc = "Format current buffer with LSP" })

					local client = vim.lsp.get_client_by_id(event.data.client_id)
					if client and client.server_capabilities.documentHighlightProvider then
						vim.api.nvim_create_autocmd({ "CursorHold", "CursorHoldI" }, {
							buffer = event.buf,
							callback = vim.lsp.buf.document_highlight,
						})

						vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
							buffer = event.buf,
							callback = vim.lsp.buf.clear_references,
						})
					end
				end,
			})

			local capabilities = vim.lsp.protocol.make_client_capabilities()
			capabilities = vim.tbl_deep_extend("force", capabilities, require("cmp_nvim_lsp").default_capabilities())
			local servers = {
				lua_ls = {
					settings = {
						Lua = {
							runtime = { version = "LuaJIT" },
							workspace = {
								checkThirdParty = false,
								library = { "${3rd}/luv/library", unpack(vim.api.nvim_get_runtime_file("", true)) },
							},
							completion = { callSnippet = "Replace" },
							telemetry = { enable = false },
							diagnostics = { disable = { "missing-fields" } },
						},
					},
				},
				rust_analyzer = {},
			}

			require("neodev").setup()
			require("mason").setup()

			local ensure_installed = vim.tbl_keys(servers)
			vim.list_extend(ensure_installed, { "stylua" })

			require("mason-tool-installer").setup({ ensure_installed = ensure_installed })

			require("mason-lspconfig").setup({
				handlers = {
					function(server_name)
						local server = servers[server_name] or {}
						server.capabilities = vim.tbl_deep_extend("force", {}, capabilities, server.capabilities or {})
						require("lspconfig")[server_name].setup(server)
					end,
				},
			})
		end,
	},
}
