import { QueryClient } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "@repo/backend/router"

export const trpc = createTRPCReact<AppRouter>()

export const queryClient = new QueryClient()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
    }),
  ],
})
