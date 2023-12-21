/// <reference lib="webworker" />

import { initTRPC } from "@trpc/server";
import { attach } from "trpc-webworker/server";

const t = initTRPC.create();

function asType<T>(x: unknown): T {
	return x as T;
}

const appRouter = t.router({
	hello: t.procedure
		.input(asType<{ name: string }>)
		.query(({ input }) => {
			return {
				greeting: `Hello ${input.name}!`,
			};
		}),
});
export type AppRouter = typeof appRouter;

const createContext = () => {
	return {};
};

// for web worker
if (self.postMessage !== undefined) {
	attach(self, {
		router: appRouter,
		createContext,
	});
}

// for shared worker
if (self.onconnect !== undefined) {
	self.onconnect = (event) => {
		for (const port of event.ports) {
			attach(port, {
				router: appRouter,
				createContext,
			});
		}
	}
}
