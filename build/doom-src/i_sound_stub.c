// i_sound_stub.c - Full no-op sound/music/input implementation for Salesforce Doom

#include "doomdef.h"
#include "doomstat.h"
#include "i_sound.h"
#include "i_system.h"
#include "s_sound.h"

// Global sound/music volume variables (referenced by d_main.c / menus)
int snd_SfxVolume  = 0;
int snd_MusicVolume = 0;

// ---------- Sound effects ----------
void I_InitSound()   {}
void I_ShutdownSound()  {}
int  I_StartSound(int id, int vol, int sep, int pitch, int priority) { return -1; }
void I_StopSound(int handle) {}
int  I_SoundIsPlaying(int handle) { return 0; }
void I_UpdateSoundParams(int handle, int vol, int sep, int pitch) {}
void I_SubmitSound() {}

// ---------- Music ----------
void I_InitMusic()    {}
void I_ShutdownMusic() {}
void I_PlaySong(int handle, int looping) {}
void I_PauseSong(int handle) {}
void I_ResumeSong(int handle) {}
void I_StopSong(int handle) {}
int  I_RegisterSong(void* data) { return 0; }
void I_UnRegisterSong(int handle) {}
int  I_QrySongPlaying(int handle) { return 0; }
void I_SetMusicVolume(int volume) {}

// ---------- High-level sound (s_sound.c replacement stubs) ----------
void S_Init(int sfxVolume, int musicVolume) {}
void S_StartSound(void* origin, int sfx_id) {}
void S_StartMusic(int music_id) {}
void S_PauseSound() {}
void S_ResumeSound() {}
void S_UpdateSounds(void* listener) {}

// ---------- Input tick (called by main loop) ----------
// Reads keyboard/mouse events via SDL and posts them to Doom's event queue
#include <SDL2/SDL.h>
#include "d_event.h"
#include "d_main.h"

static int translateKey(SDL_Keycode sym)
{
    switch (sym) {
        case SDLK_LEFT:      return KEY_LEFTARROW;
        case SDLK_RIGHT:     return KEY_RIGHTARROW;
        case SDLK_UP:        return KEY_UPARROW;
        case SDLK_DOWN:      return KEY_DOWNARROW;
        case SDLK_ESCAPE:    return KEY_ESCAPE;
        case SDLK_RETURN:    return KEY_ENTER;
        case SDLK_TAB:       return KEY_TAB;
        case SDLK_F1:        return KEY_F1;
        case SDLK_F2:        return KEY_F2;
        case SDLK_F3:        return KEY_F3;
        case SDLK_F4:        return KEY_F4;
        case SDLK_F5:        return KEY_F5;
        case SDLK_F6:        return KEY_F6;
        case SDLK_F7:        return KEY_F7;
        case SDLK_F8:        return KEY_F8;
        case SDLK_F9:        return KEY_F9;
        case SDLK_F10:       return KEY_F10;
        case SDLK_F11:       return KEY_F11;
        case SDLK_F12:       return KEY_F12;
        case SDLK_BACKSPACE: return KEY_BACKSPACE;
        case SDLK_PAUSE:     return KEY_PAUSE;
        case SDLK_EQUALS:    return KEY_EQUALS;
        case SDLK_MINUS:     return KEY_MINUS;
        case SDLK_LSHIFT:
        case SDLK_RSHIFT:    return KEY_RSHIFT;
        case SDLK_LCTRL:
        case SDLK_RCTRL:     return KEY_RCTRL;
        case SDLK_LALT:
        case SDLK_RALT:      return KEY_RALT;
        case SDLK_SPACE:     return ' ';
        default:
            if (sym >= SDLK_a && sym <= SDLK_z)
                return sym - SDLK_a + 'a';
            if (sym >= SDLK_0 && sym <= SDLK_9)
                return sym - SDLK_0 + '0';
            return 0;
    }
}

void I_StartFrame(void) {}

void I_StartTic(void)
{
    SDL_Event e;
    event_t   doom_event;

    while (SDL_PollEvent(&e)) {
        switch (e.type) {
            case SDL_KEYDOWN:
            case SDL_KEYUP: {
                int key = translateKey(e.key.keysym.sym);
                if (key) {
                    doom_event.type = (e.type == SDL_KEYDOWN) ? ev_keydown : ev_keyup;
                    doom_event.data1 = key;
                    D_PostEvent(&doom_event);
                }
                break;
            }
            case SDL_MOUSEBUTTONDOWN:
            case SDL_MOUSEBUTTONUP: {
                doom_event.type = (e.type == SDL_MOUSEBUTTONDOWN) ? ev_keydown : ev_keyup;
                doom_event.data1 = (e.button.button == SDL_BUTTON_LEFT)   ? 1 :
                                   (e.button.button == SDL_BUTTON_RIGHT)  ? 2  : 0;
                if (doom_event.data1)
                    D_PostEvent(&doom_event);
                break;
            }
            case SDL_QUIT:
                I_Quit();
                break;
            default:
                break;
        }
    }
}

// Additional S_ stubs needed by linker
void S_StopSound(void* origin) {}
void S_Start(void) {}
void S_ChangeMusic(int musicnum, int looping) {}
void S_SetSfxVolume(int volume) { snd_SfxVolume = volume; }
void S_SetMusicVolume(int volume) { snd_MusicVolume = volume; }

// Variables referenced by m_misc.c
char* sndserver_filename = "sndserver";
int   numChannels = 0;
