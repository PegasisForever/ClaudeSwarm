import { mkdir } from "fs/promises"
import { basename, dirname, extname, join } from "path"

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

async function resolveUploadPath(preferredPath: string) {
  if (!(await Bun.file(preferredPath).exists())) {
    return preferredPath
  }

  const directory = dirname(preferredPath)
  const extension = extname(preferredPath)
  const filename = basename(preferredPath, extension)
  const timestamp = Date.now()
  let attempt = 0

  while (true) {
    const attemptSuffix = attempt === 0 ? "" : `-${attempt}`
    const candidatePath = join(
      directory,
      `${filename}-${timestamp}${attemptSuffix}${extension}`,
    )

    if (!(await Bun.file(candidatePath).exists())) {
      return candidatePath
    }

    attempt += 1
  }
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

  const actualPath = await resolveUploadPath(pathField)

  await mkdir(dirname(actualPath), { recursive: true })
  await Bun.write(actualPath, fileField)

  return json(
    request,
    {
      ok: true,
      actualPath,
      size: fileField.size,
      type: fileField.type,
      name: fileField.name,
      path: actualPath,
      preferredPath: pathField,
      renamed: actualPath !== pathField,
    },
    { status: 201 },
  )
}
