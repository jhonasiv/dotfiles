alias vim=nvim

# mkdir
alias md="mkdir -p"

# ls
alias ls="ls --color=auto --sort=extension"
alias la="ls -A --color=auto --sort=extension"
alias ll="ls -l --color=auto --sort=extension"

# Git (minimal - jj is primary)
alias g="git"
alias gst="git status"
alias ga="git add"
alias gb="git branch"
alias gc="git commit -v"
alias gca="git commit -a -v"
alias gco="git checkout"
alias gp="git push"
alias grup="git remote update"
alias grupp="git remote update -p"

# jj (Jujutsu) - Primary VCS
alias j="jj"
alias js="jj status"
alias jc="jj commit"
alias jd="jj diff"
alias jl="jj log"
alias jla="jj log -r 'all()'"
alias jgp="jj git push"
alias jgf="jj git fetch"
alias jb="jj bookmark"
alias jbm="jj bookmark move"
alias jbe="jj bookmark forget"
alias jco="jj new"
alias jab="jj abandon"
alias jsh="jj show"
alias jop="jj op log"
alias jev="jj evolog"
alias jsp="jj split"
alias jsq="jj squash"
alias jre="jj rebase"
alias jrs="jj resolve"

# Zoxide
alias zz="zi"

#fd-find
alias fd="fdfind"
