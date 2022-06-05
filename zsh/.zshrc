# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.config/zsh/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi


if [ -z "$ZSH_COMPDUMP" ]; then
		ZSH_COMPDUMP="${ZDOTDIR:-$HOME}/.zcompdump-${SHORT_HOST}-${ZSH_VERSION}"
fi

setopt AUTO_CD
setopt AUTO_PUSHD
setopt PUSHD_IGNORE_DUPS
setopt ALWAYS_TO_END
setopt AUTO_LIST
setopt AUTO_NAME_DIRS
setopt AUTO_PARAM_SLASH
setopt COMPLETE_ALIASES
setopt GLOB_COMPLETE
setopt MENU_COMPLETE
setopt EXTENDED_GLOB
setopt GLOB_STAR_SHORT
setopt HIST_SUBST_PATTERN
setopt NULL_GLOB
setopt APPEND_HISTORY
setopt EXTENDED_HISTORY
setopt HIST_IGNORE_SPACE
setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_NO_STORE
setopt HIST_REDUCE_BLANKS
setopt SHARE_HISTORY
setopt ALIASES
setopt HASH_LIST_ALL
setopt INTERACTIVE_COMMENTS
setopt PATH_DIRS
setopt PATH_SCRIPT
setopt monitor
setopt LONG_LIST_JOBS
setopt interactive
setopt zle
setopt PROMPTSUBST
unsetopt completealiases




#---------------------
# Load antigen plugins
export ADOTDIR=$ZDOTDIR/antigen
export ANTIGEN_AUTO_CONFIG=false
typeset -a ANTIGEN_CHECK_FILES=($ZDOTDIR $ZDOTDIR/antigen)
source $ZDOTDIR/antigen.zsh

# Load oh-my-zsh repository
antigen use oh-my-zsh

antigen bundle command-not-found
antigen bundle zdharma-continuum/fast-syntax-highlighting
antigen bundle qoomon/zsh-lazyload
antigen bundle zsh-users/zsh-autosuggestions

antigen bundle docker

# You should use alias hinting
# antigen bundle "MichaelAquilina/zsh-you-should-use"

# git aliases
antigen bundle mdumitru/git-aliases

# Vim like recording macros
antigen bundle cal2195/q

# autoupdate antigen
antigen bundle unixorn/autoupdate-antigen.zshplugin

# fzf completion for zsh
antigen bundle Aloxaf/fzf-tab

# Create .in and .out files to be run when entering or exiting a folder
antigen bundle zpm-zsh/autoenv

# Auto-closes, deletes or skips over any matching delimiters
antigen bundle hlissner/zsh-autopair

# Use gitit to open git folder on web
antigen bundle peterhurford/git-it-on.zsh

antigen bundle agkozak/zsh-z

# Expand aliases (aka abbr)
antigen bundle olets/zsh-abbr

# FZF for Z
antigen bundle wookayin/fzf-fasd

#--- THEMES ---
antigen theme romkatv/powerlevel10k


antigen apply
#------------------

fpath+=$ZDOTDIR/.zfunc

# Enable vi mode
#bindkey -v 

# Use CTRL-Z to go back to foreground process
fancy-ctrl-z () {
  if [[ $#BUFFER -eq 0 ]]; then
    BUFFER="fg"
    zle accept-line
  else
    zle push-input
    zle clear-screen
  fi
}
zle -N fancy-ctrl-z
bindkey '^Z' fancy-ctrl-z

export EDITOR=nvim
#source $HOME/.profile

# Inicializa FZF
[ -f /usr/share/fzf/completion.zsh ] && source /usr/share/fzf/completion.zsh
[ -f /usr/share/fzf/key-bindings.zsh ] && source /usr/share/fzf/key-bindings.zsh
export FZF_DEFAULT_COMMAND='fd --type file --hidden --follow'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
eval "$(fasd --init auto)"


# To customize prompt, run `p10k configure` or edit ~/.config/zsh/.p10k.zsh.
[[ ! -f $ZDOTDIR/.p10k.zsh ]] || source $ZDOTDIR/.p10k.zsh

# Temporary fix for systemctl completion
_systemctl_unit_state()
{
		typeset -gA _sys_unit_state
		_sys_unit_state=($(__systemctl list-unit-files "$PREFIX*" | awk '{print $1, $2}'))
}

#autoload -U up-line-or-beginning-search
#autoload -U down-line-or-beginning-search
#zle -N up-line-or-beginning-search
#zle -N down-line-or-beginning-search
#bindkey "^[OA" up-line-or-beginning-search # Up
#bindkey "^[OB" down-line-or-beginning-search # Down

# Use up and down arrow to complete from command history
# bindkey '^[OA' history-beginning-search-backward
# bindkey '^[OB' history-beginning-search-forward

alias grb='GIT_EDITOR="code --wait" git rebase -i'
export XDG_CONFIG_HOME=$HOME/.config

alias tmuxx='tmux -f $XDG_CONFIG_HOME/tmux/tmux.conf'

alias vim='nvim'

alias hc='herbstclient "$@"'

# EXA aliases
source $HOME/.config/zsh/exa-aliases.zsh

# FZF tab configs
source $HOME/.config/zsh/fzf-tab.zsh

# Use bat to colorize man pages
export MANPAGER="sh -c 'col -bx | bat -l man -p'"

# Set brave as default browser
export BROWSER="brave-browser"
