interface KeyMap {
  [key: number]: string;
}

interface CtrlKeyMap {
  [key: string]: string;
}

interface ActionEvent {
  type: string;
}

interface HotkeyCallbacks {
  [key: string]: HotkeyCallbackCfg[];
}

interface HotkeyDirectMap {
  [key: string]: HotkeyCallback;
}

/** Only an explicit false return cancels the native event; other results are ignored. */
export type HotkeyCallback = (e: KeyboardEvent, combo?: string) => unknown;

interface HotkeyCallbackCfg {
  callback: HotkeyCallback;
  modifiers: string[];
  action: string;
  seq?: string;
  level?: number;
  combo?: string;
}

interface KeyInfo {
  key: string;
  modifiers: string[];
  action: string;
}

interface SequenceLevels {
  [key: string]: number;
}

const MAP: KeyMap = {
  8: "backspace",
  9: "tab",
  13: "enter",
  16: "shift",
  17: "ctrl",
  18: "alt",
  20: "capslock",
  27: "esc",
  32: "space",
  33: "pageup",
  34: "pagedown",
  35: "end",
  36: "home",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  45: "ins",
  46: "del",
  91: "meta",
  93: "meta",
  224: "meta",
};

const KEYCODE_MAP: KeyMap = {
  106: "*",
  107: "+",
  109: "-",
  110: ".",
  111: "/",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'",
};

const SHIFT_MAP: CtrlKeyMap = {
  "~": "`",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
  _: "-",
  "+": "=",
  ":": ";",
  '\"': "'",
  "<": ",",
  ">": ".",
  "?": "/",
  "|": "\\",
};

const platform: unknown =
  typeof navigator === "undefined" ? "" : Reflect.get(navigator, "platform");

const SPECIAL_ALIASES: CtrlKeyMap = {
  option: "alt",
  command: "meta",
  return: "enter",
  escape: "esc",
  plus: "+",
  mod: typeof platform === "string" && /Mac|iPod|iPhone|iPad/.test(platform) ? "meta" : "ctrl",
};

let REVERSE_MAP: CtrlKeyMap | undefined;

/**
 * loop through the f keys, f1 to f19 and add them to the map
 * programatically
 */
for (let i = 1; i < 20; ++i) {
  MAP[111 + i] = `f${String(i)}`;
}

/**
 * loop through to map numbers on the numeric keypad
 */
for (let i = 0; i <= 9; ++i) {
  MAP[i + 96] = String(i);
}

/**
 * takes the event and returns the key character
 */
function characterFromEvent(e: KeyboardEvent): string {
  // Retain legacy event support without assuming untrusted reflected values are numeric.
  const code: unknown = Reflect.get(e, "keyCode");
  const which: unknown = Reflect.get(e, "which");
  const keyCode = (typeof code === "number" ? code : 0) || (typeof which === "number" ? which : 0);
  // for keypress events we should return the character as is
  if (e.type === "keypress") {
    let character = String.fromCharCode(keyCode);
    // if the shift key is not pressed then it is safe to assume
    // that we want the character to be lowercase.  this means if
    // you accidentally have caps lock on then your key bindings
    // will continue to work
    //
    // the only side effect that might not be desired is if you
    // bind something like 'A' cause you want to trigger an
    // event when capital A is pressed caps lock will no longer
    // trigger the event.  shift+a will though.
    if (!e.shiftKey) {
      character = character.toLowerCase();
    }
    return character;
  }
  // for non keypress events the special maps are needed
  if (MAP[keyCode]) {
    return MAP[keyCode];
  }
  if (KEYCODE_MAP[keyCode]) {
    return KEYCODE_MAP[keyCode];
  }
  // if it is not in the special map
  // with keydown and keyup events the character seems to always
  // come in as an uppercase character whether you are pressing shift
  // or not.  we should make sure it is always lowercase for comparisons
  return String.fromCharCode(keyCode).toLowerCase();
}

