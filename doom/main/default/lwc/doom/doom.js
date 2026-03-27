import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import DOOM_ENGINE from '@salesforce/resourceUrl/DoomEngine';
import DOOM_WAD from '@salesforce/resourceUrl/DoomWAD';

export default class Doom extends LightningElement {
    @track loading = true;
    @track statusText = 'Initialising engine...';

    // Prevent multiple instances from fighting each other in the Lightning tab
    _started = false;

    connectedCallback() {
        if (this._started) return;
        this._started = true;

        loadScript(this, DOOM_ENGINE)
            .then(() => {
                this.statusText = 'Engine loaded. Fetching WAD...';
                return fetch(DOOM_WAD);
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch WAD: ' + response.status);
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
        const wadBytes = new Uint8Array(wadBuffer);
        const self = this;

        // Emscripten SDL2 needs the canvas element accessible by querySelector('#canvas').
        // LWC shadow DOM hides it, so we attach it to document temporarily via a
        // lightweight bridge: override Module.canvas directly so SDL finds it.
        // eslint-disable-next-line no-undef
        createDoom({
            canvas: canvas,
            noInitialRun: true,

            // preRun receives the module instance as its argument
            preRun: [function(mod) {
                try {
                    mod.FS.createDataFile('/', 'doom1.wad', wadBytes, true, true);
                } catch(e) {
                    console.error('[DOOM] FS error:', e);
                    self.statusText = 'FS error: ' + e.message;
                }
            }],

            onRuntimeInitialized: function() {
                const mod = this;
                console.log('[DOOM] Runtime initialised, calling main...');
                self.loading = false;

                // Give the DOM a tick to remove the loading overlay before starting
                setTimeout(function() {
                    canvas.focus();
                    try {
                        mod.callMain([
                            '-iwad',    'doom1.wad',
                            '-window',
                            '-nogui',
                            '-nomusic',
                            '-config',  'default.cfg',
                            '-nodemo'
                        ]);
                    } catch(e) {
                        // callMain with asyncify throws "unwind" intentionally — that's OK
                        if (e !== 'unwind' && e !== 'RuntimeError: unreachable') {
                            console.error('[DOOM] callMain error:', e);
                            self.statusText = 'Runtime error: ' + String(e).substring(0, 120);
                        }
                    }
                }, 100);
            },

            print: function(text) {
                if (text) console.log('[DOOM]', text);
            },

            printErr: function(text) {
                if (text) {
                    console.error('[DOOM ERR]', text);
                    // Only show meaningful errors, not the routine SDL/GL chatter
                    if (text.indexOf('Error') !== -1 || text.indexOf('Warning') !== -1) {
                        self.statusText = String(text).substring(0, 120);
                    }
                }
            },

            setStatus: function(text) {
                if (text) {
                    console.log('[DOOM status]', text);
                    self.statusText = text;
                }
            }
        });
    }

    preventContext(event) {
        event.preventDefault();
    }
}
