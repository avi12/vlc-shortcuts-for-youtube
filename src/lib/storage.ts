import { storage } from "#imports";

export const isEnabledItem = storage.defineItem<boolean>("local:isEnabled", { fallback: true });
