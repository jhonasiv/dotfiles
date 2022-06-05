#!/usr/bin/sh

[[ $(setxkbmap -query | cut -f2 -d ':' | tail -n 2 | head -n 1 | tr -d ' ' ) == 'us' ]] && setxkbmap br -variant abnt2 -option caps:ctrl_modifier || setxkbmap us -option caps:ctrl_modifier
