if [[ -f "$CARGO_HOME/env" ]]; then
	source $CARGO_HOME/env
fi

export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init - zsh)"

# Restart your shell for the changes to take effect.

# Load pyenv-virtualenv automatically by adding
# the following to ~/.bashrc:

eval "$(pyenv virtualenv-init -)"

export PATH=$PATH:/opt/lua-language-server/bin
export PATH=$HOME/.opencode/bin:$PATH

# Ghostty shell integration for Bash. This should be at the top of your zsh!
if [ -n "${GHOSTTY_RESOURCES_DIR}" ]; then
    builtin source "${GHOSTTY_RESOURCES_DIR}/shell-integration/zsh/ghostty-integration"
fi

# Export opencode related environment variables
export $(cat $HOME/dev/containers/opencode/.env | xargs)

# Cabin completions
fpath+=/home/jhonas/.local/share/cabin/completions/zsh
autoload -Uz compinit && compinit 2>/dev/null || true
