if ! (( $+commands[exa] )); then
  return 1
fi

exa_params=('--git' '--classify' '--group-directories-first' '--time-style=long-iso' '--group' '--color-scale')

alias ls='exa ${exa_params}'
alias l='exa --git-ignore ${exa_params}'
alias ll='exa --all --header --long ${exa_params}'
alias llm='exa --all --header --long --sort=modified ${exa_params}'
alias la='exa -lbhHigUmuSa'
alias lx='exa -lbhHigUmuSa@'
alias lt='exa --tree'
alias tree='exa --tree'
