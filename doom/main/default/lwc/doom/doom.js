import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import DOOM_ENGINE from '@salesforce/resourceUrl/DoomEngine';
import DOOM_WAD from '@salesforce/resourceUrl/DoomWAD';

export default class Doom extends LightningElement {
    @track loading = true;
    @track statusText = 'Initialising engine...';

    engineLoaded = false;

    connectedCallback() {
        // Load the compiled Doom asm.js engine
        loadScript(this, DOOM_ENGINE)
            .then(() => {
                this.statusText = 'Engine loaded. Fetching WAD...';
                return fetch(DOOM_WAD);
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch WAD file');
                this.statusText = 'WAD downloaded. Starting game...';
                return response.arrayBuffer();
            })
            .then(wadBuffer => {
                this._startDoom(wadBuffer);
            })
            .catch(error => {
                this.statusText = 'Error: ' + error.message;
                console.error('[DOOM] Load error:', error);
            });
    }

    _startDoom(wadBuffer) {
        const canvas = this.refs.gameCanvas;

        // eslint-disable-next-line no-undef
        const module = createDoom({
            canvas: canvas,
            noInitialRun: true,
            preRun: [() => {
                // Write the WAD into the Emscripten virtual filesystem
                // eslint-disable-next-line no-undef
                module.FS.createDataFile(
                    '/',
                    'doom1.wad',
                    new Uint8Array(wadBuffer),
                    true,
                    true
                );
            }],
            onRuntimeInitialized: () => {
                this.loading = false;
                canvas.focus();
                // Start Doom: shareware episode 1, windowed, no music, no GUI
                // eslint-disable-next-line no-undef
                module.callMain([
                    '-iwad',    'doom1.wad',
                    '-window',
                    '-nogui',
                    '-nomusic',
                    '-episode', '1'
                ]);
            },
            print: (text) => {
                console.log('[DOOM]', text);
                if (text && text.startsWith('doom:')) {
                    this.statusText = text;
                }
            },
            printErr: (text) => {
                console.error('[DOOM ERR]', text);
            },
            setStatus: (text) => {
                if (text) this.statusText = text;
            }
        });
    }

    preventContext(event) {
        event.preventDefault();
    }
}
