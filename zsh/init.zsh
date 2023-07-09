# Must be run before local.zsh
source $ZDOTDIR/environment.zsh

source $ZDOTDIR/aliases.zsh
source $ZDOTDIR/bindings.zsh
source $ZDOTDIR/local.zsh
source $ZDOTDIR/options.zsh
source $ZDOTDIR/plugins.zsh
source $ZDOTDIR/utils.zsh

source $ZDOTDIR/completions.zsh

# Setup the starship prompt
source $ZDOTDIR/starship.zsh

# Enable fancy-ctrl-z
zle -N fancy-ctrl-z
bindkey '^Z' fancy-ctrl-z
