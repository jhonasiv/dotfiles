require("plugins/mini")
require("mini.pick").setup()

vim.keymap.set("n", "<Leader>ff", MiniPick.builtin.files, { desc = "Find Files" })
vim.keymap.set("n", "<Leader>ft", MiniPick.builtin.grep_live, { desc = "Find Text" })
vim.keymap.set("n", "<Leader>fh", MiniPick.builtin.help, { desc = "Find Help" })
vim.keymap.set("n", "<Leader>fb", MiniPick.builtin.buffers, { desc = "Find Buffers" })
vim.keymap.set("n", "<Leader>fr", MiniPick.builtin.resume, { desc = "Resume last search" })
vim.keymap.set("n", "<Leader>fg", function() MiniPick.builtin.files({ tool = "git" }) end, { desc = "Find Git Files" })


local function get_all_keymaps()
    local modes = {
        "n", "i", "v", "x", "s", "o", "t", "c"
    }

    local items = {}

    for _, mode in ipairs(modes) do
        for _, map in ipairs(vim.api.nvim_get_keymap(mode)) do
            local leader = vim.g.mapleader or "\\"
            local lhs = map.lhs:gsub(leader, "<leader>")
            table.insert(items, {
                mode = mode,
                lhs = lhs,
                rhs = map.rhs or "",
                desc = map.desc or "",
                noremap = map.noremap,
                silent = map.silent,
            })
        end
    end

    return items
end

local function format_keymap_item(item)
    local desc = item.desc ~= "" and item.desc or "(no description)"

    return {
        text = string.format(
            "[%s] %-15s → %s",
            item.mode,
            item.lhs,
            desc
        ),
        value = item,
    }
end

local keymaps = get_all_keymaps()
local keymap_items = vim.tbl_map(format_keymap_item, keymaps)
vim.keymap.set("n", "<Leader>fk", function() MiniPick.start({ source = { items = keymap_items } }) end,
    { desc = "Find keymaps" })
