# Set Starship cache and config before initialization
export STARSHIP_CACHE="$ZSH_CACHE_HOME/starship"
export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

# Ensure cache directory exists
[[ -d "$STARSHIP_CACHE" ]] || mkdir -p "$STARSHIP_CACHE"

eval "$(starship init zsh)"

