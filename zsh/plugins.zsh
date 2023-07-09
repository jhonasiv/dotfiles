if [[ ! -f ~/.zpm/zpm.zsh ]]; then
  git clone --recursive https://github.com/zpm-zsh/zpm ~/.zpm
fi
source ~/.zpm/zpm.zsh

# Plugins for zpm
zpm load zpm-zsh/zpm-readme
zpm load zpm-zsh/zpm-info

zpm load agkozak/zsh-z,async
#zpm load zsh-users/zsh-history-substring-search,async,

# Auto suggestions
zpm load zsh-users/zsh-autosuggestions,async
source $ZDOTDIR/plugins/zsh-autosuggestions.zsh

zpm load zdharma-continuum/fast-syntax-highlighting
zpm load zsh-users/zsh-history-substring-search
source $ZDOTDIR/plugins/zsh-history-substring-search.zsh
