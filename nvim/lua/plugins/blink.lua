vim.pack.add({
    {
        src = "https://github.com/saghen/blink.cmp",
        version = "v1.8.0",
    },
    "https://github.com/rafamadriz/friendly-snippets"
})


-- Lazy loads blink when entering insert mode for the first time
local group = vim.api.nvim_create_augroup("BlinkCmpLazyLoad", { clear = true })
vim.api.nvim_create_autocmd("InsertEnter", {
    pattern = "*",
    group = group,
    once = true,
    callback = function()
        require("blink.cmp").setup({
            completion = {
                menu = {
                    enabled = true,
                    auto_show = true,
                    auto_show_delay_ms = 0,
                },
                documentation = {
                    auto_show = true
                },
                list = {
                    selection = {
                        auto_insert = false,
                        preselect = false,
                    },
                },
                ghost_text = {
                    enabled = true,
                    show_with_selection = true,
                    show_without_selection = false,
                    show_with_menu = true,
                    show_without_menu = false,
                }
            },
            sources = {
                default = { 'lsp', 'path', 'snippets', 'buffer' },
                providers = {
                    path = {
                        opts = {
                            get_cwd = function()
                                return vim.fn.getcwd()
                            end
                        }
                    }
                }
            },
            cmdline = {
                enabled = true
            },
            signature = {
                enabled = true
            },
            keymap = {
                preset = "super-tab"
            },
            fuzzy = { implementation = "prefer_rust_with_warning" }

        })
    end
})

