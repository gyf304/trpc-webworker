/// <reference lib="webworker" />

import { AnyRouter, callProcedure, getTRPCErrorFromUnknown, inferRouterContext } from "@trpc/server";
import { Unsubscribable, isObservable } from "@trpc/server/observable";
import type { ExtendedOperation, PortLike } from "./types";
import type { TRPCResponseMessage } from "@trpc/server/rpc";
import { getErrorShape, transformTRPCResponse } from "@trpc/server/shared";

export type CreateMessageHandlerOptions<TRouter extends AnyRouter> = {
	router: TRouter;
	createContext: () => inferRouterContext<TRouter>;
}

export function attach<TRouter extends AnyRouter>(port: PortLike, opts: CreateMessageHandlerOptions<TRouter>) {
	const unsubMap = new Map<string, Unsubscribable>();
	const postMessage = port.postMessage.bind(port);

	port.onmessage = async (event: MessageEvent<ExtendedOperation>) => {
		const router = opts.router;
		const origin = event.origin;

		const ctx = opts.createContext();
		const op = event.data;
		const internalId = `${origin}:${op.id}`;

		if (op.type === "unsubscription") {
			unsubMap.get(internalId)?.unsubscribe();
			return;
		}

		const respond = (response: TRPCResponseMessage) => {
			postMessage(transformTRPCResponse(router._def._config, response));
		};

		const respondError = (err: unknown) => {
			const error = getTRPCErrorFromUnknown(err);
			respond({
				id: null,
				error: getErrorShape({
					...op,
					error,
					ctx,
					config: router._def._config,
				}),
			});
		};

		let result: unknown;
		try {
			result = await callProcedure({
				type: op.type,
				ctx,
				rawInput: op.input,
				path: op.path,
				procedures: opts.router._def.procedures,
			});
		} catch (e) {
			respondError(e);
			return;
		}

		if (op.type !== "subscription") {
			respond({
				id: op.id,
				result: {
					type: "data",
					data: result,
				},
			});
			return;
		} else {
			if (!isObservable(result)) {
				throw new Error("Expected subscription to be an observable");
			}
		}

		const unsub = result.subscribe({
			next: (data) => {
				respond({
					id: op.id,
					result: {
						type: "data",
						data,
					},
				});
			},
			error: respondError,
			complete: () => {
				respond({
					id: op.id,
					result: {
						type: "stopped",
					},
				});
			},
		});

		unsubMap.set(internalId, unsub);
	};
}
