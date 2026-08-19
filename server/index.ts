import { PlanError, renderConfiguration } from "./render";
import {
  isAuthorized,
  isHttps,
  isValidCredentialSecret,
  splitCredentials,
} from "./auth";

interface Env {
  ASSETS: Fetcher;
  BASIC_AUTH_CREDENTIALS: string;
}

const privateHeaders = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};

function unauthorized(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      ...privateHeaders,
      "www-authenticate": 'Basic realm="Mihomo Compose", charset="UTF-8"',
    },
  });
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!isHttps(request)) {
      return new Response("HTTPS required", {
        status: 403,
        headers: privateHeaders,
      });
    }

    if (!isValidCredentialSecret(env.BASIC_AUTH_CREDENTIALS)) {
      console.error("BASIC_AUTH_CREDENTIALS is missing or malformed");
      return new Response("Authentication is not configured", {
        status: 500,
        headers: privateHeaders,
      });
    }

    if (!(await isAuthorized(request, env.BASIC_AUTH_CREDENTIALS))) {
      return unauthorized();
    }

    if (url.pathname === "/auth-context") {
      return json(splitCredentials(env.BASIC_AUTH_CREDENTIALS));
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/config.yaml" || url.searchParams.get("o") === "y") {
      try {
        const body = renderConfiguration(url.searchParams);
        return new Response(body, {
          headers: {
            "content-type": "text/yaml; charset=utf-8",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      } catch (error) {
        if (error instanceof PlanError) {
          return json({ error: error.message }, 400);
        }
        console.error(error);
        return json({ error: "Unable to render configuration" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
