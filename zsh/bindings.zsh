# Use terminfo-based keybindings for portability across terminal types
if (( ${+terminfo[kRIT5]} )); then
	bindkey -- "$terminfo[kRIT5]" emacs-forward-word
fi
if (( ${+terminfo[kLFT5]} )); then
	bindkey -- "$terminfo[kLFT5]" emacs-backward-word
fi
