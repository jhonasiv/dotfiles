fancy-ctrl-z () {
	if [[ $#BUFFER -eq 0 ]]; then
		BUFFER="fg"
		zle accept-line
	else
		zle push-input
		zle clear-screen
	fi
}

# Switch to jj change by partial description match
jjs() {
	local query="$1"
	local change_id=$(jj log --no-graph -r 'description(~"'$query'")' --template 'change_id.short()' | head -1)
	if [[ -n "$change_id" ]]; then
		jj new "$change_id"
	else
		echo "No change found matching: $query"
		return 1
	fi
}
