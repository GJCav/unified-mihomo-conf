import { isProfile } from "../shared/profiles";
import {
  renderProfile,
  ProfileInputError,
  type ProfileSecrets,
} from "./profile";
import { PlanError, renderConfiguration } from "./legacy/render";
import {
  isAuthorized,
  isHttps,
  isValidCredentialSecret,
  splitCredentials,
} from "./auth";

interface Env extends ProfileSecrets {
  ASSETS: Fetcher;
  BASIC_AUTH_CREDENTIALS: string;
  REQUEST_RATE_LIMITER: RateLimit;
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

function tooManyRequests(): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      ...privateHeaders,
      "retry-after": "60",
    },
  });
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      ...privateHeaders,
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

    const clientIp = request.headers.get("cf-connecting-ip") ?? "local";
    const { success } = await env.REQUEST_RATE_LIMITER.limit({ key: clientIp });
    if (!success) return tooManyRequests();

    const legacy =
      url.pathname === "/config.yaml" ||
      (!url.pathname.startsWith("/v2/") && url.searchParams.get("o") === "y");
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      !legacy &&
      url.pathname !== "/health"
    ) {
      if (url.pathname === "/favicon.ico") {
        return new Response(null, {
          status: 204,
          headers: {
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
          },
        });
      }
      // Only frontend modules and Vite's client helpers are public in development.
      // The /@fs/ bridge and arbitrary virtual module IDs can name server files.
      if (
        import.meta.env.DEV &&
        /^(?:\/(?:src|shared|node_modules)\/[\w@./+-]+|\/rulesets\/rulesets\.json|\/@vite\/(?:client|env)|\/@id\/__x00__plugin-vue:export-helper|\/__vite_ping)$/.test(
          url.pathname,
        )
      ) {
        return env.ASSETS.fetch(request);
      }
      if (url.pathname === "/" || url.pathname === "/v2") {
        return new Response(null, {
          status: 302,
          headers: {
            location: "/v2/" + (url.pathname === "/v2" ? url.search : ""),
          },
        });
      }
      if (url.pathname === "/v2/" || url.pathname === "/v2/index.html") {
        url.pathname = "/v2/";
        const asset = await env.ASSETS.fetch(new Request(url, request));
        const response = new Response(asset.body, asset);
        response.headers.set("cache-control", "no-cache");
        response.headers.set("x-content-type-options", "nosniff");
        response.headers.set("referrer-policy", "no-referrer");
        response.headers.set("x-frame-options", "DENY");
        response.headers.set(
          "content-security-policy",
          "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        );
        return response;
      }
      if (
        url.pathname.startsWith("/v2/assets/") ||
        url.pathname.startsWith("/v2/rules/")
      ) {
        return env.ASSETS.fetch(request);
      }
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

    if (
      url.pathname === "/v2/sign-in" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const requested = url.searchParams.get("profile") ?? "";
      const profile = isProfile(requested) ? requested : "laptop";
      return new Response(null, {
        status: 302,
        headers: { ...privateHeaders, location: "/v2/?profile=" + profile },
      });
    }

    if (url.pathname === "/v2/auth-context") {
      return json(splitCredentials(env.BASIC_AUTH_CREDENTIALS));
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    const profileMatch = /^\/v2\/config\/([^/]+)\.yaml$/.exec(url.pathname);
    if (profileMatch || legacy) {
      try {
        let body: string;
        if (profileMatch) {
          const id = profileMatch[1];
          if (!isProfile(id))
            return new Response("Unknown profile", {
              status: 404,
              headers: privateHeaders,
            });
          body = renderProfile(id, url.searchParams, env);
        } else {
          body = renderConfiguration(
            url.searchParams,
            env.MAIN_SUBSCRIPTION_URL,
            env.DOH_URL,
            env.TAILSCALE_CONTROL_URL,
          );
        }
        return new Response(body, {
          headers: {
            "content-type": "text/yaml; charset=utf-8",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      } catch (error) {
        if (error instanceof PlanError || error instanceof ProfileInputError) {
          return json({ error: error.message }, 400);
        }
        console.error("Unable to render configuration");
        return json({ error: "Unable to render configuration" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
