# Set Starship cache and config before initialization
export STARSHIP_CACHE="${ZSH_CACHE_HOME:-$HOME/.cache/zsh}/starship"
export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

# Ensure cache directory exists
if [[ ! -d "$STARSHIP_CACHE" ]]; then
	mkdir -p "$STARSHIP_CACHE" 2>/dev/null || true
fi

eval "$(starship init zsh)"

