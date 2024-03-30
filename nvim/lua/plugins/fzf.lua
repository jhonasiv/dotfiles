return {
	"ibhagwan/fzf-lua",
	enabled = false,
	config = function()
		-- require("fzf-lua").setup({ "telescope", winopts = { preview = { default = "bat" } } })
		local fzf = require("fzf-lua")
		local actions = fzf.actions
		fzf.setup({
			"telescope",
			keymap = {
				builtin = {
					["ctrl-d"] = "preview-page-down",
					["ctrl-u"] = "preview-page-up",
				},
				fzf = {
					["ctrl-d"] = "preview-page-down",
					["ctrl-u"] = "preview-page-up",
				},
			},
			actions = {
				files = {
					["ctrl-l"] = actions.file_edit_or_qf,
					["ctrl-v"] = actions.file_vsplit,
					["ctrl-h"] = actions.file_split,
				},
				buffers = {
					["ctrl-l"] = actions.buf_edit,
					["ctrl-h"] = actions.buf_split,
				},
			},
		})
	end,
}