interface KeypressEvent extends KeyboardEvent {
  type: "keypress";
}

function isPressEvent(e: KeyboardEvent | ActionEvent): e is KeypressEvent {
  return e.type === "keypress";
}

/**
 * checks if two arrays are equal
 *
 * @param {Array} modifiers1
 * @param {Array} modifiers2
 * @returns {boolean}
 */
function modifiersMatch(modifiers1: string[], modifiers2: string[]): boolean {
  return modifiers1.sort().join(",") === modifiers2.sort().join(",");
}

/**
 * takes a key event and figures out what the modifiers are
 *
 * @param {Event} e
 * @returns {Array}
 */
function eventModifiers(e: KeyboardEvent): string[] {
  const modifiers = [];

  if (e.shiftKey) {
    modifiers.push("shift");
  }

  if (e.altKey) {
    modifiers.push("alt");
  }

  if (e.ctrlKey) {
    modifiers.push("ctrl");
  }

  if (e.metaKey) {
    modifiers.push("meta");
  }

  return modifiers;
}

/**
 * determines if the keycode specified is a modifier key or not
 *
 * @param {string} key
 * @returns {boolean}
 */
function isModifier(key: string): boolean {
  return key === "shift" || key === "ctrl" || key === "alt" || key === "meta";
}

/**
 * reverses the map lookup so that we can look for specific keys
 * to see what can and can't use keypress
 *
 * @return {Object}
 */
function getReverseMap(): CtrlKeyMap {
  if (!REVERSE_MAP) {
    REVERSE_MAP = {};
    for (const key in MAP) {
      // pull out the numeric keypad from here cause keypress should
      // be able to detect the keys from the character
      if (Number(key) > 95 && Number(key) < 112) {
        continue;
      }

      const character = MAP[Number(key)];
      if (Object.prototype.hasOwnProperty.call(MAP, key) && character !== undefined) {
        REVERSE_MAP[character] = key;
      }
    }
  }
  return REVERSE_MAP;
}

/**
 * picks the best action based on the key combination
 *
 * @param {string} key - character for key
 * @param {Array} modifiers
 * @param {string=} action passed in
 */
function pickBestAction(key: string, modifiers: string[], action?: string): string {
  // if no action was picked in we should try to pick the one
  // that we think would work best for this key
  if (!action) {
    action = getReverseMap()[key] ? "keydown" : "keypress";
  }
  // modifier keys don't work as expected with keypress,
  // switch to keydown
  if (action === "keypress" && modifiers.length) {
    action = "keydown";
  }
  return action;
}

/**
 * Converts from a string key combination to an array
 *
 * @param  {string} combination like "command+shift+l"
 * @return {Array}
 */
function keysFromString(combination: string): string[] {
  if (combination === "+") {
    return ["+"];
  }

  combination = combination.replace(/\+{2}/g, "+plus");
  return combination.split("+");
}

/**
 * Gets info for a specific key combination
 *
 * @param  {string} combination key combination ("command+s" or "a" or "*")
 * @param  {string=} action
 * @returns {Object}
 */
function getKeyInfo(combination: string, action?: string): KeyInfo {
  let keys: string[] = [];
  let key: string = "";
  const modifiers: string[] = [];

  // take the keys from this pattern and figure out what the actual
  // pattern is all about
  keys = keysFromString(combination);

  for (const item of keys) {
    key = item;

    // normalize key names
    const alias = SPECIAL_ALIASES[key];
    if (alias) key = alias;

    // if this is not a keypress event then we should
    // be smart about using shift keys
    // this will only work for US keyboards however
    const shifted = SHIFT_MAP[key];
    if (action && action !== "keypress" && shifted) {
      key = shifted;
      modifiers.push("shift");
    }

    // if this key is a modifier then add it to the list of modifiers
    if (isModifier(key)) {
      modifiers.push(key);
    }
  }

  // depending on what the key combination is
  // we will try to pick the best event for it
  action = pickBestAction(key, modifiers, action);

  return {
    key,
    modifiers,
    action,
  };
}

