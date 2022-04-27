set nocompatible

let mapleader = ','

set formatoptions=jcroql	   	" Continue comment markers in new lines
set expandtab			    	" Insert spaces when TAB is pressed
set tabstop=4			    	" Number of spaces used on TAB

set autoread 					" When a file is changed outside of the terminal automatically updates it
set splitbelow			        " Horizontal split below current
set splitright			        " Vertical split to right of current

set nostartofline		        " Do not jump to first character with page commands

set textwidth=0               " Maximum text width before wrapping
set wrap
set autoindent                  " Use same indenting on new lines
set smartindent                 " Smart autoindenting on new lines

set ignorecase                  " Search ignoring case
set smartcase                   " Keep case when searching with *
set incsearch                   " Incrementally search for matches as you type
set hlsearch                    " Highlight search results
set wrapscan                    " Searches wrap the end of the file

set backspace=indent,eol,start  " Intuitive backspacing in insert mode
set switchbuf=useopen,usetab    " Jump to the first open window in any tab


" Go to the first non-blank character of a line
noremap 0 ^
" Just in case you need to go to the very beginning of a line
noremap ^ 0

source $HOME/.config/nvim/plugins.vim

"------------------------------------
"           EASY MOTION
"------------------------------------
" <Leader>f{char} to move to {char}
map  <Leader>f <Plug>(easymotion-bd-f)

" Move to line
map <Leader>L <Plug>(easymotion-bd-jk)

" Move to word
map  <Leader>w <Plug>(easymotion-bd-w)

" JK motions: Line motions
map <Leader>j <Plug>(easymotion-j)
map <Leader>k <Plug>(easymotion-k)

let g:EasyMotion_smartcase = 1
"------------------------------------

if !exists('g:vscode')
        set guicursor=n-v-c:block,i-ci:ver30,r:hor20          		
        set termguicolors				
        set number			        	" Show line numbers
        set rnu							" Show line number as relative numbers
        set showmatch			    	" Show matching brackets
        
        set showfulltag                 " Show tag and tidy search in completion
        set complete=.                  " No wins, buffs, tags, include scanning
        set completeopt+=menuone         " Show menu even for one item
        set completeopt+=noselect       " Do not select a match in the menu

        runtime! macros/matchit.vim 	" Runs the version of matchit that ships with vim

        "---------------------------------------- 
        "           EASY MOTION
        "---------------------------------------- 
        " <Leader>f{char} to move to {char}
        nmap <Leader>f <Plug>(easymotion-overwin-f)
        " Move to line
        nmap <Leader>L <Plug>(easymotion-overwin-line)
        " <Leader> s{char}{char} to move to {char}{char}
        nmap <Leader>s <Plug>(easymotion-overwin-f2)
        " <Leader> W Move to word
        nmap <Leader>w <Plug>(easymotion-overwin-w)
        " ----------------------------------------

        "---------------------------------------------------------
        "                   QUICK-SCOPE
        "---------------------------------------------------------

        let g:qs_highlight_on_keys = ['f', 'F', 't', 'T']

        augroup qs_colors
                autocmd!
                autocmd ColorScheme * highlight QuickScopePrimary guifg='#afff5f' gui=underline ctermfg=155 cterm=underline
                autocmd ColorScheme * highlight QuickScopeSecondary guifg='#5fffff' gui=underline ctermfg=81 cterm=underline
        augroup END

        let g:qs_enable=1

        " --------------------------------------------------------

        if !&scrolloff
                set scrolloff=3	        " Show next 3 lines while scrolling.
        endif
        if !&sidescrolloff
                set sidescrolloff=5	    " Show next 5 columns while side-scrolling.
        endif
        " Allow saving of files as sudo when I forgot to start vim using sudo.
        cmap w!! w !sudo tee > /dev/null %


        " Remember folded groups on exit
        augroup remember_folds
                autocmd!
                autocmd BufWinLeave ?* mkview
                autocmd BufWinEnter ?* silent! loadview 1
        augroup END

        syntax on
        inoremap jj <ESC>
        lua require'colorizer'.setup()
        colorscheme dracula
else
        " Disable parentheses matching depends on system. This way we should address all cases (?)
        set noshowmatch
        " NoMatchParen " This doesnt work as it belongs to a plugin, which is only loaded _after_ all files are.
        " Trying disable MatchParen after loading all plugins
        "
        function! g:FckThatMatchParen ()
                if exists(":NoMatchParen")
                        :NoMatchParen
                endif
        endfunction

        augroup plugin_initialize
                autocmd!
                autocmd VimEnter * call FckThatMatchParen()
        augroup END
        " VSCode specific config
        source $HOME/.config/nvim/vscode.vim
endif

