if [[ ! -f ~/.zpm/zpm.zsh ]]; then
  git clone --recursive https://github.com/zpm-zsh/zpm ~/.zpm
fi
source ~/.zpm/zpm.zsh

# Plugins for zpm
zpm load @gh/zpm-zsh/zpm-readme
zpm load @gh/zpm-zsh/zpm-info

zpm load @gh/agkozak/zsh-z,async
source $ZDOTDIR/plugins/zsh-z.zsh

# Auto suggestions
zpm load @gh/zsh-users/zsh-autosuggestions,async
source $ZDOTDIR/plugins/zsh-autosuggestions.zsh

zpm load @gh/zdharma-continuum/fast-syntax-highlighting
zpm load @gh/zsh-users/zsh-history-substring-search
source $ZDOTDIR/plugins/zsh-history-substring-search.zsh

zpm load @gh/olets/zsh-abbr
