#!/bin/bash
# build.sh - Compile Doom C source → asm.js for Salesforce LWC
# Target: E1M1 only, no sound, no network, no save/load

set -e

SRC="./doom-src"
OUT="./out"
mkdir -p "$OUT"

# All C files we're compiling
# Excludes: i_sound.c (replaced by stub), i_net.c (stub), i_video.c (replaced by SDL)
SOURCES=(
  # Core engine
  $SRC/d_main.c
  $SRC/doomdef.c
  $SRC/doomstat.c

  # Renderer
  $SRC/r_bsp.c
  $SRC/r_data.c
  $SRC/r_draw.c
  $SRC/r_main.c
  $SRC/r_plane.c
  $SRC/r_segs.c
  $SRC/r_sky.c
  $SRC/r_things.c

  # Game logic
  $SRC/g_game.c
  $SRC/p_ceilng.c
  $SRC/p_doors.c
  $SRC/p_enemy.c
  $SRC/p_floor.c
  $SRC/p_inter.c
  $SRC/p_lights.c
  $SRC/p_map.c
  $SRC/p_maputl.c
  $SRC/p_mobj.c
  $SRC/p_plats.c
  $SRC/p_pspr.c
  $SRC/p_saveg.c
  $SRC/p_setup.c
  $SRC/p_sight.c
  $SRC/p_spec.c
  $SRC/p_switch.c
  $SRC/p_telept.c
  $SRC/p_tick.c
  $SRC/p_user.c

  # WAD / data
  $SRC/w_wad.c
  $SRC/z_zone.c
  $SRC/info.c
  $SRC/tables.c
  $SRC/sounds.c
  $SRC/d_items.c

  # UI / HUD
  $SRC/st_lib.c
  $SRC/st_stuff.c
  $SRC/hu_lib.c
  $SRC/hu_stuff.c
  $SRC/am_map.c
  $SRC/m_menu.c

  # Misc utilities
  $SRC/m_argv.c
  $SRC/m_bbox.c
  $SRC/m_cheat.c
  $SRC/m_fixed.c
  $SRC/m_misc.c
  $SRC/m_random.c
  $SRC/m_swap.c
  $SRC/v_video.c
  $SRC/f_finale.c
  $SRC/f_wipe.c
  $SRC/wi_stuff.c
  $SRC/dstrings.c
  $SRC/d_net.c

  # Entry point
  $SRC/i_main.c

  # Platform layer (our replacements)
  $SRC/i_system.c
  $SRC/i_video_sdl.c
  $SRC/i_sound_stub.c
  $SRC/i_net_stub.c
)

echo "🔨 Compiling Doom → asm.js..."
echo "Source files: ${#SOURCES[@]}"

emcc "${SOURCES[@]}" \
  -I"$SRC" \
  -s WASM=0 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createDoom' \
  -s EXPORTED_RUNTIME_METHODS='["callMain","FS"]' \
  -s EXPORTED_FUNCTIONS='["_main"]' \
  -s TOTAL_MEMORY=16777216 \
  -s ALLOW_MEMORY_GROWTH=0 \
  -s NO_EXIT_RUNTIME=1 \
  -s USE_SDL=2 \
  -s ASYNCIFY=1 \
  -O2 \
  --closure 0 \
  -DNORMALUNIX \
  -DLINUX \
  -DDISABLE_NET \
  -o "$OUT/doom-engine.js" \
  2>&1

echo ""
echo "✅ Build complete!"
echo "Output size:"
wc -c "$OUT/doom-engine.js" | awk '{printf "  doom-engine.js: %.2f MB\n", $1/1048576}'
