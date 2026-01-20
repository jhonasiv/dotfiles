# Should be called before compinit
zmodload zsh/complist

_comp_options+=(globdots) # With hidden files

# Use hjlk in menu selection (during completion)
# Doesn't work well with interactive mode
bindkey -M menuselect 'h' vi-backward-char
bindkey -M menuselect 'k' vi-up-line-or-history
bindkey -M menuselect 'j' vi-down-line-or-history
bindkey -M menuselect 'l' vi-forward-char

bindkey -M menuselect '^xg' clear-screen
bindkey -M menuselect '^xi' vi-insert                      # Insert
bindkey -M menuselect '^xh' accept-and-hold                # Hold
bindkey -M menuselect '^xn' accept-and-infer-next-history  # Next
bindkey -M menuselect '^xu' undo                           # Undo

# Options

setopt always_to_end # move the cursor to the end of the word when a completion is inserted
setopt auto_list # automatically list choices on an ambiguous completion
setopt auto_name_dirs # any parameters set to the absolute name of a dir becomes a name for that dir. (useful for using ~ on completions)
setopt auto_param_slash # add / after completing directories
setopt complete_aliases # prevents aliases from being internally substituted before completion is attempted
setopt glob_complete # when the word has a glob pattern, dont insert all the results from the expansion, instead generate matches for completion and cycle through them like MENU_COMPLETE
setopt hash_list_all # hashs the entire command path before attempting completion/correction
setopt menu_complete # on ambiguous completions, instead of listing or beeping, insert the first match immediately. Then when compeltion is request again, remove the first match and insert the second match, etc.
setopt list_packed # make the completion list smaller by printing the matches in columns with different widths


# ZStyles

# The following lines were added by compinstall

zstyle ':completion:*' completer _expand _complete _ignored _match _approximate _expand_alias

zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "$XDG_CACHE_HOME/zsh/.zcompcache"
zstyle :compinstall filename '/home/jhonas/.config/zsh/.comp'

# Complete the alias when _expand_alias is used as a function
zstyle ':completion:*' complete true
zle -C alias-expension complete-word _generic
bindkey '^Xa' alias-expension
zstyle ':completion:alias-expension:*' completer _expand_alias

# Only display some tags for the command cd
zstyle ':completion:*:*:cd:*' tag-order local-directories directory-stack path-directories

zstyle ':completion:*' expand prefix suffix
zstyle ':completion:*' group-name ''
zstyle ':completion:*' ignore-parents parent pwd ..
zstyle ':completion:*:nvim:*' ignored-patterns '(*.(zwc))'
zstyle ':completion:*:nvim:*' file-patterns "%p:globbed-files" "*(-/):directories" "*:all-files"
zstyle ':completion:*' insert-unambiguous true
zstyle ':completion:*' insert-tab true
zstyle ':completion:*' matcher-list 'r:|[._-]=** r:|=**' 'm:{[:lower:]}={[:upper:]} m:{[:lower:][:upper:]}={[:upper:][:lower:]}' 'l:|=* r:|=*'
zstyle ':completion:*' max-errors 2 numeric
zstyle ':completion:*' menu select=3
zstyle ':completion:*' original false
zstyle ':completion:*' preserve-prefix '//[^/]##/'
zstyle ':completion:*' prompt 'Found %e errors in the command you just wrote...'
zstyle ':completion:*' rehash true
zstyle ':completion:*' select-prompt '%SScrolling active: current selection at %p, %l%s'
zstyle ':completion:*' verbose true


# Prettier text
zstyle ':completion:*' format '%F{green}--- %d ---%f'
zstyle ':completion:*' list-prompt '%SAt %p: Hit TAB for more, or the character to insert%s'
zstyle ':completion:*:*:-command-:*:*' format "%F{blue} --- %d ---%f"
zstyle ':completion:*:*:*:*:corrections' format '%F{yellow}--- %d (errors: %e) ---%f'
zstyle ':completion:*:messages' format ' %F{purple} -- %d --%f'
zstyle ':completion:*:warnings' format ' %F{red}-- no matches found --%f'
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}

# Prettier completion for processes
zstyle ':completion:*:*:*:*:processes' force-list always
zstyle ':completion:*:*:*:*:processes' menu yes select
zstyle ':completion:*:*:*:*:processes' list-colors '=(#b) #([0-9]#) ([0-9a-z-]#)*=01;34=0=01'
zstyle ':completion:*:*:*:*:processes' command "ps -u $USER -o pid,user,args -w -w"

zstyle -e ':completion:*:(ssh|scp|sftp|rsh|rsync):hosts' hosts 'reply=(${=${${(f)"$(cat {/etc/ssh_,~/.ssh/known_}hosts(|2)(N) /dev/null)"}%%[# ]*}//,/ })'

# Look at .zfunc for completions
fpath+=$ZDOTDIR/completions

autoload -Uz compinit
compinit
# End of lines added by compinstall

source <(COMPLETE=zsh jj)
