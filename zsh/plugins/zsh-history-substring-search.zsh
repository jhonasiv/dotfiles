zle -N history-substring-search-up
zle -N history-substring-search-down

# Use terminfo-based keybindings for portability across terminal types
if (( ${+terminfo[kcuu1]} )); then
	bindkey -- "$terminfo[kcuu1]" history-substring-search-up
fi
if (( ${+terminfo[kcud1]} )); then
	bindkey -- "$terminfo[kcud1]" history-substring-search-down
fi
