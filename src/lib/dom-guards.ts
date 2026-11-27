import { z } from "@/lib/zod";
import { createLazyGuard } from "@/lib/zod-guard";

export const isElement = createLazyGuard(() => z.instanceof(Element));
export const isHtmlElement = createLazyGuard(() => z.instanceof(HTMLElement));
export const isVideoElement = createLazyGuard(() => z.instanceof(HTMLVideoElement));