/**
 * actually calls the callback function
 *
 * if your callback function returns false this will use the jquery
 * convention - prevent default and stop propogation on the event
 *
 * @param {Function} callback
 * @param {Event} e
 * @returns void
 */
function fireCallback(
  callback: HotkeyCallback,
  e: KeyboardEvent,
  combo?: string,
  _sequence?: string,
): void {
  if (callback(e, combo) === false) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export default class Hotkey {
  private listeners = new Map<
    Document,
    { count: number; handler: (event: KeyboardEvent) => void }
  >();
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private callBacks: HotkeyCallbacks = {};
  private directMap: HotkeyDirectMap = {};
  private sequenceLevels: SequenceLevels = {};
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private ignoreNextKeyup: boolean | string = false;
  private ignoreNextKeypress: boolean = false;
  private nextExpectedAction: boolean | string = false;

  /**
   * init
   * @param window: window
   */
  init(window: Window): () => void {
    const document = window.document;
    let entry = this.listeners.get(document);
    if (!entry) {
      entry = { count: 0, handler: this.handleKeyEvent.bind(this) };
      this.listeners.set(document, entry);
      for (const event of ["keypress", "keydown", "keyup"])
        document.addEventListener(event, entry.handler as EventListener);
    }
    entry.count++;
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (--entry.count > 0) return;
      for (const event of ["keypress", "keydown", "keyup"])
        document.removeEventListener(event, entry.handler as EventListener);
      this.listeners.delete(document);
      if (!this.listeners.size) {
        if (this.resetTimer) clearTimeout(this.resetTimer);
        if (this.completionTimer) clearTimeout(this.completionTimer);
        this.resetSequences();
      }
    };
  }

  bindScoped(
    combos: string[] | string,
    callback: HotkeyCallback,
    scope: () => HTMLElement | null,
    action?: string,
  ): () => void {
    const wrapped: HotkeyCallback = (event, combo) => {
      const container = scope();
      if (!container || !(event.target instanceof Node) || !container.contains(event.target))
        return;
      return callback(event, combo);
    };
    this.bind(combos, wrapped, action);
    return () => {
      this.unbind(combos, wrapped, action);
    };
  }

  unbind(combos: string[] | string, callback?: HotkeyCallback, action?: string): void {
    for (const combo of Array.isArray(combos) ? combos : [combos]) {
      for (const key of Object.keys(this.callBacks)) {
        this.callBacks[key] = (this.callBacks[key] ?? []).filter((entry) => {
          const matches =
            (entry.combo === combo || entry.seq === combo) &&
            (!action || entry.action === action) &&
            (!callback ||
              entry.callback === callback ||
              (entry.seq === combo && this.directMap[`${combo}:${String(action)}`] === callback));
          return !matches;
        });
      }
      const directKey = `${combo}:${String(action)}`;
      if (!callback || this.directMap[directKey] === callback)
        Reflect.deleteProperty(this.directMap, directKey);
      Reflect.deleteProperty(this.sequenceLevels, combo);
    }
  }

  /**
   * bind
   * @param {combos} string[]|string
   * @param {callback} function
   * @param {action=} string
   */
  bind(combos: string[] | string, callback: HotkeyCallback, action?: string): this {
    this.bindMultiple(Array.isArray(combos) ? combos : [combos], callback, action);
    return this;
  }

  /**
   * resets all sequence counters except for the ones passed in
   *
   * @param {Object} doNotReset
   * @returns void
   */
  private resetSequences(doNotReset?: SequenceLevels): void {
    // doNotReset = doNotReset || {};
    let activeSequences: boolean = false;
    let key: string = "";
    for (key in this.sequenceLevels) {
      if (doNotReset && doNotReset[key]) {
        activeSequences = true;
      } else {
        this.sequenceLevels[key] = 0;
      }
    }
    if (!activeSequences) {
      this.nextExpectedAction = false;
    }
  }

  /**
   * finds all callbacks that match based on the keycode, modifiers,
   * and action
   *
   * @param {string} character
   * @param {Array} modifiers
   * @param {Event|Object} e
   * @param {string=} sequenceName - name of the sequence we are looking for
   * @param {string=} combination
   * @param {number=} level
   * @returns {Array}
   */
  private getMatches(
    character: string,
    modifiers: string[],
    e: KeyboardEvent | ActionEvent,
    sequenceName?: string,
    combination?: string,
    level?: number,
  ): HotkeyCallbackCfg[] {
    let i: number;
    const matches: HotkeyCallbackCfg[] = [];
    const action: string = e.type;

    // if there are no events related to this keycode
    const candidates = this.callBacks[character];
    if (!candidates) {
      return [];
    }

    // if a modifier key is coming up on its own we should allow it
    if (action === "keyup" && isModifier(character)) {
      modifiers = [character];
    }

    // loop through all callbacks for the key that was pressed
    // and see if any of them match
    for (i = 0; i < candidates.length; ++i) {
      const callback = candidates[i];
      if (!callback) continue;

      // if a sequence name is not specified, but this is a sequence at
      // the wrong level then move onto the next match
      if (!sequenceName && callback.seq && this.sequenceLevels[callback.seq] !== callback.level) {
        continue;
      }

      // if the action we are looking for doesn't match the action we got
      // then we should keep going
      if (action !== callback.action) {
        continue;
      }

      // if this is a keypress event and the meta key and control key
      // are not pressed that means that we need to only look at the
      // character, otherwise check the modifiers as well
      //
      // chrome will not fire a keypress if meta or control is down
      // safari will fire a keypress if meta or meta+shift is down
      // firefox will fire a keypress if meta or control is down
      if (
        (isPressEvent(e) && !e.metaKey && !e.ctrlKey) ||
        modifiersMatch(modifiers, callback.modifiers)
      ) {
        const deleteCombo = !sequenceName && callback.combo === combination;
        const deleteSequence =
          sequenceName && callback.seq === sequenceName && callback.level === level;
        if (deleteCombo || deleteSequence) {
          candidates.splice(i, 1);
        }

        matches.push(callback);
      }
    }
    return matches;
  }

  private handleKey(character: string, modifiers: string[], e: KeyboardEvent): void {
    const callbacks: HotkeyCallbackCfg[] = this.getMatches(character, modifiers, e);
    const doNotReset: SequenceLevels = {};
    let maxLevel: number = 0;
    let processedSequenceCallback: boolean = false;

    // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
    for (const callback of callbacks) {
      if (callback.seq) {
        maxLevel = Math.max(maxLevel, callback.level || 0);
      }
    }

    // loop through matching callbacks for this key event
    for (const callback of callbacks) {
      // fire for all sequence callbacks
      // this is because if for example you have multiple sequences
      // bound such as "g i" and "g t" they both need to fire the
      // callback for matching g cause otherwise you can only ever
      // match the first one
      if (callback.seq) {
        // only fire callbacks for the maxLevel to prevent
        // subsequences from also firing
        //
        // for example 'a option b' should not cause 'option b' to fire
        // even though 'option b' is part of the other sequence
        //
        // any sequences that do not match here will be discarded
        // below by the resetSequences call
        if (callback.level !== maxLevel) {
          continue;
        }

        processedSequenceCallback = true;

        // keep a list of which sequences were matches for later
        doNotReset[callback.seq || ""] = 1;
        fireCallback(callback.callback, e, callback.combo, callback.seq);
        continue;
      }

      // if there were no sequence matches but we are still here
      // that means this is a regular match so we should fire that
      if (!processedSequenceCallback) {
        fireCallback(callback.callback, e, callback.combo);
      }
    }

    const ignoreThisKeypress = e.type === "keypress" && this.ignoreNextKeypress;
    if (e.type === this.nextExpectedAction && !isModifier(character) && !ignoreThisKeypress) {
      this.resetSequences(doNotReset);
    }

    this.ignoreNextKeypress = processedSequenceCallback && e.type === "keydown";
  }

  private handleKeyEvent(e: KeyboardEvent): void {
    if (e.isComposing || e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"], [role="textbox"]')
      ) {
        return;
      }
    }

    const character = characterFromEvent(e);

    // no character found then stop
    if (!character) {
      return;
    }

    // need to use === for the character check because the character can be 0
    if (e.type === "keyup" && this.ignoreNextKeyup === character) {
      this.ignoreNextKeyup = false;
      return;
    }

    this.handleKey(character, eventModifiers(e), e);
  }

  private resetSequenceTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => {
      this.resetSequences();
    }, 1000);
  }

  private bindSequence(
    combo: string,
    keys: string[],
    callback: HotkeyCallback,
    action?: string,
  ): void {
    // const self: any = this;
    this.sequenceLevels[combo] = 0;
    const increaseSequence = (nextAction: string) => {
      return () => {
        this.nextExpectedAction = nextAction;
        this.sequenceLevels[combo] = Number(this.sequenceLevels[combo]) + 1;
        this.resetSequenceTimer();
      };
    };
    const callbackAndReset = (e: KeyboardEvent): void => {
      fireCallback(callback, e, combo);

      if (action !== "keyup") {
        this.ignoreNextKeyup = characterFromEvent(e);
      }

      if (this.completionTimer) clearTimeout(this.completionTimer);
      this.completionTimer = setTimeout(() => {
        this.resetSequences();
      }, 10);
    };
    for (let i = 0; i < keys.length; ++i) {
      const currentKey = keys[i];
      if (currentKey === undefined) continue;
      const nextKey = keys[i + 1];
      const isFinal = i + 1 === keys.length;
      const wrappedCallback = isFinal
        ? callbackAndReset
        : increaseSequence(action || getKeyInfo(nextKey ?? "").action);
      this.bindSingle(currentKey, wrappedCallback, action, combo, i);
    }
  }

  private bindSingle(
    combination: string,
    callback: HotkeyCallback,
    action?: string,
    sequenceName?: string,
    level?: number,
  ): void {
    // store a direct mapped reference for use with HotKey.trigger
    this.directMap[`${combination}:${String(action)}`] = callback;

    // make sure multiple spaces in a row become a single space
    combination = combination.replace(/\s+/g, " ");

    const sequence: string[] = combination.split(" ");

    // if this pattern is a sequence of keys then run through this method
    // to reprocess each pattern one key at a time
    if (sequence.length > 1) {
      this.bindSequence(combination, sequence, callback, action);
      return;
    }

    const info: KeyInfo = getKeyInfo(combination, action);

    // make sure to initialize array if this is the first time
    // a callback is added for this key
    const callbacks = this.callBacks[info.key] ?? [];
    this.callBacks[info.key] = callbacks;

    // remove an existing match if there is one
    this.getMatches(
      info.key,
      info.modifiers,
      { type: info.action },
      sequenceName,
      combination,
      level,
    );

    // add this call back to the array
    // if it is a sequence put it at the beginning
    // if not put it at the end
    //
    // this is important because the way these are processed expects
    // the sequence ones to come first
    callbacks[sequenceName ? "unshift" : "push"]({
      callback,
      modifiers: info.modifiers,
      action: info.action,
      seq: sequenceName,
      level,
      combo: combination,
    });
  }

  private bindMultiple(combinations: string[], callback: HotkeyCallback, action?: string) {
    for (const item of combinations) {
      this.bindSingle(item, callback, action);
    }
  }
}
