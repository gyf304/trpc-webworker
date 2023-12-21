/// <reference lib="dom" />

import { TRPCClientError, type Operation, type TRPCLink } from "@trpc/client";
import { transformResult } from "@trpc/client/shared";
import { AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { TRPCResponseMessage } from "@trpc/server/rpc";
import { PortLike } from "./types";

export function workerLink<TRouter extends AnyRouter>(port: PortLike): TRPCLink<TRouter> {
	const pendingRequests = new Map<number, { resolve: (value: TRPCResponseMessage) => void }>();
	port.onmessage = (event: MessageEvent<TRPCResponseMessage>) => {
		const message = event.data;
		if (typeof message.id !== "number") {
			return;
		}
		const pendingRequest = pendingRequests.get(message.id);
		if (!pendingRequest) {
			return;
		}
		pendingRequests.delete(message.id);
		pendingRequest.resolve(message);
	};
	return (runtime) => {
		return ({op}) => {
			return observable((observer) => {
				const { type, path, id, context } = op;
				const input = runtime.transformer.serialize(op.input);
				const serializedOp: Operation = { type, path, id, input, context };
				const resultPromise = new Promise<TRPCResponseMessage>((resolve) => {
					pendingRequests.set(id, { resolve });
				});
				port.postMessage(serializedOp);

				(async () => {
					const result = await resultPromise;
					const transformed = transformResult(result, runtime);
					if (transformed.ok) {
						observer.next(transformed);
						if (op.type !== "subscription") {
							observer.complete();
						}
					} else {
						observer.error(TRPCClientError.from(transformed.error));
						observer.complete();
					}
				})();

				return () => {
					if (op.type === "subscription") {
						port.postMessage({ type: "unsubscription", id });
					}
				};
			});
		};
	};
}
