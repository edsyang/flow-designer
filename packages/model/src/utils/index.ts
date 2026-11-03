import Hotkey from "./hotkey";

export enum DataType {
  Map = "map",
  List = "list",
  Scalar = "scalar",
  Null = "null",
}

export const hotkey = new Hotkey();

function isPlainObject(obj: any): boolean {
  return Object.getPrototypeOf(obj) === Object.prototype;
}

export function testType(data: any): DataType {
  const type = typeof data;

  if (data === null || data === undefined) {
    return DataType.Null;
  } else if (Array.isArray(data)) {
    return DataType.List;
  } else if (type === "object" && isPlainObject(data)) {
    return DataType.Map;
  }

  return DataType.Scalar;
}

export function cloneDeep(src: any): any {
  const type = typeof src;

  let data: any;
  if (src === null || src === undefined) {
    data = src;
  } else if (Array.isArray(src)) {
    data = src.map((item) => cloneDeep(item));
  } else if (type === "object" && isPlainObject(src)) {
    data = {};
    for (const key in src) {
      if (src.hasOwnProperty(key)) {
        data[key] = cloneDeep(src[key]);
      }
    }
  } else {
    data = src;
  }

  return data;
}

export function deepEqual(origin: any, source: any): boolean {
  const ot = testType(origin);
  const st = testType(source);

  if (st === DataType.Scalar || st === DataType.Null) {
    return origin === source;
  }

  if (ot !== st) {
    return false;
  }

  if (st === DataType.List) {
    const ol = origin.length;
    const sl = source.length;
    if (ol !== sl) {
      return false;
    }

    return (source as any[]).every((item: any, index: number) => deepEqual(item, origin[index]));
  }

  if (st === DataType.Map) {
    const oEntries = Object.keys(origin);
    const sEntries = Object.keys(source);

    if (oEntries.length !== sEntries.length) {
      return false;
    }

    const equal = sEntries.every((key) => {
      const ret = deepEqual(origin[key], source[key]);
      if (ret) {
        const i = oEntries.indexOf(key);
        if (i > -1) {
          oEntries.splice(i, 1);
        }
      }
      return ret;
    });

    if (!equal || oEntries.length > 0) {
      return false;
    }

    return true;
  }

  return origin === source;
}

export interface SetDataResult {
  data: any;
  modified: boolean;
}

export function setData(
  origin: any,
  source: any,
  merge: boolean = false,
  cloned: boolean = false,
): SetDataResult {
  const oType = testType(origin);
  const sType = testType(source);
  const result: SetDataResult = {
    data: null,
    modified: false,
  };

  if (sType === DataType.Null) {
    result.modified = sType !== oType;
    return result;
  }

  if (sType === DataType.Scalar) {
    result.data = source;
    result.modified = source !== origin;
    return result;
  }

  if (oType !== sType) {
    result.data = cloned ? source : cloneDeep(source);
    result.modified = true;
    return result;
  }

  if (sType === DataType.List) {
    const ol = origin.length;
    const sl = source.length;
    if (ol !== sl) {
      result.modified = true;
    }
    const maps: any = {};
    (origin as any[]).forEach((item: any, index: number) => {
      maps[getKey(item, index)] = item;
    });
    (source as any[]).forEach((item: any, index: number) => {
      const key = getKey(item, index);
      const ret = setData(maps[key], item, merge);
      if (maps[key] !== origin[index] || ret.modified) {
        result.modified = true;
      }
      origin[index] = ret.data;
    });
    if (ol > sl) {
      (origin as any[]).splice(sl, ol - sl);
    }
    result.data = origin;
    return result;
  }

  if (sType === DataType.Map) {
    const oEntries = Object.keys(origin);
    const sEntries = Object.keys(source);

    sEntries.forEach((key) => {
      const ret = setData(origin[key], source[key], merge, cloned);
      origin[key] = ret.data;
      const i = oEntries.indexOf(key);
      if (i > -1) {
        oEntries.splice(i, 1);
      }
      if (ret.modified) {
        result.modified = true;
      }
    });

    if (oEntries.length > 0) {
      if (!merge) {
        oEntries.forEach((key) => {
          delete origin[key];
        });
        result.modified = true;
      }
    }

    result.data = origin;
    return result;
  }

  return result;
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
export function hasOwn(obj: any, property: string | number | symbol): boolean {
  return obj != null && hasOwnProperty.call(obj, property);
}

const RE_PATH = /(\.\.\/?)?(([^/]*)(?:\/(.*))?)?/;
export function splitPath(path: string) {
  return RE_PATH.exec(path);
}

export function getKey(obj: any, defaultKey: any): string {
  return String((obj && obj[".key"]) || defaultKey);
}

let UID_BASE = Date.now();
export function uniqueId(prefix: string = ""): string {
  if (prefix) {
    prefix += "_";
  }
  return `${prefix}${(UID_BASE++).toString(36).toLowerCase()}`;
}

export function isDev(): boolean {
  return true;
}

export function error(err: any): void {
  isDev() && console.error(err);
}

export function log(info: any): void {
  isDev() && console.log(info);
}

export * from "./scheduler";
