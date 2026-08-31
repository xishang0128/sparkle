#!/usr/bin/bash

XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-~/.config}

if [[ -f "${XDG_CONFIG_HOME}/sparkle-flags.conf" ]]; then
    mapfile -t SPARKLE_USER_FLAGS <<<"$(grep -v '^#' "${XDG_CONFIG_HOME}/sparkle-flags.conf")"
    echo "User flags:" "${SPARKLE_USER_FLAGS[@]}"
fi

exec /opt/sparkle/sparkle "${SPARKLE_USER_FLAGS[@]}" "$@"
