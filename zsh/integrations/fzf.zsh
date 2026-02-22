# fzf integration
if (( $+commands[fzf] )); then
  source <(fzf --zsh)
  
  # jj log fuzzy finder widget - Ctrl+G, Ctrl+J
  jj-log-widget() {
    local selected=$(jj log --no-graph --template 'change_id.short() ++ " " ++ description.first_line()' 2>/dev/null | \
      fzf --height 40% --reverse | cut -d' ' -f1)
    if [[ -n "$selected" ]]; then
      LBUFFER="${LBUFFER}${selected}"
      zle redisplay
    fi
  }
  zle -N jj-log-widget
  bindkey '^g^j' jj-log-widget
fi
