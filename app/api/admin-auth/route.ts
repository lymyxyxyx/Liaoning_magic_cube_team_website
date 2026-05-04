import { NextRequest, NextResponse } from "next/server";

const adminCookieName = "liaoning_admin_session";
const adminCookieValue = "authenticated";
const adminNextCookieName = "liaoning_admin_next";

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
  }

  const payload = await readAuthPayload(request);
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next") || request.cookies.get(adminNextCookieName)?.value || null);

  if (payload.password !== adminPassword) {
    if (payload.source === "form") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login/error";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl, { status: 303 });
    }

    return NextResponse.json({ message: "Invalid password" }, { status: 401 });
  }

  const response =
    payload.source === "form"
      ? NextResponse.redirect(new URL(nextPath, request.url), { status: 303 })
      : NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, adminCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  response.cookies.delete(adminNextCookieName);

  return response;
}

async function readAuthPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      password: String(formData.get("password") || ""),
      source: "form" as const
    };
  }

  const payload = (await request.json()) as { password?: string };
  return {
    password: payload.password || "",
    source: "json" as const
  };
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin/accounts";
  if (value.startsWith("/admin/login")) return "/admin/accounts";
  return value;
}
