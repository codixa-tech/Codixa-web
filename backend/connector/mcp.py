"""MCP endpoint (Streamable HTTP transport, JSON responses, stateless).

POST /mcp carries JSON-RPC 2.0 messages. Every request needs a valid OAuth access token; without one the
server answers 401 with a WWW-Authenticate header pointing at the protected-resource metadata, which is how
Claude discovers where to sign in.
"""
import json
import logging

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import ActivityLog
from .oauth import authenticate_bearer, base_url, client_ip
from .tools import REGISTRY, Ctx, ToolError

log = logging.getLogger(__name__)

SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
SERVER_INFO = {"name": "codixa", "title": "Codixa dashboard", "version": "1.0.0"}
INSTRUCTIONS = (
    "Codixa is Abdulrahman Mustafa's software company (projects and trainings). Use these tools to add and update "
    "projects, clients, payments, media and contract drafts in the Codixa dashboard.\n"
    "- Call get_catalog once to learn categories and custom field keys.\n"
    "- Search before creating (search_projects, search_clients) to avoid duplicates.\n"
    "- Always write both Arabic and English titles and summaries; keep summaries short and factual.\n"
    "- New projects stay hidden from the website until the user asks to publish (published=true).\n"
    "- Credentials (server IPs, users, passwords) cannot be read or written here; the user enters them in the dashboard.\n"
    "- Nothing can be deleted through this connector.\n"
    "- The store (المتجر) lists ready-made systems: create_system / update_system / add_system_image. Descriptions are HTML.\n"
    "- list_orders shows booking requests from the store and contact messages.\n"
    "- After changes, share the dashboardUrl so the user can review."
)

PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR = -32700, -32600, -32601, -32602, -32603


def _unauthorized(request):
    resp = JsonResponse({"error": "invalid_token", "error_description": "Sign in to Codixa to use this connector."}, status=401)
    resp["WWW-Authenticate"] = (
        f'Bearer realm="codixa", resource_metadata="{base_url(request)}/.well-known/oauth-protected-resource/mcp"'
    )
    resp["Cache-Control"] = "no-store"
    return resp


def _rpc_error(msg_id, code, message):
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _tool_list():
    tools = []
    for t in REGISTRY.values():
        tools.append(
            {
                "name": t.name,
                "title": t.title,
                "description": t.description,
                "inputSchema": t.schema,
                "annotations": {
                    "title": t.title,
                    "readOnlyHint": t.read_only,
                    "destructiveHint": False,
                    "idempotentHint": t.read_only,
                    "openWorldHint": t.name in ("add_project_image", "add_project_video", "add_system_image"),
                },
            }
        )
    return tools


def _summary(args: dict) -> dict:
    """What goes into the activity log: arguments without bulky or sensitive payloads."""
    out = {}
    for k, v in args.items():
        if k == "image_base64":
            out[k] = f"<{len(v)} chars>"
        elif isinstance(v, str) and len(v) > 300:
            out[k] = v[:300] + "…"
        else:
            out[k] = v
    return out


def _call_tool(ctx: Ctx, params: dict) -> dict:
    name = params.get("name")
    args = params.get("arguments") or {}
    tool = REGISTRY.get(name)
    if not tool:
        raise LookupError(name)
    if not isinstance(args, dict):
        return {"content": [{"type": "text", "text": "arguments must be an object"}], "isError": True}
    try:
        result = tool.func(ctx, args)
        ok, payload = True, result
    except ToolError as exc:
        ok, payload = False, {"error": str(exc)}
    except Exception:  # noqa: BLE001 — never leak internals to the client; log them.
        log.exception("Connector tool %s failed", name)
        ok, payload = False, {"error": "Unexpected server error. The action was not completed."}

    if not tool.read_only or not ok:
        target = ""
        if ok and isinstance(payload, dict):
            for key in ("project", "system", "client", "contract", "payment", "image", "video"):
                if isinstance(payload.get(key), dict) and payload[key].get("id"):
                    target = f"{key} #{payload[key]['id']}"
                    break
        ActivityLog.objects.create(
            user=ctx.user, source=ActivityLog.Source.CONNECTOR, action=name, target=target,
            detail=_summary(args) if ok else {**_summary(args), "error": payload["error"]}, ok=ok, ip=ctx.ip,
        )

    text = json.dumps(payload, ensure_ascii=False, default=str)
    result = {"content": [{"type": "text", "text": text}], "isError": not ok}
    if ok:
        result["structuredContent"] = payload
    return result


def _handle(ctx: Ctx, msg) -> dict | None:
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or "method" not in msg:
        return _rpc_error(msg.get("id") if isinstance(msg, dict) else None, INVALID_REQUEST, "Invalid request")
    method, msg_id, params = msg["method"], msg.get("id"), msg.get("params") or {}
    is_notification = "id" not in msg

    if method.startswith("notifications/"):
        return None
    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if requested in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0]
        result = {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
            "instructions": INSTRUCTIONS,
        }
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": _tool_list()}
    elif method == "tools/call":
        try:
            result = _call_tool(ctx, params)
        except LookupError:
            return _rpc_error(msg_id, INVALID_PARAMS, f"Unknown tool: {params.get('name')}")
    elif method in ("resources/list", "prompts/list"):
        result = {method.split("/")[0]: []}
    else:
        return None if is_notification else _rpc_error(msg_id, METHOD_NOT_FOUND, f"Method not found: {method}")
    return None if is_notification else {"jsonrpc": "2.0", "id": msg_id, "result": result}


@csrf_exempt
def mcp_endpoint(request):
    if request.method == "OPTIONS":
        return HttpResponse(status=204)
    grant = authenticate_bearer(request)
    if not grant:
        return _unauthorized(request)
    if request.method in ("GET", "DELETE"):
        # No server-initiated stream and no sessions to end.
        resp = HttpResponse(status=405)
        resp["Allow"] = "POST"
        return resp
    if request.method != "POST":
        return HttpResponse(status=405)

    try:
        body = json.loads(request.body or b"")
    except ValueError:
        return JsonResponse(_rpc_error(None, PARSE_ERROR, "Parse error"), status=400)

    ctx = Ctx(user=grant.user, base=base_url(request), ip=client_ip(request))
    if isinstance(body, list):
        if not body:
            return JsonResponse(_rpc_error(None, INVALID_REQUEST, "Empty batch"), status=400)
        replies = [r for r in (_handle(ctx, m) for m in body) if r is not None]
        return JsonResponse(replies, safe=False) if replies else HttpResponse(status=202)
    reply = _handle(ctx, body)
    if reply is None:
        return HttpResponse(status=202)
    resp = JsonResponse(reply, json_dumps_params={"ensure_ascii": False})
    resp["Cache-Control"] = "no-store"
    return resp
