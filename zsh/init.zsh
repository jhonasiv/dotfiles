# Ghostty shell integration - must be at the top
if [ -n "${GHOSTTY_RESOURCES_DIR}" ]; then
    builtin source "${GHOSTTY_RESOURCES_DIR}/shell-integration/zsh/ghostty-integration"
fi

# Must be run before local.zsh
source $ZDOTDIR/environment.zsh

source $ZDOTDIR/aliases.zsh
source $ZDOTDIR/bindings.zsh
source $ZDOTDIR/options.zsh
source $ZDOTDIR/utils.zsh

source $ZDOTDIR/plugins.zsh
source $ZDOTDIR/completions.zsh
source $ZDOTDIR/integrations.zsh

# Enable fancy-ctrl-z
zle -N fancy-ctrl-z
bindkey '^Z' fancy-ctrl-z

# Load local configuration last to allow overrides
source $ZDOTDIR/local.zsh
