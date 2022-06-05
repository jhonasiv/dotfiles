function! Cond(cond, ...)
  let opts = get(a:000, 0, {})
  return a:cond ? opts : extend(opts, { 'on': [], 'for': [] })
endfunction

call plug#begin()
        " VSCode plugins
        Plug 'asvetliakov/vim-easymotion', Cond(exists('g:vscode'), { 'as': 'vsc-easymotion' })
        Plug 'wellle/targets.vim'
        " Neovim-only plugins
        Plug 'norcalli/nvim-colorizer.lua', Cond(!exists('g:vscode'), {'as': 'colorizer'})
        Plug 'vim-airline/vim-airline', Cond(!exists('g:vscode'))
        Plug 'junegunn/fzf',  Cond(!exists('g:vscode'), { 'do': { -> fzf#install() } })
        Plug 'junegunn/fzf.vim', Cond(!exists('g:vscode'))
        Plug 'itchyny/lightline.vim', Cond(!exists('g:vscode'))
        Plug 'dracula/vim', Cond(!exists('g:vscode'), { 'as': 'dracula' })
        Plug 'tpope/vim-surround', Cond(!exists('g:vscode'))
        Plug 'editorconfig/editorconfig-vim', Cond(!exists('g:vscode'))
        Plug 'terryma/vim-multiple-cursors', Cond(!exists('g:vscode'))
        Plug 'jiangmiao/auto-pairs', Cond(!exists('g:vscode'))
        Plug 'tpope/vim-unimpaired', Cond(!exists('g:vscode'))
        Plug 'preservim/nerdcommenter', Cond(!exists('g:vscode'))
        Plug 'nathanaelkane/vim-indent-guides', Cond(!exists('g:vscode'))
        Plug 'terryma/vim-expand-region', Cond(!exists('g:vscode'))
        Plug 'bkad/CamelCaseMotion', Cond(!exists('g:vscode'))
        Plug 'easymotion/vim-easymotion', Cond(!exists('g:vscode'))
        Plug 'unblevable/quick-scope', Cond(!exists('g:vscode'))
call plug#end()
