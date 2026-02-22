# Source antidote
source $HOME/.config/zsh/antidote/antidote.zsh

# Load plugins from plugins file
antidote load $ZDOTDIR/.zsh_plugins.txt

# Source local plugin settings after plugin load
source $ZDOTDIR/plugins/zsh-autosuggestions.zsh
source $ZDOTDIR/plugins/zsh-history-substring-search.zsh

# Initialize Starship after plugins
source $ZDOTDIR/plugins/starship.zsh
