source $ZDOTDIR/.zpm/zpm.zsh

# Plugins for zpm
zpm load @gh/zpm-zsh/zpm-readme
zpm load @gh/zpm-zsh/zpm-info

# Auto suggestions
zpm load @gh/zsh-users/zsh-autosuggestions,async

zpm load @gh/zdharma-continuum/fast-syntax-highlighting
zpm load @gh/zsh-users/zsh-history-substring-search

zpm load @gh/olets/zsh-abbr

source $ZDOTDIR/plugins/starship.zsh
