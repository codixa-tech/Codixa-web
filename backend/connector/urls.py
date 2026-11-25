from django.urls import path

from . import mcp, oauth

# Mounted at the site root: Claude expects these exact paths.
urlpatterns = [
    path("mcp", mcp.mcp_endpoint, name="mcp"),
    path("mcp/", mcp.mcp_endpoint),
    path(".well-known/oauth-protected-resource", oauth.protected_resource_metadata),
    path(".well-known/oauth-protected-resource/mcp", oauth.protected_resource_metadata),
    path(".well-known/oauth-authorization-server", oauth.authorization_server_metadata),
    path(".well-known/oauth-authorization-server/mcp", oauth.authorization_server_metadata),
    path("oauth/register", oauth.register, name="oauth-register"),
    path("oauth/authorize", oauth.authorize, name="oauth-authorize"),
    path("oauth/token", oauth.token, name="oauth-token"),
    path("oauth/revoke", oauth.revoke, name="oauth-revoke"),
]
