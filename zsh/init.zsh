# Must be run before local.zsh
source $ZDOTDIR/environment.zsh

source $ZDOTDIR/aliases.zsh
source $ZDOTDIR/bindings.zsh
source $ZDOTDIR/local.zsh
source $ZDOTDIR/options.zsh
source $ZDOTDIR/utils.zsh

source $ZDOTDIR/plugins.zsh
source $ZDOTDIR/completions.zsh
source $ZDOTDIR/integrations.zsh

# Enable fancy-ctrl-z
zle -N fancy-ctrl-z
bindkey '^Z' fancy-ctrl-z
