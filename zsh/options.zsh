setopt aliases # expand aliases
setopt append_history # append zsh's history list to the history file
setopt auto_cd # if a command cant be executed and is the name of a directory, perform cd to that directory
setopt auto_pushd # make cd push to old dir to the directory stack (see pushd and popd)
setopt extended_glob # treat `#', `~' and `^' as part of patterns for filename generation
setopt glob_star_short # abbrs **/* to ** and ***/* to *** (follows symbolic links)
setopt hist_expire_dups_first # trims the oldest history event that has a dup before losing a unique event
setopt hist_ignore_all_dups # removes older command from the history list when a dup is added
setopt hist_ignore_space # ignore commands that start with space
setopt hist_no_store # dont store the hist command in the history file
setopt hist_reduce_blanks # remove superfluous blanks from each command being added
setopt hist_subst_pattern # substitutions using the :s and :& hist modifiers are performed with pattern matching instead of string matching
setopt interactive # sets the shell as interactive
setopt interactive_comments # allow comments in interactive shells
setopt long_list_jobs # print job notifications in the long format
setopt null_glob # if a pattern for filename generation has no matches, delete the pattern from the argument list instead of reporting an error
setopt path_dirs # perform a path search even on command names with slashes in them
setopt path_script # a script does not need to specify a directory path to the shell, it is first looked in the current directory, then in the command path.
setopt prompt_subst # parameter expansion, command substitution and arithmetic expansion are performed in prompts
setopt pushd_ignore_dups # dont push multiple copies of the same directory onto the dir stack
setopt share_history # both imports new commands from the history file and causes your typed commands to be appended to the history file (see INC_APPEND_HISTORY).
unsetopt beep # disables beeping

# Use XDG_STATE_HOME for history file per XDG Base Directory spec
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
[[ ! -d "$XDG_STATE_HOME" ]] && mkdir -p "$XDG_STATE_HOME"
HISTFILE="$XDG_STATE_HOME/zsh/history"
[[ ! -d "${HISTFILE%/*}" ]] && mkdir -p "${HISTFILE%/*}"
HISTSIZE=100000
SAVEHIST=80000
if (( ${+commands[nvim]} )); then
    EDITOR=nvim
elif (( ${+commands[vim]} )); then
    EDITOR=vim
else
    EDITOR=vi
fi
export EDITOR
