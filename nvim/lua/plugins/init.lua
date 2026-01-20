local ENABLED_PLUGINS = {
    "blink",
    "colorscheme",
    "gitsigns",
    "hunk",
    "jujutsu",
    "lsp",
    "mini",
    "mini-ai",
    "mini-clue",
    "mini-pair",
    "mini-statusline",
    "mini-surround",
    "nvim-treesitter",
    "opencode",
    "snacks",
    -- "workwork"
}


for _, plugin in ipairs(ENABLED_PLUGINS) do
    require("plugins/" .. plugin)
end
