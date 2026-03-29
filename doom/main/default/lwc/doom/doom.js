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
                const contentType = response.headers.get('content-type') || 'unknown';
                const contentLength = response.headers.get('content-length') || 'unknown';
                console.log('[DOOM] WAD response headers:', { contentType, contentLength });
                this.statusText = 'WAD downloaded. Starting game...';
                return response.arrayBuffer();
            })
            .then(wadBuffer => {
                this._validateWad(wadBuffer);
                this._startDoom(wadBuffer);
            })
            .catch(error => {
                this.statusText = 'Error: ' + error.message;
                console.error('[DOOM] Load error:', error);
            });
    }

    _validateWad(wadBuffer) {
        const wadBytes = new Uint8Array(wadBuffer);
        const magic = String.fromCharCode(...wadBytes.slice(0, 4));

        console.log('[DOOM] WAD validation:', {
            byteLength: wadBytes.length,
            magic
        });

        if (magic !== 'IWAD' && magic !== 'PWAD') {
            throw new Error(
                `Fetched file is not a Doom WAD. Header was "${magic || 'empty'}" (${wadBytes.length} bytes)`
            );
        }
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
                    // Classic Doom auto-detects ./doom1.wad. Make the virtual FS explicit.
                    mod.FS.chdir('/');
                    mod.FS.writeFile('/doom1.wad', wadBytes);
                    mod.FS.writeFile('/default.cfg', '');
                    console.log('[DOOM] WAD mounted in FS:', mod.FS.stat('/doom1.wad').size, 'bytes');
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
        }).catch(error => {
            console.error('[DOOM] Runtime bootstrap error:', error);
            self.statusText = 'Bootstrap error: ' + error.message;
        });
    }

    preventContext(event) {
        event.preventDefault();
    }

    handleCanvasFocus() {
        const canvas = this.refs.gameCanvas;
        if (canvas) {
            canvas.focus();
        }
    }

    handleCanvasKey(event) {
        const gameplayKeys = new Set([
            ' ',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'Tab',
            'Shift',
            'Control',
            'Alt'
        ]);

        if (gameplayKeys.has(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.type === 'keydown' && event.key === ' ') {
                window.__doomUseQueued = true;
                window.__doomForceUse = true;
                window.__doomForceUseDirect = true;
            }
            this._forwardKeyEvent(event);
        }
    }

    _forwardKeyEvent(event) {
        const forwarded = new KeyboardEvent(event.type, {
            key: event.key,
            code: event.code,
            location: event.location,
            repeat: event.repeat,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            bubbles: true,
            cancelable: true
        });

        try {
            Object.defineProperty(forwarded, 'keyCode', { value: event.keyCode || event.which || 0 });
            Object.defineProperty(forwarded, 'which', { value: event.which || event.keyCode || 0 });
        } catch (e) {
            // Some browsers won't let us redefine these legacy fields. That's fine.
        }

        document.dispatchEvent(forwarded);
        window.dispatchEvent(forwarded);
    }
}
