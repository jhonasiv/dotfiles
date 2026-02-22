# Source Antigen
source $HOME/.config/zsh/plugins/antigen/antigen.zsh

# Load bundles from plugins.txt
antigen bundles < $ZDOTDIR/plugins.txt

# Apply antigen
antigen apply

# Source local plugin settings after plugin load
source $ZDOTDIR/plugins/zsh-autosuggestions.zsh
source $ZDOTDIR/plugins/zsh-history-substring-search.zsh

# Initialize Starship after plugins
source $ZDOTDIR/plugins/starship.zsh
