#! /usr/bin/zsh

# Terminate already running bar instance
polybar-msg cmd quit

# Launch bar1
echo "---" | tee -a /tmp/polybar1.log
polybar bar1 2>&1 | tee -a /tmp/polybar1.log & disown
