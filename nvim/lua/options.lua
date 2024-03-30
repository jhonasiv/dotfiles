vim.o.hlsearch = true
vim.wo.number = true

-- Sync clipboard between OS and Neovim.
vim.o.clipboard = "unnamedplus"
vim.o.breakindent = true

-- Save undo history
vim.o.undofile = true

-- Case-insensitive searching unless \C or capital in search
vim.o.ignorecase = true
vim.o.smartcase = true

-- Keep signcolumn on by default
vim.wo.signcolumn = "yes"

-- Decrease update time
vim.o.updatetime = 250
vim.o.timeoutlen = 250

vim.opt.splitright = true
vim.opt.splitbelow = true

-- Sets how neovim will display certain whitespace in the editor.
vim.opt.list = true
vim.opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }
vim.keymap.set("n", "<leader>tl", function()
	vim.opt.list = not (vim.opt.list:get())
end, { desc = "[L]ist chars" })

-- Minimum number of lines on screen to keep above and below cursor
vim.opt.scrolloff = 10

-- Set completeopt to have a better completion experiencie
vim.o.completeopt = "menuone,noselect"

-- Shows which line the cursor is in
vim.opt.cursorline = true

-- Preview substitutions live
vim.opt.inccommand = "split"

vim.o.expandtab = true
vim.o.softtabstop = 4
vim.o.tabstop = 4
vim.o.shiftwidth = 4

vim.api.nvim_create_autocmd("TextYankPost", {
	desc = "Highlight when yanking text",
	group = vim.api.nvim_create_augroup("highlight-yank", { clear = true }),
	callback = function()
		vim.highlight.on_yank()
	end,
})
