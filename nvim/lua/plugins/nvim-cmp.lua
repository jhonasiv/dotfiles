return {
	"hrsh7th/nvim-cmp",
	dependencies = {
		"L3MON4D3/LuaSnip",
		build = (function()
			-- Build step needs regex support in snippets
			-- This is not supported on many windows environments
			if vim.fn.has("win32") == 1 or vim.fn.executable("make") == 0 then
				return
			end
			return "make_install_jsregexp"
		end)(),
		"saadparwaiz1/cmp_luasnip",

		-- LSP completion capabilities
		"hrsh7th/cmp-nvim-lsp",
		"hrsh7th/cmp-path",

		-- TODO: look into for more snippets "rafamadriz/friendly-snippets"
	},
	config = function()
		local cmp = require("cmp")
		local luasnip = require("luasnip")
		luasnip.config.setup({})

		cmp.setup({
			snippet = {
				expand = function(args)
					luasnip.lsp_expand(args.body)
				end,
			},
			completion = {
				completeopt = "menu,menuone,noinsert",
			},
			mapping = cmp.mapping.preset.insert({
				["<C-j>"] = cmp.mapping.select_next_item(),
				["<C-k>"] = cmp.mapping.select_prev_item(),
				["<C-y>"] = cmp.mapping.confirm({ select = true }),
				["<C-u>"] = cmp.mapping.scroll_docs(-4),
				["<C-d>"] = cmp.mapping.scroll_docs(4),
				["<C-Space>"] = cmp.mapping.complete({}),
				["<CR>"] = cmp.mapping.confirm({
					behavior = cmp.ConfirmBehavior.Replace,
					select = true,
				}),
				["<C-l>"] = cmp.mapping.confirm({
					behavior = cmp.ConfirmBehavior.Replace,
					select = true,
				}),
				["<C-S-l>"] = cmp.mapping(function()
					if luasnip.expand_or_locally_jumpable() then
						luasnip.expand_or_jump()
					end
				end, { "i", "s" }),
				["<C-S-h>"] = cmp.mapping(function()
					if luasnip.locally_jumpable(-1) then
						luasnip.jump(-1)
					end
				end, { "i", "s" }),
			}),
			sources = {
				{ name = "nvim_lsp" },
				{ name = "luasnip" },
				{ name = "path" },
			},
		})
	end,
}
