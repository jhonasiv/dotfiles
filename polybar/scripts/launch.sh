#! /usr/bin/zsh

let "mon = $MONITOR + 2"

monitor=$(xrandr --listmonitors | sed "${mon}q;d" | cut -d' ' -f6)

MONITOR=$monitor polybar --reload mainbar &
