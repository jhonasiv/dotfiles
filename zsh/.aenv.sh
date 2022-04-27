function aenv() {
    dir=$PWD
    while test "x$dir" != "x/"; do
        basename=`basename "$dir"`
        if test "$basename" != '.autoproj' && test -f "$dir/env.sh"; then
            echo "sourcing $dir/env.sh"
            source "$dir/env.sh"
            break
        fi
        dir=`dirname "$dir"`
    done

    if test "x$dir" = "x/"; then
        if test "x$AUTOPROJ_CURRENT_ROOT" = "x"; then
            echo "found no env.sh file to load in $PWD"
			return 1
        else
            source $AUTOPROJ_CURRENT_ROOT/env.sh
			return 0
        fi
    fi
}
function autosetup_aenv() {
	dir=$PWD
	[[ $AENV_AUTOSETUP ]] && aenv || cd $AENV_DEFAULT_WORKSPACE && aenv && cd - > /dev/null
}


export AENV_DEFAULT_WORKSPACE="$HOME/dev/wetpaint-274"
export AENV_AUTOSETUP
