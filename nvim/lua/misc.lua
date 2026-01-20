local M = {}

M.jj_head = function()
    local ids = vim.fn.system("jj log --no-graph -r @ -T " ..
        "\"commit_id.short() ++ ' ' ++ commit_id.shortest()  ++ ' ' ++ change_id.short() ++ ' '  ++ change_id.shortest()\"")
    local pattern = string.format("([^%s]+)", " ")
    local ids_tbl = {}

    for capture in string.gmatch(ids, pattern) do
        table.insert(ids_tbl, capture)
    end
    return unpack(ids_tbl)
end

M.jj_get_change_id_for_buffer = function(bufnr)
    bufnr = bufnr or 0

    local file = vim.api.nvim_buf_get_name(bufnr)
    if file == "" then
        return nil
    end

    -- Only run inside a jj repo
    if vim.fn.system("jj root"):match("no jj repo") then
        return nil
    end

    -- Ask jj for the change id affecting this file at @
    local cmd = {
        "jj", "log",
        "-r", "@",
        "--paths", file,
        "-n", "1",
        "-T", "change_id",
    }

    local out = vim.fn.system(cmd)
    if vim.v.shell_error ~= 0 then
        return nil
    end

    return vim.fs.normalize(vim.trim(out))
end

M.get_vcs_root = function()
    local jj_root = vim.fn.system("jj root")
    if not jj_root:match("no jj repo") then
        -- gsub returns 2 values, force to take the first with ()
        return (jj_root:gsub("%s+$", ""))
    end

    local git_root = vim.fn.system("git rev-parse --show-toplevel")
    if git_root:match("not a git") then
        return nil
    end
    -- gsub returns 2 values, force to take the first with ()
    return (git_root:gsub("%s+$", ""))
end

M.change_directory_to_current_buffer_root = function()
    local current_dir = vim.fn.getcwd()
    local bufnr = vim.api.nvim_get_current_buf()

    local buftype = vim.bo[bufnr].buftype
    -- Do nothing since buftype is not a file
    if buftype ~= "" then
        return
    end
    local fullpath = vim.api.nvim_buf_get_name(bufnr)
    if fullpath == "" then
        return
    end

    if (pcall(require, "oil")) then
        fullpath = fullpath:gsub("oil://", "")
    end

    -- Take the parent directory from fullpath
    local parent_dir = vim.fn.fnamemodify(fullpath, ":p:h")
    vim.fn.chdir(vim.fs.normalize(parent_dir))

    local root = M.get_vcs_root()
    if not root then
        vim.fn.chdir(current_dir)
        return
    end

    if not vim.startswith(current_dir, root) and not vim.startswith(root, current_dir) then
        print("Changing directory to root " .. vim.fs.normalize(root))
        vim.fn.chdir(vim.fs.normalize(root))
    else
        vim.fn.chdir(current_dir)
    end
end

return M
