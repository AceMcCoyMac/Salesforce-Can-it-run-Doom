// i_video_sdl.c - SDL2/Emscripten video backend for Salesforce Doom
// Replaces Linux framebuffer i_video.c with SDL2 canvas rendering

#include <SDL2/SDL.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "doomstat.h"
#include "i_system.h"
#include "i_video.h"
#include "v_video.h"
#include "d_main.h"
#include "doomdef.h"
#include "m_argv.h"

// Doom renders at 320x200 internally
#define DOOMWIDTH  320
#define DOOMHEIGHT 200
#define SCALE      2

static SDL_Window*   window   = NULL;
static SDL_Renderer* renderer = NULL;
static SDL_Texture*  texture  = NULL;

// The 256-color palette Doom uses
static SDL_Color palette[256];
// 32bpp pixel buffer we blit to the texture
static uint32_t pixels[DOOMWIDTH * DOOMHEIGHT];

void I_InitGraphics(void)
{
    if (SDL_Init(SDL_INIT_VIDEO) < 0) {
        fprintf(stderr, "SDL_Init failed: %s\n", SDL_GetError());
        exit(1);
    }

    window = SDL_CreateWindow(
        "Doom",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        DOOMWIDTH * SCALE, DOOMHEIGHT * SCALE,
        SDL_WINDOW_SHOWN
    );
    if (!window) {
        fprintf(stderr, "SDL_CreateWindow failed: %s\n", SDL_GetError());
        exit(1);
    }

    renderer = SDL_CreateRenderer(window, -1,
        SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (!renderer) {
        renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_SOFTWARE);
    }

    texture = SDL_CreateTexture(renderer,
        SDL_PIXELFORMAT_ARGB8888,
        SDL_TEXTUREACCESS_STREAMING,
        DOOMWIDTH, DOOMHEIGHT);

    // screens[0] is Doom's internal 320x200 framebuffer
    screens[0] = (unsigned char*)malloc(DOOMWIDTH * DOOMHEIGHT);
    if (!screens[0]) {
        fprintf(stderr, "Failed to allocate screen buffer\n");
        exit(1);
    }
}

void I_SetPalette(byte* palette_data)
{
    // Doom palettes are 768 bytes: 256 RGB triplets
    for (int i = 0; i < 256; i++) {
        palette[i].r = *palette_data++;
        palette[i].g = *palette_data++;
        palette[i].b = *palette_data++;
        palette[i].a = 255;
    }
}

void I_UpdateNoBlit(void) {}

void I_FinishUpdate(void)
{
    // Convert 8bpp paletted → 32bpp ARGB
    for (int i = 0; i < DOOMWIDTH * DOOMHEIGHT; i++) {
        uint8_t idx = screens[0][i];
        pixels[i] = (0xFF000000)
                  | (palette[idx].r << 16)
                  | (palette[idx].g << 8)
                  | (palette[idx].b);
    }

    SDL_UpdateTexture(texture, NULL, pixels, DOOMWIDTH * sizeof(uint32_t));
    SDL_RenderClear(renderer);
    SDL_RenderCopy(renderer, texture, NULL, NULL);
    SDL_RenderPresent(renderer);
}

/* void I_WaitVBL(int count) - defined in i_system.c */

void I_ReadScreen(byte* scr)
{
    memcpy(scr, screens[0], DOOMWIDTH * DOOMHEIGHT);
}

/* void I_BeginRead(void) - defined in i_system.c */
/* void I_EndRead(void) - defined in i_system.c */

void I_ShutdownGraphics(void)
{
    if (texture)  SDL_DestroyTexture(texture);
    if (renderer) SDL_DestroyRenderer(renderer);
    if (window)   SDL_DestroyWindow(window);
    SDL_Quit();
}
