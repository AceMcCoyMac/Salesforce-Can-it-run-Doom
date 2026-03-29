// i_net_stub.c - Single-player network stub for Salesforce Doom

#include <stdlib.h>
#include "doomdef.h"
#include "d_net.h"
#include "i_net.h"

// These globals are declared in d_net.c
extern doomcom_t*  doomcom;
extern boolean     netgame;

void I_InitNetwork(void)
{
    // Allocate and initialise a single-player doomcom structure
    doomcom = (doomcom_t*)malloc(sizeof(doomcom_t));
    if (!doomcom)
    {
        // malloc failed — not much we can do
        return;
    }

    doomcom->id          = DOOMCOM_ID;   // magic number the check expects
    doomcom->ticdup      = 1;
    doomcom->extratics   = 0;
    doomcom->consoleplayer = 0;
    doomcom->numnodes    = 1;
    doomcom->numplayers  = 1;
    doomcom->deathmatch  = 0;
    doomcom->episode     = 1;
    doomcom->map         = 1;
    doomcom->skill       = 2;            // Hurt Me Plenty
    doomcom->remotenode  = -1;
    doomcom->command     = 0;
    doomcom->datalength  = 0;

    netgame = false;
}

void I_NetCmd(void) {}
