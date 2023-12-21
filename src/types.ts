import type { Operation } from "@trpc/client";

export type ExtendedOperation = Operation | { type: "unsubscription", id: number };

export interface PortLike {
	postMessage(message: any): void;
	onmessage: null | ((ev: MessageEvent<any>) => void);
}
