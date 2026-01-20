require("plugins/mini")

require("mini.statusline").setup({
    use_icons = true
})

-- local vcs_group = vim.api.nvim_create_augroup("JJChangeId", { clear = true })
-- vim.api.nvim_create_autocmd({
--     "BufEnter", "BufWritePost", "FocusGained"
-- }, {
--     group = vcs_group,
--     callback = function (args)
--         local change_id = jj_get_change_id_for_buffer(bufnr)
--         vim.b[args.buf].jj_commit_id = commit_id
--
--     end
-- })
