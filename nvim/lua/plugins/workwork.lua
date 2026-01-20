vim.pack.add { { src = "file:///home/jhonas/dev/workwork", version="snacks-integration" } }

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
            enable = false,
        },
    },
})

vim.keymap.set({ "n", "x" }, "<Leader>ks", require("workwork.core").save,
    { desc = "Save current workspaces configuration" })
