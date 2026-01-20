vim.pack.add({ "https://github.com/folke/snacks.nvim" })

local snacks = require("snacks")
snacks.setup(
    {
        picker = {
            matcher = { frecency = true },
            sources = {
                explorer = {
                    win = {
                        input = {
                            keys = {
                                ["o"] = { "explorer_add", mode = "n" }
                            }
                        },
                        list = {
                            keys = {
                                ["o"] = { "explorer_add", mode = "n" }
                            }
                        }
                    }
                }
            }
        },
        explorer = { enabled = true },
        terminal = { enabled = true }
    })

vim.keymap.set({ "n", "o" }, "<Leader>b", function() Snacks.explorer() end, { desc = "Open file tree" })
vim.keymap.set({ "n", "o" }, "<Leader>ff", function() Snacks.picker.files() end, { desc = "Find Files" })
vim.keymap.set({ "n", "o" }, "<Leader>fh", function() Snacks.picker.help() end, { desc = "Find in Help" })
vim.keymap.set({ "n", "o" }, "<Leader>fc", function() Snacks.picker.commands() end, { desc = "Find Commands" })
vim.keymap.set({ "n", "o" }, "<Leader>fs", function() Snacks.picker.search_history() end,
    { desc = "Open search history" })
vim.keymap.set({ "n", "o" }, "<Leader>fz", function() Snacks.picker.command_history() end,
    { desc = "Open command history" })
vim.keymap.set({ "n", "o" }, "<Leader>fr", function() Snacks.picker.recent() end, { desc = "Find from recent files" })
vim.keymap.set({ "n", "o" }, "<Leader>fb", function() Snacks.picker.buffers() end, { desc = "Find buffers" })
vim.keymap.set({ "n", "o" }, "<Leader>dd", function() Snacks.picker.diagnostics() end,
    { desc = "Find diagnostics in project" })
vim.keymap.set({ "n", "o" }, "<Leader>db", function() Snacks.picker.diagnostics_buffer() end,
    { desc = "Find diagnostics in buffer" })
vim.keymap.set({ "n", "o" }, "<Leader>fa", function() Snacks.picker.autocmds() end, { desc = "Find autocmds" })
vim.keymap.set({ "n", "o" }, "<Leader>ft", function() Snacks.picker.grep() end, { desc = "Find text" })
vim.keymap.set({ "n", "o" }, "<Leader>fj", function() Snacks.picker.jumps() end, { desc = "Find in jumplist" })
vim.keymap.set({ "n", "o" }, "<Leader>fk", function() Snacks.picker.keymaps() end, { desc = "Find keymap" })
vim.keymap.set({ "n", "o" }, "<Leader>fn", function() Snacks.picker.notifications() end, { desc = "Notifications" })
vim.keymap.set({ "n", "o" }, "<Leader>\"", function() Snacks.picker.registers() end, { desc = "Registers" })
vim.keymap.set({ "n", "o" }, "<Leader>u", function() Snacks.picker.undo() end, { desc = "Undo history" })
vim.keymap.set({ "n", "o" }, "<Leader>;", function() Snacks.picker.pickers() end, { desc = "Pickers list" })
vim.keymap.set({ "n", "o" }, "<Leader>r", function() Snacks.picker.resume() end, { desc = "Resume last picker" })


vim.keymap.set({ "n", "o", "v", "i" }, "<C-K>d", function() Snacks.picker.lsp_definitions() end,
    { desc = "List LSP definitions" })
vim.keymap.set({ "n", "o", "v", "i" }, "<C-K>i", function() Snacks.picker.lsp_implementations() end,
    { desc = "List LSP implementations" })
vim.keymap.set({ "n", "o", "v", "i" }, "<C-K>c", function() Snacks.picker.lsp_incoming_calls() end,
    { desc = "List LSP incoming calls" })
vim.keymap.set({ "n", "o", "v", "i" }, "<C-K>w", function() Snacks.picker.lsp_outgoing_calls() end,
    { desc = "List LSP outgoing calls" })
vim.keymap.set({ "n", "o", "v", "i" }, "<C-K>r", function() Snacks.picker.lsp_references() end,
    { desc = "List LSP references" })
vim.keymap.set({ "n", "o", "v", "i" }, "g0", function() Snacks.picker.lsp_symbols() end,
    { desc = "List LSP symbols" })
