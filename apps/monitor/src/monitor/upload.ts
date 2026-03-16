import { mkdir } from "fs/promises"
import { dirname } from "path"

type ResponseHeaders = Headers | Record<string, string>

function buildCorsHeaders(request: Request, headers?: ResponseHeaders) {
  const responseHeaders = new Headers(headers)

  responseHeaders.set("Access-Control-Allow-Headers", "Content-Type")
  responseHeaders.set("Access-Control-Allow-Methods", "OPTIONS, POST")
  responseHeaders.set(
    "Access-Control-Allow-Origin",
    request.headers.get("origin") ?? "*",
  )
  responseHeaders.set("Vary", "Origin")

  return responseHeaders
}

function json(
  request: Request,
  data: unknown,
  init?: Omit<ResponseInit, "headers"> & { headers?: ResponseHeaders },
): Response {
  return Response.json(data, {
    ...init,
    headers: buildCorsHeaders(request, init?.headers),
  })
}

export async function handleUploadRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: buildCorsHeaders(request),
      status: 204,
    })
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: buildCorsHeaders(request, {
        Allow: "POST",
      }),
    })
  }

  const contentType = request.headers.get("content-type") ?? ""

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json(
      request,
      {
        error: "Expected a multipart/form-data request",
      },
      { status: 400 },
    )
  }

  const formData = await request.formData()
  const pathField = formData.get("path")
  const fileField = formData.get("file")

  if (typeof pathField !== "string" || pathField.length === 0) {
    return json(
      request,
      {
        error: "Missing multipart field: path",
      },
      { status: 400 },
    )
  }

  if (!(fileField instanceof File)) {
    return json(
      request,
      {
        error: "Missing multipart file field: file",
      },
      { status: 400 },
    )
  }

  await mkdir(dirname(pathField), { recursive: true })
  await Bun.write(pathField, fileField)

  return json(
    request,
    {
      ok: true,
      path: pathField,
      size: fileField.size,
      type: fileField.type,
      name: fileField.name,
    },
    { status: 201 },
  )
}
