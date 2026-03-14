import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router"
import App from "./App"
import "./index.css"
import { queryClient, trpc, trpcClient } from "./trpc"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </trpc.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
