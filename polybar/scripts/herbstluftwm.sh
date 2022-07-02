#!/bin/sh


# Multi monitor support. Needs MONITOR environment variable to be set for each instance of polybar
# If MONITOR environment variable is not set this will default to monitor 0
# Check https://github.com/polybar/polybar/issues/763
MON_IDX="0"
mapfile -t MONITOR_LIST < <(polybar --list-monitors | cut -d":" -f1)
for (( i=0; i<$((${#MONITOR_LIST[@]})); i++ )); do
  [[ ${MONITOR_LIST[${i}]} == "$MONITOR" ]] && MON_IDX="$i"
done;

green="#9ece6a"
blue="#7aa2f7"
orange="#e0af68"
foreground="#c0caf5"
lightgray="#565c64"
red="#e06c75"
disabled="#414868"
purple="#a485dd"

herbstclient --idle "tag_*" 2>/dev/null | {

    while true; do
        # Read tags into $tags as array
        IFS=$'\t' read -ra tags <<< "$(herbstclient tag_status "${MON_IDX}")"
        {
            for i in "${tags[@]}" ; do
                text=""
                # Read the prefix from each tag and render them according to that prefix
                case ${i:0:1} in
                    '.')
                        # the tag is empty
                        text="%{F${disabled}}"
                        ;;
                    '+')
                        # tag is viewed on the specified monitor but this monitor is not focused
                        text="%{F${green}}"
                        ;;
                    ':')
                        # tag is not empty
                        text="%{F${blue}}"
                        ;;
                    '#')
                        # tag is viewed on the specified MONITOR and it is focused
                        text="%{F${green}}"
                        ;;
                    '-')
                        # the tag is viewed on a different MONITOR, but this monitor is not focused.
                        text="%{F${orange}}"
                        ;;
                    '%')
                        # the tag is viewed on a different MONITOR and it is focused.
                        text="%{F${orange}}"
                        ;;
                    '!')
                        # the tag contains an urgent window
                        text="%{F${red}}"
                        ;;
                esac

                # focus the monitor of the current bar before switching tags
                [ -z $text ] || echo "%{A1:herbstclient focus_monitor ${MON_IDX}; herbstclient use ${i:1}:} ${text} %{A -u}"
            done

            # reset foreground and background color to default
            echo "%{F-}%{B-}"
        } | tr -d "\n"

    echo

    # wait for next event from herbstclient --idle
    read -r || break
done
} 2>/dev/null
