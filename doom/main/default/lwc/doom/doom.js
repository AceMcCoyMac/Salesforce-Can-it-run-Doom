import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import DOOM_ENGINE from '@salesforce/resourceUrl/DoomEngine';
import DOOM_WAD from '@salesforce/resourceUrl/DoomWAD';

const BUILD_MARKER = 'DXA-2026-03-29-02';

export default class Doom extends LightningElement {
    @track loading = true;
    @track statusText = 'Initialising engine...';

    // Prevent multiple instances from fighting each other in the Lightning tab
    _started = false;
    _bootWatchdogId;
    _bootPhase = 'init';
    _boundUnhandledRejection;
    _boundWindowError;

    get buildMarker() {
        return BUILD_MARKER;
    }

    connectedCallback() {
        if (this._started) return;
        this._started = true;
        console.log('[DOOM] Build marker:', BUILD_MARKER);
        this._installGlobalDiagnostics();
        this._setBootPhase('Loading engine script...');

        loadScript(this, DOOM_ENGINE)
            .then(() => {
                this._setBootPhase('Engine loaded. Fetching WAD...');
                return fetch(DOOM_WAD);
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch WAD: ' + response.status);
                const contentType = response.headers.get('content-type') || 'unknown';
                const contentLength = response.headers.get('content-length') || 'unknown';
                console.log('[DOOM] WAD response headers:', { contentType, contentLength });
                this._setBootPhase('WAD downloaded. Starting game...');
                return response.arrayBuffer();
            })
            .then(wadBuffer => {
                this._validateWad(wadBuffer);
                return this._startDoom(wadBuffer);
            })
            .catch(error => {
                this.statusText = 'Error: ' + error.message;
                console.error('[DOOM] Load error:', error);
            });
    }

    disconnectedCallback() {
        this._clearBootWatchdog();

        if (this._boundUnhandledRejection) {
            try {
                window.removeEventListener('unhandledrejection', this._boundUnhandledRejection);
            } catch (error) {
                console.warn('[DOOM] Could not remove unhandledrejection listener:', error.message);
            }
            this._boundUnhandledRejection = undefined;
        }

        if (this._boundWindowError) {
            try {
                window.removeEventListener('error', this._boundWindowError);
            } catch (error) {
                console.warn('[DOOM] Could not remove window error listener:', error.message);
            }
            this._boundWindowError = undefined;
        }
    }

    _installGlobalDiagnostics() {
        this._boundUnhandledRejection = event => {
            const reason = event.reason?.stack || event.reason?.message || String(event.reason);
            console.error('[DOOM] Unhandled promise rejection:', reason);
            this.statusText = 'Unhandled rejection: ' + String(reason).substring(0, 120);
        };

        this._boundWindowError = event => {
            const message = event.error?.stack || event.message || 'Unknown window error';
            console.error('[DOOM] Window error:', message);
            this.statusText = 'Window error: ' + String(message).substring(0, 120);
        };

        try {
            window.addEventListener('unhandledrejection', this._boundUnhandledRejection);
        } catch (error) {
            console.warn('[DOOM] Skipping unhandledrejection listener:', error.message);
        }

        try {
            window.addEventListener('error', this._boundWindowError);
        } catch (error) {
            console.warn('[DOOM] Skipping window error listener:', error.message);
        }
    }

    _setBootPhase(message) {
        this._bootPhase = message;
        this.statusText = message;
        console.log('[DOOM boot]', message);
    }

    _startBootWatchdog() {
        this._clearBootWatchdog();
        this._bootWatchdogId = window.setTimeout(() => {
            const timeoutMessage = `Boot stalled after: ${this._bootPhase}`;
            console.error('[DOOM] Boot watchdog fired:', timeoutMessage);
            this.statusText = timeoutMessage;
        }, 12000);
    }

    _clearBootWatchdog() {
        if (this._bootWatchdogId) {
            window.clearTimeout(this._bootWatchdogId);
            this._bootWatchdogId = undefined;
        }
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

    async _startDoom(wadBuffer) {
        const canvas = this.refs.gameCanvas;
        const wadBytes = new Uint8Array(wadBuffer);
        const self = this;
        this._setBootPhase('Initialising Emscripten runtime...');
        this._startBootWatchdog();
        await this._yieldForPaint();
        this._setBootPhase('Creating Doom runtime...');
        await this._yieldForPaint();

        this._launchDoomRuntime(canvas, wadBytes, self);
    }

    _yieldForPaint() {
        return new Promise(resolve => {
            window.requestAnimationFrame(() => {
                window.setTimeout(resolve, 0);
            });
        });
    }

    _launchDoomRuntime(canvas, wadBytes, self) {
        if (typeof createDoom !== 'function') {
            this._clearBootWatchdog();
            this.statusText = 'Bootstrap error: createDoom is not available';
            console.error('[DOOM] createDoom factory is missing after loadScript().');
            return;
        }

        // Emscripten SDL2 needs the canvas element accessible by querySelector('#canvas').
        // LWC shadow DOM hides it, so we attach it to document temporarily via a
        // lightweight bridge: override Module.canvas directly so SDL finds it.
        try {
            // eslint-disable-next-line no-undef
            createDoom({
                canvas: canvas,
                noInitialRun: true,

                // preRun receives the module instance as its argument
                preRun: [function(mod) {
                    try {
                        self._setBootPhase('preRun: mounting WAD...');
                        // Classic Doom auto-detects ./doom1.wad. Make the virtual FS explicit.
                        mod.FS.chdir('/');
                        mod.FS.writeFile('/doom1.wad', wadBytes);
                        mod.FS.writeFile('/default.cfg', '');
                        console.log('[DOOM] WAD mounted in FS:', mod.FS.stat('/doom1.wad').size, 'bytes');
                        self._setBootPhase('preRun complete. Waiting for runtime...');
                    } catch(e) {
                        console.error('[DOOM] FS error:', e);
                        self.statusText = 'FS error: ' + e.message;
                    }
                }],

                onRuntimeInitialized: function() {
                    const mod = this;
                    self._clearBootWatchdog();
                    self._setBootPhase('Runtime initialised. Launching Doom...');
                    console.log('[DOOM] Runtime initialised, calling main...');
                    self.loading = false;

                    // Give the DOM a tick to remove the loading overlay before starting
                    setTimeout(function() {
                        canvas.focus();
                        try {
                            self._setBootPhase('Calling Doom main()...');
                            mod.callMain([
                                '-window',
                                '-nogui',
                                '-nomusic',
                                '-config',  'default.cfg',
                                '-nodemo'
                            ]);
                            self._setBootPhase('Doom main() returned.');
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
                self._clearBootWatchdog();
                console.error('[DOOM] Runtime bootstrap error:', error);
                self.statusText = 'Bootstrap error: ' + error.message;
            });
        } catch (error) {
            self._clearBootWatchdog();
            console.error('[DOOM] Synchronous runtime bootstrap error:', error);
            self.statusText = 'Bootstrap error: ' + error.message;
        }
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
