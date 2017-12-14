#!/bin/bash
if [ "x$1" == "x" ]; then
	echo "argument expected";
	exit;
fi

ACK_TYPES="--type js --type less --type css --type json"
ack  --color --nogroup  ${ACK_TYPES}  "$@" ./styles/ ./menus/ ./keymaps/ ./spec/ ./lib/  |egrep -v  "^[[:cntrl:]]\[1;[0-9][0-9](\w|\/|\-|\.|\_\@)+[[:cntrl:]]\[0m:[[:cntrl:]]\[1;[0-9][0-9]m[0-9]+[[:cntrl:]]\[0m:\s*\/\/"
#|egrep  -v "^(\w|\/|\-|\.|\_\@)+:[0-9]+:\s*\/\/"
