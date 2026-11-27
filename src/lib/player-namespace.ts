import { z } from "@/lib/zod";
import { createGuard, isMethod } from "@/lib/zod-guard";

// The global YouTube's player script (base.js) declares and fills with its component classes:
// `var _yt_player={};(function(g){...})(_yt_player)`
const YOUTUBE_PLAYER_NAMESPACE = "_yt_player";

declare global {

  var _yt_player: unknown;
}

export type PlayerNamespace = Record<string, unknown>;

type NamespaceCallback = (namespace: PlayerNamespace) => void;

const namespaceSchema = z.record(z.string(), z.unknown());
const namespaceCallbacks: NamespaceCallback[] = [];
let caughtNamespace: PlayerNamespace | null = null;
let isCatcherInstalled = false;

function notifyNamespace(namespace: unknown) {
  const parsed = namespaceSchema.safeParse(namespace);
  if (!parsed.success) {
    return;
  }

  caughtNamespace = parsed.data;
  for (const callback of namespaceCallbacks.splice(0)) {
    callback(parsed.data);
  }
}

function installCatcher() {
  if (globalThis._yt_player) {
    notifyNamespace(globalThis._yt_player);
    return;
  }

  // Runs at document_start, before base.js: the accessor catches base.js assigning the namespace, hands it
  // straight back as a plain value, and reads it once base.js has finished filling it in
  Object.defineProperty(globalThis, YOUTUBE_PLAYER_NAMESPACE, {
    configurable: true,
    set(namespace: unknown) {
      Object.defineProperty(globalThis, YOUTUBE_PLAYER_NAMESPACE, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: namespace
      });
      queueMicrotask(() => notifyNamespace(namespace));
    }
  });
}

export function onPlayerNamespace(callback: NamespaceCallback) {
  if (caughtNamespace) {
    callback(caughtNamespace);
    return;
  }

  namespaceCallbacks.push(callback);

  if (isCatcherInstalled) {
    return;
  }

  isCatcherInstalled = true;
  installCatcher();
}

const isFunctionObject = createGuard(z.instanceof(Function));

// A minified class is told apart by what its code is made of, which no schema can express, so the caller's check
// decides and the class is typed as what that check stands for
export function createClassGuard<Class>(isMatch: (value: unknown) => boolean) {
  return (value: unknown): value is Class => isFunctionObject(value) && isMatch(value);
}

// A component's minified members are reached by name. No schema: a loose one would read every property, getters
// included
function isIndexable(target: object): target is Record<string, unknown> {
  return target !== null;
}

function readPrototype(value: unknown) {
  if (!isFunctionObject(value)) {
    return null;
  }

  const prototype: unknown = value.prototype;
  const isObjectPrototype = typeof prototype === "object" && prototype !== null;
  return isObjectPrototype ? prototype : null;
}

// Reads a method the object may inherit, where readOwnFunction only sees the object's own
export function readMethod({ target, name }: {
  target: object;
  name: string;
}) {
  const method = isIndexable(target) ? target[name] : null;
  return isMethod(method) ? method : null;
}

export function writeMethod({ target, name, method }: {
  target: object;
  name: string;
  method: (...parameters: unknown[]) => unknown;
}) {
  if (isIndexable(target)) {
    target[name] = method;
  }
}

// Reads a property without running a getter, so probing a minified component is free of side effects
export function readOwnFunction({ target, name }: {
  target: object;
  name: string;
}) {
  const method: unknown = Object.getOwnPropertyDescriptor(target, name)?.value;
  return isMethod(method) ? method : null;
}

function readOwnMethodNames(prototype: object) {
  return Object.getOwnPropertyNames(prototype).filter(name => name !== "constructor");
}

function readSource(value: unknown) {
  return isMethod(value) ? value.toString() : "";
}

// A class's own source plus its methods': what it is made of, as opposed to what the compiler called it
function readClassSource(value: unknown) {
  const prototype = readPrototype(value);
  if (!prototype) {
    return "";
  }

  const methodSources = readOwnMethodNames(prototype).map(name => readSource(
    readOwnFunction({
      target: prototype,
      name
    })
  ));
  return [readSource(value), ...methodSources].join("");
}

// Every minified name changes with each player release, so a component is identified by what its code carries:
// the CSS class names YouTube's stylesheet pins, and the method names the compiler keeps
export function hasSourceMarkers({ value, markers }: {
  value: unknown;
  markers: readonly string[];
}) {
  const source = readSource(value);
  return markers.every(marker => source.includes(marker));
}

export function hasClassSourceMarkers({ value, markers }: {
  value: unknown;
  markers: readonly string[];
}) {
  const source = readClassSource(value);
  return markers.every(marker => source.includes(marker));
}

export function hasOwnMethods({ value, methodNames }: {
  value: unknown;
  methodNames: readonly string[];
}) {
  const prototype = readPrototype(value);
  return prototype !== null && methodNames.every(name => readOwnFunction({
    target: prototype,
    name
  }) !== null);
}

export function findOwnMethodName({ prototype, markers, excluded = [] }: {
  prototype: object;
  markers: readonly string[];
  excluded?: readonly string[];
}) {
  return readOwnMethodNames(prototype).find(name => !excluded.includes(name) && hasSourceMarkers({
    value: readOwnFunction({
      target: prototype,
      name
    }),
    markers
  })) ?? null;
}
