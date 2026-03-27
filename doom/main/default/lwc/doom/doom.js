import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import DOOM_ENGINE from '@salesforce/resourceUrl/DoomEngine';
import DOOM_WAD from '@salesforce/resourceUrl/DoomWAD';

export default class Doom extends LightningElement {
    @track loading = true;
    @track statusText = 'Initialising engine...';

    connectedCallback() {
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
        // eslint-disable-next-line no-undef
        const self = this;

        // IMPORTANT: preRun callbacks receive the module object as an argument,
        // so we don't rely on the return value of createDoom() being available yet.
        // eslint-disable-next-line no-undef
        createDoom({
            canvas: canvas,
            noInitialRun: true,

            preRun: [function(mod) {
                // mod is the module object, safe to use here
                mod.FS.createDataFile('/', 'doom1.wad', wadBytes, true, true);
            }],

            onRuntimeInitialized: function() {
                // 'this' here is the module object
                try {
                    self.loading = false;
                    canvas.focus();
                    this.callMain([
                        '-iwad',    'doom1.wad',
                        '-window',
                        '-nogui',
                        '-nomusic',
                        '-episode', '1'
                    ]);
                } catch(e) {
                    self.statusText = 'Runtime error: ' + e.message;
                    console.error('[DOOM] callMain error:', e);
                }
            },

            print: function(text) {
                if (text) {
                    console.log('[DOOM]', text);
                    if (text.startsWith('doom:')) {
                        self.statusText = text;
                    }
                }
            },

            printErr: function(text) {
                if (text) {
                    console.error('[DOOM ERR]', text);
                    // Surface engine errors to the UI
                    self.statusText = 'Engine: ' + text.substring(0, 120);
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
