export ZSH_UNCOMMON=1

setopt COMPLETE_ALIASES
compdef _zshz ${ZSHZ_CMD:-${_Z_CMD:-z}}

