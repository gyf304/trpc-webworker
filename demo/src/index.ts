/// <reference lib="dom" />

import * as trpc from "@trpc/client";
import type { AppRouter } from "./worker";
import { workerLink } from "trpc-webworker/client";

async function main() {
	const worker = new SharedWorker("./worker.js");
	const client = trpc.createTRPCProxyClient<AppRouter>({
		links: [workerLink(worker.port)],
	});

	const response = await client.hello.query({ name: "World" });
	document.getElementById("hello")!.innerText = response.greeting;
}

main();
