if [[ -f "$CARGO_HOME/env" ]]; then
	source $CARGO_HOME/env
fi

export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"

# Lazy-load pyenv on first invocation
_pyenv_init() {
	eval "$(pyenv init - zsh)"
	eval "$(pyenv virtualenv-init -)"
	unset -f _pyenv_init
}

pyenv() {
	_pyenv_init
	pyenv "$@"
}

export PATH=$PATH:/opt/lua-language-server/bin
export PATH=$HOME/.opencode/bin:$PATH

# Export opencode related environment variables
set -a
[[ -f "$HOME/dev/containers/opencode/.env" ]] && source "$HOME/dev/containers/opencode/.env"
set +a

# Cabin completions
fpath+=$HOME/.local/share/cabin/completions/zsh
